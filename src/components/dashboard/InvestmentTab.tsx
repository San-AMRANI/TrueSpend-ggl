import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Plus, RefreshCw, DollarSign, BarChart3,
  Wallet as WalletIcon, Target, Calendar, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, Zap, Shield, Flame, Info, X,
  PieChart, Edit2, Trash2, Check, AlertCircle, BarChart2,
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type {
  InvestmentHolding, InvestmentPortfolioSummary, DcaPlan, Wallet, KPI,
  FIREMetrics, SafeToInvestBreakdown,
} from '../../types';
import { dashboardService } from '../../services/api/dashboardService';

const ASSET_COLORS: Record<string, string> = {
  crypto: '#f97316',
  stock: '#3b82f6',
  etf: '#8b5cf6',
  manual: '#6b7280',
};

const PALETTE = ['#6366f1','#f97316','#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#14b8a6'];

interface InvestmentTabProps {
  kpis: KPI | null;
  wallets: Wallet[];
  token: string | null;
  onDataChange?: () => void;
}

// ─── Stress Test Engine ──────────────────────────────────────────────────────
function runStressTest(
  portfolio: InvestmentPortfolioSummary | null,
  netWorth: number,
  scenarios: { label: string; pct: number }[],
) {
  if (!portfolio) return [];
  return scenarios.map((s) => ({
    label: s.label,
    investmentChange: portfolio.totalMarketValueMad * (s.pct / 100),
    newInvestmentValue: Math.max(0, portfolio.totalMarketValueMad * (1 + s.pct / 100)),
    newNetWorth: netWorth + portfolio.totalMarketValueMad * (s.pct / 100),
    pct: s.pct,
  }));
}

