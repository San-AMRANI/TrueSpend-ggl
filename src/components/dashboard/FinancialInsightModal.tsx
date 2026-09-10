import React from 'react';
import { AlertCircle, X, Calculator, ShieldCheck, TrendingUp, Heart, CheckCircle2 } from 'lucide-react';
import { KPI } from '../../types';
import { Button } from '../ui/Button';

interface FinancialInsightModalProps {
  type: 'forecast' | 'health';
  isOpen: boolean;
  onClose: () => void;
  kpis: KPI | null;
}

export const FinancialInsightModal: React.FC<FinancialInsightModalProps> = ({
  type,
  isOpen,
  onClose,
  kpis,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            {type === 'forecast' ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <Heart className="h-5 w-5" />
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {type === 'forecast' ? 'End-of-Period Forecast Guide' : 'Financial Health Score Guide'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Insights & Calculation Methodology
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm text-gray-700 dark:text-gray-300">
          {type === 'forecast' ? (
            <>
              {/* Insight Explanation */}
              <div>
                <h4 className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  What is this insight?
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  The <strong>Expected End-of-Period Balance</strong> estimates the exact amount of money you will have remaining on the last day before your next payroll. It prevents surprise overdrafts by simulating your daily spending burn rate over the remaining days in your financial cycle.
                </p>
              </div>

              {/* How it is calculated */}
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  <Calculator className="h-4 w-4" />
                  How is it calculated?
                </h4>
                <div className="mt-2 space-y-2 text-xs text-gray-700 dark:text-gray-200">
                  <div className="rounded bg-white p-2.5 font-mono text-[11px] text-blue-900 shadow-xs dark:bg-gray-800 dark:text-blue-200">
                    Expected Balance = Total Liquidity - Remaining Fixed Commitments - (Average Daily Variable Spend × Days Remaining)
                  </div>
                  <ul className="space-y-1.5 list-disc pl-4 text-gray-600 dark:text-gray-300 text-[11px]">
                    <li>
                      <strong>Separation of Fixed vs. Variable:</strong> Large fixed costs (rent, utilities, loans) are not projected daily to avoid distorting your burn rate. They are deducted as planned fixed commitments.
                    </li>
                    <li>
                      <strong>Variable Daily Spending:</strong> Only flexible daily expenses (groceries, dining, coffee, transport, leisure) determine your daily pace.
                    </li>
                    <li>
                      <strong>Best Scenario:</strong> Assumes a 30% reduction in daily variable spending for the remaining days.
                    </li>
                    <li>
                      <strong>Worst Scenario:</strong> Simulates a 50% surge in variable spending to stress-test your safety net.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Current Breakdown */}
              {kpis?.forecast && (
                <div className="rounded-lg border border-gray-200 p-3.5 dark:border-gray-800">
                  <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    Your Current Cycle Breakdown
                  </h5>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                      <span className="text-gray-500 dark:text-gray-400">Total Liquidity:</span>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {kpis.totalLiquidity.toFixed(2)} MAD
                      </p>
                    </div>
                    <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                      <span className="text-gray-500 dark:text-gray-400">Days Remaining:</span>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {kpis.forecast.daysRemaining} of {kpis.forecast.totalDays} days
                      </p>
                    </div>
                    <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                      <span className="text-gray-500 dark:text-gray-400">Avg Daily Spend:</span>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {kpis.avgDailySpend.toFixed(2)} MAD/day
                      </p>
                    </div>
                    <div className="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                      <span className="text-gray-500 dark:text-gray-400">Projected Outcome:</span>
                      <p className={`font-semibold ${kpis.forecast.expected >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {kpis.forecast.expected.toFixed(2)} MAD
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Health Score Explanation */}
              <div>
                <h4 className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  What is this insight?
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                  The <strong>Financial Health Score (0 - 100)</strong> is an objective, real-time diagnostic rating of your financial stability, cash flow sustainability, and spending discipline during this active cycle.
                </p>
              </div>

              {/* How it is calculated */}
              <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  <Calculator className="h-4 w-4" />
                  How is it calculated?
                </h4>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  The score is composed of 6 weighted financial pillars evaluated dynamically:
                </p>
                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2 border-b border-rose-100/60 pb-1.5 dark:border-rose-900/30">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">1. Cash Flow Retention (20 pts)</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Measures whether your income covers your projected end-of-period expenses with positive savings left over.
                      </p>
                    </div>
                    <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      20 pts
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 border-b border-rose-100/60 pb-1.5 dark:border-rose-900/30">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">2. Emergency Buffer (20 pts)</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Tracks balance in your <em>Savings</em> wallets compared to your 3-month safety cushion target.
                      </p>
                    </div>
                    <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      20 pts
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 border-b border-rose-100/60 pb-1.5 dark:border-rose-900/30">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">3. Debt Load (15 pts)</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Evaluates pending payable debts against your total monthly income.
                      </p>
                    </div>
                    <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      15 pts
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 border-b border-rose-100/60 pb-1.5 dark:border-rose-900/30">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">4. Budget Control (15 pts)</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Assesses whether your spending pace stays within or slightly below your category budgets.
                      </p>
                    </div>
                    <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      15 pts
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2 border-b border-rose-100/60 pb-1.5 dark:border-rose-900/30">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">5. Runway (15 pts)</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Checks if your Safe-to-Spend liquidity provides enough days of burn to reach next payday comfortably.
                      </p>
                    </div>
                    <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      15 pts
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">6. Daily Discipline (15 pts)</span>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Rewards staying within today's calculated daily spending allowance.
                      </p>
                    </div>
                    <span className="rounded bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      15 pts
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};
