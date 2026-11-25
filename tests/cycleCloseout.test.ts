import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCashRecoveryTimestamp,
  computeClosingSweepTimestamp,
  computeNextPayrollDate,
  computeYearlyAuditMetrics,
  planMonthlyPocketSweep,
  resolveClosingPeriodInfo,
} from '../src/lib/cycleCloseout.js';
import { computeFinancialState } from '../src/lib/financialEngine.js';

const WALLETS = [
  { id: 'w-bank', name: 'Main Bank', type: 'Bank', isMain: true, initialBalance: 500 },
  { id: 'w-cash', name: 'Cash Wallet', type: 'Cash', isMain: false, initialBalance: 20 },
  { id: 'w-save', name: 'Savings Reserve', type: 'Savings', isMain: false, initialBalance: 3000 },
  {
    id: 'w-cc',
    name: 'Credit Card',
    type: 'Bank',
    isMain: false,
    initialBalance: -200,
    accountSubtype: 'CreditCard',
    creditLimit: 5000,
  },
];

test('bank_and_cash_recover sweeps 100% Bank + Cash to Savings and recovers Cash from incoming payroll with exact financialEngine math', () => {
  const plan = planMonthlyPocketSweep({
    wallets: WALLETS,
    walletBalances: { 'w-bank': 500, 'w-cash': 20, 'w-save': 3000, 'w-cc': -200 },
    pendingPayablesMad: 0,
    sweepMode: 'bank_and_cash_recover',
    depositWalletId: 'w-bank',
    destinationSavingsWalletId: 'w-save',
    incomingSalaryMad: 10000,
  });

  assert.equal(plan.sweptBankAmountMad, 500);
  assert.equal(plan.sweptCashAmountMad, 20);
  assert.equal(plan.totalSweptAmountMad, 520);
  assert.equal(plan.recoveredCashAmountMad, 20);
  assert.equal(plan.sweeps.length, 2);
  assert.equal(plan.cashRecoveries.length, 1);
  assert.equal(plan.cashRecoveries[0].sourceBankWalletId, 'w-bank');
  assert.equal(plan.cashRecoveries[0].destinationCashWalletId, 'w-cash');
  assert.equal(plan.cashRecoveries[0].amountMad, 20);

  // Simulate exact transactions generated on payday 2026-11-25
  const receivedDate = new Date('2026-11-25T12:00:00.000Z');
  const bankSweepTs = computeClosingSweepTimestamp(receivedDate, 0);
  const cashSweepTs = computeClosingSweepTimestamp(receivedDate, 10);
  const cashRecoverTs = computeCashRecoveryTimestamp(receivedDate, 0);

  const payrolls = [
    { id: 'p-oct', scheduledFor: '2026-10-25T12:00:00.000Z', amount: '10000' },
    { id: 'p-nov', scheduledFor: '2026-11-25T12:00:00.000Z', amount: '10000' },
    { id: 'p-dec', scheduledFor: '2026-12-25T12:00:00.000Z', amount: '10000' },
  ];

  const transactions = [
    {
      id: 'tx-sweep-bank',
      type: 'Transfer' as const,
      amount: '500',
      walletId: 'w-bank',
      destinationWalletId: 'w-save',
      category: '💰 Savings & Goals',
      createdAt: bankSweepTs.toISOString(),
    },
    {
      id: 'tx-sweep-cash',
      type: 'Transfer' as const,
      amount: '20',
      walletId: 'w-cash',
      destinationWalletId: 'w-save',
      category: '💰 Savings & Goals',
      createdAt: cashSweepTs.toISOString(),
    },
    {
      id: 'tx-salary',
      type: 'Income' as const,
      amount: '10000',
      walletId: 'w-bank',
      category: '📥 Income',
      createdAt: receivedDate.toISOString(),
    },
    {
      id: 'tx-recover-cash',
      type: 'Transfer' as const,
      amount: '20',
      walletId: 'w-bank',
      destinationWalletId: 'w-cash',
      category: '🔄 Transfer',
      createdAt: cashRecoverTs.toISOString(),
    },
  ];

  // Exclude credit card for pure liquid verification
  const liquidWallets = WALLETS.filter((w) => w.id !== 'w-cc');

  // 1) Closing cycle (2026-11-24T23:59Z) sees 520 MAD saved & swept!
  const closingState = computeFinancialState({
    transactions: transactions.slice(0, 2) as any,
    payrolls: payrolls as any,
    debts: [],
    budgets: [],
    wallets: liquidWallets as any,
    now: new Date('2026-11-24T23:59:00.000Z'),
  });
  assert.equal(closingState.walletBalances['w-bank'], 0);
  assert.equal(closingState.walletBalances['w-cash'], 0);
  assert.equal(closingState.walletBalances['w-save'], 3520);
  assert.equal(closingState.monthlySavingsFunded, 520);

  // 2) Incoming cycle on Payday (2026-11-25T15:00Z):
  //    - Cash pocket physically holds 20 MAD (recovered from incoming payroll)
  //    - Main Bank holds 9,980 MAD
  //    - Savings Reserve holds 3,520 MAD
  //    - Safe-to-Spend is EXACTLY 10,000 MAD (not 10,020 or 10,520!)
  //    - Incoming cycle monthlySavingsFunded is 0 (520 belongs to closed cycle!)
  //    - Incoming cycle monthlyExpenses is 0
  const incomingState = computeFinancialState({
    transactions: transactions as any,
    payrolls: payrolls as any,
    debts: [],
    budgets: [],
    wallets: liquidWallets as any,
    now: new Date('2026-11-25T15:00:00.000Z'),
  });

  assert.equal(incomingState.walletBalances['w-cash'], 20);
  assert.equal(incomingState.walletBalances['w-bank'], 9980);
  assert.equal(incomingState.walletBalances['w-save'], 3520);
  assert.equal(incomingState.safeToSpend, 10000);
  assert.equal(incomingState.monthlyIncome, 10000);
  assert.equal(incomingState.monthlySavingsFunded, 0);
  assert.equal(incomingState.monthlyExpenses, 0);
  assert.equal(incomingState.daysUntilPayday, 30);
  assert.ok(Math.abs(incomingState.dailyAllowance - 10000 / 30) < 0.01);
});

