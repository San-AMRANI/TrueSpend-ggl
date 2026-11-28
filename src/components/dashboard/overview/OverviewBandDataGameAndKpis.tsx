import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  Activity,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Flame,
  Gauge,
  Target,
  Trophy,
} from 'lucide-react';
import type {
  CategoryBudget,
  DashboardTab,
  Debt,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Subscription,
  Transaction,
} from '../../../types';
import {
  buildCategoryEfficiencyScatter,
  buildFinancialDisciplineRadar,
  buildPaydayCycleCurve,
  buildSpendingHeatmap90d,
  computeDataGameProfile,
  computeExecutiveKpiMatrix,
  type HeatmapDayCell,
} from '../../../lib/dataGameEngine';

interface OverviewBandDataGameProps {
  kpis: KPI | null;
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  debts: Debt[];
  goals: Goal[];
  subscriptions: Subscription[];
  investmentsData?: InvestmentsData | null;
  isPrivacyMode?: boolean;
  setActiveTab?: (tab: DashboardTab) => void;
}

const HEATMAP_COLORS: Record<HeatmapDayCell['intensity'], string> = {
  0: 'bg-emerald-500/80 dark:bg-emerald-500/70',
  1: 'bg-indigo-200 dark:bg-indigo-900/70',
  2: 'bg-indigo-400 dark:bg-indigo-600',
  3: 'bg-amber-400 dark:bg-amber-500',
  4: 'bg-rose-500 dark:bg-rose-500',
};

const QUADRANT_COLOR: Record<string, string> = {
  'Micro-Leak': '#f59e0b',
  'Heavy Hitter': '#6366f1',
  'Core Driver': '#e11d48',
  Quiet: '#10b981',
};

