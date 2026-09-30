import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Award, RefreshCw, Landmark, Banknote,
  BarChart3, Shield, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import type { KPI, NetWorthSnapshot, Wallet } from '../../types';
import { dashboardService } from '../../services/api/dashboardService';

// ─── Milestone Badges ─────────────────────────────────────────────────────────
const MILESTONES = [
  { value: 10_000, label: '10K', icon: '🌱', color: 'text-green-600' },
  { value: 50_000, label: '50K', icon: '🌿', color: 'text-emerald-600' },
  { value: 100_000, label: '100K', icon: '🌳', color: 'text-teal-600' },
  { value: 250_000, label: '250K', icon: '💎', color: 'text-blue-600' },
  { value: 500_000, label: '500K', icon: '🏆', color: 'text-amber-600' },
  { value: 1_000_000, label: '1M', icon: '👑', color: 'text-purple-600' },
];

function getEarnedMilestones(netWorth: number) {
  return MILESTONES.filter(m => netWorth >= m.value);
}

function getNextMilestone(netWorth: number) {
  return MILESTONES.find(m => netWorth < m.value) ?? null;
}

// ─── Currency Formatting ──────────────────────────────────────────────────────
const FX_RATES: Record<string, number> = { MAD: 1, USD: 1 / 10.0, EUR: 1 / 10.85 };
const CURRENCY_SYMBOLS: Record<string, string> = { MAD: 'MAD', USD: '$', EUR: '€' };

function convertAmount(mad: number, currency: string) {
  return mad * (FX_RATES[currency] ?? 1);
}

