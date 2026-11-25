import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
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
} from 'recharts';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Gauge,
  Layers,
  Receipt,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import type { CategoryBudget, KPI, Payroll, Transaction, Wallet } from '../../types';
import type { FinancialPeriod } from '../../lib/financialMonth';
import {
  buildBudgetPacingSeries,
  buildDailyLivingBurnSeries,
  buildMultiCycleTrendSeries,
  buildSpendSizeDistribution,
  buildTopCategoriesMultiCycleTrend,
  buildWeekdaySpendProfile,
} from '../../lib/analyticsCharts';

const formatCompact = (val: number) => {
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return `${Math.round(val)}`;
};

/* ──────────────────────────────────────────────────────────────────────────
 * 1. Daily Living Burn vs Cap (with Daily Burn / Cumulative Pace Toggle)
 * ────────────────────────────────────────────────────────────────────────── */
interface AnalyticsDailyBurnCardProps {
  transactions: Transaction[];
  period: FinancialPeriod | null;
  kpis?: KPI | null;
  periodLivingBudget?: number;
  wallets?: Wallet[];
}

export const AnalyticsDailyBurnCard: React.FC<AnalyticsDailyBurnCardProps> = ({
  transactions,
  period,
  kpis = null,
  periodLivingBudget = 0,
  wallets = [],
}) => {
  const [mode, setMode] = useState<'daily' | 'cumulative'>('daily');

  const series = useMemo(() => {
    const isCurrentPeriod =
      period && new Date() >= period.start && new Date() <= period.end;
    const dailyAllowanceHint =
      isCurrentPeriod && kpis?.dailyAllowance && kpis.dailyAllowance > 0
        ? kpis.dailyAllowance
        : 0;
    return buildDailyLivingBurnSeries({
      transactions,
      period,
      dailyAllowanceHint,
      periodBudgetTotal: periodLivingBudget,
      wallets,
    });
  }, [transactions, period, kpis, periodLivingBudget, wallets]);

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                {mode === 'daily'
                  ? 'Daily Living Burn vs Cap'
                  : 'Cumulative Living Spend vs Cap Pace'}
              </span>
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {series.periodCaption} · Living expenses only (excludes savings &amp; investments)
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode('daily')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'daily'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Daily Burn
            </button>
            <button
              type="button"
              onClick={() => setMode('cumulative')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'cumulative'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Cumulative Pace
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {mode === 'daily' ? (
              <ComposedChart
                data={series.points}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
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
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
                        <div className="space-y-0.5 font-mono tabular-nums">
                          <p className="text-gray-800 dark:text-gray-200">
                            Daily Burn: {Math.round(row.spend).toLocaleString()} MAD
                          </p>
                          <p className="text-indigo-600 dark:text-indigo-400">
                            7-Day Avg: {Math.round(row.rolling7).toLocaleString()} MAD
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            Daily Cap: {series.dailyCap.toLocaleString()} MAD
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                {series.dailyCap > 0 && (
                  <ReferenceLine
                    y={series.dailyCap}
                    stroke="#6366f1"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Cap ${series.dailyCap.toLocaleString()}`,
                      position: 'insideTopRight',
                      fill: '#6366f1',
                      fontSize: 10,
                    }}
                  />
                )}
                <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                  {series.points.map((entry) => (
                    <Cell
                      key={entry.dateKey}
                      fill={
                        entry.status === 'over'
                          ? '#f43f5e'
                          : entry.status === 'near'
                          ? '#f59e0b'
                          : '#10b981'
                      }
                      fillOpacity={0.86}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="rolling7"
                  stroke="#6366f1"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            ) : (
              <AreaChart
                data={series.points}
                margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="analyticsCumBurnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload;
                    return (
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1">{label}</p>
                        <div className="space-y-0.5 font-mono tabular-nums">
                          <p className="text-indigo-600 dark:text-indigo-400">
                            Actual Cumulative: {Math.round(row.cumSpend).toLocaleString()} MAD
                          </p>
                          <p className="text-emerald-600 dark:text-emerald-400">
                            Cap Pace Target: {Math.round(row.idealPace).toLocaleString()} MAD
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
                  strokeWidth={2.4}
                  fill="url(#analyticsCumBurnGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="idealPace"
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.8}
                  dot={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Summary Telemetry Strip */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Peak Spend Day</p>
            <p className="font-semibold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
              {series.peakDayLabel}{' '}
              <span className="text-rose-600 dark:text-rose-400 font-normal">
                ({series.peakAmount.toLocaleString()} MAD)
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Avg Daily Living Burn</p>
            <p className="font-semibold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
              {series.avgDailySpend.toLocaleString()} MAD/day
            </p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">Zero-Spend Days</p>
            <p className="font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {series.zeroSpendDays} of {series.points.length} days
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-gray-500 dark:text-gray-400">Days Under Cap</p>
            <p className="font-semibold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
              {series.daysUnderCapPct}% ({series.daysUnderCap}/{series.points.length})
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
 * 2. Multi-Cycle Cashflow, Living Burn & Savings Rate Trend
 * ────────────────────────────────────────────────────────────────────────── */
interface AnalyticsMultiCycleTrendCardProps {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  wallets?: Wallet[];
}

export const AnalyticsMultiCycleTrendCard: React.FC<AnalyticsMultiCycleTrendCardProps> = ({
  transactions,
  budgets,
  payrolls,
  wallets = [],
}) => {
  const data = useMemo(
    () => buildMultiCycleTrendSeries({ transactions, budgets, payrolls, wallets, maxCycles: 6 }),
    [transactions, budgets, payrolls, wallets]
  );

  if (data.length < 2) return null;

  const avgSavingsRate = Math.round(
    data.reduce((s, r) => s + r.savingsRate, 0) / data.length
  );

  return (
    <Card className="border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Multi-Cycle Income, Living Spend &amp; Savings Rate</span>
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Last {data.length} payroll cycles · Avg savings rate{' '}
              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                {avgSavingsRate}%
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" /> Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-rose-500" /> Living Spend
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Savings Rate %
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="mad"
                tickFormatter={formatCompact}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[-20, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: '#6366f1' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  return (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg">
                      <p className="font-semibold text-gray-900 dark:text-white">{row.label}</p>
                      <p className="text-[11px] text-gray-400 mb-1.5">{row.periodRange}</p>
                      <div className="space-y-0.5 font-mono tabular-nums">
                        <p className="text-emerald-600 dark:text-emerald-400">
                          Income: {row.income.toLocaleString()} MAD
                        </p>
                        <p className="text-rose-600 dark:text-rose-400">
                          Living Spend: {row.livingSpend.toLocaleString()} MAD
                        </p>
                        <p className="text-gray-700 dark:text-gray-300">
                          Net Surplus: {row.netSurplus >= 0 ? '+' : ''}
                          {row.netSurplus.toLocaleString()} MAD
                        </p>
                        <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          Savings Rate: {row.savingsRate}%
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar yAxisId="mad" dataKey="income" fill="#10b981" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              <Bar yAxisId="mad" dataKey="livingSpend" fill="#f43f5e" fillOpacity={0.82} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              <Line
                yAxisId="pct"
                type="monotone"
                dataKey="savingsRate"
                stroke="#6366f1"
                strokeWidth={2.4}
                dot={{ r: 4, fill: '#6366f1' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
 * 3. Behavioral Insights Row: Weekday Cadence + Ticket-Size Distribution
 * ────────────────────────────────────────────────────────────────────────── */
interface AnalyticsBehaviorRowProps {
  filteredTransactions: Transaction[];
  wallets?: Wallet[];
}

export const AnalyticsBehaviorRow: React.FC<AnalyticsBehaviorRowProps> = ({
  filteredTransactions,
  wallets = [],
}) => {
  const weekdayData = useMemo(
    () => buildWeekdaySpendProfile(filteredTransactions, wallets),
    [filteredTransactions, wallets]
  );

  const sizeData = useMemo(
    () => buildSpendSizeDistribution(filteredTransactions, wallets),
    [filteredTransactions, wallets]
  );

  const peakDay = weekdayData.find((d) => d.isPeak);
  const topBucket = sizeData
    .slice()
    .sort((a, b) => b.totalAmount - a.totalAmount)[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Weekday Spending Cadence */}
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Weekday Spending Cadence</span>
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {peakDay && peakDay.avgSpend > 0
              ? `Peak living spend averages ${peakDay.avgSpend.toLocaleString()} MAD on ${peakDay.dayName}s (${peakDay.sharePct}% of total)`
              : 'Average daily living spend by day of the week'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[230px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} />
                <Tooltip
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload;
                    return (
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1">{row.dayName}</p>
                        <div className="space-y-0.5 font-mono tabular-nums">
                          <p className="text-gray-800 dark:text-gray-200">Avg Active Day: {row.avgSpend.toLocaleString()} MAD</p>
                          <p className="text-gray-500 dark:text-gray-400">Total: {row.totalSpend.toLocaleString()} MAD ({row.txCount} tx)</p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avgSpend" radius={[6, 6, 0, 0]} maxBarSize={32}>
                  {weekdayData.map((entry) => (
                    <Cell
                      key={entry.shortName}
                      fill={
                        entry.isPeak ? '#f59e0b' : entry.isLowest ? '#10b981' : '#6366f1'
                      }
                      fillOpacity={0.86}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
            <span>Amber = Highest spend day</span>
            <span>Emerald = Lowest spend day</span>
          </div>
        </CardContent>
      </Card>

      {/* Spend-Size Ticket Distribution */}
      <Card className="border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Purchase Size Distribution (Micro vs Big-Ticket)</span>
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {topBucket && topBucket.totalAmount > 0
              ? `${topBucket.label} (${topBucket.rangeLabel}) drives ${topBucket.amountSharePct}% of spend across ${topBucket.txCount} transactions`
              : 'Reveals whether frequent small purchases or big-ticket items drive your outflow'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[230px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="rangeLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} />
                <Tooltip
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload;
                    return (
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1">
                          {row.label} ({row.rangeLabel} MAD)
                        </p>
                        <div className="space-y-0.5 font-mono tabular-nums">
                          <p className="text-gray-800 dark:text-gray-200">
                            Total: {row.totalAmount.toLocaleString()} MAD ({row.amountSharePct}%)
                          </p>
                          <p className="text-gray-500 dark:text-gray-400">
                            Count: {row.txCount} tx ({row.countSharePct}% of volume)
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="totalAmount" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {sizeData.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} fillOpacity={0.86} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {sizeData.map((b) => (
              <span key={b.id}>
                {b.label}: {b.txCount}tx
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
 * 4. Categories Sub-Tab Deep Charts: Budget Pacing vs Time + 6-Cycle Drift
 * ────────────────────────────────────────────────────────────────────────── */
const STACK_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#f43f5e', '#94a3b8'];

interface AnalyticsCategoryDeepChartsProps {
  budgets: CategoryBudget[];
  filteredTransactions: Transaction[];
  allTransactions: Transaction[];
  payrolls: Payroll[];
  year: number;
  month: number;
  elapsedPercent: number;
  wallets?: Wallet[];
}

export const AnalyticsCategoryDeepCharts: React.FC<AnalyticsCategoryDeepChartsProps> = ({
  budgets,
  filteredTransactions,
  allTransactions,
  payrolls,
  year,
  month,
  elapsedPercent,
  wallets = [],
}) => {
  const pacingData = useMemo(
    () =>
      buildBudgetPacingSeries({
        budgets,
        filteredTransactions,
        year,
        month,
        wallets,
      }),
    [budgets, filteredTransactions, year, month, wallets]
  );

  const trendData = useMemo(
    () =>
      buildTopCategoriesMultiCycleTrend({
        transactions: allTransactions,
        payrolls,
        wallets,
        maxCycles: 6,
        topN: 5,
      }),
    [allTransactions, payrolls, wallets]
  );

  const showPacing = pacingData.length > 0;
  const showTrend = trendData.series.length >= 2 && trendData.categories.length > 0;

  if (!showPacing && !showTrend) return null;

  return (
    <div className={showPacing && showTrend ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'}>
      {/* Budget Utilization vs Cycle Elapsed Time */}
      {showPacing && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Budget Pacing vs Cycle Time Elapsed</span>
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Compares each living category&apos;s cap usage against {Math.round(elapsedPercent)}% of cycle elapsed.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pacingData}
                  layout="vertical"
                  margin={{ top: 14, right: 20, left: 6, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
                  <XAxis
                    type="number"
                    domain={[0, 140]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortCategory"
                    width={136}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      return (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-xs shadow-lg">
                          <p className="font-semibold text-gray-900 dark:text-white mb-1">{row.category}</p>
                          <div className="space-y-0.5 font-mono tabular-nums">
                            <p className="text-gray-800 dark:text-gray-200">
                              Spent: {row.spent.toLocaleString()} / {row.budget.toLocaleString()} MAD
                            </p>
                            <p className="text-indigo-600 dark:text-indigo-400">
                              Used: {row.pctUsed}% vs {Math.round(elapsedPercent)}% cycle elapsed
                            </p>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {elapsedPercent > 0 && elapsedPercent < 100 && (
                    <ReferenceLine
                      x={Math.round(elapsedPercent)}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      strokeWidth={1.6}
                      label={{
                        value: `${Math.round(elapsedPercent)}% time`,
                        position: 'top',
                        fill: '#6366f1',
                        fontSize: 10,
                      }}
                    />
                  )}
                  <ReferenceLine x={100} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1.2} />
                  <Bar dataKey="cappedPct" barSize={16} radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {pacingData.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={
                          entry.status === 'over'
                            ? '#f43f5e'
                            : entry.status === 'watch'
                            ? '#f59e0b'
                            : '#10b981'
                        }
                        fillOpacity={0.86}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 5 Categories Multi-Cycle Evolution */}
      {showTrend && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Top Living Categories Across Cycles</span>
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Spot category creep across your last {trendData.series.length} financial cycles.
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[245px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      `${Number(value).toLocaleString()} MAD`,
                      name,
                    ]}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  {trendData.categories.map((cat, idx) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="cats"
                      fill={STACK_COLORS[idx % STACK_COLORS.length]}
                      fillOpacity={0.88}
                      maxBarSize={32}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
              {trendData.categories.map((cat, idx) => (
                <span key={cat} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-xs shrink-0"
                    style={{ backgroundColor: STACK_COLORS[idx % STACK_COLORS.length] }}
                  />
                  <span className="truncate max-w-[130px]">{cat}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
