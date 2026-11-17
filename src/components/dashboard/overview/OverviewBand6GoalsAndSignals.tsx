import React, { useMemo } from 'react';
import { Plus, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { AnimatedProgressBar } from '../../ui/MotionPrimitives';
import { generateFacts, selectFacts } from '../../../lib/financialFacts';
import { FinancialFactsCarousel } from '../FinancialFactsCarousel';
import type {
  CategoryBudget,
  DashboardTab,
  Debt,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Transaction,
} from '../../../types';

interface OverviewBand6Props {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  goals: Goal[];
  investmentsData: InvestmentsData | null;
  isPrivacyMode: boolean;
  setActiveTab: (tab: DashboardTab) => void;
}

export const OverviewBand6GoalsAndSignals: React.FC<OverviewBand6Props> = ({
  kpis,
  transactions,
  debts,
  budgets,
  payrolls,
  goals,
  investmentsData,
  isPrivacyMode,
  setActiveTab,
}) => {
  const facts = useMemo(
    () => selectFacts(generateFacts(kpis, transactions, debts, budgets, payrolls, investmentsData)),
    [kpis, transactions, debts, budgets, payrolls, investmentsData],
  );

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-12 items-stretch">
      {/* Savings Goals */}
      <Card className="min-w-0 lg:col-span-5 flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Target className="h-4 w-4 text-indigo-500" />
            <span>Savings Goals</span>
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-indigo-600 dark:text-indigo-400"
            onClick={() => setActiveTab('goals')}
          >
            Manage ({goals.length}) →
          </Button>
        </CardHeader>
        <CardContent className="flex-1">
          {goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                No savings goals yet
              </p>
              <p className="max-w-xs text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                Track emergency buffers, trips, or planned purchases.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveTab('goals')}
                className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Goal
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {goals.slice(0, 3).map((g) => {
                const target = parseFloat(g.targetAmount) || 0;
                const current = parseFloat(g.currentAmount) || 0;
                const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                const isCompleted = current >= target && target > 0;
                return (
                  <div
                    key={g.id}
                    onClick={() => setActiveTab('goals')}
                    className="cursor-pointer rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {g.name}
                      </span>
                      <span
                        className={`font-mono tabular-nums font-bold ${
                          isCompleted ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        {progress.toFixed(0)}%
                      </span>
                    </div>
                    <AnimatedProgressBar
                      className="mt-1.5"
                      trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                      percent={progress}
                      barClassName={isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}
                    />
                    <div className="mt-1 flex justify-between text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                      <span>{isPrivacyMode ? '••••' : `${current.toLocaleString()} MAD`}</span>
                      <span>{isPrivacyMode ? '••••' : `${target.toLocaleString()} MAD`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Financial Facts Carousel */}
      <Card className="min-w-0 lg:col-span-7 overflow-hidden flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm sm:text-base">Financial Facts &amp; Signals</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab('analytics')}>
            Full Analytics →
          </Button>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden pb-4 flex-1 flex items-center">
          {facts.length > 0 ? (
            <FinancialFactsCarousel facts={facts} />
          ) : (
            <p className="w-full py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Add transactions to unlock personalized financial facts.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewBand6GoalsAndSignals;
