import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expenseCategories,
  normalizeCategory,
  resolveSubscriptionCategory,
} from '../src/lib/categories.js';
import { generateFacts, selectFacts } from '../src/lib/financialFacts.js';
import type {
  CategoryBudget,
  Debt,
  FinancialContext,
  Goal,
  KPI,
  Subscription,
  Transaction,
} from '../src/types/index.js';

const expenseCategorySet = new Set<string>(expenseCategories);

test('resolveSubscriptionCategory maps legacy subscription & phone labels to canonical budget categories', () => {
  const telecomCases = [
    'Internet & Telecom',
    'Telecom & Internet',
    'Mobile Phone Plan',
    'Phone Plan',
    'Fiber Internet',
    'Maroc Telecom',
    'Subscriptions & Streaming',
    'Streaming & Media',
    'AI & Software',
    'Software & Dev',
    'Cloud Storage',
    'Digital Services',
    'Other Subscriptions',
  ];

  for (const raw of telecomCases) {
    assert.equal(
      resolveSubscriptionCategory(raw),
      '📱 Telecom & Subscriptions',
      `Expected "${raw}" to map to 📱 Telecom & Subscriptions`,
    );
    assert.equal(normalizeCategory(raw), '📱 Telecom & Subscriptions');
  }

  assert.equal(resolveSubscriptionCategory('Housing & Rent'), '🏢 Housing & Utilities');
  assert.equal(resolveSubscriptionCategory('Bills & Utilities'), '🏢 Housing & Utilities');
  assert.equal(resolveSubscriptionCategory('Fixed Bills & Utilities'), '🏢 Housing & Utilities');
  assert.equal(resolveSubscriptionCategory('Health & Fitness'), '🩺 Health & Medical');
  assert.equal(resolveSubscriptionCategory('Healthcare & Pharmacy'), '🩺 Health & Medical');
  assert.equal(resolveSubscriptionCategory('Insurance'), '🛡️ Insurance / Annual Costs');
  assert.equal(resolveSubscriptionCategory('Education & Learning'), '🏠 Household & Family');
  assert.equal(resolveSubscriptionCategory('Shopping & Lifestyle'), '👕 Personal & Clothing');
  assert.equal(resolveSubscriptionCategory('Transport & Fuel'), '🚗 Transportation');

  // Empty, unknown, or non-expense categories always resolve to a valid canonical expense category
  for (const edge of [null, undefined, '', '   ', 'Random Legacy Sub', '📥 Income', '🔄 Transfer']) {
    const resolved = resolveSubscriptionCategory(edge);
    assert.equal(resolved, '📱 Telecom & Subscriptions');
    assert.ok(expenseCategorySet.has(resolved));
  }
});

