import test from 'node:test';
import assert from 'node:assert/strict';
import { expenseCategories, normalizeCategory } from '../src/lib/categories';
import {
  computeFourPillarBreakdown,
  getCategoryPillar,
  getCategorySpending,
  getExpensesForMonth,
  getProjectContextIds,
  parseProjectPlannedItems,
} from '../src/lib/finance';
import type { FinancialContext, Transaction } from '../src/types/index';

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: overrides.id || 'tx-1',
  userId: overrides.userId || 'user-1',
  walletId: overrides.walletId || 'wallet-bank',
  destinationWalletId: overrides.destinationWalletId ?? null,
  amount: overrides.amount || '100',
  type: overrides.type || 'Expense',
  category: overrides.category || '🛒 Groceries',
  notes: overrides.notes ?? '',
  createdAt: overrides.createdAt || '2026-04-12T10:00:00.000Z',
  contextId: overrides.contextId ?? null,
});

test('Home, Tech & Equipment is added as 17th canonical category without breaking existing 16', () => {
  assert.equal(expenseCategories.length, 17);
  assert.ok(expenseCategories.includes('🛠️ Home, Tech & Equipment'));

  // All 16 original categories remain intact
  const legacyCategories = [
    '🏠 Household & Family',
    '🏢 Housing & Utilities',
    '🛒 Groceries',
    '🍔 Dining & Takeaway',
    '☕ Coffee & Quick Food',
    '🚗 Transportation',
    '👕 Personal & Clothing',
    '📱 Telecom & Subscriptions',
    '🎬 Entertainment',
    '👥 Social',
    '🩺 Health & Medical',
    '🛡️ Insurance / Annual Costs',
    '💳 Debt & Obligations',
    '⚠️ Unexpected',
    '🛟 Emergency & goals Fund',
    '📈 Investments',
  ];
  for (const cat of legacyCategories) {
    assert.equal(normalizeCategory(cat), cat);
  }

  // Room setup & durable gear aliases normalize cleanly to Home, Tech & Equipment
  for (const alias of [
    'desk',
    'chair',
    'ergonomic chair',
    'hard drive',
    'ssd',
    'monitor',
    'room setup',
    'workspace',
    'furniture',
    'Home Tech & Equipment',
    '🛠️ Home, Tech & Equipment',
  ]) {
    assert.equal(normalizeCategory(alias), '🛠️ Home, Tech & Equipment');
  }

  assert.equal(getCategoryPillar('🛠️ Home, Tech & Equipment'), 'myself');
});

test('getProjectContextIds isolates only Project contexts', () => {
  const contexts: Array<Pick<FinancialContext, 'id' | 'type'>> = [
    { id: 'ctx-room', type: 'Project' },
    { id: 'ctx-trip', type: 'Trip' },
    { id: 'ctx-mission', type: 'Work / Mission' },
    { id: 'ctx-studio', type: 'Project' },
  ];
  const ids = getProjectContextIds(contexts);
  assert.equal(ids.size, 2);
  assert.equal(ids.has('ctx-room'), true);
  assert.equal(ids.has('ctx-studio'), true);
  assert.equal(ids.has('ctx-trip'), false);
  assert.equal(ids.has('ctx-mission'), false);
});

test('parseProjectPlannedItems safely parses JSON strings, arrays, and malformed input', () => {
  assert.deepEqual(parseProjectPlannedItems(null), []);
  assert.deepEqual(parseProjectPlannedItems(''), []);
  assert.deepEqual(parseProjectPlannedItems('{invalid json'), []);

  const rawJson = JSON.stringify([
    {
      id: 'item-desk',
      name: '  Standing Desk  ',
      estimatedAmount: 2000,
      category: 'desk',
      purchased: false,
    },
    {
      id: 'item-chair',
      name: 'Ergonomic Chair',
      estimatedAmount: 2500.5,
      category: '🛠️ Home, Tech & Equipment',
      purchased: false,
      linkedTransactionId: 'tx-chair-1',
    },
    {
      // Empty name should be skipped safely
      id: 'bad',
      name: '   ',
      estimatedAmount: 100,
    },
  ]);

  const parsed = parseProjectPlannedItems(rawJson);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].name, 'Standing Desk');
  assert.equal(parsed[0].category, '🛠️ Home, Tech & Equipment');
  assert.equal(parsed[0].estimatedAmount, 2000);
  assert.equal(parsed[0].purchased, false);

  // Linking a transaction automatically marks purchased true
  assert.equal(parsed[1].name, 'Ergonomic Chair');
  assert.equal(parsed[1].estimatedAmount, 2500.5);
  assert.equal(parsed[1].purchased, true);
  assert.equal(parsed[1].linkedTransactionId, 'tx-chair-1');
});