// ─── FIRE Calculator ─────────────────────────────────────────────────────────
function computeFIRE(
  kpis: KPI | null,
  portfolio: InvestmentPortfolioSummary | null,
  annualExpensesOverride?: number,
): FIREMetrics {
  const monthlyExpenses = kpis?.monthlyExpenses ?? 0;
  const annualExpenses = annualExpensesOverride ?? monthlyExpenses * 12;
  const fiNumber = annualExpenses * 25; // 4% SWR
  const currentNetWorth = (kpis?.netWorthTotal ?? 0);
  const progressPct = fiNumber > 0 ? Math.min(100, (currentNetWorth / fiNumber) * 100) : 0;
  const monthlyIncome = kpis?.monthlyIncome ?? 0;
  const monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
  const passiveIncome = portfolio?.passiveIncomeMonthlyMad ?? 0;
  const yearsToFIRE =
    monthlySavings > 0 && fiNumber > currentNetWorth
      ? (fiNumber - currentNetWorth) / (monthlySavings * 12)
      : null;
  return {
    annualExpenses,
    fiNumber,
    currentNetWorth,
    progressPct,
    yearsToFIRE,
    safeWithdrawalRate: 4,
    monthlyPassiveIncome: passiveIncome,
    monthlyExpensesNeeded: annualExpenses / 12,
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export const InvestmentTab: React.FC<InvestmentTabProps> = ({ kpis, wallets, token, onDataChange }) => {
  const [portfolio, setPortfolio] = useState<InvestmentPortfolioSummary | null>(null);
  const [dcaPlans, setDcaPlans] = useState<DcaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'portfolio' | 'trade' | 'dca' | 'stress' | 'fire' | 'safe'>('portfolio');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trade form state
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | 'dividend' | 'staking'>('buy');
  const [tradeForm, setTradeForm] = useState({
    symbol: '', name: '', assetType: 'crypto', walletId: '', holdingId: '',
    quantity: '', pricePerUnit: '', amount: '', date: '', notes: '',
  });

  // New holding form
  const [showNewHolding, setShowNewHolding] = useState(false);
  const [holdingForm, setHoldingForm] = useState({
    symbol: '', name: '', assetType: 'crypto', walletId: '',
    quantity: '', avgCostBasis: '', currency: 'USD',
  });

  // DCA form
  const [showDcaForm, setShowDcaForm] = useState(false);
  const [dcaForm, setDcaForm] = useState({
    symbol: '', assetName: '', assetType: 'crypto', walletId: '',
    amount: '', currency: 'MAD', frequency: 'monthly', nextDate: '',
  });

  // Stress test
  const [stressSlider, setStressSlider] = useState(-30);

  // FIRE
  const [fireAnnualExpenses, setFireAnnualExpenses] = useState('');

  // Manual price
  const [manualPriceForm, setManualPriceForm] = useState({ symbol: '', assetType: 'manual', priceUsd: '' });
  const [showManualPrice, setShowManualPrice] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const brokerageWallets = useMemo(() => wallets.filter(w => w.type === 'Brokerage'), [wallets]);
  const liquidWallets = useMemo(() => wallets.filter(w => w.type !== 'Brokerage'), [wallets]);

  const fetchPortfolio = useCallback(async () => {
    if (!token) return;
    try {
      const [portfolioData, dcaData] = await Promise.all([
        dashboardService.getPortfolio(token),
        dashboardService.getDcaPlans(token),
      ]);
      setPortfolio(portfolioData);
      setDcaPlans(dcaData || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  const handleRefreshPrices = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await dashboardService.refreshInvestmentPrices(token);
      await fetchPortfolio();
      showToast('Prices refreshed successfully');
    } catch (e: any) {
      showToast('Failed to refresh prices');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await dashboardService.createHolding({
        ...holdingForm,
        quantity: parseFloat(holdingForm.quantity) || 0,
        avgCostBasis: parseFloat(holdingForm.avgCostBasis) || 0,
      }, token);
      setShowNewHolding(false);
      setHoldingForm({ symbol: '', name: '', assetType: 'crypto', walletId: '', quantity: '', avgCostBasis: '', currency: 'USD' });
      await fetchPortfolio();
      showToast('Holding added');
    } catch (e: any) {
      showToast(e.message || 'Failed to add holding');
    }
  };

  const handleDeleteHolding = async (id: string, symbol: string) => {
    if (!token || !confirm(`Delete ${symbol} holding?`)) return;
    try {
      await dashboardService.deleteHolding(id, token);
      await fetchPortfolio();
      onDataChange?.();
      showToast(`${symbol} removed`);
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      if (tradeMode === 'buy') {
        await dashboardService.executeBuyOrder({
          walletId: tradeForm.walletId,
          symbol: tradeForm.symbol,
          name: tradeForm.name || tradeForm.symbol,
          assetType: tradeForm.assetType,
          holdingId: tradeForm.holdingId || undefined,
          quantity: parseFloat(tradeForm.quantity),
          pricePerUnit: parseFloat(tradeForm.pricePerUnit),
          date: tradeForm.date || undefined,
          notes: tradeForm.notes || undefined,
        }, token);
        showToast(`✅ Buy order recorded for ${tradeForm.symbol}`);
      } else if (tradeMode === 'sell') {
        const result = await dashboardService.executeSellOrder({
          holdingId: tradeForm.holdingId,
          walletId: tradeForm.walletId,
          quantity: parseFloat(tradeForm.quantity),
          pricePerUnit: parseFloat(tradeForm.pricePerUnit),
          date: tradeForm.date || undefined,
          notes: tradeForm.notes || undefined,
        }, token);
        showToast(`✅ Sold. Realized P&L: ${result?.realizedGainLoss?.toFixed(2)} MAD`);
      } else if (tradeMode === 'dividend') {
        await dashboardService.recordDividend({
          holdingId: tradeForm.holdingId,
          walletId: tradeForm.walletId,
          amount: parseFloat(tradeForm.amount),
          date: tradeForm.date || undefined,
          notes: tradeForm.notes || undefined,
        }, token);
        showToast('💰 Dividend income recorded');
      } else if (tradeMode === 'staking') {
        await dashboardService.recordStakingYield({
          holdingId: tradeForm.holdingId,
          walletId: tradeForm.walletId,
          quantity: tradeForm.quantity ? parseFloat(tradeForm.quantity) : undefined,
          amount: tradeForm.amount ? parseFloat(tradeForm.amount) : undefined,
          pricePerUnit: tradeForm.pricePerUnit ? parseFloat(tradeForm.pricePerUnit) : undefined,
          date: tradeForm.date || undefined,
          notes: tradeForm.notes || undefined,
        }, token);
        showToast('🌱 Staking yield recorded');
      }
      await fetchPortfolio();
      onDataChange?.();
      setTradeForm({ symbol: '', name: '', assetType: 'crypto', walletId: '', holdingId: '', quantity: '', pricePerUnit: '', amount: '', date: '', notes: '' });
    } catch (e: any) {
      showToast(e.message || 'Trade failed');
    }
  };

  const handleCreateDca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await dashboardService.createDcaPlan(dcaForm, token);
      setShowDcaForm(false);
      setDcaForm({ symbol: '', assetName: '', assetType: 'crypto', walletId: '', amount: '', currency: 'MAD', frequency: 'monthly', nextDate: '' });
      await fetchPortfolio();
      showToast('DCA plan created');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleDeleteDca = async (id: string) => {
    if (!token) return;
    try {
      await dashboardService.deleteDcaPlan(id, token);
      await fetchPortfolio();
      showToast('DCA plan removed');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const handleManualPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await dashboardService.setManualPrice({
        symbol: manualPriceForm.symbol,
        assetType: manualPriceForm.assetType,
        priceUsd: parseFloat(manualPriceForm.priceUsd),
      }, token);
      setShowManualPrice(false);
      await fetchPortfolio();
      showToast('Price updated');
    } catch (e: any) {
      showToast(e.message);
    }
  };

  const fire = useMemo(
    () => computeFIRE(kpis, portfolio, fireAnnualExpenses ? parseFloat(fireAnnualExpenses) : undefined),
    [kpis, portfolio, fireAnnualExpenses],
  );

  const stressScenarios = useMemo(() => runStressTest(portfolio, kpis?.netWorthTotal ?? 0, [
    { label: 'Custom', pct: stressSlider },
    { label: '-20% Correction', pct: -20 },
    { label: '-40% Bear', pct: -40 },
    { label: '-60% Crash', pct: -60 },
    { label: '+20% Bull', pct: 20 },
    { label: '+50% Bull Run', pct: 50 },
  ]), [portfolio, kpis?.netWorthTotal, stressSlider]);

  const safeToInvest = kpis?.safeToInvestBreakdown;

  const allocationData = useMemo(() => {
    if (!portfolio?.holdings?.length) return [];
    const byType: Record<string, number> = {};
    for (const h of portfolio.holdings) {
      const val = h.marketValueMad ?? 0;
      byType[h.assetType] = (byType[h.assetType] ?? 0) + val;
    }
    return Object.entries(byType).map(([type, value]) => ({ name: type, value: Math.round(value) }));
  }, [portfolio]);

  const sectionBtns: { id: typeof activeSection; label: string; icon: any }[] = [
    { id: 'portfolio', label: 'Portfolio', icon: BarChart3 },
    { id: 'trade', label: 'Trade', icon: ArrowUpRight },
    { id: 'dca', label: 'DCA Plans', icon: Calendar },
    { id: 'stress', label: 'Stress Test', icon: AlertCircle },
    { id: 'fire', label: 'FIRE', icon: Flame },
    { id: 'safe', label: 'Safe to Invest', icon: Shield },
  ];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-gray-800" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm shadow-xl animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" /> Investment Hub
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Portfolio · Trading · DCA · FIRE · Stress Testing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshPrices} disabled={refreshing} className="flex items-center gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Prices
          </Button>
          <Button size="sm" onClick={() => setShowNewHolding(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Add Holding
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-0">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-indigo-200 font-medium">Portfolio Value</p>
            <p className="text-2xl font-bold mt-1">{(portfolio?.totalMarketValueMad ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-indigo-200 mt-0.5">MAD</p>
          </CardContent>
        </Card>
        <Card className={`border-0 ${(portfolio?.totalUnrealizedGainLoss ?? 0) >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white`}>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-white/80 font-medium">Unrealized P&L</p>
            <p className="text-2xl font-bold mt-1">
              {(portfolio?.totalUnrealizedGainLoss ?? 0) >= 0 ? '+' : ''}{(portfolio?.totalUnrealizedGainLoss ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-white/80 mt-0.5">{(portfolio?.totalUnrealizedGainLossPct ?? 0).toFixed(2)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Invested</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{(portfolio?.totalInvestedMad ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-gray-400 mt-0.5">MAD cost basis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Holdings</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{portfolio?.holdings?.length ?? 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">assets tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Section Nav */}
      <div className="flex gap-1.5 flex-wrap">
        {sectionBtns.map(btn => (
          <button
            key={btn.id}
            onClick={() => setActiveSection(btn.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeSection === btn.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <btn.icon className="h-3.5 w-3.5" />
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── PORTFOLIO SECTION ─────────────────────────────────────────────── */}
      {activeSection === 'portfolio' && (
        <div className="space-y-4">
          {/* Allocation Chart */}
          {allocationData.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Asset Allocation</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <RePieChart>
                      <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {allocationData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `${v.toLocaleString()} MAD`} />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Holdings P&L</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={(portfolio?.holdings ?? []).slice(0, 8).map(h => ({ name: h.symbol, pl: Math.round(h.unrealizedGainLoss ?? 0) }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => `${v.toLocaleString()} MAD`} />
                      <Bar dataKey="pl" name="P&L" fill="#6366f1" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Holdings Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Holdings</CardTitle>
              <div className="flex gap-2">
                <button onClick={() => setShowManualPrice(!showManualPrice)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200">Set Price</button>
              </div>
            </CardHeader>
            <CardContent>
              {showManualPrice && (
                <form onSubmit={handleManualPrice} className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Symbol</label>
                    <Input value={manualPriceForm.symbol} onChange={e => setManualPriceForm(p => ({...p, symbol: e.target.value}))} placeholder="BTC" className="w-24 mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Type</label>
                    <Select value={manualPriceForm.assetType} onChange={e => setManualPriceForm(p => ({...p, assetType: e.target.value}))} className="mt-1">
                      <option value="crypto">Crypto</option>
                      <option value="stock">Stock</option>
                      <option value="etf">ETF</option>
                      <option value="manual">Manual</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Price (USD)</label>
                    <Input type="number" step="any" value={manualPriceForm.priceUsd} onChange={e => setManualPriceForm(p => ({...p, priceUsd: e.target.value}))} placeholder="0.00" className="w-28 mt-1" />
                  </div>
                  <Button type="submit" size="sm" className="bg-amber-600 text-white hover:bg-amber-700">Set</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowManualPrice(false)}>Cancel</Button>
                </form>
              )}

              {!portfolio?.holdings?.length ? (
                <div className="py-12 text-center">
                  <PieChart className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">No holdings yet. Add your first asset.</p>
                  <Button size="sm" className="mt-3 bg-indigo-600 text-white" onClick={() => setShowNewHolding(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Holding
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                        <th className="pb-2 px-2">Asset</th>
                        <th className="pb-2 px-2 text-right">Qty</th>
                        <th className="pb-2 px-2 text-right">Avg Cost</th>
                        <th className="pb-2 px-2 text-right">Price (MAD)</th>
                        <th className="pb-2 px-2 text-right">Value</th>
                        <th className="pb-2 px-2 text-right">P&L</th>
                        <th className="pb-2 px-2 text-right">P&L %</th>
                        <th className="pb-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {portfolio.holdings.map((h) => {
                        const qty = parseFloat(h.quantity);
                        const avg = parseFloat(h.avgCostBasis);
                        const pnl = h.unrealizedGainLoss ?? 0;
                        const pnlPct = h.unrealizedGainLossPct ?? 0;
                        return (
                          <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full`} style={{ backgroundColor: ASSET_COLORS[h.assetType] ?? '#6b7280' }} />
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">{h.symbol}</p>
                                  <p className="text-[11px] text-gray-400 truncate max-w-[120px]">{h.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                            <td className="py-3 px-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{avg.toFixed(2)} {h.currency}</td>
                            <td className="py-3 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {h.currentPriceMad !== undefined ? h.currentPriceMad.toFixed(2) : '—'}
                            </td>
                            <td className="py-3 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                              {h.marketValueMad !== undefined ? h.marketValueMad.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
                            </td>
                            <td className={`py-3 px-2 text-right tabular-nums font-semibold ${pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td className={`py-3 px-2 text-right tabular-nums text-sm ${pnlPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                            </td>
                            <td className="py-3 px-2 text-right">
                              <button onClick={() => handleDeleteHolding(h.id, h.symbol)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TRADE SECTION ─────────────────────────────────────────────────── */}
      {activeSection === 'trade' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execute Trade / Record Income</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mode Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {(['buy','sell','dividend','staking'] as const).map(mode => (
                <button key={mode} onClick={() => setTradeMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${tradeMode === mode ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  {mode === 'buy' ? '📈 Buy' : mode === 'sell' ? '📉 Sell' : mode === 'dividend' ? '💰 Dividend' : '🌱 Staking'}
                </button>
              ))}
            </div>

            <form onSubmit={handleTrade} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              {(tradeMode === 'buy') && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Symbol *</label>
                    <Input value={tradeForm.symbol} onChange={e => setTradeForm(p => ({...p, symbol: e.target.value.toUpperCase()}))} placeholder="BTC, AAPL, SPY…" className="mt-1" required />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Name</label>
                    <Input value={tradeForm.name} onChange={e => setTradeForm(p => ({...p, name: e.target.value}))} placeholder="Bitcoin" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Type</label>
                    <Select value={tradeForm.assetType} onChange={e => setTradeForm(p => ({...p, assetType: e.target.value}))} className="mt-1">
                      <option value="crypto">Crypto</option>
                      <option value="stock">Stock</option>
                      <option value="etf">ETF</option>
                      <option value="manual">Manual / Other</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Source Wallet (cash) *</label>
                    <Select value={tradeForm.walletId} onChange={e => setTradeForm(p => ({...p, walletId: e.target.value}))} className="mt-1" required>
                      <option value="">Select wallet…</option>
                      {liquidWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </Select>
                  </div>
                </>
              )}

              {(tradeMode === 'sell' || tradeMode === 'dividend' || tradeMode === 'staking') && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Holding *</label>
                  <Select value={tradeForm.holdingId} onChange={e => setTradeForm(p => ({...p, holdingId: e.target.value}))} className="mt-1 w-full" required>
                    <option value="">Select holding…</option>
                    {(portfolio?.holdings ?? []).map(h => <option key={h.id} value={h.id}>{h.symbol} – {h.name} (qty: {parseFloat(h.quantity).toLocaleString()})</option>)}
                  </Select>
                </div>
              )}

              {(tradeMode === 'sell') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Destination Wallet *</label>
                  <Select value={tradeForm.walletId} onChange={e => setTradeForm(p => ({...p, walletId: e.target.value}))} className="mt-1" required>
                    <option value="">Select wallet…</option>
                    {liquidWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </div>
              )}

              {(tradeMode === 'dividend' || tradeMode === 'staking') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Wallet (receive to) *</label>
                  <Select value={tradeForm.walletId} onChange={e => setTradeForm(p => ({...p, walletId: e.target.value}))} className="mt-1" required>
                    <option value="">Select wallet…</option>
                    {liquidWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </div>
              )}

              {(tradeMode === 'buy' || tradeMode === 'sell' || tradeMode === 'staking') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Quantity *</label>
                  <Input type="number" step="any" min="0" value={tradeForm.quantity} onChange={e => setTradeForm(p => ({...p, quantity: e.target.value}))} placeholder="0.001" className="mt-1" required />
                </div>
              )}

              {(tradeMode === 'buy' || tradeMode === 'sell') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Price per unit (MAD) *</label>
                  <Input type="number" step="any" min="0" value={tradeForm.pricePerUnit} onChange={e => setTradeForm(p => ({...p, pricePerUnit: e.target.value}))} placeholder="0.00" className="mt-1" required />
                </div>
              )}

              {(tradeMode === 'dividend' || tradeMode === 'staking') && (
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Amount (MAD) *</label>
                  <Input type="number" step="any" min="0" value={tradeForm.amount} onChange={e => setTradeForm(p => ({...p, amount: e.target.value}))} placeholder="0.00" className="mt-1" required={tradeMode === 'dividend'} />
                </div>
              )}

              {(tradeMode === 'staking') && tradeForm.quantity && tradeForm.pricePerUnit && (
                <div className="sm:col-span-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-2">
                  Staking yield value ≈ {(parseFloat(tradeForm.quantity || '0') * parseFloat(tradeForm.pricePerUnit || '0')).toFixed(2)} MAD
                </div>
              )}

              {tradeMode === 'buy' && tradeForm.quantity && tradeForm.pricePerUnit && (
                <div className="sm:col-span-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 p-3 text-sm">
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">Total: </span>
                  <span className="text-indigo-600">{(parseFloat(tradeForm.quantity) * parseFloat(tradeForm.pricePerUnit)).toFixed(2)} MAD</span>
                  <span className="text-gray-400 ml-2">will be deducted from your wallet</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Date (optional)</label>
                <Input type="date" value={tradeForm.date} onChange={e => setTradeForm(p => ({...p, date: e.target.value}))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <Input value={tradeForm.notes} onChange={e => setTradeForm(p => ({...p, notes: e.target.value}))} placeholder="Optional note" className="mt-1" />
              </div>

              <div className="sm:col-span-2 flex gap-3 pt-2">
                <Button type="submit" className={`${tradeMode === 'buy' ? 'bg-emerald-600 hover:bg-emerald-700' : tradeMode === 'sell' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}>
                  {tradeMode === 'buy' ? '📈 Record Buy' : tradeMode === 'sell' ? '📉 Record Sell' : tradeMode === 'dividend' ? '💰 Record Dividend' : '🌱 Record Yield'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── DCA PLANS ─────────────────────────────────────────────────────── */}
      {activeSection === 'dca' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Dollar-Cost Averaging Plans</CardTitle>
              <Button size="sm" onClick={() => setShowDcaForm(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> New Plan
              </Button>
            </CardHeader>
            <CardContent>
              {showDcaForm && (
                <form onSubmit={handleCreateDca} className="mb-6 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-white">New DCA Plan</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Symbol *</label>
                      <Input value={dcaForm.symbol} onChange={e => setDcaForm(p => ({...p, symbol: e.target.value.toUpperCase()}))} placeholder="BTC" className="mt-1" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Name *</label>
                      <Input value={dcaForm.assetName} onChange={e => setDcaForm(p => ({...p, assetName: e.target.value}))} placeholder="Bitcoin" className="mt-1" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Type</label>
                      <Select value={dcaForm.assetType} onChange={e => setDcaForm(p => ({...p, assetType: e.target.value}))} className="mt-1">
                        <option value="crypto">Crypto</option>
                        <option value="stock">Stock</option>
                        <option value="etf">ETF</option>
                        <option value="manual">Manual</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Wallet</label>
                      <Select value={dcaForm.walletId} onChange={e => setDcaForm(p => ({...p, walletId: e.target.value}))} className="mt-1">
                        <option value="">Select…</option>
                        {liquidWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Amount (MAD) *</label>
                      <Input type="number" step="any" value={dcaForm.amount} onChange={e => setDcaForm(p => ({...p, amount: e.target.value}))} placeholder="500" className="mt-1" required />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Frequency</label>
                      <Select value={dcaForm.frequency} onChange={e => setDcaForm(p => ({...p, frequency: e.target.value}))} className="mt-1">
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Next Date *</label>
                      <Input type="date" value={dcaForm.nextDate} onChange={e => setDcaForm(p => ({...p, nextDate: e.target.value}))} className="mt-1" required />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">Create Plan</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowDcaForm(false)}>Cancel</Button>
                  </div>
                </form>
              )}

              {!dcaPlans.length ? (
                <div className="py-10 text-center">
                  <Calendar className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">No DCA plans yet. Set up automatic investing.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dcaPlans.map(plan => (
                    <div key={plan.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: ASSET_COLORS[plan.assetType] ?? '#6b7280' }} />
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{plan.symbol} <span className="font-normal text-gray-400">— {plan.assetName}</span></p>
                          <p className="text-xs text-gray-500">{parseFloat(plan.amount).toLocaleString()} {plan.currency} · {plan.frequency} · Next: {plan.nextDate}</p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteDca(plan.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── STRESS TEST ────────────────────────────────────────────────────── */}
      {activeSection === 'stress' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Portfolio Volatility Stress Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Custom Scenario: {stressSlider > 0 ? '+' : ''}{stressSlider}%</label>
                  <span className={`text-sm font-bold ${stressSlider >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stressSlider >= 0 ? '+' : ''}{((portfolio?.totalMarketValueMad ?? 0) * stressSlider / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                  </span>
                </div>
                <input type="range" min="-80" max="100" step="5" value={stressSlider}
                  onChange={e => setStressSlider(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>−80%</span><span>0%</span><span>+100%</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stressScenarios.map(s => (
                  <div key={s.label} className={`rounded-xl p-4 border ${s.pct < 0 ? 'border-red-100 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20' : 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{s.label}</p>
                    <p className={`text-xl font-bold mt-1 ${s.pct < 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {s.pct >= 0 ? '+' : ''}{s.pct}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Portfolio: <span className="font-semibold">{s.newInvestmentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Net Worth: {s.newNetWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold flex items-center gap-1.5"><Info className="h-4 w-4" /> Interpretation</p>
                <p className="mt-1 text-xs">These scenarios show how your net worth changes if the investment portfolio drops or rises by the given percentage. Your liquid cash (Bank, Cash, Savings) is unaffected.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── FIRE CALCULATOR ───────────────────────────────────────────────── */}
      {activeSection === 'fire' && (
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-100 dark:border-orange-900/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" /> FIRE Calculator — Financial Independence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="max-w-xs">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Annual Expenses (MAD) — override</label>
                <Input
                  type="number" step="any"
                  value={fireAnnualExpenses}
                  onChange={e => setFireAnnualExpenses(e.target.value)}
                  placeholder={`${((kpis?.monthlyExpenses ?? 0) * 12).toFixed(0)} (from transactions)`}
                  className="mt-1"
                />
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'FI Number (25× expenses)', value: fire.fiNumber.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' MAD', color: 'text-orange-700 dark:text-orange-400' },
                  { label: 'Current Net Worth', value: fire.currentNetWorth.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' MAD', color: 'text-indigo-700 dark:text-indigo-400' },
                  { label: 'Progress to FIRE', value: fire.progressPct.toFixed(1) + '%', color: fire.progressPct >= 100 ? 'text-emerald-600' : 'text-amber-600' },
                  { label: 'Years to FIRE', value: fire.yearsToFIRE !== null ? fire.yearsToFIRE.toFixed(1) + ' years' : 'Set a savings rate', color: 'text-gray-700 dark:text-gray-300' },
                  { label: 'Safe Withdrawal Rate', value: fire.safeWithdrawalRate + '%', color: 'text-gray-700 dark:text-gray-300' },
                  { label: 'Monthly Passive Income', value: fire.monthlyPassiveIncome.toFixed(0) + ' MAD', color: 'text-emerald-600' },
                ].map(item => (
                  <div key={item.label} className="bg-white dark:bg-gray-900/60 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.label}</p>
                    <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>0</span>
                  <span className="font-medium">{fire.progressPct.toFixed(1)}% to FI</span>
                  <span>{fire.fiNumber.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD</span>
                </div>
                <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                    style={{ width: `${Math.min(100, fire.progressPct)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-white dark:bg-gray-900/40 border border-orange-100 dark:border-orange-900/30 p-4 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                <p><span className="font-semibold">FI Number</span> = Annual Expenses × 25 (4% Safe Withdrawal Rate rule)</p>
                <p><span className="font-semibold">Years to FIRE</span> = (FI Number − Net Worth) ÷ Annual Savings</p>
                <p><span className="font-semibold">Net Worth</span> = Liquid Cash + Investment Portfolio + Receivables − Payables</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SAFE TO INVEST ────────────────────────────────────────────────── */}
      {activeSection === 'safe' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" /> Safe-to-Invest Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!safeToInvest ? (
              <p className="text-sm text-gray-500 py-6 text-center">Set up your salary and payroll to see safe-to-invest analysis.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: '📊 Monthly Salary', value: safeToInvest.salary, color: 'text-indigo-600', sign: '+' },
                    { label: '🏠 Fixed Bills', value: safeToInvest.fixedBills, color: 'text-red-500', sign: '−' },
                    { label: '💳 Loans & Payables', value: safeToInvest.loans, color: 'text-red-500', sign: '−' },
                    { label: '🛒 Groceries', value: safeToInvest.groceries, color: 'text-orange-500', sign: '−' },
                    { label: '🛡 Emergency Buffer', value: safeToInvest.emergencyBuffer, color: 'text-amber-500', sign: '−' },
                    { label: '📅 Projected Cash Needs', value: safeToInvest.projectedCashNeeds, color: 'text-gray-500', sign: '−' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{row.label}</span>
                      <span className={`text-sm font-semibold tabular-nums ${row.color}`}>
                        {row.sign} {row.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                      </span>
                    </div>
                  ))}
                </div>

                <div className={`rounded-xl p-5 border-2 ${safeToInvest.safeToInvest > 0 ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Safe to Invest This Month</p>
                  <p className={`text-3xl font-bold mt-1 ${safeToInvest.safeToInvest > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {safeToInvest.safeToInvest.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                  </p>
                  <p className="text-xs text-gray-500 mt-1">After covering all obligations and buffers</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── New Holding Modal ─────────────────────────────────────────────── */}
      {showNewHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Add Investment Holding</h3>
              <button onClick={() => setShowNewHolding(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleCreateHolding} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Symbol *</label>
                  <Input value={holdingForm.symbol} onChange={e => setHoldingForm(p => ({...p, symbol: e.target.value.toUpperCase()}))} placeholder="BTC" className="mt-1" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Name *</label>
                  <Input value={holdingForm.name} onChange={e => setHoldingForm(p => ({...p, name: e.target.value}))} placeholder="Bitcoin" className="mt-1" required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Type</label>
                  <Select value={holdingForm.assetType} onChange={e => setHoldingForm(p => ({...p, assetType: e.target.value}))} className="mt-1">
                    <option value="crypto">Crypto</option>
                    <option value="stock">Stock</option>
                    <option value="etf">ETF</option>
                    <option value="manual">Manual</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Brokerage Wallet *</label>
                  <Select value={holdingForm.walletId} onChange={e => setHoldingForm(p => ({...p, walletId: e.target.value}))} className="mt-1" required>
                    <option value="">Select…</option>
                    {brokerageWallets.length ? brokerageWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>) : wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Quantity</label>
                  <Input type="number" step="any" value={holdingForm.quantity} onChange={e => setHoldingForm(p => ({...p, quantity: e.target.value}))} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Avg Cost Basis</label>
                  <Input type="number" step="any" value={holdingForm.avgCostBasis} onChange={e => setHoldingForm(p => ({...p, avgCostBasis: e.target.value}))} placeholder="0.00" className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cost Currency</label>
                  <Select value={holdingForm.currency} onChange={e => setHoldingForm(p => ({...p, currency: e.target.value}))} className="mt-1">
                    <option value="USD">USD</option>
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-700 flex-1">Add Holding</Button>
                <Button type="button" variant="outline" onClick={() => setShowNewHolding(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
