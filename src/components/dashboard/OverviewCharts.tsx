import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { format, addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { Activity, BarChart3, TrendingUp } from 'lucide-react';
import type { CategoryBudget, KPI, Payroll, Transaction } from '../../types';
import {
  computeFourPillarBreakdown,
  netExpenseOf,
  netIncomeOf,
  isLivingExpense,
} from '../../lib/finance';
import {
  FinancialPeriod,
  getFinancialPeriods,
  financialPeriodLabel,
} from '../../lib/financialMonth';

interface CycleDailyBurnChartProps {
  transactions: Transaction[];
  currentFm: FinancialPeriod | null;
  dailyAllowance: number;
  safeToSpend: number;
  daysUntilPayday: number;
  wallets?: Array<{ id: string; type?: string }>;
  isPrivacyMode: boolean;
}

export const CycleDailyBurnChart: React.FC<CycleDailyBurnChartProps> = ({
  transactions,
  currentFm,
  dailyAllowance,
  safeToSpend,
  daysUntilPayday,
  wallets,
  isPrivacyMode,
}) => {
  const [chartMode, setChartMode] = useState<'daily' | 'cumulative'>('daily');

  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const cycleStart = currentFm ? startOfDay(currentFm.start) : addDays(today, -20);
    const cycleEnd = currentFm ? startOfDay(currentFm.end) : today;
    const effectiveEnd = today < cycleEnd ? today : cycleEnd;
    const totalDaysShown = Math.max(7, Math.min(35, differenceInCalendarDays(effectiveEnd, cycleStart) + 1));
    const windowStart =
      differenceInCalendarDays(effectiveEnd, cycleStart) + 1 > 35
        ? addDays(effectiveEnd, -34)
        : cycleStart;

    const dailySpendMap = new Map<string, number>();
    const dailyIncomeMap = new Map<string, number>();

    transactions.forEach((tx) => {
      const txDay = format(new Date(tx.createdAt), 'yyyy-MM-dd');
      if (tx.type === 'Expense' && isLivingExpense(tx, wallets)) {
        dailySpendMap.set(txDay, (dailySpendMap.get(txDay) || 0) + netExpenseOf(tx));
      } else if (tx.type === 'Income') {
        const netInc = netIncomeOf(tx);
        if (netInc > 0) {
          dailyIncomeMap.set(txDay, (dailyIncomeMap.get(txDay) || 0) + netInc);
        }
      }
    });

    const rows: Array<{
      dateKey: string;
      label: string;
      spend: number;
      income: number;
      rolling7: number;
      cumSpend: number;
      idealPace: number;
      status: 'under' | 'near' | 'over';
    }> = [];

    let cumSpend = 0;
    const recentWindow: number[] = [];

    for (let i = 0; i < totalDaysShown; i++) {
      const d = addDays(windowStart, i);
      const key = format(d, 'yyyy-MM-dd');
      const spend = Math.round((dailySpendMap.get(key) || 0) * 100) / 100;
      const income = Math.round((dailyIncomeMap.get(key) || 0) * 100) / 100;
      cumSpend += spend;
      recentWindow.push(spend);
      if (recentWindow.length > 7) recentWindow.shift();
      const rolling7 =
        recentWindow.reduce((sum, v) => sum + v, 0) / Math.max(1, recentWindow.length);

      const status: 'under' | 'near' | 'over' =
        dailyAllowance <= 0
          ? 'under'
          : spend > dailyAllowance
          ? 'over'
          : spend >= dailyAllowance * 0.8
          ? 'near'
          : 'under';

      rows.push({
        dateKey: key,
        label: format(d, 'MMM d'),
        spend,
        income,
        rolling7: Math.round(rolling7 * 100) / 100,
        cumSpend: Math.round(cumSpend * 100) / 100,
        idealPace: Math.round(dailyAllowance * (i + 1) * 100) / 100,
        status,
      });
    }

    return rows;
  }, [transactions, currentFm, dailyAllowance, wallets]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { peakDayLabel: '—', peakAmount: 0, zeroSpendDays: 0, safePerDay: 0 };
    }
    let peak = chartData[0];
    let zeroSpendDays = 0;
    chartData.forEach((row) => {
      if (row.spend > peak.spend) peak = row;
      if (row.spend === 0) zeroSpendDays++;
    });
    const safePerDay = daysUntilPayday > 0 ? Math.max(0, safeToSpend / daysUntilPayday) : safeToSpend;
    return {
      peakDayLabel: peak.spend > 0 ? peak.label : 'None',
      peakAmount: peak.spend,
      zeroSpendDays,
      safePerDay,
    };
  }, [chartData, safeToSpend, daysUntilPayday]);

  const formatY = (val: number) => {
    if (isPrivacyMode) return '••';
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return `${val.toFixed(0)}`;
  };

  return (
    <div className="flex flex-col h-full justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>
              {chartMode === 'daily' ? 'Daily Living Burn vs Cap' : 'Cumulative Cycle Pace'}
            </span>
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {currentFm
              ? `${financialPeriodLabel(currentFm)} · Daily cap ${isPrivacyMode ? '••••' : dailyAllowance.toFixed(0)} MAD`
              : `Last ${chartData.length} days living spend vs daily cap`}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5">
          <button
            type="button"
            onClick={() => setChartMode('daily')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              chartMode === 'daily'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Daily Burn
          </button>
          <button
            type="button"
            onClick={() => setChartMode('cumulative')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              chartMode === 'cumulative'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Cumulative
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="w-full h-[210px] sm:h-[235px] mt-3">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'daily' ? (
            <ComposedChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                tickFormatter={formatY}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
                      <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
                      <div className="space-y-0.5 font-mono tabular-nums">
                        <p className="text-gray-700 dark:text-gray-200">
                          Burn: {isPrivacyMode ? '••••' : `${row.spend.toFixed(0)} MAD`}
                        </p>
                        <p className="text-indigo-600 dark:text-indigo-400">
                          7d Avg: {isPrivacyMode ? '••••' : `${row.rolling7.toFixed(0)} MAD`}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">
                          Daily Cap: {isPrivacyMode ? '••••' : `${dailyAllowance.toFixed(0)} MAD`}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              {dailyAllowance > 0 && (
                <ReferenceLine
                  y={dailyAllowance}
                  stroke="#6366f1"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
              )}
              <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={18}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.dateKey}
                    fill={
                      entry.status === 'over'
                        ? '#f43f5e'
                        : entry.status === 'near'
                        ? '#f59e0b'
                        : '#10b981'
                    }
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="rolling7"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="cycleCumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                tickFormatter={formatY}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
                      <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
                      <div className="space-y-0.5 font-mono tabular-nums">
                        <p className="text-indigo-600 dark:text-indigo-400">
                          Actual Cumulative: {isPrivacyMode ? '••••' : `${row.cumSpend.toFixed(0)} MAD`}
                        </p>
                        <p className="text-emerald-600 dark:text-emerald-400">
                          Linear Cap Pace: {isPrivacyMode ? '••••' : `${row.idealPace.toFixed(0)} MAD`}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cumSpend"
                stroke="#6366f1"
                strokeWidth={2.2}
                fill="url(#cycleCumGrad)"
              />
              <Line
                type="monotone"
                dataKey="idealPace"
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth={1.75}
                dot={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Micro Telemetry Strip */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Peak Spend Day</p>
          <p className="font-semibold font-mono tabular-nums text-gray-900 dark:text-white truncate">
            {stats.peakDayLabel}{' '}
            <span className="text-rose-600 dark:text-rose-400 font-normal">
              ({isPrivacyMode ? '••••' : `${stats.peakAmount.toFixed(0)} MAD`})
            </span>
          </p>
        </div>
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Zero-Spend Days</p>
          <p className="font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.zeroSpendDays} of {chartData.length}d
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Liquid Safe / Day</p>
          <p className="font-semibold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
            {isPrivacyMode ? '••••' : `${stats.safePerDay.toFixed(0)} MAD/d`}
          </p>
        </div>
      </div>
    </div>
  );
};

interface MultiCycleCashflowChartProps {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  wallets?: Array<{ id: string; type?: string }>;
  isPrivacyMode: boolean;
}

export const MultiCycleCashflowChart: React.FC<MultiCycleCashflowChartProps> = ({
  transactions,
  budgets,
  payrolls,
  wallets,
  isPrivacyMode,
}) => {
  const cycleData = useMemo(() => {
    const periods = getFinancialPeriods(payrolls);
    const recent = periods.slice(-6);
    const now = new Date();

    return recent.map((p) => {
      const isCurrent = now >= p.start && now <= p.end;
      const breakdown = computeFourPillarBreakdown({
        transactions,
        budgets,
        year: p.year,
        month: p.month,
        payrolls,
        wallets,
        isCurrentMonth: isCurrent,
      });
      const label = format(p.end, 'MMM yy');
      return {
        label,
        periodRange: financialPeriodLabel(p),
        income: Math.round(breakdown.periodIncome),
        livingSpend: Math.round(breakdown.totalLivingSpent),
        wealthBuilt: Math.round(breakdown.totalWealthBuilt),
        savingsRate: Math.round(breakdown.totalWealthPctOfIncome),
      };
    });
  }, [transactions, budgets, payrolls, wallets]);

  const formatY = (val: number) => {
    if (isPrivacyMode) return '••';
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return `${val}`;
  };

  if (cycleData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[210px] text-xs text-gray-500 dark:text-gray-400">
        Configure payroll dates in Financial Calendar to visualize multi-cycle trends.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Multi-Cycle Income, Burn &amp; Wealth Built</span>
          </h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Last {cycleData.length} payroll cycles · Living spend vs retained savings &amp; investments
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-emerald-500" /> Net Income
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-xs bg-rose-500" /> Living Spend
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-indigo-500" /> Wealth Built
          </span>
        </div>
      </div>

      <div className="w-full h-[215px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={cycleData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatY}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'rgba(99,102,241,0.06)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
                    <p className="font-semibold text-gray-900 dark:text-white">{d.label}</p>
                    <p className="text-[10px] text-gray-400 mb-1.5">{d.periodRange}</p>
                    <div className="space-y-0.5 font-mono tabular-nums">
                      <p className="text-emerald-600 dark:text-emerald-400">
                        Income: {isPrivacyMode ? '••••' : `${d.income.toLocaleString()} MAD`}
                      </p>
                      <p className="text-rose-600 dark:text-rose-400">
                        Living Spend: {isPrivacyMode ? '••••' : `${d.livingSpend.toLocaleString()} MAD`}
                      </p>
                      <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Wealth Built: {isPrivacyMode ? '••••' : `${d.wealthBuilt.toLocaleString()} MAD`} ({d.savingsRate}%)
                      </p>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="income" fill="#10b981" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="livingSpend" fill="#f43f5e" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Line
              type="monotone"
              dataKey="wealthBuilt"
              stroke="#6366f1"
              strokeWidth={2.2}
              dot={{ r: 3.5, fill: '#6366f1' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface WealthAllocationChartProps {
  kpis: KPI | null;
  stockPortfolioMad: number;
  activeReceivables: number;
  externalAssetsMad: number;
  isPrivacyMode: boolean;
}

const SLICE_COLORS = ['#6366f1', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6'];

export const WealthAllocationChart: React.FC<WealthAllocationChartProps> = ({
  kpis,
  stockPortfolioMad,
  activeReceivables,
  externalAssetsMad,
  isPrivacyMode,
}) => {
  const { slices, grossTotal } = useMemo(() => {
    const accounts = kpis?.accounts || [];
    const bankBal = accounts
      .filter((a) => a.type === 'Bank')
      .reduce((s, a) => s + Math.max(0, a.balance), 0);
    const cashSavingsBal = accounts
      .filter((a) => a.type === 'Cash' || a.type === 'Savings')
      .reduce((s, a) => s + Math.max(0, a.balance), 0);
    const investBal =
      stockPortfolioMad > 0
        ? stockPortfolioMad
        : accounts
            .filter((a) => a.type === 'Investment')
            .reduce((s, a) => s + Math.max(0, a.balance), 0);

    const raw = [
      { name: 'Bank Liquidity', value: bankBal },
      { name: 'Cash & Savings', value: cashSavingsBal },
      { name: 'Investments', value: investBal },
      { name: 'Receivables', value: Math.max(0, activeReceivables) },
      { name: 'External Assets', value: Math.max(0, externalAssetsMad) },
    ]
      .filter((item) => item.value > 0)
      .map((item, idx) => ({
        ...item,
        color: SLICE_COLORS[idx % SLICE_COLORS.length],
      }));

    const sum = raw.reduce((s, r) => s + r.value, 0);
    return { slices: raw, grossTotal: sum };
  }, [kpis, stockPortfolioMad, activeReceivables, externalAssetsMad]);

  if (slices.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">
        Add wallet balances or holdings to view asset composition.
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={62}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                const pct = grossTotal > 0 ? ((d.value / grossTotal) * 100).toFixed(1) : '0';
                return (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-2.5 py-1.5 text-xs shadow-md font-mono tabular-nums">
                    <span className="font-sans font-semibold text-gray-900 dark:text-white">{d.name}: </span>
                    <span className="text-indigo-600 dark:text-indigo-300">
                      {isPrivacyMode ? '••••' : `${d.value.toFixed(0)} MAD`} ({pct}%)
                    </span>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase tracking-wider text-gray-400">Gross</span>
          <span className="text-xs font-bold font-mono tabular-nums text-gray-900 dark:text-white">
            {isPrivacyMode
              ? '••••'
              : grossTotal >= 1000
              ? `${(grossTotal / 1000).toFixed(1)}k`
              : grossTotal.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-1.5 min-w-0">
        {slices.map((s) => {
          const pct = grossTotal > 0 ? (s.value / grossTotal) * 100 : 0;
          return (
            <div key={s.name} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate text-gray-700 dark:text-gray-300">{s.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {isPrivacyMode ? '••••' : `${s.value.toFixed(0)}`}
                </span>
                <span className="text-[11px] text-gray-400 w-9 text-right">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
