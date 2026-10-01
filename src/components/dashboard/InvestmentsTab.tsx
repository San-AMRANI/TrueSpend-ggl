import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Coins,
  DollarSign,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Layers,
  Percent,
  Sliders,
  Award,
  Wallet as WalletIcon,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  History,
  Activity,
  PieChart,
  Zap,
  ArrowRightLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  InvestmentsData,
  InvestmentHolding,
  InvestmentTransaction,
  DcaPlan,
  Wallet,
  InvestmentAssetType,
  InvestmentTradeType,
  KPI,
  Debt,
} from '../../types';

interface InvestmentsTabProps {
  data: InvestmentsData | null;
  loading: boolean;
  wallets: Wallet[];
  kpis: KPI | null;
  debts: Debt[];
  onRefresh: () => Promise<void>;
  onCreateHolding: (payload: Partial<InvestmentHolding>) => Promise<any>;
  onUpdateHolding: (id: string, payload: Partial<InvestmentHolding>) => Promise<any>;
  onDeleteHolding: (id: string) => Promise<any>;
  onExecuteTrade: (payload: {
    holdingId: string;
    type: InvestmentTradeType;
    units?: number;
    pricePerUnit?: number;
    totalAmount?: number;
    fees?: number;
    walletId?: string | null;
    notes?: string;
  }) => Promise<any>;
  onCreateDcaPlan: (payload: Partial<DcaPlan>) => Promise<any>;
  onUpdateDcaPlan: (id: string, payload: Partial<DcaPlan>) => Promise<any>;
  onDeleteDcaPlan: (id: string) => Promise<any>;
}

type SubTab = 'holdings' | 'safe-to-invest' | 'allocation' | 'stress-test' | 'ledger';

const POPULAR_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', assetType: 'crypto', currency: 'USD' },
  { symbol: 'ETH', name: 'Ethereum', assetType: 'crypto', currency: 'USD' },
  { symbol: 'SOL', name: 'Solana', assetType: 'crypto', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', assetType: 'etf', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq 100)', assetType: 'etf', currency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', assetType: 'stock', currency: 'USD' },
  { symbol: 'ATW', name: 'Attijariwafa Bank (BVC)', assetType: 'bourse_local', currency: 'MAD' },
  { symbol: 'BCP', name: 'Banque Centrale Populaire', assetType: 'bourse_local', currency: 'MAD' },
  { symbol: 'IAM', name: 'Maroc Telecom', assetType: 'bourse_local', currency: 'MAD' },
  { symbol: 'GOLD', name: 'Physical Gold / Precious Metals', assetType: 'commodity', currency: 'USD' },
];

const NET_WORTH_MILESTONES = [
  { threshold: 10000, label: '10K MAD Club', icon: '🥉' },
  { threshold: 50000, label: '50K MAD Milestone', icon: '🥈' },
  { threshold: 100000, label: '100K MAD Wealth Builder', icon: '🥇' },
  { threshold: 250000, label: 'Quarter Million MAD', icon: '💎' },
  { threshold: 500000, label: 'Half Million MAD', icon: '👑' },
  { threshold: 1000000, label: '1 Million MAD Capitalist', icon: '🚀' },
];

