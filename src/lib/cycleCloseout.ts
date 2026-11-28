import { isReimbursementIncome, reimbursedAmountOf } from './finance.js';

export type PocketSweepMode =
  | 'bank_and_cash_recover'
  | 'main_bank_only'
  | 'safe_surplus_only'
  | 'all_pocket_no_recover'
  | 'disabled';

export const VALID_POCKET_SWEEP_MODES: readonly PocketSweepMode[] = [
  'bank_and_cash_recover',
  'main_bank_only',
  'safe_surplus_only',
  'all_pocket_no_recover',
  'disabled',
] as const;

export interface CloseoutWalletInput {
  id: string;
  name: string;
  type: string;
  isMain?: boolean | null;
  accountSubtype?: string | null;
}

export interface SweepTransferPlanItem {
  sourceWalletId: string;
  sourceWalletName: string;
  sourceWalletType: string;
  amountMad: number;
  kind: 'bank_sweep' | 'cash_sweep';
}

export interface CashRecoveryPlanItem {
  sourceBankWalletId: string;
  sourceBankWalletName: string;
  destinationCashWalletId: string;
  destinationCashWalletName: string;
  amountMad: number;
}

export interface MonthlyPocketSweepPlan {
  sweepMode: PocketSweepMode;
  sweeps: SweepTransferPlanItem[];
  cashRecoveries: CashRecoveryPlanItem[];
  sweptBankAmountMad: number;
  sweptCashAmountMad: number;
  totalSweptAmountMad: number;
  recoveredCashAmountMad: number;
}

export interface ClosingPeriodInfo {
  closingYear: number;
  closingMonth: number;
  closingCycleKey: string;
  incomingYear: number;
  incomingMonth: number;
  isYearEnd: boolean;
  closingCalendarYear: number;
}

export interface YearlyMonthMetric {
  month: number; // 1..12
  label: string;
  earnedIncomeMad: number;
  livingSpendMad: number;
  savedMad: number;
  investedMad: number;
  netCashflowMad: number;
  savingsRatePercent: number;
  transactionCount: number;
}

