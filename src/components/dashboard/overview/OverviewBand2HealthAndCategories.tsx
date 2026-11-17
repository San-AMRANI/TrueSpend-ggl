import React, { useMemo } from 'react';
import { AlertCircle, BarChart3, Heart, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { AnimatedMetricValue, AnimatedProgressBar } from '../../ui/MotionPrimitives';
import { computeFourPillarBreakdown, getSpendingPace, isInMonth, netExpenseOf } from '../../../lib/finance';
import type { FinancialPeriod } from '../../../lib/financialMonth';
import type { CategoryBudget, DashboardTab, KPI, Payroll, Transaction } from '../../../types';
import { healthBg, healthColor, healthLabel } from './overviewHelpers';

interface OverviewBand2Props {
  kpis: KPI | null;
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  currentFm: FinancialPeriod | null;
  isPrivacyMode: boolean;
  setActiveTab: (tab: DashboardTab) => void;
  onOpenInsightModal: (type: 'forecast' | 'health') => void;
}

export const OverviewBand2HealthAndCategories: React.FC<OverviewBand2Props> = ({
  kpis,
  transactions,
  budgets,
  payrolls,
  currentFm,
  isPrivacyMode,
  setActiveTab,
  onOpenInsightModal,
}) => {
  const year = currentFm?.year ?? -1;
  const month = currentFm?.month ?? -1;

  const { monthlyBudget, pace, topCategories } = useMemo(() => {
    const budgetTotal = budgets
      .filter((b) => b.year === year && b.month === month)
      .reduce((sum, b) => sum + Number.parseFloat(b.amount), 0);
    const actualTotal = transactions
      .filter((tx) => currentFm && tx.type === 'Expense' && isInMonth(tx, year, month, payrolls))
      .reduce((sum, tx) => sum + netExpenseOf(tx), 0);
    const paceRes = getSpendingPace(actualTotal, budgetTotal, year, month, payrolls);

    const pillars = computeFourPillarBreakdown({
      transactions,
      budgets,
      year,
      month,
      payrolls,
      wallets: kpis?.accounts,
      isCurrentMonth: true,
    });
    const merged = [...pillars.myselfCategories, ...pillars.obligationsCategories];
    const top = merged
      .filter((item) => item.spent > 0 || item.budgeted > 0)
      .sort((a, b) => b.spent - a.spent || b.budgeted - a.budgeted)
      .slice(0, 6);

    return { monthlyBudget: budgetTotal, pace: paceRes, topCategories: top };
  }, [transactions, budgets, year, month, payrolls, currentFm, kpis?.accounts]);

  const maskMoney = (amount: number, decimals = 0, suffix = ' MAD') =>
    isPrivacyMode ? `••••${suffix ? suffix : ''}` : `${amount.toFixed(decimals)}${suffix}`;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Top Spending Categories vs Budget */}
      <Card className="min-w-0 lg:col-span-4 flex flex-col justify-between">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Category Burn &amp; Pace</span>
          </CardTitle>
          <button
            type="button"
            onClick={() => setActiveTab('budgets')}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Budgets →
          </button>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
          {topCategories.length > 0 ? (
            <div className="space-y-2.5">
              {topCategories.map((cat) => {
                const pct =
                  cat.budgeted > 0
                    ? Math.min(100, (cat.spent / cat.budgeted) * 100)
                    : cat.spent > 0
                    ? 100
                    : 0;
                const over = cat.budgeted > 0 && cat.spent > cat.budgeted;
                const near = cat.budgeted > 0 && cat.spent >= cat.budgeted * 0.8 && !over;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {cat.category}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] shrink-0">
                        <span
                          className={`font-semibold ${
                            over
                              ? 'text-rose-600 dark:text-rose-400'
                              : near
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {isPrivacyMode ? '••••' : cat.spent.toFixed(0)}
                        </span>
                        {cat.budgeted > 0 ? (
                          <span className="text-gray-400">
                            {' '}
                            / {isPrivacyMode ? '••••' : cat.budgeted.toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-gray-400"> MAD</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          over
                            ? 'bg-rose-500'
                            : near
                            ? 'bg-amber-500'
                            : cat.budgeted > 0
                            ? 'bg-indigo-500'
                            : 'bg-gray-400 dark:bg-gray-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
              No category expenses recorded yet in this cycle.
            </div>
          )}

          {/* Spending Pace Footer Summary */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
            {monthlyBudget > 0 ? (
              <>
                <span className="text-gray-500 dark:text-gray-400">Budget Pace</span>
                <span
                  className={`font-mono tabular-nums font-semibold ${
                    pace.difference > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isPrivacyMode ? '••••' : `${Math.abs(pace.difference).toFixed(0)} MAD`}{' '}
                  {pace.difference > 0 ? 'ahead' : 'under pace'}
                </span>
              </>
            ) : (
              <>
                <span className="text-gray-500 dark:text-gray-400">No monthly budgets configured</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('budgets')}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
                >
                  Set Limits →
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* End-of-Period Forecast */}
      <Card className="min-w-0 lg:col-span-4 flex flex-col justify-between">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>End-of-Period Forecast</span>
          </CardTitle>
          <button
            type="button"
            onClick={() => onOpenInsightModal('forecast')}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 cursor-pointer"
            title="Click for clarification and calculation formula"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Formula</span>
          </button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          {kpis?.forecast && kpis.forecast.totalDays > 0 ? (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Expected Closing Balance
                </p>
                <p
                  className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                    kpis.forecast.expected >= 0
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {maskMoney(kpis.forecast.expected, 2)}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                  At {isPrivacyMode ? '••••' : `${kpis.avgDailySpend.toFixed(1)} MAD/day`} variable avg
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
                <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5">
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Best (-30%)
                  </p>
                  <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {isPrivacyMode ? '••••' : kpis.forecast.best.toFixed(0)}
                  </p>
                </div>
                <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-2.5">
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Expected
                  </p>
                  <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                    {isPrivacyMode ? '••••' : kpis.forecast.expected.toFixed(0)}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-2.5">
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Stress (+50%)
                  </p>
                  <p className="mt-1 text-sm font-bold text-rose-700 dark:text-rose-300">
                    {isPrivacyMode ? '••••' : kpis.forecast.worst.toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  <span>
                    Day {kpis.forecast.elapsedDays} of {kpis.forecast.totalDays}
                  </span>
                  <span>{kpis.forecast.daysRemaining}d left</span>
                </div>
                <AnimatedProgressBar
                  trackClassName="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                  percent={
                    kpis.forecast.totalDays > 0
                      ? (kpis.forecast.elapsedDays / kpis.forecast.totalDays) * 100
                      : 0
                  }
                  barClassName="bg-gradient-to-r from-blue-500 to-indigo-500"
                />
                {kpis.forecast.spendingPacePercent > 0 && (
                  <p
                    className={`text-xs font-medium ${
                      kpis.forecast.spendingPacePercent > 110
                        ? 'text-rose-600 dark:text-rose-400'
                        : kpis.forecast.spendingPacePercent > 100
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {kpis.forecast.spendingPacePercent > 100
                      ? `${(kpis.forecast.spendingPacePercent - 100).toFixed(1)}% ahead of budget pace`
                      : `${(100 - kpis.forecast.spendingPacePercent).toFixed(1)}% under budget pace`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
              Set up payroll cycle dates to generate your period forecast.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Financial Health Score */}
      <Card className="min-w-0 lg:col-span-4 flex flex-col justify-between">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Heart className="h-4 w-4 text-rose-500" />
            <span>Financial Health Score</span>
          </CardTitle>
          <button
            type="button"
            onClick={() => onOpenInsightModal('health')}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
            title="Click for clarification and scoring methodology"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Scoring</span>
          </button>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          {kpis ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-4 rounded-xl border p-3 ${healthBg(kpis.healthScore)}`}>
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-gray-200 dark:text-gray-800"
                    />
                    <motion.circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      strokeWidth="3"
                      strokeLinecap="round"
                      stroke="currentColor"
                      className={healthColor(kpis.healthScore)}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: Math.max(0, Math.min(1, kpis.healthScore / 100)) }}
                      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </svg>
                  <AnimatedMetricValue
                    value={kpis.healthScore}
                    decimals={0}
                    className={`absolute text-lg font-bold font-mono tabular-nums ${healthColor(kpis.healthScore)}`}
                  />
                </div>
                <div className="min-w-0">
                  <p className={`text-base font-bold ${healthColor(kpis.healthScore)}`}>
                    {healthLabel(kpis.healthScore)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Weighted 6-pillar diagnostic (0–100)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {kpis.healthFactors?.map((factor, idx) => (
                  <div key={factor.name} className="min-w-0">
                    <div className="flex justify-between text-[11px] gap-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                        {factor.name}
                      </span>
                      <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                        {factor.score}/{factor.maxPoints}
                      </span>
                    </div>
                    <AnimatedProgressBar
                      className="mt-1"
                      delay={idx * 0.04}
                      trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                      percent={factor.maxPoints > 0 ? (factor.score / factor.maxPoints) * 100 : 0}
                      barClassName={
                        factor.score / factor.maxPoints >= 0.7
                          ? 'bg-emerald-500'
                          : factor.score / factor.maxPoints >= 0.4
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-gray-500">Loading diagnostic...</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewBand2HealthAndCategories;
