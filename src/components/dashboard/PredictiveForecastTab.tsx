import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Calendar,
  Target,
  WalletCards,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  BarChart3,
  Compass,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { SpexAvatar } from '../common/SpexAvatar';
import {
  CategoryBudget,
  DashboardTab,
  Debt,
  FinancialContext,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Subscription,
  Transaction,
} from '../../types';
import {
  computeHolisticForecast,
  WhatIfScenarioParams,
} from '../../lib/predictiveEngine';

interface PredictiveForecastTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
  payrolls: Payroll[];
  budgets: CategoryBudget[];
  subscriptions: Subscription[];
  debts: Debt[];
  goals: Goal[];
  contexts: FinancialContext[];
  investmentsData?: InvestmentsData | null;
  setActiveTab: (tab: DashboardTab) => void;
}

const DEFAULT_WHAT_IF: WhatIfScenarioParams = {
  discretionaryCutPercent: 0,
  extraMonthlyDcaMad: 0,
  oneTimeShockMad: 0,
  incomeDeltaMad: 0,
  cancelReviewingSubs: false,
};

export const PredictiveForecastTab: React.FC<PredictiveForecastTabProps> = ({
  kpis,
  transactions,
  payrolls,
  budgets,
  subscriptions,
  debts,
  goals,
  contexts,
  investmentsData = null,
  setActiveTab,
}) => {
  const [whatIf, setWhatIf] = useState<WhatIfScenarioParams>(DEFAULT_WHAT_IF);
  const [horizonMonths, setHorizonMonths] = useState<6 | 12 | 24>(12);
  const [activeSection, setActiveSection] = useState<
    'all' | 'trajectory' | 'cashflow' | 'categories' | 'goals'
  >('all');

  const forecast = useMemo(
    () =>
      computeHolisticForecast({
        kpis,
        transactions,
        payrolls,
        budgets,
        subscriptions,
        debts,
        goals,
        contexts,
        investmentsData,
        whatIf,
      }),
    [
      kpis,
      transactions,
      payrolls,
      budgets,
      subscriptions,
      debts,
      goals,
      contexts,
      investmentsData,
      whatIf,
    ]
  );

  const isWhatIfModified =
    whatIf.discretionaryCutPercent !== 0 ||
    whatIf.extraMonthlyDcaMad !== 0 ||
    whatIf.oneTimeShockMad !== 0 ||
    whatIf.incomeDeltaMad !== 0 ||
    whatIf.cancelReviewingSubs;

  const horizonSeries = useMemo(
    () => forecast.horizonTrajectory24m.slice(0, horizonMonths + 1),
    [forecast.horizonTrajectory24m, horizonMonths]
  );

  const targetHorizonPoint =
    horizonSeries[horizonSeries.length - 1] || forecast.horizonTrajectory24m[12];

  const netWorthGainAtHorizon =
    (targetHorizonPoint?.simulatedNetWorth ?? forecast.currentNetWorth) -
    forecast.currentNetWorth;

  const upcomingEvents30d = useMemo(
    () => forecast.dailyCashFlow30d.filter((d) => d.events.length > 0),
    [forecast.dailyCashFlow30d]
  );

  const applyPreset = (preset: 'baseline' | 'lean_dca' | 'purchase_shock' | 'income_boost') => {
    if (preset === 'baseline') {
      setWhatIf(DEFAULT_WHAT_IF);
    } else if (preset === 'lean_dca') {
      setWhatIf({
        discretionaryCutPercent: 15,
        extraMonthlyDcaMad: 1000,
        oneTimeShockMad: 0,
        incomeDeltaMad: 0,
        cancelReviewingSubs: true,
      });
    } else if (preset === 'purchase_shock') {
      setWhatIf({
        discretionaryCutPercent: 0,
        extraMonthlyDcaMad: 0,
        oneTimeShockMad: -3500,
        incomeDeltaMad: 0,
        cancelReviewingSubs: false,
      });
    } else if (preset === 'income_boost') {
      setWhatIf({
        discretionaryCutPercent: 10,
        extraMonthlyDcaMad: 1500,
        oneTimeShockMad: 0,
        incomeDeltaMad: 2000,
        cancelReviewingSubs: false,
      });
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* ── Top Header & Data Synthesis Telemetry ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <SpexAvatar className="h-12 w-12 shrink-0" animated />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Holistic Predictive Intelligence &amp; Forecasting</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Synthesized live across {forecast.dataPointsAnalyzed.transactions} transactions ·{' '}
              {forecast.dataPointsAnalyzed.wallets} wallets · {forecast.dataPointsAnalyzed.budgets}{' '}
              budgets · {forecast.dataPointsAnalyzed.subscriptions} subscriptions ·{' '}
              {forecast.dataPointsAnalyzed.debts} debts · {forecast.dataPointsAnalyzed.goals} goals
            </p>
          </div>
        </div>

        {/* Section Filter Bar */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Forecasts' },
              { id: 'trajectory', label: 'Wealth Trajectory' },
              { id: 'cashflow', label: '30d Cash Runway' },
              { id: 'categories', label: 'Category Burn Radar' },
              { id: 'goals', label: 'Goals & Seasonality' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeSection === tab.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 1: Executive Multi-Horizon KPI Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Current Net Worth */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Current Unified Net Worth</span>
              <Compass className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 font-mono">
              {forecast.currentNetWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
              <span>Cash {forecast.currentLiquidity.toFixed(0)}</span>
              <span aria-hidden="true">·</span>
              <span>Portfolio {forecast.currentPortfolioMad.toFixed(0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 90-Day Forecast */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>90-Day Projected Net Worth</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1.5 font-mono">
              {forecast.projectedNetWorth90d.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
              MAD
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {forecast.projectedNetWorth90d >= forecast.currentNetWorth ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />+
                  {(forecast.projectedNetWorth90d - forecast.currentNetWorth).toFixed(0)} MAD
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-0.5">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  {(forecast.projectedNetWorth90d - forecast.currentNetWorth).toFixed(0)} MAD
                </span>
              )}
              <span className="text-gray-500 dark:text-gray-400">over next 3 payroll cycles</span>
            </div>
          </CardContent>
        </Card>

        {/* Selected Horizon Forecast */}
        <Card className="border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-medium">
              <span>{horizonMonths}-Month Projected Net Worth</span>
              <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-indigo-950 dark:text-white mt-1.5 font-mono">
              {(targetHorizonPoint?.simulatedNetWorth ?? 0).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{' '}
              MAD
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-indigo-800/80 dark:text-indigo-300/80">
              <span>
                {netWorthGainAtHorizon >= 0 ? '+' : ''}
                {netWorthGainAtHorizon.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                net change
              </span>
              <span aria-hidden="true">·</span>
              <span>{forecast.savingsRateSimulated.toFixed(1)}% savings rate</span>
            </div>
          </CardContent>
        </Card>

        {/* 30-Day Liquidity Floor & Runway */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>30-Day Liquidity Floor &amp; Runway</span>
              <ShieldCheck
                className={`h-4 w-4 ${
                  forecast.hasLiquidityPinchBeforePayday ? 'text-rose-500' : 'text-emerald-500'
                }`}
              />
            </div>
            <p
              className={`text-2xl font-bold mt-1.5 font-mono ${
                forecast.hasLiquidityPinchBeforePayday
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {forecast.lowest30dBalance.toLocaleString()} MAD
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Low on {forecast.lowest30dDateLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{forecast.survivalRunwayDays}d survival runway</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Interactive "What-If" Scenario Simulator ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Interactive What-If Scenario Simulator</span>
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Adjust spending cuts, DCA investments, or one-time shocks to see real-time effects across every chart and goal ETA below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('lean_dca')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Lean +1,000 DCA
              </button>
              <button
                type="button"
                onClick={() => applyPreset('purchase_shock')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                −3,500 MAD Purchase
              </button>
              <button
                type="button"
                onClick={() => applyPreset('income_boost')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              >
                +2,000 MAD Income Boost
              </button>
              {isWhatIfModified && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyPreset('baseline')}
                  className="text-xs flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Slider 1: Discretionary Cut */}
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Trim Variable Spend
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  −{whatIf.discretionaryCutPercent}% (
                  {((forecast.monthlyVariableBurn * whatIf.discretionaryCutPercent) / 100).toFixed(
                    0
                  )}{' '}
                  MAD/mo)
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={5}
                value={whatIf.discretionaryCutPercent}
                onChange={(e) =>
                  setWhatIf((prev) => ({
                    ...prev,
                    discretionaryCutPercent: Number(e.target.value),
                  }))
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0% (Current)</span>
                <span>20%</span>
                <span>40% Cut</span>
              </div>
            </div>

            {/* Slider 2: Extra Monthly DCA */}
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Extra Monthly DCA
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  +{whatIf.extraMonthlyDcaMad} MAD/mo
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={250}
                value={whatIf.extraMonthlyDcaMad}
                onChange={(e) =>
                  setWhatIf((prev) => ({
                    ...prev,
                    extraMonthlyDcaMad: Number(e.target.value),
                  }))
                }
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0 MAD</span>
                <span>2,500 MAD</span>
                <span>5,000 MAD</span>
              </div>
            </div>

            {/* Slider 3: One-Time Cash Shock / Windfall */}
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  One-Time Shock / Windfall
                </span>
                <span
                  className={`font-mono font-bold ${
                    whatIf.oneTimeShockMad < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : whatIf.oneTimeShockMad > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {whatIf.oneTimeShockMad > 0 ? '+' : ''}
                  {whatIf.oneTimeShockMad} MAD
                </span>
              </div>
              <input
                type="range"
                min={-10000}
                max={10000}
                step={500}
                value={whatIf.oneTimeShockMad}
                onChange={(e) =>
                  setWhatIf((prev) => ({
                    ...prev,
                    oneTimeShockMad: Number(e.target.value),
                  }))
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>−10k Purchase</span>
                <span>0</span>
                <span>+10k Bonus</span>
              </div>
            </div>

            {/* Slider 4: Monthly Income Delta */}
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Monthly Income Delta
                </span>
                <span
                  className={`font-mono font-bold ${
                    whatIf.incomeDeltaMad < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : whatIf.incomeDeltaMad > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {whatIf.incomeDeltaMad > 0 ? '+' : ''}
                  {whatIf.incomeDeltaMad} MAD/mo
                </span>
              </div>
              <input
                type="range"
                min={-3000}
                max={5000}
                step={250}
                value={whatIf.incomeDeltaMad}
                onChange={(e) =>
                  setWhatIf((prev) => ({
                    ...prev,
                    incomeDeltaMad: Number(e.target.value),
                  }))
                }
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>−3,000</span>
                <span>0</span>
                <span>+5,000 MAD</span>
              </div>
            </div>
          </div>

          {/* Bottom Summary Bar of What-If Impact */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={whatIf.cancelReviewingSubs}
                onChange={(e) =>
                  setWhatIf((prev) => ({ ...prev, cancelReviewingSubs: e.target.checked }))
                }
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                Simulate trimming 35% of recurring subscription overhead (+
                {(forecast.monthlyFixedSubsBurn * 0.35).toFixed(0)} MAD/mo saved)
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400">
              <span>
                Baseline Monthly Surplus:{' '}
                <strong className="font-mono text-gray-900 dark:text-white">
                  {forecast.monthlyNetSavingsBaseline.toFixed(0)} MAD
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Simulated Surplus:{' '}
                <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                  {forecast.monthlyNetSavingsSimulated.toFixed(0)} MAD/mo
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                12m What-If Impact:{' '}
                <strong
                  className={`font-mono ${
                    forecast.netWorthDelta12mFromWhatIf >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {forecast.netWorthDelta12mFromWhatIf >= 0 ? '+' : ''}
                  {forecast.netWorthDelta12mFromWhatIf.toLocaleString()} MAD
                </strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Row 3: Multi-Horizon Wealth Trajectory & 30-Day Cash Flow ── */}
      {(activeSection === 'all' ||
        activeSection === 'trajectory' ||
        activeSection === 'cashflow') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Multi-Horizon Net Worth Fan Chart */}
          {(activeSection === 'all' || activeSection === 'trajectory') && (
            <Card className={activeSection === 'trajectory' ? 'lg:col-span-2' : ''}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Multi-Horizon Net Worth Cone ({horizonMonths} Months)</span>
                    </CardTitle>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Combines cash surplus, DCA contributions, and portfolio compounding with Optimistic (14% p.a.) &amp; Conservative (3.5% p.a.) bands.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg self-start">
                    {([6, 12, 24] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setHorizonMonths(m)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          horizonMonths === m
                            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                        }`}
                      >
                        {m}M
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={horizonSeries}
                      margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="simNetWorthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="optBandGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.14} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
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
                      <Area
                        type="monotone"
                        dataKey="optimisticNetWorth"
                        name="Optimistic Trajectory"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        fill="url(#optBandGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="simulatedNetWorth"
                        name="Simulated Net Worth"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fill="url(#simNetWorthGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="baselineNetWorth"
                        name="Current Baseline"
                        stroke="#64748b"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="conservativeNetWorth"
                        name="Conservative Floor"
                        stroke="#f59e0b"
                        strokeWidth={1.2}
                        strokeDasharray="2 2"
                        fill="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Projected Cash at {horizonMonths}M:{' '}
                    <strong className="font-mono text-gray-900 dark:text-white">
                      {(targetHorizonPoint?.projectedLiquidity ?? 0).toLocaleString()} MAD
                    </strong>
                  </span>
                  <span>
                    Projected Investment Portfolio:{' '}
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                      {(targetHorizonPoint?.projectedPortfolioMad ?? 0).toLocaleString()} MAD
                    </strong>
                  </span>
                  <span>
                    Range:{' '}
                    <strong className="font-mono">
                      {(targetHorizonPoint?.conservativeNetWorth ?? 0).toLocaleString()} –{' '}
                      {(targetHorizonPoint?.optimisticNetWorth ?? 0).toLocaleString()} MAD
                    </strong>
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chart 2: 30-Day Forward Cash Flow & Event Horizon */}
          {(activeSection === 'all' || activeSection === 'cashflow') && (
            <Card className={activeSection === 'cashflow' ? 'lg:col-span-2' : ''}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>30-Day Forward Liquidity &amp; Payday Runway</span>
                    </CardTitle>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Day-by-day simulated cash balance factoring weekday spend cadence, scheduled subscriptions, debt due dates, and next salary deposit.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={forecast.dailyCashFlow30d}
                      margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="cashRunwayGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                      />
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
                      <ReferenceLine
                        y={kpis?.emergencyBuffer ?? 1000}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Emergency Buffer',
                          position: 'insideTopRight',
                          fill: '#ef4444',
                          fontSize: 10,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="projectedLiquidity"
                        name="Projected Cash Balance"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fill="url(#cashRunwayGrad)"
                      />
                      {isWhatIfModified && (
                        <Area
                          type="monotone"
                          dataKey="baselineLiquidity"
                          name="Unmodified Baseline"
                          stroke="#94a3b8"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          fill="none"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Scheduled Upcoming Cash Events Strip */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Upcoming 30-Day Scheduled Cash Flow Events ({upcomingEvents30d.length})
                  </p>
                  {upcomingEvents30d.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Only standard daily variable spending scheduled over the next 30 days.
                    </p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {upcomingEvents30d.slice(0, 8).map((pt) => (
                        <div
                          key={pt.date}
                          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 shrink-0 text-xs"
                        >
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {pt.label}
                          </div>
                          <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                            {pt.events.join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Row 4: Cross-Domain Predictive Signals ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Cross-Domain Predictive Signals &amp; Early Warnings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {forecast.signals.map((sig) => (
              <div
                key={sig.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  sig.severity === 'critical'
                    ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20'
                    : sig.severity === 'warning'
                    ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20'
                    : sig.severity === 'positive'
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold uppercase tracking-wider">{sig.domain}</span>
                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                      {sig.impactMad >= 0 ? '+' : ''}
                      {sig.impactMad.toFixed(0)} MAD impact
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{sig.title}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {sig.detail}
                  </p>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab(sig.actionTab)}
                    className="text-xs"
                  >
                    {sig.actionLabel}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Row 5: Category Burn & Exhaustion Radar ── */}
      {(activeSection === 'all' || activeSection === 'categories') && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <WalletCards className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Category Burn Velocity &amp; Budget Exhaustion Radar</span>
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Predicts end-of-cycle category totals and flags the exact date a budget cap will be exhausted at current daily velocity.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveTab('budgets')}>
                Adjust Category Caps
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {forecast.categoryPredictions.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
                No category budgets or expenses recorded in the current cycle yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400">
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold text-right">Spent / Cap</th>
                      <th className="py-3 px-4 font-semibold text-right">Daily Velocity</th>
                      <th className="py-3 px-4 font-semibold text-right">Projected End Total</th>
                      <th className="py-3 px-4 font-semibold text-right">Projected Variance</th>
                      <th className="py-3 px-4 font-semibold">Exhaustion Forecast</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {forecast.categoryPredictions.slice(0, 12).map((cat) => (
                      <tr
                        key={cat.category}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                          {cat.category}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-700 dark:text-gray-300">
                          {cat.spentSoFar.toFixed(0)} /{' '}
                          {cat.budgetCap > 0 ? `${cat.budgetCap.toFixed(0)} MAD` : 'Unbudgeted'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-gray-600 dark:text-gray-400">
                          {cat.dailyVelocity.toFixed(1)} MAD/d
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900 dark:text-white">
                          {cat.projectedEndOfCycle.toFixed(0)} MAD
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {cat.budgetCap > 0 ? (
                            <span
                              className={
                                cat.projectedVariance > 0
                                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                  : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              }
                            >
                              {cat.projectedVariance > 0
                                ? `+${cat.projectedVariance.toFixed(0)} Over`
                                : `${cat.projectedVariance.toFixed(0)} Saved`}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {cat.status === 'breached' ? (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>Cap exceeded</span>
                            </span>
                          ) : cat.status === 'breach_imminent' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                Exhausts {cat.exhaustionDateLabel} ({cat.daysUntilExhaustion}d)
                              </span>
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>On track through payday</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Row 6: Goal Completion ETAs & Day-of-Week Seasonality ── */}
      {(activeSection === 'all' || activeSection === 'goals') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Savings Goals ETA Predictor */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Savings Goal Completion ETA Predictor</span>
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Projected completion timeline based on your monthly surplus velocity.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveTab('goals')}>
                  Manage Goals
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {forecast.goalPredictions.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-8 text-center">
                  No active savings goals yet. Create a goal in the Goals tab to forecast its completion date.
                </p>
              ) : (
                forecast.goalPredictions.map((g) => (
                  <div
                    key={g.id}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {g.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span>
                            {g.currentAmount.toLocaleString()} / {g.targetAmount.toLocaleString()}{' '}
                            MAD
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{g.progressPercent.toFixed(0)}% funded</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          ETA: {g.simulatedEtaLabel}
                        </div>
                        {g.monthsSaved > 0 ? (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {g.monthsSaved} mo faster with What-If
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {g.simulatedMonthsToComplete === 0
                              ? 'Goal reached'
                              : `~${g.simulatedMonthsToComplete} months left`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${Math.min(100, g.progressPercent)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Day-of-Week Seasonality Profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>Weekday Spending Seasonality Profile</span>
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Historical daily burn multiplier by day of the week used to calibrate your 30-day cash flow curve.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={forecast.dayOfWeekPatterns}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                    <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any) => [`${Number(value).toFixed(0)} MAD/day`, 'Avg Spend']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="avgSpendMad" radius={[6, 6, 0, 0]}>
                      {forecast.dayOfWeekPatterns.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.relativeMultiplier > 1.15
                              ? '#f59e0b'
                              : entry.relativeMultiplier < 0.85
                              ? '#10b981'
                              : '#4f46e5'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Amber = High-velocity spend day (&gt;1.15x mean)</span>
                <span>Emerald = Low-burn conservation day</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