test('alternative sweep modes (main_bank_only, safe_surplus_only, all_pocket_no_recover, disabled) compute accurately', () => {
  const bankOnly = planMonthlyPocketSweep({
    wallets: WALLETS,
    walletBalances: { 'w-bank': 500, 'w-cash': 20, 'w-save': 3000 },
    pendingPayablesMad: 150,
    sweepMode: 'main_bank_only',
    depositWalletId: 'w-bank',
    destinationSavingsWalletId: 'w-save',
    incomingSalaryMad: 10000,
  });
  assert.equal(bankOnly.sweptBankAmountMad, 500);
  assert.equal(bankOnly.sweptCashAmountMad, 0);
  assert.equal(bankOnly.recoveredCashAmountMad, 0);

  const safeOnly = planMonthlyPocketSweep({
    wallets: WALLETS,
    walletBalances: { 'w-bank': 500, 'w-cash': 20, 'w-save': 3000 },
    pendingPayablesMad: 150,
    sweepMode: 'safe_surplus_only',
    depositWalletId: 'w-bank',
    destinationSavingsWalletId: 'w-save',
    incomingSalaryMad: 10000,
  });
  assert.equal(safeOnly.sweptBankAmountMad, 350);
  assert.equal(safeOnly.sweptCashAmountMad, 0);

  const allNoRecover = planMonthlyPocketSweep({
    wallets: WALLETS,
    walletBalances: { 'w-bank': 500, 'w-cash': 20, 'w-save': 3000 },
    pendingPayablesMad: 0,
    sweepMode: 'all_pocket_no_recover',
    depositWalletId: 'w-bank',
    destinationSavingsWalletId: 'w-save',
    incomingSalaryMad: 10000,
  });
  assert.equal(allNoRecover.totalSweptAmountMad, 520);
  assert.equal(allNoRecover.recoveredCashAmountMad, 0);

  const disabled = planMonthlyPocketSweep({
    wallets: WALLETS,
    walletBalances: { 'w-bank': 500, 'w-cash': 20, 'w-save': 3000 },
    pendingPayablesMad: 0,
    sweepMode: 'disabled',
    depositWalletId: 'w-bank',
    destinationSavingsWalletId: 'w-save',
    incomingSalaryMad: 10000,
  });
  assert.equal(disabled.totalSweptAmountMad, 0);
  assert.equal(disabled.sweeps.length, 0);
});

test('computeNextPayrollDate handles month-end clamping and year rollover', () => {
  assert.equal(computeNextPayrollDate('2026-01-31T12:00:00.000Z', 31), '2026-02-28');
  assert.equal(computeNextPayrollDate('2028-01-31T12:00:00.000Z', 31), '2028-02-29');
  assert.equal(computeNextPayrollDate('2026-12-25T12:00:00.000Z', 25), '2027-01-25');
});

test('resolveClosingPeriodInfo detects Year-End accurately for both late-month and 1st-of-month paydays', () => {
  const nov = resolveClosingPeriodInfo('2026-11-25T12:00:00.000Z', 25);
  assert.equal(nov.closingCycleKey, '2026-11');
  assert.equal(nov.incomingYear, 2026);
  assert.equal(nov.incomingMonth, 12);
  assert.equal(nov.isYearEnd, false);

  const dec25 = resolveClosingPeriodInfo('2026-12-25T12:00:00.000Z', 25);
  assert.equal(dec25.closingCycleKey, '2026-12');
  assert.equal(dec25.incomingYear, 2027);
  assert.equal(dec25.incomingMonth, 1);
  assert.equal(dec25.isYearEnd, true);
  assert.equal(dec25.closingCalendarYear, 2026);

  const jan1 = resolveClosingPeriodInfo('2027-01-01T12:00:00.000Z', 1);
  assert.equal(jan1.isYearEnd, true);
  assert.equal(jan1.closingCalendarYear, 2026);
});

