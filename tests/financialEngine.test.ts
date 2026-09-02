import assert from 'node:assert/strict';
import { computeFinancialState } from '../src/lib/financialEngine.js';

const now = new Date('2026-09-15T12:00:00Z');
const settings = { emergencyBuffer: 100, salary: 0 };

const transaction = (id: string, date: string, amount: string, type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment', sourceWallet: 'Bank' | 'Cash') => ({
  id,
  userId: 'user',
  createdAt: date,
  amount,
  type,
  sourceWallet,
  category: type === 'Income' ? 'Income' : 'Test',
});

const periodPayrolls = [
  { id: 'pay-1', userId: 'user', scheduledFor: '2026-08-25T00:00:00Z', amount: '3000', createdAt: '2026-08-01T00:00:00Z' },
  { id: 'pay-2', userId: 'user', scheduledFor: '2026-09-25T00:00:00Z', amount: '3000', createdAt: '2026-08-01T00:00:00Z' },
];

{
  const state = computeFinancialState({
    now,
    transactions: [
      transaction('expense', '2026-09-10T00:00:00Z', '400', 'Expense', 'Bank'),
      transaction('income', '2026-08-26T00:00:00Z', '1000', 'Income', 'Bank'),
    ],
    payrolls: periodPayrolls,
    debts: [{ type: 'Payable', status: 'Pending', remainingBalance: '600' }] as any,
    budgets: [],
    goals: [],
    userSettings: settings,
  });

  assert.equal(state.totalLiquidity, 600, 'balances must be chronological and include all settled movements');
  assert.equal(state.safeToSpend, -100, 'Safe to Spend must expose an obligation deficit');
  assert.equal(state.monthlyIncome, 1000);
  assert.equal(state.monthlyExpenses, 400);
}

{
  const state = computeFinancialState({
    now,
    transactions: [transaction('income', '2026-08-26T00:00:00Z', '1000', 'Income', 'Bank')],
    payrolls: periodPayrolls,
    debts: [],
    budgets: [],
    goals: [{ id: 'goal', userId: 'user', name: 'Car', targetAmount: 1200, currentAmount: 400, deadline: '2026-12-01T00:00:00Z', category: '', notes: '', createdAt: '', updatedAt: '' }],
    userSettings: settings,
  });

  assert.equal(state.goalMetrics[0].remainingAmount, 800);
  assert.equal(state.goalMetrics[0].completed, false);
  assert.ok((state.goalMetrics[0].requiredMonthlyContribution ?? 0) > 0);
}

{
  const state = computeFinancialState({
    now,
    transactions: [
      transaction('income', '2026-08-26T00:00:00Z', '1000', 'Income', 'Bank'),
      transaction('to-cash', '2026-08-27T00:00:00Z', '250', 'Transfer', 'Bank'),
      transaction('cash-expense', '2026-08-28T00:00:00Z', '50', 'Expense', 'Cash'),
    ],
    payrolls: periodPayrolls,
    debts: [],
    budgets: [],
    goals: [],
    userSettings: settings,
  });

  assert.equal(state.bankBalance, 750);
  assert.equal(state.cashOnHand, 200);
  assert.equal(state.totalLiquidity, 950);
}

console.log('financialEngine tests passed');