export const InvestmentsTab: React.FC<InvestmentsTabProps> = ({
  data,
  loading,
  wallets,
  kpis,
  debts,
  onRefresh,
  onCreateHolding,
  onUpdateHolding,
  onDeleteHolding,
  onExecuteTrade,
  onCreateDcaPlan,
  onUpdateDcaPlan,
  onDeleteDcaPlan,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('holdings');
  const [displayCurrency, setDisplayCurrency] = useState<'MAD' | 'USD' | 'EUR'>('MAD');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);
  const [tradeModalHolding, setTradeModalHolding] = useState<InvestmentHolding | null>(null);
  const [tradeType, setTradeType] = useState<InvestmentTradeType>('BUY');
  const [showDcaModal, setShowDcaModal] = useState(false);

  // Trade form state
  const [tradeUnits, setTradeUnits] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeTotal, setTradeTotal] = useState('');
  const [tradeFees, setTradeFees] = useState('0');
  const [tradeWalletId, setTradeWalletId] = useState('');
  const [tradeNotes, setTradeNotes] = useState('');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Holding form state
  const [holdingForm, setHoldingForm] = useState({
    symbol: '',
    name: '',
    assetType: 'crypto' as InvestmentAssetType,
    units: '',
    buyPriceAvg: '',
    currentPrice: '',
    currency: 'USD',
    walletId: '',
    targetAllocationPercent: '0',
    dividendYieldPercent: '0',
    notes: '',
  });
  const [holdingSubmitting, setHoldingSubmitting] = useState(false);
  const [holdingError, setHoldingError] = useState<string | null>(null);

  // DCA form state
  const [dcaForm, setDcaForm] = useState({
    symbol: 'BTC',
    assetName: 'Bitcoin',
    assetType: 'crypto' as InvestmentAssetType,
    targetAmount: '500',
    currency: 'MAD',
    frequency: 'post_payday' as 'daily' | 'weekly' | 'monthly' | 'post_payday',
    dayOffsetAfterPayday: 2,
    walletId: '',
  });
  const [dcaSubmitting, setDcaSubmitting] = useState(false);
  const [dcaError, setDcaError] = useState<string | null>(null);

  // Stress-Test sliders
  const [cryptoDrop, setCryptoDrop] = useState<number>(30); // percentage drop
  const [equitiesDrop, setEquitiesDrop] = useState<number>(15);

  const rates = useMemo(() => {
    return data?.rates || { USD_TO_MAD: 10.05, EUR_TO_MAD: 10.95, USD_TO_EUR: 0.92 };
  }, [data?.rates]);

  // Convert MAD value to user's selected display currency
  const formatAmount = (madAmount: number) => {
    if (displayCurrency === 'USD') {
      const usd = madAmount / rates.USD_TO_MAD;
      return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (displayCurrency === 'EUR') {
      const eur = madAmount / rates.EUR_TO_MAD;
      return `€${eur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${madAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
  };

  const handleRefreshQuotes = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Debts and net worth calculations
  const pendingReceivables = useMemo(() => {
    return debts
      .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
      .reduce((sum, d) => sum + (parseFloat(d.remainingBalance) || 0), 0);
  }, [debts]);

  const pendingPayables = useMemo(() => {
    return debts
      .filter((d) => d.type === 'Payable' && d.status === 'Pending')
      .reduce((sum, d) => sum + (parseFloat(d.remainingBalance) || 0), 0);
  }, [debts]);

  const totalLiquidCash = kpis?.totalLiquidity || 0;
  const totalInvestmentMad = data?.totalPortfolioValueMad || 0;
  const netWorthMad = totalLiquidCash + totalInvestmentMad + pendingReceivables - pendingPayables;

  // Next milestone
  const currentMilestone = NET_WORTH_MILESTONES.slice().reverse().find((m) => netWorthMad >= m.threshold);
  const nextMilestone = NET_WORTH_MILESTONES.find((m) => netWorthMad < m.threshold);
  const milestoneProgress = nextMilestone
    ? Math.min(100, Math.max(0, (netWorthMad / nextMilestone.threshold) * 100))
    : 100;

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    if (!data?.holdings) return [];
    return data.holdings.filter((h) => {
      const matchesType =
        assetFilter === 'all' ||
        (assetFilter === 'crypto' && h.assetType === 'crypto') ||
        (assetFilter === 'stocks' && (h.assetType === 'stock' || h.assetType === 'etf')) ||
        (assetFilter === 'bourse_local' && h.assetType === 'bourse_local') ||
        (assetFilter === 'other' && ['commodity', 'real_estate', 'custom'].includes(h.assetType));

      const matchesSearch =
        !searchQuery ||
        h.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [data?.holdings, assetFilter, searchQuery]);

  // Asset class breakdown
  const allocationBreakdown = useMemo(() => {
    if (!data?.holdings || data.holdings.length === 0) return [];
    const groups: Record<string, { label: string; totalMad: number; count: number; color: string }> = {
      crypto: { label: 'Crypto Assets', totalMad: 0, count: 0, color: 'bg-amber-500' },
      stock: { label: 'Equities & Stocks', totalMad: 0, count: 0, color: 'bg-blue-500' },
      etf: { label: 'Index & ETFs', totalMad: 0, count: 0, color: 'bg-indigo-500' },
      bourse_local: { label: 'Bourse de Casablanca', totalMad: 0, count: 0, color: 'bg-emerald-500' },
      commodity: { label: 'Commodities & Gold', totalMad: 0, count: 0, color: 'bg-yellow-500' },
      real_estate: { label: 'Real Estate / Land', totalMad: 0, count: 0, color: 'bg-orange-500' },
      custom: { label: 'Private / Custom', totalMad: 0, count: 0, color: 'bg-purple-500' },
    };

    let totalVal = 0;
    for (const h of data.holdings) {
      const units = parseFloat(h.units || '0') || 0;
      const price = parseFloat(h.currentPrice || '0') || 0;
      const localVal = units * price;
      let madVal = localVal;
      if (h.currency === 'USD') madVal = localVal * rates.USD_TO_MAD;
      else if (h.currency === 'EUR') madVal = localVal * rates.EUR_TO_MAD;

      const group = groups[h.assetType] || groups.custom;
      group.totalMad += madVal;
      group.count += 1;
      totalVal += madVal;
    }

    return Object.entries(groups)
      .filter(([_, g]) => g.totalMad > 0)
      .map(([key, g]) => ({
        key,
        label: g.label,
        totalMad: g.totalMad,
        count: g.count,
        percent: totalVal > 0 ? (g.totalMad / totalVal) * 100 : 0,
        color: g.color,
      }))
      .sort((a, b) => b.totalMad - a.totalMad);
  }, [data?.holdings, rates]);

  // Stress-Test computation
  const stressTestResult = useMemo(() => {
    let simulatedInvestmentsMad = 0;
    let cryptoDrawdownMad = 0;
    let equitiesDrawdownMad = 0;

    if (data?.holdings) {
      for (const h of data.holdings) {
        const units = parseFloat(h.units || '0') || 0;
        const price = parseFloat(h.currentPrice || '0') || 0;
        const localVal = units * price;
        let madVal = localVal;
        if (h.currency === 'USD') madVal = localVal * rates.USD_TO_MAD;
        else if (h.currency === 'EUR') madVal = localVal * rates.EUR_TO_MAD;

        if (h.assetType === 'crypto') {
          const dropLoss = (madVal * cryptoDrop) / 100;
          cryptoDrawdownMad += dropLoss;
          simulatedInvestmentsMad += madVal - dropLoss;
        } else if (['stock', 'etf', 'bourse_local'].includes(h.assetType)) {
          const dropLoss = (madVal * equitiesDrop) / 100;
          equitiesDrawdownMad += dropLoss;
          simulatedInvestmentsMad += madVal - dropLoss;
        } else {
          simulatedInvestmentsMad += madVal;
        }
      }
    }

    const totalDrawdownMad = cryptoDrawdownMad + equitiesDrawdownMad;
    const simulatedNetWorthMad = totalLiquidCash + simulatedInvestmentsMad + pendingReceivables - pendingPayables;

    return {
      simulatedInvestmentsMad,
      simulatedNetWorthMad,
      totalDrawdownMad,
      cryptoDrawdownMad,
      equitiesDrawdownMad,
      runwaySafe: totalLiquidCash >= (kpis?.emergencyBuffer || 0),
    };
  }, [data?.holdings, cryptoDrop, equitiesDrop, rates, totalLiquidCash, pendingReceivables, pendingPayables, kpis?.emergencyBuffer]);

  // Open Trade Modal
  const openTradeModal = (holding: InvestmentHolding, type: InvestmentTradeType = 'BUY') => {
    setTradeModalHolding(holding);
    setTradeType(type);
    const currPrice = parseFloat(holding.currentPrice || '0') || 0;
    setTradePrice(currPrice.toString());
    setTradeUnits('');
    setTradeTotal('');
    setTradeFees('0');
    setTradeWalletId(holding.walletId || wallets[0]?.id || '');
    setTradeNotes('');
    setTradeError(null);
  };

  // Open Add Holding Modal
  const openAddHoldingModal = (preset?: typeof POPULAR_ASSETS[0]) => {
    setEditingHolding(null);
    setHoldingForm({
      symbol: preset?.symbol || '',
      name: preset?.name || '',
      assetType: (preset?.assetType as any) || 'crypto',
      units: '',
      buyPriceAvg: '',
      currentPrice: '',
      currency: preset?.currency || 'USD',
      walletId: wallets[0]?.id || '',
      targetAllocationPercent: '0',
      dividendYieldPercent: '0',
      notes: '',
    });
    setHoldingError(null);
    setShowAddHoldingModal(true);
  };

  // Open Edit Holding Modal
  const openEditHoldingModal = (h: InvestmentHolding) => {
    setEditingHolding(h);
    setHoldingForm({
      symbol: h.symbol,
      name: h.name,
      assetType: h.assetType,
      units: h.units || '0',
      buyPriceAvg: h.buyPriceAvg || '0',
      currentPrice: h.currentPrice || '0',
      currency: h.currency || 'USD',
      walletId: h.walletId || '',
      targetAllocationPercent: h.targetAllocationPercent || '0',
      dividendYieldPercent: h.dividendYieldPercent || '0',
      notes: h.notes || '',
    });
    setHoldingError(null);
    setShowAddHoldingModal(true);
  };

  // Handle Save Holding
  const handleSaveHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingForm.symbol.trim()) {
      setHoldingError('Please specify asset symbol (e.g. BTC, AAPL, VOO)');
      return;
    }
    setHoldingSubmitting(true);
    setHoldingError(null);
    try {
      if (editingHolding) {
        await onUpdateHolding(editingHolding.id, {
          symbol: holdingForm.symbol.toUpperCase().trim(),
          name: holdingForm.name.trim() || holdingForm.symbol.toUpperCase().trim(),
          assetType: holdingForm.assetType,
          units: holdingForm.units || '0',
          buyPriceAvg: holdingForm.buyPriceAvg || '0',
          currentPrice: holdingForm.currentPrice || holdingForm.buyPriceAvg || '0',
          currency: holdingForm.currency,
          walletId: holdingForm.walletId || null,
          targetAllocationPercent: holdingForm.targetAllocationPercent || '0',
          dividendYieldPercent: holdingForm.dividendYieldPercent || '0',
          notes: holdingForm.notes || null,
        });
      } else {
        await onCreateHolding({
          symbol: holdingForm.symbol.toUpperCase().trim(),
          name: holdingForm.name.trim() || holdingForm.symbol.toUpperCase().trim(),
          assetType: holdingForm.assetType,
          units: holdingForm.units || '0',
          buyPriceAvg: holdingForm.buyPriceAvg || '0',
          currentPrice: holdingForm.currentPrice || holdingForm.buyPriceAvg || '0',
          currency: holdingForm.currency,
          walletId: holdingForm.walletId || null,
          targetAllocationPercent: holdingForm.targetAllocationPercent || '0',
          dividendYieldPercent: holdingForm.dividendYieldPercent || '0',
          notes: holdingForm.notes || null,
        });
      }
      setShowAddHoldingModal(false);
      setEditingHolding(null);
    } catch (err: any) {
      setHoldingError(err.message || 'Failed to save holding');
    } finally {
      setHoldingSubmitting(false);
    }
  };

  // Handle Execute Trade
  const handleExecuteTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeModalHolding) return;
    const units = parseFloat(tradeUnits) || 0;
    const price = parseFloat(tradePrice) || 0;
    const total = parseFloat(tradeTotal) || units * price;
    const fees = parseFloat(tradeFees) || 0;

    if (tradeType !== 'DIVIDEND' && tradeType !== 'STAKING_REWARD' && units <= 0) {
      setTradeError('Units must be greater than 0');
      return;
    }
    if (total <= 0) {
      setTradeError('Total amount must be greater than 0');
      return;
    }

    setTradeSubmitting(true);
    setTradeError(null);
    try {
      await onExecuteTrade({
        holdingId: tradeModalHolding.id,
        type: tradeType,
        units,
        pricePerUnit: price,
        totalAmount: total,
        fees,
        walletId: tradeWalletId || null,
        notes: tradeNotes || undefined,
      });
      setTradeModalHolding(null);
    } catch (err: any) {
      setTradeError(err.message || 'Failed to execute trade');
    } finally {
      setTradeSubmitting(false);
    }
  };

  // Handle Save DCA Plan
  const handleSaveDcaPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmount = parseFloat(dcaForm.targetAmount);
    if (!targetAmount || targetAmount <= 0) {
      setDcaError('Please enter a valid recurring target amount');
      return;
    }
    setDcaSubmitting(true);
    setDcaError(null);
    try {
      await onCreateDcaPlan({
        symbol: dcaForm.symbol.toUpperCase().trim(),
        assetName: dcaForm.assetName.trim(),
        assetType: dcaForm.assetType,
        targetAmount: dcaForm.targetAmount,
        currency: dcaForm.currency,
        frequency: dcaForm.frequency,
        dayOffsetAfterPayday: dcaForm.dayOffsetAfterPayday,
        walletId: dcaForm.walletId || null,
      });
      setShowDcaModal(false);
    } catch (err: any) {
      setDcaError(err.message || 'Failed to create DCA plan');
    } finally {
      setDcaSubmitting(false);
    }
  };

  const getAssetBadge = (type: InvestmentAssetType) => {
    switch (type) {
      case 'crypto':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">🪙 Crypto</span>;
      case 'stock':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">📈 Stock</span>;
      case 'etf':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">📊 ETF</span>;
      case 'bourse_local':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">🏛️ Bourse BVC</span>;
      case 'commodity':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">🥇 Gold/Metals</span>;
      case 'real_estate':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">🏡 Real Estate</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">💼 Custom</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-sm">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Investment & Wealth Operating System
                <span className="text-xs px-2 py-0.5 font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full">
                  Live Feeds
                </span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track crypto, stocks, local bourse, and compute your predictive Safe-to-Invest runway.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Currency Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            {(['MAD', 'USD', 'EUR'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setDisplayCurrency(curr)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  displayCurrency === curr
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshQuotes}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Prices</span>
          </Button>

          <Button
            size="sm"
            onClick={() => openAddHoldingModal()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Hero Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Investment Portfolio</span>
              <Coins className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatAmount(data?.totalPortfolioValueMad || 0)}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Cost Basis:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {formatAmount(data?.totalCostBasisMad || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Unrealized P&L */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Unrealized P&L</span>
              {(data?.totalUnrealizedPnlMad || 0) >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  (data?.totalUnrealizedPnlMad || 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {(data?.totalUnrealizedPnlMad || 0) >= 0 ? '+' : ''}
                {formatAmount(data?.totalUnrealizedPnlMad || 0)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  (data?.totalUnrealizedPnlPercent || 0) >= 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                }`}
              >
                {(data?.totalUnrealizedPnlPercent || 0) >= 0 ? '+' : ''}
                {(data?.totalUnrealizedPnlPercent || 0).toFixed(2)}%
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Live paper return on current holdings
            </p>
          </CardContent>
        </Card>

        {/* Safe-to-Invest Monthly Surplus */}
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-transparent dark:from-emerald-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Safe-to-Invest (This Month)</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatAmount(data?.safeToInvest?.safeToInvestMonthly || 0)}
            </div>
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 truncate">
              {data?.safeToInvest?.surplusAfterDca !== undefined && (
                <>Surplus after DCA: {formatAmount(data.safeToInvest.surplusAfterDca)}</>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Passive Income & FIRE Progress */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Passive Yield & FIRE</span>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatAmount(data?.annualPassiveIncomeMad || 0)}
              <span className="text-xs font-normal text-gray-500 ml-1">/yr</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Living Costs Covered:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {(data?.fireCoveragePercent || 0).toFixed(1)}% FIRE
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Complete Balance Sheet & Net Worth Section */}
      <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  Unified Net Worth Engine
                </span>
                {currentMilestone && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                    <span>{currentMilestone.icon}</span>
                    <span>{currentMilestone.label}</span>
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-950 dark:text-white">
                {formatAmount(netWorthMad)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Liquid Wallets + Investments + Receivables - Payables
              </p>
            </div>

            {/* Formula Breakdown chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Liquid Cash</span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatAmount(totalLiquidCash)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">+ Investments</span>
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {formatAmount(totalInvestmentMad)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">+ Receivables</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatAmount(pendingReceivables)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">- Payables</span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {formatAmount(pendingPayables)}
                </span>
              </div>
            </div>
          </div>

          {/* Milestone Progress Bar */}
          {nextMilestone && (
            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                <span className="flex items-center gap-1 font-medium">
                  <span>Next Wealth Milestone:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-bold">{nextMilestone.label}</span>
                </span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {milestoneProgress.toFixed(0)}% ({formatAmount(nextMilestone.threshold - netWorthMad)} remaining)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('holdings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'holdings'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Coins className="h-4 w-4" />
          Holdings & Positions ({data?.holdings?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('safe-to-invest')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'safe-to-invest'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Safe-to-Invest & DCA Planner
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('allocation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'allocation'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <PieChart className="h-4 w-4" />
          Asset Allocation & Rebalancing
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('stress-test')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'stress-test'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Market Stress-Test (What-If)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <History className="h-4 w-4" />
          Trade & Dividend Ledger ({data?.transactions?.length || 0})
        </button>
      </div>

      {/* SUB-TAB 1: HOLDINGS & POSITIONS */}
      {activeSubTab === 'holdings' && (
        <div className="space-y-4">
          {/* Filter Bar & Quick presets */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Assets' },
                { id: 'crypto', label: '🪙 Crypto' },
                { id: 'stocks', label: '📈 Stocks & ETFs' },
                { id: 'bourse_local', label: '🏛️ Bourse BVC' },
                { id: 'other', label: '🥇 Gold & Others' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAssetFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    assetFilter === f.id
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-xs'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <Input
                type="text"
                placeholder="Search symbol or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-9 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Quick Popular Asset Chips when portfolio is empty or for easy adds */}
          {(!data?.holdings || data.holdings.length === 0) && (
            <Card className="border-dashed border-2 border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    No investment holdings yet
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
                    Start tracking your crypto bags, international stock portfolios, or Casablanca BVC shares. Live prices update automatically.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-2">
                    Popular Assets:
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {POPULAR_ASSETS.slice(0, 8).map((preset) => (
                      <button
                        key={preset.symbol}
                        type="button"
                        onClick={() => openAddHoldingModal(preset)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 shadow-xs transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 text-blue-500" />
                        {preset.symbol} ({preset.name})
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Holdings Grid / Table */}
          {filteredHoldings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHoldings.map((h) => {
                const units = parseFloat(h.units || '0') || 0;
                const buyPrice = parseFloat(h.buyPriceAvg || '0') || 0;
                const currPrice = parseFloat(h.currentPrice || '0') || 0;
                const marketValLocal = units * currPrice;
                const costBasisLocal = units * buyPrice;
                const pnlLocal = marketValLocal - costBasisLocal;
                const pnlPct = costBasisLocal > 0 ? (pnlLocal / costBasisLocal) * 100 : 0;
                const change24h = h.change24h || 0;

                let marketValMad = marketValLocal;
                if (h.currency === 'USD') marketValMad = marketValLocal * rates.USD_TO_MAD;
                else if (h.currency === 'EUR') marketValMad = marketValLocal * rates.EUR_TO_MAD;

                return (
                  <Card
                    key={h.id}
                    className="border-gray-200 dark:border-gray-800 hover:shadow-md transition-all group overflow-hidden"
                  >
                    <CardContent className="p-5 space-y-4">
                      {/* Card Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              {h.symbol}
                            </span>
                            {getAssetBadge(h.assetType)}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                            {h.name}
                          </p>
                        </div>

                        {/* 24h ticker badge */}
                        <div
                          className={`text-right text-xs px-2 py-0.5 rounded-md font-semibold flex items-center gap-0.5 ${
                            change24h >= 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          }`}
                        >
                          {change24h >= 0 ? '+' : ''}
                          {change24h.toFixed(2)}%
                        </div>
                      </div>

                      {/* Position Values */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <div>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Position Value</span>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatAmount(marketValMad)}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {units.toLocaleString()} {h.symbol}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Unrealized P&L</span>
                          <span
                            className={`text-base font-bold ${
                              pnlLocal >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {pnlLocal >= 0 ? '+' : ''}
                            {pnlPct.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {pnlLocal >= 0 ? '+' : ''}
                            {formatAmount(
                              h.currency === 'USD'
                                ? pnlLocal * rates.USD_TO_MAD
                                : h.currency === 'EUR'
                                ? pnlLocal * rates.EUR_TO_MAD
                                : pnlLocal
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Pricing Details */}
                      <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg text-xs flex justify-between items-center text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="block text-[10px] text-gray-400">Current Spot Price</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {currPrice.toLocaleString()} {h.currency}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-gray-400">Avg Cost Basis</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {buyPrice.toLocaleString()} {h.currency}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openTradeModal(h, 'BUY')}
                            className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            + Buy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openTradeModal(h, 'SELL')}
                            className="h-8 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium"
                          >
                            - Sell
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openTradeModal(h, 'DIVIDEND')}
                            title="Record Dividend / Staking Yield"
                            className="h-8 px-2 text-xs border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          >
                            Yield
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditHoldingModal(h)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Edit Holding"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete holding ${h.symbol}?`)) {
                                onDeleteHolding(h.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Delete Holding"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: SAFE-TO-INVEST & DCA PLANNER */}
      {activeSubTab === 'safe-to-invest' && (
        <div className="space-y-6">
          {/* Safe-to-Invest Intelligence Card */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-indigo-50/30 dark:from-emerald-950/30 dark:to-indigo-950/10 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    TrueSpend "Safe-to-Invest" Runway Engine
                  </CardTitle>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Calculates how much money you can invest this cycle without risking your rent, groceries, debt obligations, or emergency buffer.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">Safe Deployable Surplus</span>
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatAmount(data?.safeToInvest?.safeToInvestMonthly || 0)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Recommendation Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-sm text-blue-950 dark:text-blue-200 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">TrueSpend Advisor Recommendation:</span>
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    {data?.safeToInvest?.recommendationText || 'Your cash flow supports steady disciplined investing.'}
                  </p>
                </div>
              </div>

              {/* Step-by-Step Cash Flow Watermark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Monthly Income</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {formatAmount(data?.safeToInvest?.monthlyIncome || 0)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">Salary & Cash In</span>
                </div>

                <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">- Fixed Budgets</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    {formatAmount(data?.safeToInvest?.fixedObligations || 0)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">Rent, bills & utilities</span>
                </div>

                <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">- Variable Spend</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {formatAmount(data?.safeToInvest?.variableSpendPace || 0)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">Daily groceries & living</span>
                </div>

                <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">- Buffer Deficiency</span>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {formatAmount(data?.safeToInvest?.emergencyBufferDeficiency || 0)}
                  </span>
                  <span className="text-[10px] text-gray-400 block">Emergency fund top-up</span>
                </div>

                <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">= Safe Surplus</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatAmount(data?.safeToInvest?.safeToInvestMonthly || 0)}
                  </span>
                  <span className="text-[10px] text-emerald-600/80 block">Zero risk to liquidity</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DCA Recurring Planner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-500" />
                Dollar-Cost Averaging (DCA) Automation Planner
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Schedule recurring investments linked to your Financial Calendar and Payday cycles.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowDcaModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4" />
              New DCA Plan
            </Button>
          </div>

          {/* DCA Plans List */}
          {(!data?.dcaPlans || data.dcaPlans.length === 0) ? (
            <Card className="border-dashed border-2 border-gray-200 dark:border-gray-800">
              <CardContent className="p-8 text-center space-y-2">
                <Calendar className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  No active Dollar-Cost Averaging plans
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Automate recurring investments (e.g., "Invest 1,500 MAD into S&P 500 or Bitcoin 2 days after payday") to build wealth consistently.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.dcaPlans.map((plan) => {
                const planAmt = parseFloat(plan.targetAmount) || 0;
                let scheduleText = 'Every month';
                if (plan.frequency === 'post_payday') {
                  scheduleText = `${plan.dayOffsetAfterPayday} days after Payday`;
                } else if (plan.frequency === 'weekly') {
                  scheduleText = 'Every week';
                } else if (plan.frequency === 'daily') {
                  scheduleText = 'Every day';
                }

                return (
                  <Card key={plan.id} className="border-gray-200 dark:border-gray-800 shadow-xs">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {plan.symbol}
                            {getAssetBadge(plan.assetType)}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{plan.assetName}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            plan.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {plan.status}
                        </span>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Target Amount:</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {planAmt.toLocaleString()} {plan.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Execution Schedule:</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {scheduleText}
                          </span>
                        </div>
                        {plan.walletName && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Funding Wallet:</span>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                              {plan.walletName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onUpdateDcaPlan(plan.id, {
                              status: plan.status === 'active' ? 'paused' : 'active',
                            });
                          }}
                          className="text-xs h-7"
                        >
                          {plan.status === 'active' ? 'Pause' : 'Activate'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => onDeleteDcaPlan(plan.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ASSET ALLOCATION & REBALANCING */}
      {activeSubTab === 'allocation' && (
        <div className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-indigo-500" />
                Portfolio Asset Allocation Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stacked Allocation Bar */}
              <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-800">
                {allocationBreakdown.map((item) => (
                  <div
                    key={item.key}
                    style={{ width: `${item.percent}%` }}
                    className={`${item.color} h-full transition-all`}
                    title={`${item.label}: ${item.percent.toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Allocation List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allocationBreakdown.map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {item.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                      <span>Value: {formatAmount(item.totalMad)}</span>
                      <span>{item.count} position(s)</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rebalancing Intelligence Alert */}
              {allocationBreakdown.find((a) => a.key === 'crypto' && a.percent > 40) && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm block mb-1">Portfolio Risk Warning: High Crypto Concentration</span>
                    <p className="leading-relaxed">
                      Crypto currently represents {allocationBreakdown.find((a) => a.key === 'crypto')?.percent.toFixed(0)}% of your investment portfolio. Because crypto assets carry high volatility, TrueSpend recommends taking partial profits or rebalancing into stable assets (ETFs, gold, or liquid savings) to protect capital.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 4: MARKET STRESS-TEST (WHAT-IF SIMULATOR) */}
      {activeSubTab === 'stress-test' && (
        <div className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-red-50/50 to-amber-50/50 dark:from-red-950/20 dark:to-amber-950/20 border-b border-gray-200 dark:border-gray-800">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Sliders className="h-5 w-5 text-red-500" />
                Portfolio Volatility Stress-Testing Simulator
              </CardTitle>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Simulate sudden crypto crashes or equity market drawdowns to verify that your emergency runway and living buffer remain safe.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-amber-700 dark:text-amber-300">Crypto Crash Severity</span>
                    <span className="text-red-600 font-bold">-{cryptoDrop}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={cryptoDrop}
                    onChange={(e) => setCryptoDrop(parseInt(e.target.value, 10))}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Mild (-10%)</span>
                    <span>Severe (-50%)</span>
                    <span>Extreme (-80%)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-blue-700 dark:text-blue-300">Stock & Bourse Market Correction</span>
                    <span className="text-red-600 font-bold">-{equitiesDrop}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={equitiesDrop}
                    onChange={(e) => setEquitiesDrop(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Pullback (-5%)</span>
                    <span>Correction (-20%)</span>
                    <span>Bear Market (-50%)</span>
                  </div>
                </div>
              </div>

              {/* Stress Test Simulation Results */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Simulated Net Worth</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatAmount(stressTestResult.simulatedNetWorthMad)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    Baseline: {formatAmount(netWorthMad)}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">
                  <span className="text-xs text-red-700 dark:text-red-300 block mb-1">Total Paper Drawdown</span>
                  <span className="text-xl font-bold text-red-600 dark:text-red-400">
                    -{formatAmount(stressTestResult.totalDrawdownMad)}
                  </span>
                  <span className="text-[10px] text-red-600/80 block mt-1">
                    Crypto: -{formatAmount(stressTestResult.cryptoDrawdownMad)} | Equities: -{formatAmount(stressTestResult.equitiesDrawdownMad)}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 block mb-1">Runway & Liquidity Status</span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Liquid Cash Protected
                  </span>
                  <span className="text-[10px] text-emerald-600/80 block mt-1">
                    {formatAmount(totalLiquidCash)} remains untouched in liquid wallets
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 5: TRADE & DIVIDEND LEDGER */}
      {activeSubTab === 'ledger' && (
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-500" />
              Complete Investment Trade & Dividend History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data?.transactions || data.transactions.length === 0) ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No recorded buy, sell, or dividend transactions yet. Trades executed via the "+ Buy", "- Sell", or "Yield" buttons will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Units</th>
                      <th className="px-4 py-3">Price / Unit</th>
                      <th className="px-4 py-3">Total Amount</th>
                      <th className="px-4 py-3">Realized P&L</th>
                      <th className="px-4 py-3">Wallet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.transactions.map((t) => {
                      const units = parseFloat(t.units) || 0;
                      const price = parseFloat(t.pricePerUnit) || 0;
                      const total = parseFloat(t.totalAmount) || 0;
                      const realizedPnl = parseFloat(t.realizedPnl || '0') || 0;

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-850">
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                t.type === 'BUY'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : t.type === 'SELL'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {t.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                            {t.holdingSymbol || 'Asset'}
                          </td>
                          <td className="px-4 py-3">{units.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {price.toLocaleString()} {t.currency}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                            {total.toLocaleString()} {t.currency}
                          </td>
                          <td className="px-4 py-3">
                            {t.type === 'SELL' ? (
                              <span
                                className={`font-semibold ${
                                  realizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {realizedPnl >= 0 ? '+' : ''}
                                {realizedPnl.toFixed(2)} {t.currency}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {t.walletName || 'External'}
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
      )}

      {/* MODAL 1: ADD / EDIT HOLDING */}
      {showAddHoldingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {editingHolding ? `Edit Position: ${editingHolding.symbol}` : 'Add New Investment Holding'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddHoldingModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHolding} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ticker Symbol</label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. BTC, ETH, AAPL"
                    value={holdingForm.symbol}
                    onChange={(e) => setHoldingForm({ ...holdingForm, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Name</label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. Bitcoin, Apple"
                    value={holdingForm.name}
                    onChange={(e) => setHoldingForm({ ...holdingForm, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Class</label>
                  <Select
                    value={holdingForm.assetType}
                    onChange={(e) => setHoldingForm({ ...holdingForm, assetType: e.target.value as any })}
                  >
                    <option value="crypto">🪙 Crypto Currency</option>
                    <option value="stock">📈 US/EU Stock</option>
                    <option value="etf">📊 ETF / Index Fund</option>
                    <option value="bourse_local">🏛️ Bourse de Casablanca (BVC)</option>
                    <option value="commodity">🥇 Gold / Commodities</option>
                    <option value="real_estate">🏡 Real Estate</option>
                    <option value="custom">💼 Custom / Private</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <Select
                    value={holdingForm.currency}
                    onChange={(e) => setHoldingForm({ ...holdingForm, currency: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="MAD">MAD (Dirham)</option>
                    <option value="EUR">EUR (€)</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Units Held</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={holdingForm.units}
                    onChange={(e) => setHoldingForm({ ...holdingForm, units: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Avg Buy Price</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={holdingForm.buyPriceAvg}
                    onChange={(e) => setHoldingForm({ ...holdingForm, buyPriceAvg: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Current Price</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={holdingForm.currentPrice}
                    onChange={(e) => setHoldingForm({ ...holdingForm, currentPrice: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Dividend / Staking Yield % (yr)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 4.5"
                    value={holdingForm.dividendYieldPercent}
                    onChange={(e) => setHoldingForm({ ...holdingForm, dividendYieldPercent: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Brokerage Wallet</label>
                  <Select
                    value={holdingForm.walletId}
                    onChange={(e) => setHoldingForm({ ...holdingForm, walletId: e.target.value })}
                  >
                    <option value="">None / External Exchange</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {holdingError && (
                <p className="text-xs text-red-600 dark:text-red-400">{holdingError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddHoldingModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={holdingSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {holdingSubmitting ? 'Saving...' : 'Save Holding'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXECUTE TRADE (BUY / SELL / DIVIDEND) */}
      {tradeModalHolding && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  Execute Trade: {tradeModalHolding.symbol}
                </h3>
                <span className="text-xs text-gray-500">
                  Current Units: {parseFloat(tradeModalHolding.units || '0').toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTradeModalHolding(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Trade Type Selector */}
            <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['BUY', 'SELL', 'DIVIDEND'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTradeType(t)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    tradeType === t
                      ? t === 'BUY'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : t === 'SELL'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {t === 'DIVIDEND' ? 'Yield / Div' : t}
                </button>
              ))}
            </div>

            <form onSubmit={handleExecuteTradeSubmit} className="space-y-3">
              {tradeType !== 'DIVIDEND' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Units</label>
                    <Input
                      required
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={tradeUnits}
                      onChange={(e) => {
                        const u = e.target.value;
                        setTradeUnits(u);
                        const p = parseFloat(tradePrice) || 0;
                        if (p > 0 && u) setTradeTotal(((parseFloat(u) || 0) * p).toFixed(2));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Price / Unit ({tradeModalHolding.currency})
                    </label>
                    <Input
                      required
                      type="number"
                      step="any"
                      value={tradePrice}
                      onChange={(e) => {
                        const p = e.target.value;
                        setTradePrice(p);
                        const u = parseFloat(tradeUnits) || 0;
                        if (u > 0 && p) setTradeTotal((u * (parseFloat(p) || 0)).toFixed(2));
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Total Amount ({tradeModalHolding.currency})
                  </label>
                  <Input
                    required
                    type="number"
                    step="any"
                    value={tradeTotal}
                    onChange={(e) => {
                      const tot = e.target.value;
                      setTradeTotal(tot);
                      const p = parseFloat(tradePrice) || 0;
                      if (p > 0 && tot) setTradeUnits(((parseFloat(tot) || 0) / p).toFixed(6));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fees / Slippage</label>
                  <Input
                    type="number"
                    step="any"
                    value={tradeFees}
                    onChange={(e) => setTradeFees(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {tradeType === 'BUY'
                    ? 'Debit Cash From Wallet'
                    : tradeType === 'SELL'
                    ? 'Credit Net Proceeds To Wallet'
                    : 'Credit Dividend Income To Wallet'}
                </label>
                <Select
                  value={tradeWalletId}
                  onChange={(e) => setTradeWalletId(e.target.value)}
                >
                  <option value="">Do not touch cash wallets (Holdings only)</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type}) — Bal: {formatAmount(w.balance || 0)}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-gray-500">
                  Selecting a wallet synchronizes TrueSpend cash flow automatically.
                </p>
              </div>

              {tradeError && (
                <p className="text-xs text-red-600 dark:text-red-400">{tradeError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTradeModalHolding(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={tradeSubmitting}
                  className={
                    tradeType === 'BUY'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : tradeType === 'SELL'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }
                >
                  {tradeSubmitting ? 'Processing...' : `Confirm ${tradeType}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NEW DCA PLAN */}
      {showDcaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-500" />
                Schedule Recurring DCA Plan
              </h3>
              <button
                type="button"
                onClick={() => setShowDcaModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDcaPlan} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ticker Symbol</label>
                  <Input
                    required
                    type="text"
                    placeholder="BTC, VOO, AAPL"
                    value={dcaForm.symbol}
                    onChange={(e) => setDcaForm({ ...dcaForm, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Name</label>
                  <Input
                    required
                    type="text"
                    value={dcaForm.assetName}
                    onChange={(e) => setDcaForm({ ...dcaForm, assetName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Recurring Amount</label>
                  <Input
                    required
                    type="number"
                    step="any"
                    value={dcaForm.targetAmount}
                    onChange={(e) => setDcaForm({ ...dcaForm, targetAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <Select
                    value={dcaForm.currency}
                    onChange={(e) => setDcaForm({ ...dcaForm, currency: e.target.value })}
                  >
                    <option value="MAD">MAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Frequency</label>
                <Select
                  value={dcaForm.frequency}
                  onChange={(e) => setDcaForm({ ...dcaForm, frequency: e.target.value as any })}
                >
                  <option value="post_payday">Post-Payday Cycle (TrueSpend Recommended)</option>
                  <option value="monthly">Monthly (1st of month)</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </Select>
              </div>

              {dcaForm.frequency === 'post_payday' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Days after Payday
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="15"
                    value={dcaForm.dayOffsetAfterPayday}
                    onChange={(e) => setDcaForm({ ...dcaForm, dayOffsetAfterPayday: parseInt(e.target.value, 10) || 0 })}
                  />
                  <p className="text-[11px] text-gray-500">
                    Allows salary deposits to clear before execution.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Funding Wallet</label>
                <Select
                  value={dcaForm.walletId}
                  onChange={(e) => setDcaForm({ ...dcaForm, walletId: e.target.value })}
                >
                  <option value="">Default Primary Bank Wallet</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </option>
                  ))}
                </Select>
              </div>

              {dcaError && <p className="text-xs text-red-600 dark:text-red-400">{dcaError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDcaModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={dcaSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {dcaSubmitting ? 'Creating...' : 'Create DCA Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