function formatCurrency(value: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  const converted = convertAmount(value, currency);
  return `${sym}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-gray-700 dark:text-gray-200">{label}</p>
      <p className="text-indigo-600 dark:text-indigo-400">Net Worth: <span className="font-bold">{formatCurrency(payload[0]?.value, currency)}</span></p>
      {d?.liquidValue && <p className="text-blue-500">Liquid: {formatCurrency(parseFloat(d.liquidValue), currency)}</p>}
      {d?.investmentValue && <p className="text-emerald-500">Investments: {formatCurrency(parseFloat(d.investmentValue), currency)}</p>}
      {d?.debtValue && <p className="text-red-400">Debts: -{formatCurrency(parseFloat(d.debtValue), currency)}</p>}
    </div>
  );
};

interface NetWorthDashboardProps {
  kpis: KPI | null;
  wallets: Wallet[];
  token: string | null;
}

export const NetWorthDashboard: React.FC<NetWorthDashboardProps> = ({ kpis, wallets, token }) => {
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [period, setPeriod] = useState<'6m' | '1y' | 'all'>('6m');
  const [currency, setCurrency] = useState<'MAD' | 'USD' | 'EUR'>('MAD');
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await dashboardService.getNetWorthHistory(period, token);
      setHistory(data || []);
    } catch (e) {
      console.error('Failed to fetch net worth history', e);
    } finally {
      setLoading(false);
    }
  }, [token, period]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const netWorth = kpis?.netWorthTotal ?? 0;
  const liquidValue = kpis?.totalLiquidity ?? 0;
  const investmentValue = kpis?.investmentValue ?? 0;
  const receivables = kpis?.pendingReceivables ?? 0;
  const payables = kpis?.pendingPayables ?? 0;

  const earnedMilestones = useMemo(() => getEarnedMilestones(netWorth), [netWorth]);
  const nextMilestone = useMemo(() => getNextMilestone(netWorth), [netWorth]);

  const chartData = useMemo(() => history.map(snap => ({
    date: snap.date.slice(5), // MM-DD
    fullDate: snap.date,
    netWorth: parseFloat(snap.netWorth),
    liquidValue: snap.liquidValue,
    investmentValue: snap.investmentValue,
    debtValue: snap.debtValue,
  })), [history]);

  // Compute change vs period start
  const periodStartValue = chartData.length > 1 ? chartData[0].netWorth : null;
  const periodChange = periodStartValue !== null ? netWorth - periodStartValue : null;
  const periodChangePct = periodStartValue && periodStartValue !== 0 ? (periodChange! / Math.abs(periodStartValue)) * 100 : null;

  const brokerageAccounts = wallets.filter(w => w.type === 'Brokerage');

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" /> Net Worth Dashboard
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track wealth trajectory · milestones · allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Currency toggle */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {(['MAD','USD','EUR'] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${currency === c ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={fetchHistory} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hero Net Worth Card */}
      <Card className="bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 text-white border-0">
        <CardContent className="pt-6 pb-6">
          <p className="text-sm text-gray-400 font-medium">Total Net Worth</p>
          <p className="text-4xl font-bold mt-1 tracking-tight">
            {formatCurrency(netWorth, currency)}
          </p>
          {periodChange !== null && (
            <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${periodChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {periodChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {periodChange >= 0 ? '+' : ''}{formatCurrency(Math.abs(periodChange), currency)} ({periodChangePct?.toFixed(1)}%) vs {period === '6m' ? '6 months ago' : period === '1y' ? '1 year ago' : 'all time'}
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Liquid Cash', value: liquidValue, icon: '🏦', color: 'border-blue-700/40 bg-blue-900/20' },
              { label: 'Investments', value: investmentValue, icon: '📈', color: 'border-emerald-700/40 bg-emerald-900/20' },
              { label: 'Receivables', value: receivables, icon: '💌', color: 'border-sky-700/40 bg-sky-900/20' },
              { label: 'Payables', value: -payables, icon: '💸', color: 'border-red-700/40 bg-red-900/20' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border ${item.color} p-3`}>
                <p className="text-xs text-gray-400">{item.icon} {item.label}</p>
                <p className={`text-base font-bold mt-1 ${item.value < 0 ? 'text-red-400' : 'text-white'}`}>
                  {item.value < 0 ? '−' : ''}{formatCurrency(Math.abs(item.value), currency)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Net Worth Trajectory</CardTitle>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {(['6m','1y','all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${period === p ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}>
                {p === '6m' ? '6M' : p === '1y' ? '1Y' : 'All'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ) : chartData.length < 2 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <BarChart3 className="h-10 w-10 text-gray-300 dark:text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">Not enough data yet. Net worth snapshots are recorded daily.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                {periodStartValue !== null && (
                  <ReferenceLine y={periodStartValue} stroke="#6366f1" strokeDasharray="4 4" strokeOpacity={0.4} />
                )}
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#nwGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6366f1' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" /> Net Worth Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {MILESTONES.map(m => {
              const earned = netWorth >= m.value;
              return (
                <div
                  key={m.label}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    earned
                      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 opacity-50'
                  }`}
                >
                  <span className={`text-lg ${earned ? '' : 'grayscale opacity-50'}`}>{m.icon}</span>
                  <div>
                    <p className={`font-bold leading-tight ${earned ? m.color : 'text-gray-400'}`}>{m.label}</p>
                    <p className="text-[10px] text-gray-400">{m.value.toLocaleString()} MAD</p>
                  </div>
                  {earned && <span className="ml-1 text-emerald-500 text-xs font-bold">✓</span>}
                </div>
              );
            })}
          </div>

          {nextMilestone && (
            <div className="mt-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Next milestone: {nextMilestone.label} ({nextMilestone.value.toLocaleString()} MAD)</p>
              <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.min(100, (netWorth / nextMilestone.value) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {formatCurrency(netWorth, currency)} of {formatCurrency(nextMilestone.value, currency)} — {((netWorth / nextMilestone.value) * 100).toFixed(1)}% there
              </p>
            </div>
          )}

          {earnedMilestones.length > 0 && (
            <p className="mt-3 text-xs text-gray-400 text-center">
              🎉 You've achieved {earnedMilestones.length} milestone{earnedMilestones.length > 1 ? 's' : ''}!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Brokerage Accounts (if any) */}
      {brokerageAccounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Brokerage / Exchange Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {brokerageAccounts.map(w => (
                <div key={w.id} className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/10 p-4">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide">Brokerage</p>
                  <p className="font-bold text-gray-900 dark:text-white mt-1">{w.name}</p>
                  <p className="text-sm text-gray-500">Holdings tracked separately</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Portfolio values are computed from your holdings, not wallet cash balances.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