test('generateFacts separates project expenses from monthly category budgets and generates rich expanded facts', () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const budgetMonth = month + 1;

  // Build dates guaranteed to fall inside the current calendar month and previous calendar month
  const dayInCurrentMonth = (day: number) => {
    const safeDay = Math.min(day, Math.max(1, now.getDate()));
    return new Date(year, month, safeDay, 12, 0, 0).toISOString();
  };
  const dayInPrevMonth = (day: number) =>
    new Date(year, month - 1, Math.min(day, 25), 12, 0, 0).toISOString();

  const kpis: KPI = {
    accounts: [],
    totalLiquidity: 18500,
    bankBalance: 16000,
    cashOnHand: 2500,
    monthlyIncome: 15000,
    monthlyExpenses: 5400,
    adjustedTrueSpend: 5400,
    daysUntilPayday: 12,
    dailyAllowance: 380,
    dailySpent: 90,
    dailyRemaining: 290,
    dailyUsagePercent: 24,
    dailyStatus: 'on_track',
    payday: 28,
    emergencyBuffer: 4000,
    investmentReserve: 2500,
    salary: 15000,
    currentFinancialAmount: 18500,
    financialPeriodStart: dayInCurrentMonth(1),
    financialPeriodEnd: new Date(year, month + 1, 0, 23, 59, 59).toISOString(),
    nextPayrollDate: null,
    financialMonthReady: true,
    financialMonthMessage: null,
    safeToSpend: 11200,
    pendingPayables: 600,
    pendingReceivables: 800,
    runwayDays: 45,
    avgDailySpend: 210,
    healthScore: 84,
    healthFactors: [],
    walletBalances: { Bank: 16000, Cash: 2500, Savings: 6000 },
    forecast: {
      expected: 6800,
      best: 5900,
      worst: 7900,
      daysRemaining: 12,
      elapsedDays: 18,
      totalDays: 30,
      spendingPacePercent: 70,
    },
  };

  const makeTx = (overrides: Partial<Transaction> & { id: string }): Transaction => ({
    userId: 'u1',
    walletId: 'w1',
    type: 'Expense',
    amount: '100',
    category: '🛒 Groceries',
    notes: 'Test transaction note',
    createdAt: dayInCurrentMonth(2),
    ...overrides,
  });

  const transactions: Transaction[] = [
    // Current month income
    makeTx({ id: 'inc-1', type: 'Income', amount: '15000', category: '📥 Income', createdAt: dayInCurrentMonth(1), notes: 'Monthly salary' }),
    // Fixed bills: Housing & Insurance (testing fixedCategories fix)
    makeTx({ id: 'exp-rent', amount: '3800', category: '🏢 Housing & Utilities', createdAt: dayInCurrentMonth(2), notes: 'Monthly apartment rent' }),
    makeTx({ id: 'exp-ins', amount: '400', category: '🛡️ Insurance / Annual Costs', createdAt: dayInCurrentMonth(3), notes: 'Car insurance installment' }),
    // Telecom subscription logged under normalized category
    makeTx({ id: 'exp-phone', amount: '199', category: '📱 Telecom & Subscriptions', createdAt: dayInCurrentMonth(4), notes: 'Mobile phone plan renewal' }),
    // Groceries (smaller than previous month to trigger category-drop-win)
    makeTx({ id: 'exp-groc', amount: '450', category: '🛒 Groceries', createdAt: dayInCurrentMonth(5), notes: 'Weekly groceries' }),
    // Dining, Coffee, Personal & Clothing, Health, Household
    makeTx({ id: 'exp-dining', amount: '220', category: '🍔 Dining & Takeaway', createdAt: dayInCurrentMonth(6), notes: 'Dinner out' }),
    makeTx({ id: 'exp-coffee', amount: '65', category: '☕ Coffee & Quick Food', createdAt: dayInCurrentMonth(7), notes: 'Coffee & pastry' }),
    makeTx({ id: 'exp-clothes', amount: '350', category: '👕 Personal & Clothing', createdAt: dayInCurrentMonth(8), notes: 'Running shoes' }),
    makeTx({ id: 'exp-health', amount: '280', category: '🩺 Health & Medical', createdAt: dayInCurrentMonth(9), notes: 'Pharmacy & checkup' }),
    makeTx({ id: 'exp-family', amount: '300', category: '🏠 Household & Family', createdAt: dayInCurrentMonth(10), notes: 'Household supplies' }),
    // Emergency Fund & Investments allocations
    makeTx({ id: 'exp-ef', amount: '900', category: '🛟 Emergency & goals Fund', createdAt: dayInCurrentMonth(11), notes: 'Emergency vault transfer' }),
    makeTx({ id: 'exp-inv', amount: '1000', category: '📈 Investments', createdAt: dayInCurrentMonth(12), notes: 'Monthly ETF contribution' }),
    // Loan Given to brother (Transfer type with 🤝 Loan Given category)
    makeTx({ id: 'loan-1', type: 'Transfer', amount: '200', category: '🤝 Loan Given', createdAt: dayInCurrentMonth(12), notes: 'Loan to brother' }),
    // Project-tagged Room Setup purchase — MUST NOT inflate monthly category budget for Home, Tech & Equipment!
    makeTx({
      id: 'exp-setup-desk',
      amount: '2200',
      category: '🛠️ Home, Tech & Equipment',
      contextId: 'ctx-room',
      createdAt: dayInCurrentMonth(13),
      notes: 'Standing desk for room setup',
    }),
    // Non-project Home, Tech & Equipment purchase (150 MAD) so monthly budget usage = 150 / 1000 = 15% (NOT 235%!)
    makeTx({
      id: 'exp-cable',
      amount: '150',
      category: '🛠️ Home, Tech & Equipment',
      createdAt: dayInCurrentMonth(14),
      notes: 'USB-C hub',
    }),
    // Previous month expenses for MoM comparison & category-drop-win
    makeTx({ id: 'prev-groc', amount: '1400', category: '🛒 Groceries', createdAt: dayInPrevMonth(8), notes: 'Previous month groceries' }),
    makeTx({ id: 'prev-rent', amount: '3200', category: '🏢 Housing & Utilities', createdAt: dayInPrevMonth(2), notes: 'Previous month rent' }),
    makeTx({ id: 'prev-dining', amount: '600', category: '🍔 Dining & Takeaway', createdAt: dayInPrevMonth(15), notes: 'Previous month dining' }),
  ];

  const budgets: CategoryBudget[] = [
    {
      id: 'b-tech',
      userId: 'u1',
      category: '🛠️ Home, Tech & Equipment',
      year,
      month: budgetMonth,
      amount: '1000',
      createdAt: dayInCurrentMonth(1),
      updatedAt: dayInCurrentMonth(1),
    },
    {
      id: 'b-telecom',
      userId: 'u1',
      category: '📱 Telecom & Subscriptions',
      year,
      month: budgetMonth,
      amount: '500',
      createdAt: dayInCurrentMonth(1),
      updatedAt: dayInCurrentMonth(1),
    },
    {
      id: 'b-groc',
      userId: 'u1',
      category: '🛒 Groceries',
      year,
      month: budgetMonth,
      amount: '1500',
      createdAt: dayInCurrentMonth(1),
      updatedAt: dayInCurrentMonth(1),
    },
  ];

  const debts: Debt[] = [
    {
      id: 'd1',
      userId: 'u1',
      contactName: 'Brother',
      type: 'Receivable',
      originalAmount: '200',
      remainingBalance: '200',
      status: 'Pending',
      createdAt: dayInCurrentMonth(12),
    },
    {
      id: 'd2',
      userId: 'u1',
      contactName: 'Karim',
      type: 'Payable',
      originalAmount: '600',
      remainingBalance: '600',
      status: 'Pending',
      createdAt: dayInPrevMonth(20),
    },
  ];

  const inFiveDays = new Date(now.getTime() + 5 * 86400000).toISOString();
  const inFortyDays = new Date(now.getTime() + 40 * 86400000).toISOString();

  const subscriptions: Subscription[] = [
    {
      id: 'sub-phone',
      userId: 'u1',
      name: 'Orange Mobile Plan',
      amount: '199',
      currency: 'MAD',
      billingCycle: 'monthly',
      category: '📱 Telecom & Subscriptions',
      nextBillingDate: inFiveDays,
      status: 'active',
      createdAt: dayInPrevMonth(1),
      updatedAt: dayInPrevMonth(1),
    },
    {
      id: 'sub-cloud',
      userId: 'u1',
      name: 'Annual Car Insurance',
      amount: '3600',
      currency: 'MAD',
      billingCycle: 'yearly',
      category: '🛡️ Insurance / Annual Costs',
      nextBillingDate: inFortyDays,
      status: 'active',
      createdAt: dayInPrevMonth(1),
      updatedAt: dayInPrevMonth(1),
    },
  ];

  const goals: Goal[] = [
    {
      id: 'g1',
      userId: 'u1',
      name: 'Emergency Reserve',
      targetAmount: '10000',
      currentAmount: '7500',
      category: '🛟 Emergency & goals Fund',
      createdAt: dayInPrevMonth(1),
      updatedAt: dayInCurrentMonth(1),
    },
    {
      id: 'g2',
      userId: 'u1',
      name: 'Japan Trip',
      targetAmount: '20000',
      currentAmount: '4000',
      category: '🛟 Emergency & goals Fund',
      createdAt: dayInPrevMonth(5),
      updatedAt: dayInCurrentMonth(1),
    },
  ];

  const contexts: FinancialContext[] = [
    {
      id: 'ctx-room',
      userId: 'u1',
      name: 'Room Setup',
      type: 'Project',
      startDate: dayInCurrentMonth(1),
      endDate: null,
      budget: '5000',
      status: 'Active',
      notes: 'Workspace upgrade',
      createdAt: dayInCurrentMonth(1),
      updatedAt: dayInCurrentMonth(1),
      plannedItems: [
        { id: 'p1', name: 'Standing Desk', estimatedAmount: 2200, category: '🛠️ Home, Tech & Equipment', purchased: true },
        { id: 'p2', name: 'Ergonomic Chair', estimatedAmount: 1800, category: '🛠️ Home, Tech & Equipment', purchased: false },
        { id: 'p3', name: '4TB External HDD', estimatedAmount: 900, category: '🛠️ Home, Tech & Equipment', purchased: false },
      ],
    },
  ];

  const facts = generateFacts(kpis, transactions, debts, budgets, [], null, {
    subscriptions,
    goals,
    contexts,
  });

  const byId = new Map(facts.map((f) => [f.id, f]));

  // Verify separated monthly budget isolation:
  // Home, Tech & Equipment monthly spend is 150 / 1000 (15%), NOT 2350 / 1000 (235%)
  // Highest used monthly budget should be Telecom & Subscriptions (199 / 500 = 40%), NOT exceeded!
  const budgetUsageFact = byId.get('budget-usage');
  assert.ok(budgetUsageFact, 'budget-usage fact should be generated');
  assert.equal(budgetUsageFact.title, 'Budget usage', 'Project-tagged 2200 MAD desk must not trigger Budget exceeded');
  assert.match(budgetUsageFact.message, /Telecom & Subscriptions/);

  // Verify fixed vs discretionary recognizes 🏢 Housing & Utilities + 🛡️ Insurance / Annual Costs
  const fixedFact = byId.get('fixed-vs-discretionary');
  assert.ok(fixedFact, 'fixed-vs-discretionary fact should be generated');
  assert.match(fixedFact.message, /fixed essentials \(4,679\.00 MAD\)/i);

  // Verify all key new financial facts are generated
  const expectedNewIds = [
    'home-tech-equipment-spend',
    'health-medical-spend',
    'household-family-spend',
    'personal-clothing-spend',
    'largest-category-share',
    'most-disciplined-budget',
    'budget-pacing-vs-calendar',
    'project-budgets-isolation',
    'project-planned-checklist-progress',
    'housing-burden-ratio',
    'income-days-to-cover-fixed',
    'loans-given-this-cycle',
    'emergency-fund-allocation',
    'investment-allocation-cycle',
    'category-drop-win',
    'daily-burn-vs-allowance',
    'payday-projected-cushion',
    'subscriptions-monthly-commitment',
    'upcoming-subscription-renewals',
    'multi-month-sinking-fund',
    'goals-overall-progress',
    'nearest-goal-milestone',
  ];

  for (const id of expectedNewIds) {
    assert.ok(byId.has(id), `Expected new financial fact "${id}" to be generated`);
  }

  // Spot-check key values including estimatedAmount calculation (1800 + 900 = 2,700.00 MAD left)
  assert.match(byId.get('project-budgets-isolation')!.value, /44%/); // 2200 / 5000 = 44%
  assert.equal(byId.get('project-planned-checklist-progress')!.value, '1 / 3 bought');
  assert.match(byId.get('project-planned-checklist-progress')!.message, /2,700\.00 MAD left/);
  assert.match(byId.get('loans-given-this-cycle')!.value, /200\.00 MAD/);
  assert.match(byId.get('upcoming-subscription-renewals')!.value, /199\.00 MAD due/);
  assert.match(byId.get('multi-month-sinking-fund')!.value, /300\.00 MAD \/ mo/); // 3600 / 12
  assert.equal(byId.get('goals-overall-progress')!.value, '38% funded'); // 11500 / 30000
  assert.match(byId.get('nearest-goal-milestone')!.title, /Emergency Reserve/);

  // Verify selectFacts supports the larger 48-card deck without duplicates
  const selected = selectFacts(facts);
  assert.ok(selected.length > 32, `Expected expanded deck to select > 32 facts, got ${selected.length}`);
  assert.ok(selected.length <= 48, `Expected selected deck <= 48 facts, got ${selected.length}`);
  const uniqueIds = new Set(selected.map((f) => f.id));
  assert.equal(uniqueIds.size, selected.length, 'Selected facts must have unique IDs');
  const typesRepresented = new Set(selected.map((f) => f.type));
  assert.ok(typesRepresented.size >= 7, `Expected diverse fact types (>= 7), got ${typesRepresented.size}`);
});