export const OverviewBandDataGameAndKpis: React.FC<OverviewBandDataGameProps> = ({
  kpis,
  transactions,
  budgets,
  payrolls,
  debts,
  goals,
  subscriptions,
  investmentsData = null,
  isPrivacyMode = false,
  setActiveTab,
}) => {
  const [showXpLedger, setShowXpLedger] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDayCell | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'payday_curve' | 'scatter' | 'radar'>('payday_curve');

  const input = useMemo(
    () => ({
      kpis,
      transactions,
      budgets,
      payrolls,
      debts,
      goals,
      subscriptions,
      investmentsData,
    }),
    [kpis, transactions, budgets, payrolls, debts, goals, subscriptions, investmentsData]
  );

  const kpiMatrix = useMemo(() => computeExecutiveKpiMatrix(input), [input]);
  const gameProfile = useMemo(() => computeDataGameProfile(input), [input]);
  const heatmap90 = useMemo(
    () => buildSpendingHeatmap90d(transactions, kpis?.dailyAllowance ?? 0, kpis?.accounts),
    [transactions, kpis?.dailyAllowance, kpis?.accounts]
  );
  const paydayCurve = useMemo(
    () => buildPaydayCycleCurve(transactions, payrolls, kpis?.accounts),
    [transactions, payrolls, kpis?.accounts]
  );
  const scatterPoints = useMemo(
    () => buildCategoryEfficiencyScatter(transactions, kpis?.accounts, 90),
    [transactions, kpis?.accounts]
  );
  const radarAxes = useMemo(() => buildFinancialDisciplineRadar(input), [input]);

  // Organize 90-day heatmap into columns of 7 (Sun -> Sat)
  const heatmapWeeks = useMemo(() => {
    if (heatmap90.length === 0) return [];
    const padded: Array<HeatmapDayCell | null> = [];
    const leadingBlanks = heatmap90[0].dayOfWeek;
    for (let i = 0; i < leadingBlanks; i += 1) padded.push(null);
    for (const c of heatmap90) padded.push(c);
    while (padded.length % 7 !== 0) padded.push(null);

    const weeks: Array<Array<HeatmapDayCell | null>> = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }
    return weeks;
  }, [heatmap90]);

  const completedChallenges = gameProfile.challenges.filter((c) => c.status === 'completed').length;

  return (
    <div className="space-y-4">
      {/* ═════════════════════════════════════════════════════════════════════
          1. EXECUTIVE KPI MATRIX (12 Live Ledger Metrics)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-4 py-3 sm:px-5 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
              Financial Intelligence KPI Matrix
            </h3>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            12 behavioral &amp; balance-sheet metrics computed live from your ledger
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 divide-x divide-y divide-gray-100 dark:divide-gray-800">
          {kpiMatrix.map((tile) => {
            const valueColor =
              tile.tone === 'positive'
                ? 'text-emerald-600 dark:text-emerald-400'
                : tile.tone === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : tile.tone === 'negative'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-gray-900 dark:text-gray-100';

            return (
              <div key={tile.id} className="p-3.5 space-y-1">
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                  {tile.label}
                </p>
                <p className={`text-base sm:text-lg font-bold font-mono tabular-nums truncate ${valueColor}`}>
                  {isPrivacyMode && tile.maskable ? '••••' : tile.value}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {tile.sublabel}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          2. FINANCIAL DATA GAME + 90-DAY SPENDING INTENSITY HEATMAP
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* LEFT (5 cols): Financial Mastery Level & Active Behavioral Challenges */}
        <div className="lg:col-span-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  <span>Financial Data Game · Level {gameProfile.level}</span>
                </p>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {gameProfile.tierTitle}
                </h3>
              </div>
              <div className="text-right font-mono tabular-nums">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {gameProfile.totalXp.toLocaleString()} XP
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {completedChallenges}/{gameProfile.challenges.length} challenges won
                </p>
              </div>
            </div>

            {/* Level Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${gameProfile.levelProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                <span>
                  {gameProfile.currentLevelXp} / {gameProfile.nextLevelXp} XP to Level{' '}
                  {gameProfile.level + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setShowXpLedger((p) => !p)}
                  className="font-sans font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  <span>XP math</span>
                  {showXpLedger ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>

            {showXpLedger && (
              <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-3 space-y-1.5 text-xs">
                {gameProfile.xpBreakdown.map((row) => (
                  <div key={row.source} className="flex items-center justify-between gap-2">
                    <span className="text-gray-600 dark:text-gray-300">
                      {row.source}{' '}
                      <span className="text-[11px] text-gray-400">({row.detail})</span>
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white shrink-0">
                      +{row.xp} XP
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Live Behavioral Challenges */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-indigo-500" />
                  Active Ledger Challenges
                </span>
                <span className="text-[11px] text-gray-400">Auto-tracked live</span>
              </div>

              <div className="space-y-2.5">
                {gameProfile.challenges.map((ch) => (
                  <div key={ch.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate flex items-center gap-1.5">
                        {ch.status === 'completed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <Flame className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="truncate">{ch.title}</span>
                      </span>
                      <span className="font-mono tabular-nums text-[11px] shrink-0 text-gray-600 dark:text-gray-300">
                        {ch.currentLabel} ·{' '}
                        <span className="text-gray-400">{ch.targetLabel}</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ch.status === 'completed'
                            ? 'bg-emerald-500'
                            : ch.status === 'on_track'
                            ? 'bg-indigo-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${ch.progressPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {setActiveTab && (
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Streak:{' '}
                <strong className="font-mono tabular-nums text-gray-900 dark:text-white">
                  {gameProfile.currentUnderCapStreak}d
                </strong>{' '}
                (Best {gameProfile.bestUnderCapStreak}d)
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Explore Deep Analytics →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT (7 cols): 90-Day Spending Intensity Heatmap & Personal Records */}
        <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>90-Day Daily Spend &amp; Zero-Spend Heatmap</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Emerald marks Zero-Spend days · Hover any square to inspect daily spend &amp; tx count
                </p>
              </div>
              <div className="text-xs font-mono tabular-nums text-right">
                {hoveredDay ? (
                  <div>
                    <span className="font-sans font-semibold text-gray-900 dark:text-white">
                      {hoveredDay.label}
                    </span>
                    <div className="text-gray-500 dark:text-gray-400">
                      {hoveredDay.spent === 0
                        ? '0 MAD (Zero-Spend Day)'
                        : `${isPrivacyMode ? '••••' : hoveredDay.spent.toLocaleString()} MAD · ${hoveredDay.txCount} tx`}
                    </div>
                  </div>
                ) : (
                  <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {gameProfile.zeroSpendDays30d} zero-spend days (30d)
                  </div>
                )}
              </div>
            </div>

            {/* 7-row x 13-week Grid */}
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex items-start gap-2 min-w-full">
                <div className="grid grid-rows-7 gap-1.5 text-[10px] font-mono text-gray-400 pt-0.5 pr-1 select-none">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>
                <div
                  className="grid gap-1.5 flex-1"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, heatmapWeeks.length)}, minmax(0, 1fr))` }}
                >
                  {heatmapWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="grid grid-rows-7 gap-1.5">
                      {week.map((cell, dIdx) =>
                        cell ? (
                          <button
                            key={cell.dateKey}
                            type="button"
                            onMouseEnter={() => setHoveredDay(cell)}
                            onFocus={() => setHoveredDay(cell)}
                            title={`${cell.label}: ${cell.spent} MAD (${cell.txCount} txs)`}
                            className={`h-4 sm:h-4.5 w-full rounded-[3px] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-indigo-500 cursor-pointer ${HEATMAP_COLORS[cell.intensity]}`}
                            aria-label={`${cell.label}: ${cell.spent} MAD`}
                          />
                        ) : (
                          <div key={`blank-${wIdx}-${dIdx}`} className="h-4 sm:h-4.5 w-full" />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Last 90 calendar days</span>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500/80" /> Zero-Spend
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-indigo-200 dark:bg-indigo-900/70" /> Light
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-indigo-400 dark:bg-indigo-600" /> Moderate
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-amber-400 dark:bg-amber-500" /> Heavy
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-rose-500" /> Over Cap
                </span>
              </div>
            </div>
          </div>

          {/* Personal Records Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            {gameProfile.records.map((rec) => (
              <div key={rec.id} className="space-y-0.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Award className="h-3 w-3 text-indigo-500 shrink-0" />
                  <span className="truncate">{rec.label}</span>
                </p>
                <p className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  {isPrivacyMode && rec.id === 'leanest_week' ? '••••' : rec.value}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{rec.context}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          3. CREATIVE ANALYTICS STUDIO (Payday Wave · Micro-Leak Scatter · Radar)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {activeChartTab === 'payday_curve' ? (
                <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : activeChartTab === 'scatter' ? (
                <Compass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>
                {activeChartTab === 'payday_curve'
                  ? 'Payday-to-Payday Spend Wave (Cycle Day 1 → 30)'
                  : activeChartTab === 'scatter'
                  ? 'Category Frequency vs Ticket Size Matrix (90d)'
                  : '6-Axis Financial Discipline Radar'}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {activeChartTab === 'payday_curve'
                ? 'Compares your historical average daily outflow across cycle days against your current cycle.'
                : activeChartTab === 'scatter'
                ? 'Distinguishes high-frequency Micro-Leaks (bottom-right) from low-frequency Heavy Hitters (top-left).'
                : 'Balanced multi-dimensional audit across Savings, Budgets, Cash Cushion, Daily Cap, Cost Agility & Wealth Mix.'}
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5 self-start sm:self-auto">
            {(
              [
                { id: 'payday_curve', label: 'Payday Wave' },
                { id: 'scatter', label: 'Micro-Leak Matrix' },
                { id: 'radar', label: 'Discipline Radar' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveChartTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeChartTab === tab.id
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Payday-to-Payday Cycle Spend Wave */}
        {activeChartTab === 'payday_curve' && (
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paydayCurve} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="paydayAvgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg text-xs font-mono tabular-nums space-y-1">
                        <div className="font-sans font-semibold text-gray-900 dark:text-white">
                          Cycle Day {row.cycleDay}
                        </div>
                        <div className="flex justify-between gap-4 text-indigo-600 dark:text-indigo-400">
                          <span>Historical Avg</span>
                          <span>{isPrivacyMode ? '••••' : `${row.avgSpend} MAD`}</span>
                        </div>
                        <div className="flex justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                          <span>Current Cycle</span>
                          <span>{isPrivacyMode ? '••••' : `${row.currentCycleSpend} MAD`}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgSpend"
                  name="Historical Cycle Avg"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#paydayAvgGrad)"
                />
                <Bar
                  dataKey="currentCycleSpend"
                  name="Current Cycle"
                  fill="#10b981"
                  fillOpacity={0.75}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={14}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tab 2: Category Frequency vs Average Ticket Scatter Matrix */}
        {activeChartTab === 'scatter' && (
          <div className="space-y-3">
            {scatterPoints.length > 0 ? (
              <>
                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 12, right: 18, left: -8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
                      <XAxis
                        type="number"
                        dataKey="txCount"
                        name="Transactions"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: 'Transaction Frequency (90d)',
                          position: 'insideBottom',
                          offset: -4,
                          fontSize: 11,
                          fill: '#94a3b8',
                        }}
                      />
                      <YAxis
                        type="number"
                        dataKey="avgTicket"
                        name="Avg Ticket"
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={52}
                      />
                      <ZAxis type="number" dataKey="totalSpent" range={[60, 420]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const pt = payload[0]?.payload;
                          return (
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg text-xs font-mono tabular-nums space-y-1">
                              <div className="font-sans font-semibold text-gray-900 dark:text-white">
                                {pt.category}
                              </div>
                              <div className="text-[11px] font-sans text-gray-500">
                                Profile: <strong>{pt.quadrant}</strong>
                              </div>
                              <div>Frequency: {pt.txCount} transactions</div>
                              <div>
                                Avg Ticket: {isPrivacyMode ? '••••' : `${pt.avgTicket} MAD`}
                              </div>
                              <div>
                                90d Total: {isPrivacyMode ? '••••' : `${pt.totalSpent} MAD`}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterPoints}>
                        {scatterPoints.map((pt) => (
                          <Cell
                            key={pt.category}
                            fill={QUADRANT_COLOR[pt.quadrant] || '#6366f1'}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {Object.entries(QUADRANT_COLOR).map(([label, color]) => (
                    <span key={label} className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                  <span className="ml-auto font-mono">Bubble size = 90d total spend</span>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-xs text-gray-500 dark:text-gray-400">
                Log living expenses across categories to visualize frequency vs ticket size.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: 6-Axis Financial Discipline Radar */}
        {activeChartTab === 'radar' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-6 h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarAxes} outerRadius="74%">
                  <PolarGrid stroke="rgba(148,163,184,0.28)" />
                  <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                  />
                  <Radar
                    name="Discipline"
                    dataKey="score"
                    stroke="#4f46e5"
                    fill="#6366f1"
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0]?.payload;
                      return (
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2.5 shadow-lg text-xs">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {pt.axis}: <span className="font-mono">{pt.score}/100</span>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {pt.detail}
                          </div>
                        </div>
                      );
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="md:col-span-6 divide-y divide-gray-100 dark:divide-gray-800">
              {radarAxes.map((item) => (
                <div key={item.axis} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {item.axis}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {item.detail}
                    </p>
                  </div>
                  <span
                    className={`font-mono tabular-nums text-sm font-bold shrink-0 ${
                      item.score >= 75
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : item.score >= 45
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {item.score}/100
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewBandDataGameAndKpis;
