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
    userSettings: settings,
  });

  assert.equal(state.totalLiquidity, 1000);
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
    userSettings: settings,
  });

  assert.equal(state.bankBalance, 750);
  assert.equal(state.cashOnHand, 200);
  assert.equal(state.totalLiquidity, 950);
}

{
  const state = computeFinancialState({
    now,
    transactions: [
      {
        id: 'split-expense',
        userId: 'user',
        createdAt: '2026-09-10T00:00:00Z',
        amount: '25',
        type: 'Expense',
        sourceWallet: 'Bank',
        category: 'Food & Dining',
        reimbursableAmount: '20',
      },
      transaction('income', '2026-08-26T00:00:00Z', '1000', 'Income', 'Bank'),
    ],
    payrolls: periodPayrolls,
    debts: [],
    budgets: [],
    userSettings: settings,
  });

  // Gross expense is 25, reimbursable is 20 -> Net Expense should be 5
  assert.equal(state.monthlyExpenses, 5, 'monthlyExpenses must account for reimbursable amounts as net cost');
  assert.equal(state.adjustedTrueSpend, 5, 'adjustedTrueSpend must equal 5');
  // Total liquidity reflects the actual cash outflow of 25 from the bank: 1000 - 25 = 975
  assert.equal(state.totalLiquidity, 975, 'totalLiquidity tracks actual bank outflow');
}

{
  // Test today's dailySpent with split transaction
  const state = computeFinancialState({
    now: new Date('2026-09-15T14:00:00Z'),
    transactions: [
      {
        id: 'split-today',
        userId: 'user',
        createdAt: '2026-09-15T10:00:00Z',
        amount: '100',
        type: 'Expense',
        sourceWallet: 'Bank',
        category: 'Food & Dining',
        reimbursableAmount: '80',
      },
    ],
    payrolls: periodPayrolls,
    debts: [],
    budgets: [],
    userSettings: settings,
  });

  // Daily spent should be 100 - 80 = 20
  assert.equal(state.dailySpent, 20, 'dailySpent must be net of reimbursement');
}

console.log('financialEngine tests passed');
