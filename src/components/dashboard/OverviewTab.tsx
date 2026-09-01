import React, { useState, useMemo } from 'react';
import { CategoryBudget, DashboardTab, Debt, KPI, Payroll, Transaction, Goal } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { SettleDebtModal } from '../SettleDebtModal';
import { getSpendingPace, isInMonth } from '../../lib/finance';
import { getCurrentFinancialMonth } from '../../lib/financialMonth';
import { generateFacts, selectFacts } from '../../lib/financialFacts';
import { FinancialFactsCarousel } from './FinancialFactsCarousel';
import {
  ArrowDownRight, ArrowUpRight, Banknote, BarChart3, Heart,
  Landmark, RefreshCw, Shield, TrendingUp, WalletCards, Clock, Zap
} from 'lucide-react';
import { format } from 'date-fns';

interface OverviewTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  goals: Goal[];
  setActiveTab: (tab: DashboardTab) => void;
  openTransaction: (transactionId: string) => void;
  handleSettle: (debtId: string, amount: number, category?: string, wallet?: 'Bank' | 'Cash') => Promise<void> | void;
  payrolls: Payroll[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ kpis, transactions, debts, budgets, goals, payrolls, setActiveTab, openTransaction, handleSettle }) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  
  const currentFm = getCurrentFinancialMonth(payrolls);
  const year = currentFm?.year ?? -1;
  const month = currentFm?.month ?? -1;

  const monthlyBudget = budgets
    .filter((budget) => budget.year === year && budget.month === month)
    .reduce((sum, budget) => sum + Number.parseFloat(budget.amount), 0);
  const monthlyActual = transactions
    .filter((transaction) => currentFm && transaction.type === 'Expense' && isInMonth(transaction, year, month, payrolls))
    .reduce((sum, transaction) => sum + Number.parseFloat(transaction.amount), 0);
  const pace = getSpendingPace(monthlyActual, monthlyBudget, year, month, payrolls);
  const activeReceivables = debts
    .filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending')
    .reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0);
  
  const activePayables = debts
    .filter((debt) => debt.type === 'Payable' && debt.status === 'Pending')
    .reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0);
  
  // Phase 3: Net Worth Tracking (Liquidity + Receivables - Payables)
  const netWorth = (kpis?.totalLiquidity ?? 0) + activeReceivables - activePayables;
  const dailyStatusStyles = { on_track: 'text-blue-600', warning: 'text-amber-600', critical: 'text-red-600' };

  // Generate financial facts for the carousel
  const facts = useMemo(
    () => selectFacts(generateFacts(kpis, transactions, debts, budgets, payrolls)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kpis, transactions, debts, budgets, payrolls],
  );

  // Health score ring color
  const healthColor = (score: number) =>
    score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  const healthBg = (score: number) =>
    score >= 75 ? 'from-emerald-500/10 to-emerald-500/5' : score >= 50 ? 'from-amber-500/10 to-amber-500/5' : 'from-red-500/10 to-red-500/5';
  const healthLabel = (score: number) =>
    score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : score >= 30 ? 'Needs Attention' : 'Critical';

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 sm:space-y-6">
      {!currentFm && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Your financial period is not set yet. Add the current and next payroll in Financial Calendar so balances, budgets, and reports use the right period.</div>}

      {/* Row 1 – Safe to Spend Hero + Daily Allowance + Runway */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {/* Safe to Spend — Hero Card */}
        <Card className="col-span-2 min-w-0 border-transparent bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 text-white xl:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-400">
              <Shield className="h-4 w-4 text-indigo-400" /> Safe to Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="break-words text-2xl font-bold sm:text-3xl">
              {(kpis?.safeToSpend ?? 0).toFixed(2)} <span className="text-lg text-gray-400">MAD</span>
            </div>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Landmark className="h-3 w-3" />Bank: {kpis?.bankBalance.toFixed(2) || '0.00'}</span>
              <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />Cash: {kpis?.cashOnHand.toFixed(2) || '0.00'}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              <span>Liquidity {(kpis?.totalLiquidity ?? 0).toFixed(0)}</span>
              <span>· Buffer −{(kpis?.emergencyBuffer ?? 0).toFixed(0)}</span>
              {(kpis?.pendingPayables ?? 0) > 0 && <span>· Payables −{(kpis?.pendingPayables ?? 0).toFixed(0)}</span>}
            </div>
            {/* Net Worth Badge */}
            <div className="mt-4 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-400">Estimated Net Worth</p>
              <p className="text-lg font-semibold text-white">{netWorth.toFixed(2)} MAD</p>
            </div>
          </CardContent>
        </Card>

        {/* Daily Allowance */}
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">Daily Allowance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`break-words text-xl font-bold sm:text-3xl ${dailyStatusStyles[kpis?.dailyStatus || 'on_track']}`}>
              {kpis?.dailyRemaining.toFixed(2) || '0.00'} <span className="text-sm sm:text-base">MAD</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{kpis?.dailySpent.toFixed(2) || '0.00'} spent of {kpis?.dailyAllowance.toFixed(2) || '0.00'}</p>
            <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2 hidden sm:inline-flex" onClick={() => setActiveTab('what-if')}>Simulate a purchase</Button>
          </CardContent>
        </Card>

        {/* Runway */}
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
              <Clock className="h-3.5 w-3.5" /> Financial Runway
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="break-words text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">
              {kpis?.runwayDays !== undefined && kpis.runwayDays < 999
                ? <>{kpis.runwayDays} <span className="text-sm sm:text-base font-normal text-gray-500">days</span></>
                : <span className="text-sm text-gray-400">—</span>}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              at {(kpis?.avgDailySpend ?? 0).toFixed(0)} MAD/day avg spend
            </p>
            {kpis && kpis.runwayDays < 7 && kpis.runwayDays < 999 && (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                ⚠ Short runway — consider reducing spending
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 – Financial Facts Carousel + Spending Pace */}
      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Facts carousel */}
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base sm:text-lg">Financial Facts</CardTitle>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveTab('analytics')}>Analytics</Button>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden pb-4">
            {facts.length > 0 ? (
              <FinancialFactsCarousel facts={facts} />
            ) : (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Add some transactions to see your financial facts.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Spending Pace */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 shrink-0 text-blue-600" /> Spending pace
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            {monthlyBudget > 0 ? (
              <>
                <p className="break-words text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100 sm:text-2xl">
                  {monthlyActual.toFixed(0)} / {pace.ideal.toFixed(0)} MAD
                </p>
                <p className={`mt-2 break-words text-sm font-medium ${pace.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {Math.abs(pace.difference).toFixed(2)} MAD {pace.difference > 0 ? 'ahead of pace' : 'behind pace'}
                </p>
                <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">Based on {monthlyBudget.toFixed(0)} MAD in category budgets.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400">Set monthly category budgets to measure your spending pace.</p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('budgets')}>Set budgets</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2 – End-of-Month Forecast + Health Score */}
      <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
        {/* End-of-Month Forecast */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" /> End-of-Period Forecast
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis?.forecast && kpis.forecast.totalDays > 0 ? (
              <div className="space-y-4">
                {/* Expected balance */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Expected end-of-period balance</p>
                  {kpis.avgDailySpend > 0 && (
                    <p className="mt-1 text-[10px] text-blue-500/80 dark:text-blue-400/80">Based on your current average spending of {kpis.avgDailySpend.toFixed(2)} MAD/day</p>
                  )}
                  <p className={`mt-1 text-2xl font-bold ${kpis.forecast.expected >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-red-600 dark:text-red-400'}`}>
                    {kpis.forecast.expected.toFixed(2)} MAD
                  </p>
                </div>
                {/* Scenarios */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-green-600 dark:text-green-400">Best</p>
                    <p className="mt-1 text-sm font-bold text-green-700 dark:text-green-300">{kpis.forecast.best.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Expected</p>
                    <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">{kpis.forecast.expected.toFixed(0)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/20">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-red-600 dark:text-red-400">Worst</p>
                    <p className="mt-1 text-sm font-bold text-red-700 dark:text-red-300">{kpis.forecast.worst.toFixed(0)}</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Day {kpis.forecast.elapsedDays} of {kpis.forecast.totalDays}</span>
                    <span>{kpis.forecast.daysRemaining} days left</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                      style={{ width: `${Math.min(100, (kpis.forecast.elapsedDays / kpis.forecast.totalDays) * 100)}%` }}
                    />
                  </div>
                </div>
                {/* Spending pace tag */}
                {kpis.forecast.spendingPacePercent > 0 && (
                  <p className={`text-sm font-medium ${kpis.forecast.spendingPacePercent > 110 ? 'text-red-600 dark:text-red-400' : kpis.forecast.spendingPacePercent > 100 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                    {kpis.forecast.spendingPacePercent > 100
                      ? `${(kpis.forecast.spendingPacePercent - 100).toFixed(1)}% ahead of budget pace`
                      : `${(100 - kpis.forecast.spendingPacePercent).toFixed(1)}% behind budget pace`}
                  </p>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Set up your financial period to see your forecast.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Financial Health Score */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Heart className="h-5 w-5 text-rose-500" /> Financial Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis ? (
              <div className="space-y-4">
                {/* Score Ring */}
                <div className={`flex items-center gap-5 rounded-xl bg-gradient-to-br p-4 ${healthBg(kpis.healthScore)}`}>
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-800" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        className={healthColor(kpis.healthScore)}
                        strokeDasharray={`${(kpis.healthScore / 100) * 97.4} 97.4`}
                      />
                    </svg>
                    <span className={`absolute text-xl font-bold ${healthColor(kpis.healthScore)}`}>{kpis.healthScore}</span>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${healthColor(kpis.healthScore)}`}>{healthLabel(kpis.healthScore)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">out of 100</p>
                  </div>
                </div>
                {/* Factor Breakdown */}
                <div className="space-y-2">
                  {kpis.healthFactors?.map((factor) => (
                    <div key={factor.name} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{factor.name}</span>
                          <span className="tabular-nums text-gray-500 dark:text-gray-400">{factor.score}/{factor.maxPoints}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                          <div
                            className={`h-full rounded-full transition-all ${factor.score / factor.maxPoints >= 0.7 ? 'bg-emerald-500' : factor.score / factor.maxPoints >= 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${(factor.score / factor.maxPoints) * 100}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{factor.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading health score…</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Row 4 – Recent Transactions + Pending Receivables */}
      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="min-w-0 text-base sm:text-lg">Recent Transactions</CardTitle>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveTab('transactions')}>View all</Button>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {transactions.slice(0, 5).map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => openTransaction(transaction.id)}
                  className="flex w-full min-w-0 items-center justify-between gap-2 py-3 text-left first:pt-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${transaction.type === 'Income' ? 'bg-green-100 text-green-600' : transaction.type === 'Transfer' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                      {transaction.type === 'Income' ? <ArrowDownRight className="h-4 w-4" /> : transaction.type === 'Transfer' ? <RefreshCw className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-gray-100">{transaction.notes || transaction.category || transaction.type}</p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">{format(new Date(transaction.createdAt), 'MMM d, yyyy')} · {transaction.sourceWallet}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${transaction.type === 'Income' ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                    {transaction.type === 'Expense' ? '-' : transaction.type === 'Income' ? '+' : ''}{Number.parseFloat(transaction.amount).toFixed(2)} MAD
                  </span>
                </button>
              ))}
              {transactions.length === 0 && <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No transactions yet.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-blue-100 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center gap-2 text-base text-blue-900">
              <WalletCards className="h-5 w-5 shrink-0" /> Pending receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="break-words text-2xl font-bold text-blue-900">{activeReceivables.toFixed(2)} MAD</div>
            <p className="mb-4 text-xs text-blue-700">Money owed to you from splits</p>
            <div className="space-y-3">
              {debts
                .filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending')
                .slice(0, 3)
                .map((debt) => (
                  <div key={debt.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-blue-100 bg-white dark:bg-gray-900 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{debt.contactName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Bal: {Number.parseFloat(debt.remainingBalance).toFixed(2)} MAD</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="shrink-0 border-blue-200 text-blue-700" onClick={() => setSettlingDebt(debt)}>Settle</Button>
                  </div>
                ))}
              {activeReceivables === 0 && <p className="py-4 text-center text-sm text-blue-700">No pending receivables.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Phase 3: Goals Overview */}
        <Card className="min-w-0 overflow-hidden border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-900/10">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-base sm:text-lg text-indigo-900 dark:text-indigo-400 flex items-center gap-2">
              <Zap className="h-5 w-5" /> Active Goals
            </CardTitle>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveTab('goals')}>Manage</Button>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            <div className="space-y-4">
              {goals.slice(0, 3).map((goal) => {
                const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                return (
                  <div key={goal.id} className="min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate pr-2">{goal.name}</span>
                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{Math.round(progress)}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
                    </div>
                  </div>
                );
              })}
              {goals.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No active goals.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setActiveTab('goals')}>Create one</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <SettleDebtModal
        debt={settlingDebt}
        onClose={() => setSettlingDebt(null)}
        onConfirm={async (debtId, amount, category, wallet) => {
          await handleSettle(debtId, amount, category, wallet);
        }}
      />
    </div>
  );
};
