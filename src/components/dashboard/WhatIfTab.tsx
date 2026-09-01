import React, { useMemo } from 'react';
import { KPI, Goal, Transaction, Payroll, Debt, CategoryBudget } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { computeFinancialState } from '../../lib/financialEngine';
import { Calculator, BarChart3, AlertTriangle } from 'lucide-react';

interface WhatIfTabProps {
  kpis: KPI | null;
  goals: Goal[];
  amount: number;
  setAmount: (amount: number) => void;
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  budgets: CategoryBudget[];
}

export const WhatIfTab: React.FC<WhatIfTabProps> = ({ kpis, goals, amount, setAmount, transactions, payrolls, debts, budgets }) => {
  const [scenario, setScenario] = React.useState<'purchase' | 'save' | 'salary'>('purchase');
  const [targetGoalId, setTargetGoalId] = React.useState<string>('');

  const simResult = useMemo(() => {
    if (!kpis) return null;
    if (amount <= 0) return null;
    
    const effAmount = scenario === 'salary' ? -amount : amount; // Income is negative in this logic
    
    const dummyTransaction: Transaction = {
      id: 'what-if-dummy',
      userId: 'dummy',
      createdAt: new Date().toISOString(),
      amount: Math.abs(effAmount).toString(),
      type: effAmount < 0 ? 'Income' : 'Expense', // if effAmount < 0, it's Income
      sourceWallet: 'Bank',
      category: scenario === 'save' ? 'Savings Contribution' : 'What-If Simulation',
    };

    const simTransactions = [...transactions, dummyTransaction];
    
    // We compute the new state
    const newState = computeFinancialState({
      transactions: simTransactions,
      payrolls,
      debts,
      budgets,
      goals,
      userSettings: {
        emergencyBuffer: kpis.emergencyBuffer,
        salary: kpis.salary || 0,
      }
    });
    
    return newState;
  }, [kpis, amount, scenario, transactions, payrolls, debts, budgets, goals]);

  if (!kpis) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          <Calculator className="h-5 w-5" /> What-If Simulator
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Preview the exact impact of a financial action before committing.</p>
      </div>

      <Card className="border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20">
        <CardHeader>
          <CardTitle className="text-base text-indigo-900 dark:text-indigo-500">
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as any)}
              className="bg-transparent font-semibold cursor-pointer border-b border-dashed border-indigo-500 focus:outline-none"
            >
              <option value="purchase">Try a purchase</option>
              <option value="save">Contribute to savings/goal</option>
              <option value="salary">Receive a bonus/salary early</option>
            </select>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="what-if-amount">Amount</label>
            <input 
              id="what-if-amount" 
              min="0" 
              type="number" 
              step="0.01" 
              value={amount || ''} 
              onChange={(event) => setAmount(Math.max(0, Number.parseFloat(event.target.value) || 0))} 
              className="w-full rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600" 
              placeholder="Amount in MAD" 
            />
            
            {scenario === 'save' && goals.length > 0 && (
              <select
                value={targetGoalId}
                onChange={(e) => setTargetGoalId(e.target.value)}
                className="w-full sm:w-auto rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">Select a Goal (Optional)</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}

            <Button type="button" variant="outline" className="border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40" onClick={() => setAmount(0)}>Reset</Button>
          </div>
          
          {amount > 0 && simResult && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" /> Simulated Impact
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Safe to Spend</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {kpis.safeToSpend.toFixed(2)} → <span className={simResult.safeToSpend < kpis.safeToSpend ? 'text-red-500' : 'text-green-500'}>{simResult.safeToSpend.toFixed(2)}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Runway</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {kpis.runwayDays} days → <span className={simResult.runwayDays < kpis.runwayDays ? 'text-red-500' : 'text-green-500'}>{simResult.runwayDays} days</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Forecast</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {kpis.forecast.expected.toFixed(2)} → <span className={simResult.forecast.expected < kpis.forecast.expected ? 'text-red-500' : 'text-green-500'}>{simResult.forecast.expected.toFixed(2)}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Health Score</p>
                    <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                      {kpis.healthScore} / 100 → <span className={simResult.healthScore < kpis.healthScore ? 'text-red-500' : 'text-green-500'}>{simResult.healthScore}</span>
                    </p>
                  </div>
                </div>

                {simResult.dailyStatus === 'critical' && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p>This action puts your daily budget in a critical state. You would have {simResult.dailyRemaining.toFixed(2)} MAD remaining today.</p>
                  </div>
                )}
                
                {scenario === 'save' && targetGoalId && (
                  <div className="mt-4 text-sm text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                    <p>You are moving {amount} MAD into {goals.find(g => g.id === targetGoalId)?.name}. This accelerates your progress!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
