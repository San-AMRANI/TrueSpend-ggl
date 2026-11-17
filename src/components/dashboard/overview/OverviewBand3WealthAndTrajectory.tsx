import React, { useMemo, useState } from 'react';
import { ChevronRight, Layers, PieChart as PieChartIcon, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { computeFourPillarBreakdown } from '../../../lib/finance';
import { computeHolisticForecast } from '../../../lib/predictiveEngine';
import type { FinancialPeriod } from '../../../lib/financialMonth';
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
import { MultiCycleCashflowChart, WealthAllocationChart } from '../OverviewCharts';
import { computeMacroBenchmark } from './overviewHelpers';

interface OverviewBand3Props {
  kpis: KPI | null;
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  subscriptions: Subscription[];
  debts: Debt[];
  goals: Goal[];
  investmentsData: InvestmentsData | null;
  stockPortfolioMad: number;
  activeReceivables: number;
  externalAssetsMad: number;
  currentFm: FinancialPeriod | null;
  isPrivacyMode: boolean;
  setActiveTab: (tab: DashboardTab) => void;
}

export const OverviewBand3WealthAndTrajectory: React.FC<OverviewBand3Props> = ({
  kpis,
  transactions,
  budgets,
  payrolls,
  subscriptions,
  debts,
  goals,
  investmentsData,
  stockPortfolioMad,
  activeReceivables,
  externalAssetsMad,
  currentFm,
  isPrivacyMode,
  setActiveTab,
}) => {
  const [wealthTab, setWealthTab] = useState<'pillars' | 'allocation'>('pillars');
  const year = currentFm?.year ?? -1;
  const month = currentFm?.month ?? -1;

  const fourPillars = useMemo(
    () =>
      computeFourPillarBreakdown({
        transactions,
        budgets,
        year,
        month,
        payrolls,
        wallets: kpis?.accounts,
        isCurrentMonth: true,
      }),
    [transactions, budgets, year, month, payrolls, kpis?.accounts],
  );

  const macro = useMemo(
    () => computeMacroBenchmark(transactions, kpis, currentFm, payrolls),
    [transactions, kpis, currentFm, payrolls],
  );

  const holisticForecast = useMemo(
    () =>
      computeHolisticForecast({
        kpis,
        transactions,
        payrolls,
        budgets,
        subscriptions,
        debts,
        goals,
        contexts: [],
        investmentsData,
      }),
    [kpis, transactions, payrolls, budgets, subscriptions, debts, goals, investmentsData],
  );

  const maskMoney = (amount: number, decimals = 0, suffix = ' MAD') =>
    isPrivacyMode ? `••••${suffix ? suffix : ''}` : `${amount.toFixed(decimals)}${suffix}`;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
      {/* Wealth Structure & 4 Pillars */}
      <Card className="min-w-0 lg:col-span-5 flex flex-col justify-between">
        <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            {wealthTab === 'pillars' ? (
              <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            )}
            <span>{wealthTab === 'pillars' ? '4-Pillar Cashflow Split' : 'Gross Asset Mix'}</span>
          </CardTitle>

          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5">
            <button
              type="button"
              onClick={() => setWealthTab('pillars')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                wealthTab === 'pillars'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              4-Pillar
            </button>
            <button
              type="button"
              onClick={() => setWealthTab('allocation')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                wealthTab === 'allocation'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Asset Mix
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col justify-between space-y-4">
          {wealthTab === 'pillars' ? (
            <div className="space-y-3">
              {[
                {
                  label: 'Obligations & Essentials',
                  amt: fourPillars.spentOnObligations,
                  pct: fourPillars.obligationsPctOfIncome,
                  bar: 'bg-indigo-500',
                  text: 'text-indigo-600 dark:text-indigo-400',
                },
                {
                  label: 'Spent on Myself (Lifestyle)',
                  amt: fourPillars.spentOnMyself,
                  pct: fourPillars.myselfPctOfIncome,
                  bar: 'bg-amber-500',
                  text: 'text-amber-600 dark:text-amber-400',
                },
                {
                  label: 'Invested Capital',
                  amt: fourPillars.investedAmount,
                  pct: fourPillars.investedPctOfIncome,
                  bar: 'bg-sky-500',
                  text: 'text-sky-600 dark:text-sky-400',
                },
                {
                  label: 'Saved & Retained in Bank',
                  amt: fourPillars.totalActualRetainedAndSaved,
                  pct: fourPillars.savedPctOfIncome,
                  bar: 'bg-emerald-500',
                  text: 'text-emerald-600 dark:text-emerald-400',
                },
              ].map((pillar) => (
                <div key={pillar.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {pillar.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      <span className={`font-semibold ${pillar.text}`}>
                        {isPrivacyMode ? '••••' : `${pillar.amt.toFixed(0)} MAD`}
                      </span>
                      <span className="text-gray-400 ml-1.5">({pillar.pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${pillar.bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, pillar.pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2">
              <WealthAllocationChart
                kpis={kpis}
                stockPortfolioMad={stockPortfolioMad}
                activeReceivables={activeReceivables}
                externalAssetsMad={externalAssetsMad}
                isPrivacyMode={isPrivacyMode}
              />
            </div>
          )}

          {/* 50 / 30 / 20 Macro Target Strip */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-indigo-500" />
                50 / 30 / 20 Macro Benchmark
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('budgets')}
                className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
              >
                Adjust →
              </button>
            </div>
            <div className="flex justify-between text-xs font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
              <span>Needs {macro.needsPct}%</span>
              <span>Wants {macro.wantsPct}%</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Save {macro.savingsPct}%
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div className="bg-indigo-500" style={{ width: `${macro.needsPct}%` }} />
              <div className="bg-amber-500" style={{ width: `${macro.wantsPct}%` }} />
              <div className="bg-emerald-500" style={{ width: `${macro.savingsPct}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Multi-Cycle Cashflow History + Cross-Domain Predictive Trajectory */}
      <Card className="min-w-0 lg:col-span-7 flex flex-col justify-between">
        <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
          <MultiCycleCashflowChart
            transactions={transactions}
            budgets={budgets}
            payrolls={payrolls}
            wallets={kpis?.accounts}
            isPrivacyMode={isPrivacyMode}
          />

          {/* Predictive Horizon Telemetry Strip */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Predictive Net Worth &amp; Cash Horizon
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('forecast')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Open Predictive Hub</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">90d Net Worth</p>
                <p className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                  {maskMoney(holisticForecast.projectedNetWorth90d, 0)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">12m Net Worth</p>
                <p className="text-sm font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {maskMoney(holisticForecast.projectedNetWorth12m, 0)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">30d Lowest Cash</p>
                <p
                  className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                    holisticForecast.hasLiquidityPinchBeforePayday
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {maskMoney(holisticForecast.lowest30dBalance, 0)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">At-Risk Budgets</p>
                <p className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                  {
                    holisticForecast.categoryPredictions.filter(
                      (c) => c.status === 'breached' || c.status === 'breach_imminent',
                    ).length
                  }{' '}
                  / {holisticForecast.categoryPredictions.length}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OverviewBand3WealthAndTrajectory;
