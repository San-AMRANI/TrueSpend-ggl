import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHolisticForecast } from '../src/lib/predictiveEngine';
import type {
  CategoryBudget,
  Debt,
  FinancialContext,
  Goal,
  KPI,
  Payroll,
  Subscription,
  Transaction,
} from '../src/types';

function makeTx(partial: Partial<Transaction> & { id: string; amount: string; type: Transaction['type']; createdAt: string; category: string }): Transaction {
  return {
    walletId: 'w-bank',
    notes: '',
    ...partial,
  } as Transaction;
}

function buildRealisticFixture() {
  // Now = Nov 25, 2026 (Day 1 of Nov 25 – Dec 22 cycle!)
  const now = new Date('2026-11-25T12:00:00.000Z');

  const payrolls: Payroll[] = [
    { id: 'p-1', amount: '17520', scheduledFor: '2026-08-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
    { id: 'p-2', amount: '17520', scheduledFor: '2026-09-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
    { id: 'p-3', amount: '17520', scheduledFor: '2026-10-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
    { id: 'p-4', amount: '17520', scheduledFor: '2026-11-25T08:00:00.000Z', status: 'confirmed' } as Payroll,
    { id: 'p-5', amount: '17520', scheduledFor: '2026-12-23T08:00:00.000Z', status: 'expected' } as Payroll,
  ];

  // 3 completed historical cycles (~5,500 MAD/mo living spend each: 1500 rent + ~4000 groceries/coffee/dining)
  const transactions: Transaction[] = [];
  const cycleStarts = [
    new Date('2026-08-26T10:00:00.000Z'),
    new Date('2026-09-26T10:00:00.000Z'),
    new Date('2026-10-26T10:00:00.000Z'),
  ];

  let idx = 1;
  for (const start of cycleStarts) {
    // Monthly rent (1500) + insurance (145) + mobile (100)
    transactions.push(
      makeTx({ id: `tx-${idx++}`, type: 'Expense', amount: '1500', category: '🏢 Housing & Utilities', createdAt: new Date(start.getTime() + 5 * 86_400_000).toISOString() }),
      makeTx({ id: `tx-${idx++}`, type: 'Expense', amount: '145', category: '🛡️ Insurance', createdAt: new Date(start.getTime() + 3 * 86_400_000).toISOString() }),
      makeTx({ id: `tx-${idx++}`, type: 'Expense', amount: '100', category: '📱 Internet & Telecom', createdAt: new Date(start.getTime() + 1 * 86_400_000).toISOString() }),
    );
    // Everyday living spend: 20 days x 180 MAD = 3600 MAD/cycle (total cycle living = ~5345 MAD)
    for (let d = 0; d < 20; d++) {
      transactions.push(
        makeTx({
          id: `tx-${idx++}`,
          type: 'Expense',
          amount: d % 2 === 0 ? '120' : '240',
          category: d % 3 === 0 ? '🛒 Groceries' : d % 3 === 1 ? '🍔 Dining & Takeaway' : '☕ Coffee & Quick Food',
          createdAt: new Date(start.getTime() + (d + 2) * 86_400_000).toISOString(),
        })
      );
    }
    // Also include a Savings/Investment expense to ensure living-expense filter ignores wealth transfers!
    transactions.push(
      makeTx({
        id: `tx-${idx++}`,
        type: 'Expense',
        amount: '8000',
        category: '🛟 Emergency & goals Fund',
        createdAt: new Date(start.getTime() + 25 * 86_400_000).toISOString(),
      })
    );
  }

  // DAY 1 of the new cycle (Nov 25, 2026):
  // User buys ONE 1,250 MAD equipment item + 19 MAD coffee + 10 MAD groceries
  transactions.push(
    makeTx({ id: 'tx-day1-eq', type: 'Expense', amount: '1250', category: '🛠️ Home, Tech & Equipment', createdAt: '2026-11-25T09:00:00.000Z' }),
    makeTx({ id: 'tx-day1-cof', type: 'Expense', amount: '19', category: '☕ Coffee & Quick Food', createdAt: '2026-11-25T10:00:00.000Z' }),
    makeTx({ id: 'tx-day1-gro', type: 'Expense', amount: '10', category: '🛒 Groceries', createdAt: '2026-11-25T11:00:00.000Z' }),
  );

  const budgets: CategoryBudget[] = [
    { id: 'b-1', category: '🛠️ Home, Tech & Equipment', amount: '1500', year: 2026, month: 12 } as CategoryBudget,
    { id: 'b-2', category: '☕ Coffee & Quick Food', amount: '450', year: 2026, month: 12 } as CategoryBudget,
    { id: 'b-3', category: '🛒 Groceries', amount: '650', year: 2026, month: 12 } as CategoryBudget,
    { id: 'b-4', category: '🛟 Emergency & goals Fund', amount: '7690', year: 2026, month: 12 } as CategoryBudget,
    { id: 'b-5', category: '📈 Investments', amount: '1000', year: 2026, month: 12 } as CategoryBudget,
  ];

  const subscriptions: Subscription[] = [
    { id: 's-1', name: 'Rent / Loyer', amount: '1500', currency: 'MAD', billingCycle: 'monthly', status: 'active', nextBillingDate: '2026-12-05' } as Subscription,
    { id: 's-2', name: 'Assurance', amount: '145', currency: 'MAD', billingCycle: 'monthly', status: 'active', nextBillingDate: '2026-12-03' } as Subscription,
    { id: 's-3', name: 'Mobile Phone Plan', amount: '100', currency: 'MAD', billingCycle: 'monthly', status: 'active', nextBillingDate: '2026-12-01' } as Subscription,
  ];

  const debts: Debt[] = [
    { id: 'd-1', contactName: 'Friend', type: 'Receivable', status: 'Pending', remainingBalance: '560' } as Debt,
  ];

  const goals: Goal[] = [
    { id: 'g-1', name: '100K Wealth Milestone', category: 'Wealth', targetAmount: '100000', currentAmount: '27866', deadline: '2028-01-01' } as Goal,
  ];

  const kpis: KPI = {
    totalLiquidity: 31157, // 1812 operating + 27966 savings + 1379 investment reserve
    investmentReserve: 1379,
    emergencyBuffer: 27966,
    safeToSpend: 1812,
    salary: 17520,
    payday: 25,
    daysUntilPayday: 28,
    avgDailySpend: 1279, // Day-1 spike in raw avgDailySpend!
    monthlyIncome: 17520,
    forecast: {
      elapsedDays: 1,
      totalDays: 28,
      daysRemaining: 27,
      expectedEndBalance: 20000,
      bestEndBalance: 22000,
      worstEndBalance: 18000,
    },
    accounts: [
      { id: 'w-bank', name: 'Main Bank', type: 'Bank', balance: 1792, isMain: true },
      { id: 'w-cash', name: 'Cash', type: 'Cash', balance: 20, isMain: false },
      { id: 'w-sav', name: 'Savings Reserve', type: 'Savings', balance: 27966, isMain: false },
      { id: 'w-inv', name: 'Brokerage', type: 'Investment', balance: 1379, isMain: false },
    ],
  } as unknown as KPI;

  return { now, payrolls, transactions, budgets, subscriptions, debts, goals, contexts: [] as FinancialContext[], kpis };
}

test('Day-1 lump-sum equipment purchase does not blow up monthly burn or category projection', () => {
  const fx = buildRealisticFixture();
  const report = computeHolisticForecast({
    kpis: fx.kpis,
    transactions: fx.transactions,
    payrolls: fx.payrolls,
    budgets: fx.budgets,
    subscriptions: fx.subscriptions,
    debts: fx.debts,
    goals: fx.goals,
    contexts: fx.contexts,
    nowOverride: fx.now,
  });

  // 1. Monthly living outflow must match historical ~5,345 MAD/mo (NOT 26,880 MAD/mo!)
  const totalMonthlyLiving = report.monthlyVariableBurn + report.monthlyFixedSubsBurn;
  assert.ok(totalMonthlyLiving >= 4000 && totalMonthlyLiving <= 7000, `Expected realistic monthly living burn ~5345 MAD, got ${totalMonthlyLiving}`);
  assert.ok(report.monthlyNetSavingsBaseline > 10000, `Expected strong positive baseline surplus >10k MAD, got ${report.monthlyNetSavingsBaseline}`);
  assert.ok(report.projectedNetWorth12m > report.currentNetWorth, `Expected 12M net worth growth, got ${report.projectedNetWorth12m} vs ${report.currentNetWorth}`);

  // 2. Home, Tech & Equipment must NOT be extrapolated to 22,250 MAD!
  const homeCat = report.categoryPredictions.find((c) => c.category.includes('Home, Tech'));
  assert.ok(homeCat, 'Expected Home, Tech & Equipment category prediction');
  assert.equal(homeCat.forecastMethod, 'lump_sum');
  assert.ok(homeCat.projectedEndOfCycle <= 1500, `Expected <= 1500 MAD projected, got ${homeCat.projectedEndOfCycle}`);
  assert.equal(homeCat.status, 'watch', '83% used should be watch, not breach_imminent');

  // 3. Wealth-allocation categories (Savings, Investments) excluded from living burn radar
  assert.equal(report.categoryPredictions.some((c) => c.category.includes('Emergency')), false);
  assert.equal(report.categoryPredictions.some((c) => c.category.includes('Investments')), false);

  // 4. Month 0 Net Worth reconciles exactly with currentNetWorth (zero double-counting of investmentReserve)
  assert.equal(report.horizonTrajectory24m[0].simulatedNetWorth, report.currentNetWorth);
  assert.equal(report.currentNetWorth, 31717); // (31157 - 1379) + 1379 + 560 = 31717

  // 5. Lowest 30d balance is cleanly rounded (no .467 floats)
  assert.equal(Number.isInteger(report.lowest30dBalance), true);
});

test('Net Worth Cone bands NEVER invert even under severe negative-surplus stress test', () => {
  const fx = buildRealisticFixture();
  const report = computeHolisticForecast({
    kpis: fx.kpis,
    transactions: fx.transactions,
    payrolls: fx.payrolls,
    budgets: fx.budgets,
    subscriptions: fx.subscriptions,
    debts: fx.debts,
    goals: fx.goals,
    contexts: fx.contexts,
    whatIf: {
      discretionaryCutPercent: 0,
      extraMonthlyDcaMad: 0,
      oneTimeShockMad: -10000,
      incomeDeltaMad: -15000, // forces deeply negative monthly surplus
      cancelReviewingSubs: false,
    },
    nowOverride: fx.now,
  });

  assert.ok(report.monthlyNetSavingsSimulated < 0, 'Stress test should produce negative simulated surplus');
  for (const pt of report.horizonTrajectory24m) {
    assert.ok(
      pt.conservativeNetWorth <= pt.simulatedNetWorth && pt.simulatedNetWorth <= pt.optimisticNetWorth,
      `Month ${pt.monthOffset} bands inverted: cons=${pt.conservativeNetWorth}, sim=${pt.simulatedNetWorth}, opt=${pt.optimisticNetWorth}`
    );
  }

  // Goal ETA must honestly pause under negative cashflow instead of fabricating a date
  const goal = report.goalPredictions[0];
  assert.equal(goal.simulatedMonthsToComplete, null);
  assert.equal(goal.simulatedEtaLabel, 'Paused (deficit)');
});

test('Goal ETA does not double-count discretionary spending cuts', () => {
  const fx = buildRealisticFixture();
  const baseReport = computeHolisticForecast({
    kpis: fx.kpis,
    transactions: fx.transactions,
    payrolls: fx.payrolls,
    budgets: fx.budgets,
    subscriptions: fx.subscriptions,
    debts: fx.debts,
    goals: fx.goals,
    contexts: fx.contexts,
    nowOverride: fx.now,
  });

  const cutReport = computeHolisticForecast({
    kpis: fx.kpis,
    transactions: fx.transactions,
    payrolls: fx.payrolls,
    budgets: fx.budgets,
    subscriptions: fx.subscriptions,
    debts: fx.debts,
    goals: fx.goals,
    contexts: fx.contexts,
    whatIf: {
      discretionaryCutPercent: 20,
      extraMonthlyDcaMad: 0,
      oneTimeShockMad: 0,
      incomeDeltaMad: 0,
      cancelReviewingSubs: false,
    },
    nowOverride: fx.now,
  });

  const gBase = baseReport.goalPredictions[0];
  const gCut = cutReport.goalPredictions[0];
  assert.ok(gBase.baselineMonthsToComplete !== null && gBase.baselineMonthsToComplete > 0);
  assert.ok(gCut.simulatedMonthsToComplete !== null && gCut.simulatedMonthsToComplete <= gBase.baselineMonthsToComplete);
  assert.equal(gCut.monthsSaved, gBase.baselineMonthsToComplete - gCut.simulatedMonthsToComplete);
  assert.ok(gCut.monthsSaved <= 3, `20% cut on ~3.6k variable spend should only save 1-2 months, got ${gCut.monthsSaved}`);
});

test('Negative 30-day cash triggers critical cash shortfall signal even when savings reserve is 0', () => {
  const fx = buildRealisticFixture();
  // Remove savings wallet so protectedSavingsReserve === 0, and trigger heavy cash shock
  const noSavingsKpis = {
    ...fx.kpis,
    totalLiquidity: 2000,
    wallets: [{ id: 'w-bank', name: 'Bank', type: 'Bank', balance: 2000 }],
  } as any;

  const report = computeHolisticForecast({
    kpis: noSavingsKpis,
    transactions: fx.transactions,
    payrolls: fx.payrolls,
    budgets: fx.budgets,
    subscriptions: fx.subscriptions,
    debts: fx.debts,
    goals: fx.goals,
    contexts: fx.contexts,
    whatIf: {
      discretionaryCutPercent: 0,
      extraMonthlyDcaMad: 0,
      oneTimeShockMad: -5000,
      incomeDeltaMad: 0,
      cancelReviewingSubs: false,
    },
    nowOverride: fx.now,
  });

  assert.ok(report.lowest30dBalance < 0, 'Expected negative 30d cash floor');
  assert.equal(report.hasLiquidityPinchBeforePayday, true);
  const liqSig = report.signals.find((s) => s.domain === 'Liquidity');
  assert.ok(liqSig, 'Liquidity signal should exist');
  assert.equal(liqSig.severity, 'critical');
  assert.match(liqSig.title, /cash shortfall/i);
});

