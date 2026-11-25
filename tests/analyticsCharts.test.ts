import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBudgetPacingSeries,
  buildDailyLivingBurnSeries,
  buildMultiCycleTrendSeries,
  buildSpendSizeDistribution,
  buildTopCategoriesMultiCycleTrend,
  buildWeekdaySpendProfile,
} from '../src/lib/analyticsCharts';
import type { CategoryBudget, Payroll, Transaction, Wallet } from '../src/types';

const wallets: Array<Pick<Wallet, 'id' | 'type'>> = [
  { id: 'w-bank', type: 'Bank' },
  { id: 'w-inv', type: 'Investment' },
];

const payrolls: Payroll[] = [
  { id: 'p-1', amount: '15000', scheduledFor: '2026-09-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
  { id: 'p-2', amount: '15000', scheduledFor: '2026-10-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
  { id: 'p-3', amount: '15000', scheduledFor: '2026-11-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
];

const sampleTxs: Transaction[] = [
  { id: 't1', type: 'Income', amount: '15000', category: 'Salary', walletId: 'w-bank', createdAt: '2026-10-25T09:00:00.000Z' } as Transaction,
  { id: 't2', type: 'Expense', amount: '35', category: '☕ Coffee & Quick Food', walletId: 'w-bank', createdAt: '2026-10-26T09:00:00.000Z' } as Transaction,
  { id: 't3', type: 'Expense', amount: '120', category: '🛒 Groceries', walletId: 'w-bank', createdAt: '2026-10-27T12:00:00.000Z' } as Transaction,
  { id: 't4', type: 'Expense', amount: '420', category: '🍔 Dining & Takeaway', walletId: 'w-bank', createdAt: '2026-10-28T20:00:00.000Z' } as Transaction,
  { id: 't5', type: 'Expense', amount: '1800', category: '🏢 Housing & Utilities', walletId: 'w-bank', createdAt: '2026-10-30T10:00:00.000Z' } as Transaction,
  // Investment transaction must be excluded from living burn charts!
  { id: 't6', type: 'Expense', amount: '5000', category: '📈 Investments', walletId: 'w-inv', createdAt: '2026-10-29T10:00:00.000Z' } as Transaction,
];

const sampleBudgets: CategoryBudget[] = [
  { id: 'b1', category: '🛒 Groceries', amount: '600', year: 2026, month: 10 } as CategoryBudget,
  { id: 'b2', category: '🏢 Housing & Utilities', amount: '1600', year: 2026, month: 10 } as CategoryBudget,
  { id: 'b3', category: '📈 Investments', amount: '5000', year: 2026, month: 10 } as CategoryBudget,
];

test('buildDailyLivingBurnSeries excludes investments and tracks peak/zero-spend days accurately', () => {
  const res = buildDailyLivingBurnSeries({
    transactions: sampleTxs,
    period: {
      year: 2026,
      month: 10,
      start: new Date('2026-10-25T00:00:00.000Z'),
      end: new Date('2026-11-03T23:59:59.000Z'),
      startPayroll: { id: 'p-start', scheduledFor: '2026-10-25T00:00:00.000Z', amount: '17500' },
      endPayroll: { id: 'p-end', scheduledFor: '2026-11-04T00:00:00.000Z', amount: '17500' },
    },
    dailyAllowanceHint: 300,
    wallets,
    now: new Date('2026-11-05T12:00:00.000Z'),
  });

  assert.equal(res.points.length, 10);
  assert.equal(res.peakAmount, 1800);
  assert.equal(res.dailyCap, 300);
  assert.equal(res.zeroSpendDays, 6);
  // Cumulative living spend should be 35 + 120 + 420 + 1800 = 2375 (5000 investment excluded)
  assert.equal(res.points[res.points.length - 1].cumSpend, 2375);
});

test('buildSpendSizeDistribution & buildWeekdaySpendProfile classify living expenses accurately', () => {
  const dist = buildSpendSizeDistribution(sampleTxs, wallets);
  const micro = dist.find((d) => d.id === 'micro');
  const everyday = dist.find((d) => d.id === 'everyday');
  const mid = dist.find((d) => d.id === 'mid');
  const big = dist.find((d) => d.id === 'big');

  assert.equal(micro?.totalAmount, 35);
  assert.equal(everyday?.totalAmount, 120);
  assert.equal(mid?.totalAmount, 420);
  assert.equal(big?.totalAmount, 1800);

  const weekday = buildWeekdaySpendProfile(sampleTxs, wallets);
  assert.equal(weekday.length, 7);
  const peakDay = weekday.find((d) => d.isPeak);
  assert.equal(peakDay?.avgSpend, 1800);
});

test('buildBudgetPacingSeries excludes wealth categories and flags over-budget living categories', () => {
  const pacing = buildBudgetPacingSeries({
    budgets: sampleBudgets,
    filteredTransactions: sampleTxs,
    year: 2026,
    month: 10,
    wallets,
  });

  assert.equal(pacing.length, 2); // Investments excluded
  assert.equal(pacing[0].category, '🏢 Housing & Utilities');
  assert.equal(pacing[0].status, 'over');
  assert.equal(pacing[0].pctUsed, 112.5);
  assert.equal(pacing[1].status, 'safe');
});

test('buildMultiCycleTrendSeries and buildTopCategoriesMultiCycleTrend return coherent cycle rows', () => {
  const trend = buildMultiCycleTrendSeries({
    transactions: sampleTxs,
    budgets: sampleBudgets,
    payrolls,
    wallets,
    now: new Date('2026-11-26T12:00:00.000Z'),
  });
  assert.ok(trend.length >= 2);
  const octRow = trend.find((r) => r.livingSpend === 2375);
  assert.ok(octRow, 'Expected Oct cycle with 2375 MAD living spend');
  assert.equal(octRow.income, 15000);
  assert.equal(octRow.savingsRate, 84);

  const catTrend = buildTopCategoriesMultiCycleTrend({
    transactions: sampleTxs,
    payrolls,
    wallets,
    now: new Date('2026-11-26T12:00:00.000Z'),
  });
  assert.ok(catTrend.categories.includes('🏢 Housing & Utilities'));
  assert.equal(catTrend.categories.includes('📈 Investments'), false);
});