export interface YearlyAuditSummary {
  year: number;
  generatedAt: string;
  earnedIncomeMad: number;
  reimbursementsExcludedMad: number;
  netLivingSpendMad: number;
  totalSavedAndSweptMad: number;
  totalInvestedMad: number;
  dividendsReceivedMad: number;
  debtRepaidMad: number;
  netCashflowMad: number;
  annualSavingsRatePercent: number;
  totalTransactions: number;
  payrollsConfirmedCount: number;
  monthlyBreakdown: YearlyMonthMetric[];
  bestMonth: { month: number; label: string; savingsRatePercent: number; netCashflowMad: number } | null;
  worstMonth: { month: number; label: string; savingsRatePercent: number; netCashflowMad: number } | null;
  topCategories: Array<{ category: string; amountMad: number; sharePercent: number }>;
  projectsAudit: {
    activeCount: number;
    completedOrExpiredToArchive: Array<{
      id: string;
      name: string;
      status: string;
      endDate: string | null;
      spentInYearMad: number;
      budgetLimitMad: number | null;
    }>;
    totalProjectSpendMad: number;
  };
  subscriptionsAudit: {
    activeCount: number;
    annualizedTotalMad: number;
    monthlySinkingFundMad: number;
    nonMonthlyAnnualTotalMad: number;
    nonMonthlySinkingFundMonthlyMad: number;
    nonMonthlyItems: Array<{
      id: string;
      name: string;
      billingCycle: string;
      cycleAmountMad: number;
      annualizedMad: number;
      monthlyReserveMad: number;
    }>;
  };
  debtCarryForward: {
    openReceivablesCount: number;
    openReceivablesMad: number;
    openPayablesCount: number;
    openPayablesMad: number;
    netDebtPositionMad: number;
  };
  goalsAudit: {
    totalGoalsCount: number;
    completedGoalsCount: number;
    totalFundedMad: number;
    totalTargetMad: number;
  };
  netWorthAudit: {
    startNetWorthMad: number | null;
    endNetWorthMad: number | null;
    deltaNetWorthMad: number | null;
    startSnapshotDate: string | null;
    endSnapshotDate: string | null;
  };
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const isCreditLiabilityWallet = (w: CloseoutWalletInput): boolean =>
  w.accountSubtype === 'CreditCard' || w.accountSubtype === 'Overdraft' || w.accountSubtype === 'BNPL';

/**
 * Returns a timestamp strictly inside the closing financial period (the calendar day
 * BEFORE the incoming payroll date) across UTC-12..UTC+1 so both `isInFinancialMonth`
 * and `financialEngine.ts` opening-balance calculations isolate closing sweeps from
 * the incoming cycle.
 */
export function computeClosingSweepTimestamp(receivedDate: Date, offsetSeconds = 0): Date {
  const prevDay = new Date(
    Date.UTC(
      receivedDate.getUTCFullYear(),
      receivedDate.getUTCMonth(),
      receivedDate.getUTCDate() - 1,
      22,
      55,
      offsetSeconds,
      0
    )
  );
  return prevDay;
}

/**
 * Returns a timestamp strictly inside the incoming financial period (1 minute after
 * salary deposit) so Cash Pocket Recovery is attributed to the incoming payroll.
 */
export function computeCashRecoveryTimestamp(receivedDate: Date, index = 0): Date {
  return new Date(receivedDate.getTime() + (60 + index * 10) * 1000);
}

/**
 * Computes next calendar month's payroll YYYY-MM-DD date, clamping to the last valid
 * day of shorter months (e.g. Jan 31 -> Feb 28/29).
 */
export function computeNextPayrollDate(
  currentScheduledFor: Date | string,
  preferredPaydayDay?: number | null
): string {
  const parsed = new Date(currentScheduledFor);
  const baseYear = parsed.getUTCFullYear();
  const baseMonth = parsed.getUTCMonth(); // 0-indexed
  const desiredDay =
    preferredPaydayDay && Number.isInteger(preferredPaydayDay) && preferredPaydayDay >= 1 && preferredPaydayDay <= 31
      ? preferredPaydayDay
      : parsed.getUTCDate();

  const targetMonthIndex = baseMonth + 1;
  const targetYear = baseYear + Math.floor(targetMonthIndex / 12);
  const targetMonthZero = targetMonthIndex % 12;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthZero + 1, 0)).getUTCDate();
  const clampedDay = Math.min(desiredDay, daysInTargetMonth);

  return `${targetYear}-${String(targetMonthZero + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Resolves the closing period (YYYY-MM), incoming period (YYYY-MM), and whether
 * this closeout completes a calendar year (closing day falls in December).
 */
export function resolveClosingPeriodInfo(
  scheduledFor: Date | string,
  preferredPaydayDay?: number | null
): ClosingPeriodInfo {
  const scheduled = new Date(scheduledFor);
  const closingYear = scheduled.getUTCFullYear();
  const closingMonth = scheduled.getUTCMonth() + 1;
  const closingCycleKey = `${closingYear}-${String(closingMonth).padStart(2, '0')}`;

  const nextDateStr = computeNextPayrollDate(scheduled, preferredPaydayDay);
  const [nextYearStr, nextMonthStr] = nextDateStr.split('-');
  const incomingYear = Number(nextYearStr);
  const incomingMonth = Number(nextMonthStr);

  // The closing period ends the day BEFORE the payroll date.
  // For Dec 25 payday -> closingEnd is Dec 24 (month 11, year Y).
  // For Jan 1 payday -> closingEnd is Dec 31 (month 11, year Y-1).
  const closingEnd = new Date(
    Date.UTC(scheduled.getUTCFullYear(), scheduled.getUTCMonth(), scheduled.getUTCDate() - 1, 12, 0, 0)
  );
  const isYearEnd = closingEnd.getUTCMonth() === 11;
  const closingCalendarYear = closingEnd.getUTCFullYear();

  return {
    closingYear,
    closingMonth,
    closingCycleKey,
    incomingYear,
    incomingMonth,
    isYearEnd,
    closingCalendarYear,
  };
}

/**
 * Pure planner for end-of-cycle pocket sweeps & incoming-payroll Cash recovery.
 *
 * In default `bank_and_cash_recover` mode:
 *  1. 100% of positive Main Bank balance is swept to Savings (dated end of closing cycle).
 *  2. 100% of positive Cash wallet balance(s) is swept to Savings (dated end of closing cycle),
 *     giving 100% accurate end-of-cycle saved analytics across Bank + Cash.
 *  3. Immediately after the new salary lands in Main Bank, the exact Cash balance that
 *     physically remains in the user's pocket is transferred from Main Bank -> Cash
 *     (dated inside the incoming cycle), so Cash stays accurate AND is funded out of the
 *     incoming payroll rather than inflating the new cycle above the salary!
 */
export function planMonthlyPocketSweep(params: {
  wallets: CloseoutWalletInput[];
  walletBalances: Record<string, number>;
  pendingPayablesMad: number;
  sweepMode: PocketSweepMode;
  depositWalletId?: string | null;
  destinationSavingsWalletId?: string | null;
  incomingSalaryMad: number;
}): MonthlyPocketSweepPlan {
  const {
    wallets,
    walletBalances,
    pendingPayablesMad,
    sweepMode,
    depositWalletId,
    destinationSavingsWalletId,
    incomingSalaryMad,
  } = params;

  if (sweepMode === 'disabled') {
    return {
      sweepMode,
      sweeps: [],
      cashRecoveries: [],
      sweptBankAmountMad: 0,
      sweptCashAmountMad: 0,
      totalSweptAmountMad: 0,
      recoveredCashAmountMad: 0,
    };
  }

  const eligibleWallets = wallets.filter(
    (w) => !isCreditLiabilityWallet(w) && w.id !== destinationSavingsWalletId
  );

  const mainBankWallet =
    eligibleWallets.find((w) => w.id === depositWalletId && w.type === 'Bank') ||
    eligibleWallets.find((w) => w.type === 'Bank' && w.isMain) ||
    eligibleWallets.find((w) => w.type === 'Bank') ||
    null;

  const cashWallets = eligibleWallets.filter((w) => w.type === 'Cash');

  const sweeps: SweepTransferPlanItem[] = [];
  const cashRecoveries: CashRecoveryPlanItem[] = [];

  if (mainBankWallet) {
    const rawBankBal = Number(walletBalances[mainBankWallet.id] ?? 0);
    let bankSweep = 0;
    if (sweepMode === 'safe_surplus_only') {
      bankSweep = Math.max(0, rawBankBal - Math.max(0, pendingPayablesMad));
    } else {
      bankSweep = Math.max(0, rawBankBal);
    }
    bankSweep = round2(bankSweep);
    if (bankSweep >= 0.01) {
      sweeps.push({
        sourceWalletId: mainBankWallet.id,
        sourceWalletName: mainBankWallet.name,
        sourceWalletType: mainBankWallet.type,
        amountMad: bankSweep,
        kind: 'bank_sweep',
      });
    }
  }

  const shouldSweepCash =
    sweepMode === 'bank_and_cash_recover' || sweepMode === 'all_pocket_no_recover';

  if (shouldSweepCash) {
    let remainingSalaryCapacity = Math.max(0, round2(incomingSalaryMad));

    for (const cashWallet of cashWallets) {
      const rawCashBal = round2(Math.max(0, Number(walletBalances[cashWallet.id] ?? 0)));
      if (rawCashBal < 0.01) continue;

      sweeps.push({
        sourceWalletId: cashWallet.id,
        sourceWalletName: cashWallet.name,
        sourceWalletType: cashWallet.type,
        amountMad: rawCashBal,
        kind: 'cash_sweep',
      });

      if (sweepMode === 'bank_and_cash_recover' && mainBankWallet && remainingSalaryCapacity >= 0.01) {
        const recoverAmt = round2(Math.min(rawCashBal, remainingSalaryCapacity));
        if (recoverAmt >= 0.01) {
          cashRecoveries.push({
            sourceBankWalletId: mainBankWallet.id,
            sourceBankWalletName: mainBankWallet.name,
            destinationCashWalletId: cashWallet.id,
            destinationCashWalletName: cashWallet.name,
            amountMad: recoverAmt,
          });
          remainingSalaryCapacity = round2(remainingSalaryCapacity - recoverAmt);
        }
      }
    }
  }

  const sweptBankAmountMad = round2(
    sweeps.filter((s) => s.kind === 'bank_sweep').reduce((sum, s) => sum + s.amountMad, 0)
  );
  const sweptCashAmountMad = round2(
    sweeps.filter((s) => s.kind === 'cash_sweep').reduce((sum, s) => sum + s.amountMad, 0)
  );
  const totalSweptAmountMad = round2(sweptBankAmountMad + sweptCashAmountMad);
  const recoveredCashAmountMad = round2(
    cashRecoveries.reduce((sum, r) => sum + r.amountMad, 0)
  );

  return {
    sweepMode,
    sweeps,
    cashRecoveries,
    sweptBankAmountMad,
    sweptCashAmountMad,
    totalSweptAmountMad,
    recoveredCashAmountMad,
  };
}

const INVESTMENT_CATEGORIES = new Set([
  '📈 Investments',
  'Investments & Brokerage',
  'Investments',
  'Investment',
  'Stocks & Crypto',
  'Investment Funding',
  'Trading',
  'Crypto Purchase',
  'Investment Returns & Capital Gains',
  '📈 Investment Returns / Dividends',
]);

const SAVINGS_CATEGORIES = new Set([
  '🛟 Emergency & goals Fund',
  '💰 Savings & Goals',
]);

const DEBT_CATEGORIES = new Set([
  '💳 Debt & Obligations',
  'Debt Repayment',
  'Loan',
]);

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function annualizeSubscriptionAmount(amount: number, billingCycle: string): number {
  const raw = (billingCycle || 'monthly').trim().toLowerCase();
  if (raw === 'yearly') return amount;
  if (raw === 'every_6_months') return amount * 2;
  if (raw === 'quarterly' || raw === 'every_3_months') return amount * 4;
  if (raw === 'every_2_months') return amount * 6;
  if (raw === 'weekly') return amount * 52;
  if (raw === 'biweekly') return amount * 26;
  const customMonths = raw.match(/^every_(\d+)_months?$/);
  if (customMonths) return (amount * 12) / Math.max(1, parseInt(customMonths[1], 10));
  const customDays = raw.match(/^every_(\d+)_days?$/);
  if (customDays) return (amount * 365) / Math.max(1, parseInt(customDays[1], 10));
  return amount * 12;
}

/**
 * Pure aggregator for the Yearly Financial Audit & Year-End Closeout report.
 */
export function computeYearlyAuditMetrics(params: {
  year: number;
  transactions: any[];
  wallets: CloseoutWalletInput[];
  payrolls: any[];
  subscriptions: any[];
  debts: any[];
  goals: any[];
  contexts: any[];
  snapshots: Array<{ snapshotDate: string; totalNetWorthMad: string | number }>;
  liveNetWorthMad?: number | null;
}): YearlyAuditSummary {
  const {
    year,
    transactions,
    wallets,
    payrolls,
    subscriptions,
    debts,
    goals,
    contexts,
    snapshots,
    liveNetWorthMad = null,
  } = params;

  const walletById = new Map(wallets.map((w) => [w.id, w]));

  const monthlyBuckets: YearlyMonthMetric[] = MONTH_LABELS.map((label, idx) => ({
    month: idx + 1,
    label,
    earnedIncomeMad: 0,
    livingSpendMad: 0,
    savedMad: 0,
    investedMad: 0,
    netCashflowMad: 0,
    savingsRatePercent: 0,
    transactionCount: 0,
  }));

  let earnedIncomeMad = 0;
  let reimbursementsExcludedMad = 0;
  let netLivingSpendMad = 0;
  let totalSavedAndSweptMad = 0;
  let totalInvestedMad = 0;
  let dividendsReceivedMad = 0;
  let debtRepaidMad = 0;
  let totalTransactions = 0;

  const categoryTotals = new Map<string, number>();
  const projectSpendInYear = new Map<string, number>();

  for (const tx of transactions) {
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime()) || dt.getUTCFullYear() !== year) continue;

    const monthIdx = dt.getUTCMonth();
    const bucket = monthlyBuckets[monthIdx];
    const amount = Number(tx.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    totalTransactions += 1;
    bucket.transactionCount += 1;

    const category = tx.category || 'Uncategorized';
    const srcWallet = tx.walletId ? walletById.get(tx.walletId) : undefined;
    const destWalletId = tx.destinationWalletId || tx.toWalletId;
    const destWallet = destWalletId ? walletById.get(destWalletId) : undefined;
    const isInvestmentWalletTx = srcWallet?.type === 'Investment';
    const isSavingsWalletTx = srcWallet?.type === 'Savings';
    const isInvestmentCategory = INVESTMENT_CATEGORIES.has(category);
    const isSavingsCategory = SAVINGS_CATEGORIES.has(category);
    const isPayableTx = tx.linkedDebtType === 'Payable' || category === 'Debt Repayment';

    if (tx.type === 'Income') {
      if (isReimbursementIncome(tx)) {
        reimbursementsExcludedMad += amount;
      } else {
        earnedIncomeMad += amount;
        bucket.earnedIncomeMad += amount;
        if (
          isInvestmentCategory ||
          isInvestmentWalletTx ||
          category.toLowerCase().includes('dividend')
        ) {
          dividendsReceivedMad += amount;
        }
      }
    } else if (tx.type === 'Transfer') {
      const destType = destWallet?.type?.toLowerCase();
      if (destType === 'savings' && !isSavingsWalletTx) {
        totalSavedAndSweptMad += amount;
        bucket.savedMad += amount;
      } else if (destType === 'investment' && !isInvestmentWalletTx) {
        totalInvestedMad += amount;
        bucket.investedMad += amount;
      } else if (!destWallet && isSavingsCategory) {
        totalSavedAndSweptMad += amount;
        bucket.savedMad += amount;
      } else if (!destWallet && isInvestmentCategory) {
        totalInvestedMad += amount;
        bucket.investedMad += amount;
      }
    } else if (tx.type === 'Expense' || tx.type === 'Debt Repayment') {
      const reimbursable = tx.type === 'Expense' && !isPayableTx ? reimbursedAmountOf(tx) : 0;
      const netExpense = Math.max(0, amount - reimbursable);

      if (tx.type === 'Debt Repayment' || DEBT_CATEGORIES.has(category)) {
        debtRepaidMad += netExpense;
      }

      if (isInvestmentCategory || isInvestmentWalletTx) {
        if (!isInvestmentWalletTx) {
          totalInvestedMad += netExpense;
          bucket.investedMad += netExpense;
        }
      } else if (isSavingsCategory) {
        if (!isSavingsWalletTx) {
          totalSavedAndSweptMad += netExpense;
          bucket.savedMad += netExpense;
        }
      } else {
        netLivingSpendMad += netExpense;
        bucket.livingSpendMad += netExpense;
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + netExpense);
        if (tx.contextId) {
          projectSpendInYear.set(
            tx.contextId,
            (projectSpendInYear.get(tx.contextId) || 0) + netExpense
          );
        }
      }
    }
  }

  // Finalize monthly metrics
  for (const b of monthlyBuckets) {
    b.earnedIncomeMad = round2(b.earnedIncomeMad);
    b.livingSpendMad = round2(b.livingSpendMad);
    b.savedMad = round2(b.savedMad);
    b.investedMad = round2(b.investedMad);
    b.netCashflowMad = round2(b.earnedIncomeMad - b.livingSpendMad);
    b.savingsRatePercent =
      b.earnedIncomeMad > 0
        ? round2(((b.earnedIncomeMad - b.livingSpendMad) / b.earnedIncomeMad) * 100)
        : 0;
  }

  const activeMonths = monthlyBuckets.filter((m) => m.earnedIncomeMad > 0 || m.livingSpendMad > 0);
  const sortedByPerf = [...activeMonths].sort((a, b) => {
    if (b.savingsRatePercent !== a.savingsRatePercent) {
      return b.savingsRatePercent - a.savingsRatePercent;
    }
    return b.netCashflowMad - a.netCashflowMad;
  });

  const bestMonth = sortedByPerf.length
    ? {
        month: sortedByPerf[0].month,
        label: sortedByPerf[0].label,
        savingsRatePercent: sortedByPerf[0].savingsRatePercent,
        netCashflowMad: sortedByPerf[0].netCashflowMad,
      }
    : null;
  const worstMonth =
    sortedByPerf.length > 1
      ? {
          month: sortedByPerf[sortedByPerf.length - 1].month,
          label: sortedByPerf[sortedByPerf.length - 1].label,
          savingsRatePercent: sortedByPerf[sortedByPerf.length - 1].savingsRatePercent,
          netCashflowMad: sortedByPerf[sortedByPerf.length - 1].netCashflowMad,
        }
      : bestMonth;

  const topCategories = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amountMad]) => ({
      category,
      amountMad: round2(amountMad),
      sharePercent: netLivingSpendMad > 0 ? round2((amountMad / netLivingSpendMad) * 100) : 0,
    }));

  // Payrolls confirmed in target year
  const payrollsConfirmedCount = payrolls.filter((p) => {
    const dt = new Date(p.confirmedAt || p.scheduledFor);
    return (
      !Number.isNaN(dt.getTime()) &&
      dt.getUTCFullYear() === year &&
      (p.status === 'confirmed' || p.status === 'matched' || Boolean(p.linkedTransactionId))
    );
  }).length;

  // Subscriptions & multi-month sinking-fund audit
  const activeSubs = subscriptions.filter((s) => (s.status || 'active') === 'active');
  let annualizedTotalMad = 0;
  let nonMonthlyAnnualTotalMad = 0;
  const nonMonthlyItems: YearlyAuditSummary['subscriptionsAudit']['nonMonthlyItems'] = [];

  for (const sub of activeSubs) {
    const amt = Number(sub.amount || 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const cycle = (sub.billingCycle || 'monthly').toLowerCase();
    const annualized = round2(annualizeSubscriptionAmount(amt, cycle));
    annualizedTotalMad += annualized;
    if (cycle !== 'monthly' && cycle !== 'weekly' && cycle !== 'biweekly') {
      nonMonthlyAnnualTotalMad += annualized;
      nonMonthlyItems.push({
        id: sub.id,
        name: sub.name,
        billingCycle: cycle,
        cycleAmountMad: round2(amt),
        annualizedMad: annualized,
        monthlyReserveMad: round2(annualized / 12),
      });
    }
  }
  nonMonthlyItems.sort((a, b) => b.annualizedMad - a.annualizedMad);

  // Projects / FinancialContexts archival review
  const yearEndCutoff = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  let activeCount = 0;
  const completedOrExpiredToArchive: YearlyAuditSummary['projectsAudit']['completedOrExpiredToArchive'] = [];
  let totalProjectSpendMad = 0;

  for (const ctx of contexts) {
    const spent = round2(projectSpendInYear.get(ctx.id) || 0);
    totalProjectSpendMad += spent;
    const status = String(ctx.status || 'Active');
    if (status === 'Active') activeCount += 1;
    const endDate = ctx.endDate ? new Date(ctx.endDate) : null;
    const isExpired = endDate && !Number.isNaN(endDate.getTime()) && endDate <= yearEndCutoff;
    if (status === 'Completed' || (status === 'Active' && isExpired)) {
      completedOrExpiredToArchive.push({
        id: ctx.id,
        name: ctx.name,
        status,
        endDate: ctx.endDate ? new Date(ctx.endDate).toISOString().slice(0, 10) : null,
        spentInYearMad: spent,
        budgetLimitMad: ctx.budgetLimit ? round2(Number(ctx.budgetLimit)) : null,
      });
    }
  }

  // Open Debt Carry-Forward Summary
  const openReceivables = debts.filter(
    (d) => d.type === 'Receivable' && d.status !== 'Cleared' && Number(d.remainingBalance || 0) > 0
  );
  const openPayables = debts.filter(
    (d) => d.type === 'Payable' && d.status !== 'Cleared' && Number(d.remainingBalance || 0) > 0
  );
  const openReceivablesMad = round2(
    openReceivables.reduce((sum, d) => sum + Number(d.remainingBalance || 0), 0)
  );
  const openPayablesMad = round2(
    openPayables.reduce((sum, d) => sum + Number(d.remainingBalance || 0), 0)
  );

  // Goals Audit
  let completedGoalsCount = 0;
  let totalFundedMad = 0;
  let totalTargetMad = 0;
  for (const g of goals) {
    const curr = Number(g.currentAmount || 0);
    const target = Number(g.targetAmount || 0);
    totalFundedMad += curr;
    totalTargetMad += target;
    if (target > 0 && curr >= target) {
      completedGoalsCount += 1;
    }
  }

  // Net Worth Growth (First vs Last Snapshot in Target Year)
  const yearSnapshots = snapshots
    .filter((s) => typeof s.snapshotDate === 'string' && s.snapshotDate.startsWith(`${year}-`))
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

  const startSnap = yearSnapshots[0] || null;
  const endSnap = yearSnapshots.length > 0 ? yearSnapshots[yearSnapshots.length - 1] : null;
  const startNetWorthMad = startSnap ? round2(Number(startSnap.totalNetWorthMad || 0)) : null;
  const endNetWorthMad = endSnap
    ? round2(Number(endSnap.totalNetWorthMad || 0))
    : liveNetWorthMad !== null
    ? round2(liveNetWorthMad)
    : null;
  const deltaNetWorthMad =
    startNetWorthMad !== null && endNetWorthMad !== null
      ? round2(endNetWorthMad - startNetWorthMad)
      : null;

  const netCashflowMad = round2(earnedIncomeMad - netLivingSpendMad);
  const annualSavingsRatePercent =
    earnedIncomeMad > 0
      ? round2(((earnedIncomeMad - netLivingSpendMad) / earnedIncomeMad) * 100)
      : 0;

  return {
    year,
    generatedAt: new Date().toISOString(),
    earnedIncomeMad: round2(earnedIncomeMad),
    reimbursementsExcludedMad: round2(reimbursementsExcludedMad),
    netLivingSpendMad: round2(netLivingSpendMad),
    totalSavedAndSweptMad: round2(totalSavedAndSweptMad),
    totalInvestedMad: round2(totalInvestedMad),
    dividendsReceivedMad: round2(dividendsReceivedMad),
    debtRepaidMad: round2(debtRepaidMad),
    netCashflowMad,
    annualSavingsRatePercent,
    totalTransactions,
    payrollsConfirmedCount,
    monthlyBreakdown: monthlyBuckets,
    bestMonth,
    worstMonth,
    topCategories,
    projectsAudit: {
      activeCount,
      completedOrExpiredToArchive,
      totalProjectSpendMad: round2(totalProjectSpendMad),
    },
    subscriptionsAudit: {
      activeCount: activeSubs.length,
      annualizedTotalMad: round2(annualizedTotalMad),
      monthlySinkingFundMad: round2(annualizedTotalMad / 12),
      nonMonthlyAnnualTotalMad: round2(nonMonthlyAnnualTotalMad),
      nonMonthlySinkingFundMonthlyMad: round2(nonMonthlyAnnualTotalMad / 12),
      nonMonthlyItems,
    },
    debtCarryForward: {
      openReceivablesCount: openReceivables.length,
      openReceivablesMad,
      openPayablesCount: openPayables.length,
      openPayablesMad,
      netDebtPositionMad: round2(openReceivablesMad - openPayablesMad),
    },
    goalsAudit: {
      totalGoalsCount: goals.length,
      completedGoalsCount,
      totalFundedMad: round2(totalFundedMad),
      totalTargetMad: round2(totalTargetMad),
    },
    netWorthAudit: {
      startNetWorthMad,
      endNetWorthMad,
      deltaNetWorthMad,
      startSnapshotDate: startSnap?.snapshotDate || null,
      endSnapshotDate: endSnap?.snapshotDate || null,
    },
  };
}