test('Monthly budgets separate Project spend by default while preserving exact cash retention and Combined view', () => {
  const projectIds = new Set(['ctx-room-setup']);
  const transactions: Transaction[] = [
    makeTx({
      id: 'tx-salary',
      type: 'Income',
      category: '📥 Income',
      amount: '15000',
      notes: 'April Salary',
    }),
    makeTx({
      id: 'tx-groceries',
      type: 'Expense',
      category: '🛒 Groceries',
      amount: '1200',
      notes: 'Marjane',
      contextId: null,
    }),
    makeTx({
      id: 'tx-desk',
      type: 'Expense',
      category: '🛠️ Home, Tech & Equipment',
      amount: '1800',
      notes: 'Standing Desk',
      contextId: 'ctx-room-setup',
    }),
    makeTx({
      id: 'tx-chair',
      type: 'Expense',
      category: '🛠️ Home, Tech & Equipment',
      amount: '2200',
      notes: 'Ergonomic Chair',
      contextId: 'ctx-room-setup',
    }),
    makeTx({
      id: 'tx-hdd',
      type: 'Expense',
      category: '🛠️ Home, Tech & Equipment',
      amount: '750',
      notes: '2TB External Hard Drive',
      contextId: 'ctx-room-setup',
    }),
  ];

  // 1. Separated mode (default in BudgetsTab)
  const separateCatSpend = getCategorySpending(
    transactions,
    '🛠️ Home, Tech & Equipment',
    2026,
    4,
    [],
    undefined,
    projectIds
  );
  assert.equal(separateCatSpend, 0);

  const separateExpenses = getExpensesForMonth(transactions, 2026, 4, [], {
    excludeContextIds: projectIds,
  });
  assert.equal(separateExpenses.length, 1);
  assert.equal(separateExpenses[0].id, 'tx-groceries');

  const separatePillars = computeFourPillarBreakdown({
    transactions,
    budgets: [],
    year: 2026,
    month: 4,
    payrolls: [],
    isCurrentMonth: true,
    excludeContextIds: projectIds,
  });
  assert.equal(separatePillars.spentOnObligations, 1200);
  assert.equal(separatePillars.spentOnMyself, 0);
  assert.equal(separatePillars.totalLivingSpent, 1200);
  assert.equal(separatePillars.excludedProjectSpent, 4750);
  // Bank retention STILL deducts the 4,750 MAD cash spent on the project: 15000 - 1200 - 4750 = 9050!
  assert.equal(separatePillars.liveRetainedInBank, 9050);

  // 2. Combined mode (toggle switched to Combined)
  const combinedCatSpend = getCategorySpending(
    transactions,
    '🛠️ Home, Tech & Equipment',
    2026,
    4,
    []
  );
  assert.equal(combinedCatSpend, 4750);

  const combinedPillars = computeFourPillarBreakdown({
    transactions,
    budgets: [],
    year: 2026,
    month: 4,
    payrolls: [],
    isCurrentMonth: true,
  });
  assert.equal(combinedPillars.spentOnObligations, 1200);
  assert.equal(combinedPillars.spentOnMyself, 4750);
  assert.equal(combinedPillars.totalLivingSpent, 5950);
  assert.equal(combinedPillars.excludedProjectSpent, 0);
  // Exact same real bank retention in both modes!
  assert.equal(combinedPillars.liveRetainedInBank, 9050);
});