test('computeYearlyAuditMetrics produces accurate annual financial report across income, expenses, sweeps, subscriptions, projects, debts, and net worth', () => {
  const summary = computeYearlyAuditMetrics({
    year: 2026,
    wallets: [
      { id: 'w-bank', name: 'Main Bank', type: 'Bank', isMain: true },
      { id: 'w-save', name: 'Savings', type: 'Savings', isMain: false },
      { id: 'w-inv', name: 'Brokerage', type: 'Investment', isMain: false },
    ],
    transactions: [
      {
        id: 't1',
        type: 'Income',
        amount: '10000',
        walletId: 'w-bank',
        category: '📥 Income',
        createdAt: '2026-01-25T12:00:00.000Z',
      },
      {
        id: 't2',
        type: 'Income',
        amount: '400',
        walletId: 'w-bank',
        category: 'Debt Repayment',
        notes: 'Reimbursement from Omar',
        createdAt: '2026-02-10T12:00:00.000Z',
      },
      {
        id: 't3',
        type: 'Expense',
        amount: '3000',
        walletId: 'w-bank',
        category: '🛒 Groceries',
        createdAt: '2026-01-28T12:00:00.000Z',
      },
      {
        id: 't4',
        type: 'Transfer',
        amount: '2500',
        walletId: 'w-bank',
        destinationWalletId: 'w-save',
        category: '💰 Savings & Goals',
        createdAt: '2026-02-24T22:55:00.000Z',
      },
      {
        id: 't5',
        type: 'Transfer',
        amount: '1500',
        walletId: 'w-bank',
        destinationWalletId: 'w-inv',
        category: '📈 Investments',
        createdAt: '2026-03-01T12:00:00.000Z',
      },
      {
        id: 't6',
        type: 'Expense',
        amount: '2000',
        walletId: 'w-bank',
        category: '🖥️ Home, Tech & Equipment',
        contextId: 'ctx-desk',
        createdAt: '2026-06-15T12:00:00.000Z',
      },
    ],
    payrolls: [
      { id: 'p1', scheduledFor: '2026-01-25T12:00:00.000Z', amount: '10000', status: 'confirmed' },
    ],
    subscriptions: [
      { id: 's1', name: 'Car Insurance', amount: '3600', billingCycle: 'yearly', status: 'active' },
      { id: 's2', name: 'Mobile Plan', amount: '100', billingCycle: 'monthly', status: 'active' },
    ],
    debts: [
      { id: 'd1', type: 'Receivable', status: 'Pending', remainingBalance: '600' },
      { id: 'd2', type: 'Payable', status: 'Pending', remainingBalance: '250' },
    ],
    goals: [
      { id: 'g1', name: 'Emergency', currentAmount: '10000', targetAmount: '10000' },
      { id: 'g2', name: 'Laptop', currentAmount: '2000', targetAmount: '8000' },
    ],
    contexts: [
      { id: 'ctx-desk', name: 'Room Setup', status: 'Active', endDate: '2026-10-01', budgetLimit: '5000' },
    ],
    snapshots: [
      { snapshotDate: '2026-01-25', totalNetWorthMad: '12000' },
      { snapshotDate: '2026-12-25', totalNetWorthMad: '19500' },
    ],
  });

  assert.equal(summary.earnedIncomeMad, 10000);
  assert.equal(summary.reimbursementsExcludedMad, 400);
  assert.equal(summary.netLivingSpendMad, 5000);
  assert.equal(summary.totalSavedAndSweptMad, 2500);
  assert.equal(summary.totalInvestedMad, 1500);
  assert.equal(summary.annualSavingsRatePercent, 50);
  assert.equal(summary.subscriptionsAudit.annualizedTotalMad, 4800);
  assert.equal(summary.subscriptionsAudit.nonMonthlyAnnualTotalMad, 3600);
  assert.equal(summary.subscriptionsAudit.nonMonthlySinkingFundMonthlyMad, 300);
  assert.equal(summary.projectsAudit.completedOrExpiredToArchive.length, 1);
  assert.equal(summary.projectsAudit.completedOrExpiredToArchive[0].spentInYearMad, 2000);
  assert.equal(summary.debtCarryForward.openReceivablesMad, 600);
  assert.equal(summary.debtCarryForward.openPayablesMad, 250);
  assert.equal(summary.goalsAudit.completedGoalsCount, 1);
  assert.equal(summary.netWorthAudit.deltaNetWorthMad, 7500);
});
