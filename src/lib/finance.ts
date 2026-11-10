import { CategoryBudget, KPI, Transaction } from '../types/index.js';
import { normalizeCategory } from './categories.js';
import { FinancialMonthRef, PayrollLike, getFinancialMonthBounds, getFinancialMonthRef, getFinancialPeriods, getPreviousFinancialMonth, isInFinancialMonth } from './financialMonth.js';

export const BUDGET_STATUS_THRESHOLDS = { warning: 80, overBudget: 100, critical: 120 } as const;
export type BudgetStatus = 'normal' | 'warning' | 'over_budget' | 'critical' | 'not_set';

export interface TransactionFilters {
  query?: string;
  datePreset?: 'all' | 'today' | 'week' | 'month' | 'last-month' | 'custom';
  startDate?: string;
  endDate?: string;
  types?: Transaction['type'][];
  categories?: string[];
  wallets?: Transaction['walletId'][];
  minAmount?: number;
  maxAmount?: number;
  reimbursable?: 'all' | 'reimbursable' | 'non-reimbursable';
  debtRelationship?: 'all' | 'debt-linked' | 'not-debt-related';
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
}

export const amountOf = (transaction: Pick<Transaction, 'amount'>) => Number.parseFloat(transaction.amount) || 0;

/**
 * Returns the effective net expense of a transaction.
 * For an Expense transaction with a reimbursableAmount, returns max(0, amount - reimbursableAmount).
 * For example: 25 MAD expense with 20 MAD reimbursable returns 5 MAD.
 */
export const netExpenseOf = (transaction: Pick<Transaction, 'amount' | 'type'> & Partial<Pick<Transaction, 'reimbursableAmount' | 'linkedDebtType' | 'category'>>) => {
  const gross = Number.parseFloat(transaction.amount) || 0;
  if (transaction.type !== 'Expense') return gross;
  // Payable debt repayments or bill settlements are out-of-pocket obligations, never reimbursable
  if (transaction.linkedDebtType === 'Payable' || transaction.category === 'Debt Repayment') {
    return gross;
  }
  const reimbursable = transaction.reimbursableAmount ? Number.parseFloat(transaction.reimbursableAmount) || 0 : 0;
  return Math.max(0, gross - reimbursable);
};

export const transactionDate = (transaction: Pick<Transaction, 'createdAt'>) => new Date(transaction.createdAt);
export const transactionMonth = (transaction: Pick<Transaction, 'createdAt'>, payrolls: PayrollLike[]): FinancialMonthRef | null => getFinancialMonthRef(transactionDate(transaction), payrolls);
export const monthLabel = (year: number, month: number) => new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const isInMonth = (transaction: Pick<Transaction, 'createdAt'>, year: number, month: number, payrolls: PayrollLike[]) => isInFinancialMonth(transactionDate(transaction), payrolls, year, month);
export const isExpense = (transaction: Pick<Transaction, 'type'>) => transaction.type === 'Expense';

export const isInvestmentCategory = (category?: string) => [
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
].includes(category || '');

export const isSavingsRetentionCategory = (category?: string) => {
  const norm = normalizeCategory(category || '');
  return (
    norm === '🛟 Emergency & goals Fund' ||
    [
      '🛟 Emergency & goals Fund',
      '💰 Savings & Goals',
      'Savings',
      'Emergency Fund',
      'Goal Contribution',
    ].includes(category || '')
  );
};

export const isWealthAllocationCategory = (category?: string) =>
  isInvestmentCategory(category) || isSavingsRetentionCategory(category);

/**
 * Pillar 1: Spent on Myself (Personal Lifestyle, Discretionary Wants & Self-Enjoyment)
 */
export const SPENT_ON_MYSELF_CATEGORIES = [
  '🍔 Dining & Takeaway',
  '☕ Coffee & Quick Food',
  '👕 Personal & Clothing',
  '🎬 Entertainment',
  '👥 Social',
] as const;

/**
 * Pillar 2: Spent on Obligations (Fixed Needs, Essentials, Household/Family & Debt Servicing)
 */
export const SPENT_ON_OBLIGATIONS_CATEGORIES = [
  '🏢 Housing & Utilities',
  '🛒 Groceries',
  '🚗 Transportation',
  '🩺 Health & Medical',
  '📱 Telecom & Subscriptions',
  '🛡️ Insurance / Annual Costs',
  '🏠 Household & Family',
  '💳 Debt & Obligations',
  '⚠️ Unexpected',
] as const;

export type FinancialPillar = 'myself' | 'obligations' | 'investments' | 'savings';

export const getCategoryPillar = (category?: string): FinancialPillar => {
  const norm = normalizeCategory(category || '');
  if (isInvestmentCategory(norm) || isInvestmentCategory(category)) return 'investments';
  if (isSavingsRetentionCategory(norm) || isSavingsRetentionCategory(category)) return 'savings';
  if ((SPENT_ON_MYSELF_CATEGORIES as readonly string[]).includes(norm)) return 'myself';
  return 'obligations';
};

export const isInvestmentTransaction = (
  transaction: Pick<Transaction, 'category' | 'walletId'> & Partial<Pick<Transaction, 'type' | 'destinationWalletId'>>,
  wallets?: Array<{ id: string; type?: string }>,
) => {
  if (isInvestmentCategory(transaction.category) || isInvestmentCategory(normalizeCategory(transaction.category))) return true;
  if (wallets && transaction.type === 'Transfer' && transaction.destinationWalletId) {
    const dest = wallets.find((item) => item.id === transaction.destinationWalletId);
    if (dest?.type?.toLowerCase() === 'investment') return true;
  }
  if (wallets && transaction.walletId && transaction.type !== 'Transfer') {
    const w = wallets.find((item) => item.id === transaction.walletId);
    if (w?.type === 'Investment') return true;
  }
  return false;
};

export const isLivingExpense = (
  transaction: Pick<Transaction, 'type' | 'category' | 'walletId'>,
  wallets?: Array<{ id: string; type?: string }>,
) => {
  if (transaction.type !== 'Expense') return false;
  if (isInvestmentTransaction(transaction, wallets)) return false;
  if (isSavingsRetentionCategory(transaction.category)) return false;
  return true;
};

export const getExpensesForMonth = (
  transactions: Transaction[],
  year: number,
  month: number,
  payrolls: PayrollLike[],
  options?: {
    excludeInvestments?: boolean;
    excludeWealthAllocations?: boolean;
    includeBudgetTransfers?: boolean;
    wallets?: Array<{ id: string; type?: string }>;
  },
) =>
  transactions.filter((transaction) => {
    if (!isInMonth(transaction, year, month, payrolls)) return false;
    if (transaction.type === 'Expense') {
      if (options?.excludeInvestments && isInvestmentTransaction(transaction, options.wallets)) return false;
      if (options?.excludeWealthAllocations && (isInvestmentTransaction(transaction, options.wallets) || isSavingsRetentionCategory(transaction.category))) {
        return false;
      }
      return true;
    }
    if (options?.includeBudgetTransfers && transaction.type === 'Transfer') {
      let norm = normalizeCategory(transaction.category);
      if (options?.wallets && transaction.destinationWalletId) {
        const dest = options.wallets.find((w) => w.id === transaction.destinationWalletId);
        if (dest) {
          const destType = dest.type?.toLowerCase();
          if (destType === 'investment') norm = '📈 Investments';
          else if (destType === 'savings') norm = '🛟 Emergency & goals Fund';
          else norm = '🔄 Transfer';
        }
      }
      if (options?.excludeWealthAllocations && isWealthAllocationCategory(norm)) return false;
      return Boolean(norm && norm !== '🔄 Transfer' && norm !== 'Transfer');
    }
    return false;
  });

export const getCategorySpending = (
  transactions: Transaction[],
  category: string,
  year: number,
  month: number,
  payrolls: PayrollLike[],
  wallets?: Array<{ id: string; type?: string }>,
) => {
  const normCategory = normalizeCategory(category);
  return transactions
    .filter((transaction) => {
      if (!isInMonth(transaction, year, month, payrolls)) return false;

      let txCategory = normalizeCategory(transaction.category);
      if (transaction.type === 'Transfer' && wallets && transaction.destinationWalletId) {
        const dest = wallets.find((w) => w.id === transaction.destinationWalletId);
        if (dest) {
          const destType = dest.type?.toLowerCase();
          if (destType === 'investment') {
            txCategory = '📈 Investments';
          } else if (destType === 'savings') {
            txCategory = '🛟 Emergency & goals Fund';
          } else {
            txCategory = '🔄 Transfer';
          }
        }
      }

      if (txCategory !== normCategory) return false;
      if (transaction.type === 'Expense') {
        if (wallets && transaction.walletId) {
          const sourceWallet = wallets.find((w) => w.id === transaction.walletId);
          const sourceType = sourceWallet?.type?.toLowerCase();
          if (normCategory === '📈 Investments' && sourceType === 'investment') {
            return false;
          }
          if (normCategory === '🛟 Emergency & goals Fund' && sourceType === 'savings') {
            return false;
          }
        }
        return true;
      }
      if (transaction.type === 'Debt Repayment' && normCategory === '💳 Debt & Obligations') {
        return true;
      }
      if (transaction.type === 'Transfer') {
        return Boolean(txCategory && txCategory !== '🔄 Transfer' && txCategory !== 'Transfer');
      }
      return false;
    })
    .reduce((total, transaction) => total + netExpenseOf(transaction), 0);
};

/**
 * Calculates total income for a financial month (respecting custom payroll cycle boundaries,
 * e.g. 24th of previous calendar month to 23rd of current month), with fallback to configured payroll.
 */
export const getPeriodIncomeForMonth = (
  transactions: Transaction[],
  year: number,
  month: number,
  payrolls: PayrollLike[],
) => {
  const items: { label: string; amount: number; isEstimated?: boolean }[] = [];
  let total = 0;
  let salaryIncome = 0;
  let otherIncome = 0;

  transactions.forEach((tx) => {
    if (tx.type !== 'Income') return;
    if (!isInMonth(tx, year, month, payrolls)) return;
    const amt = Number.parseFloat(String(tx.amount)) || 0;
    if (amt <= 0) return;
    total += amt;
    const catLower = (tx.category || '').toLowerCase();
    const notesLower = (tx.notes || '').toLowerCase();
    if (tx.payrollId || catLower.includes('salary') || catLower.includes('payroll') || notesLower.includes('salary') || notesLower.includes('payroll')) {
      salaryIncome += amt;
    } else {
      otherIncome += amt;
    }
    items.push({
      label: tx.notes || tx.category || 'Income',
      amount: amt,
    });
  });

  const period = getFinancialPeriods(payrolls).find((item) => item.year === year && item.month === month);
  const configuredPayrollAmt = period?.startPayroll ? Number.parseFloat(String(period.startPayroll.amount)) || 0 : 0;

  if (total === 0 && configuredPayrollAmt > 0) {
    items.push({
      label: 'Configured Salary (Payday Baseline)',
      amount: configuredPayrollAmt,
      isEstimated: true,
    });
    total = configuredPayrollAmt;
    salaryIncome = configuredPayrollAmt;
  } else if (salaryIncome === 0 && configuredPayrollAmt > 0 && total >= configuredPayrollAmt) {
    salaryIncome = configuredPayrollAmt;
    otherIncome = Math.max(0, total - salaryIncome);
  }

  return {
    items,
    total,
    salaryIncome,
    otherIncome,
    isEstimated: items.some((i) => i.isEstimated),
  };
};

export interface PillarCategoryItem {
  category: string;
  pillar: FinancialPillar;
  spent: number;
  budgeted: number;
  txCount: number;
}

export interface FourPillarBreakdown {
  periodIncome: number;
  salaryIncome: number;
  otherIncome: number;
  incomeItems: { label: string; amount: number; isEstimated?: boolean }[];
  // Pillar 1: Spent on Myself (Personal & Lifestyle)
  spentOnMyself: number;
  plannedMyselfBudget: number;
  myselfPctOfIncome: number;
  myselfPctOfLivingSpend: number;
  myselfCategories: PillarCategoryItem[];
  // Pillar 2: Spent on Obligations (Essential Needs, Family, Bills & Debt)
  spentOnObligations: number;
  plannedObligationsBudget: number;
  obligationsPctOfIncome: number;
  obligationsPctOfLivingSpend: number;
  obligationsCategories: PillarCategoryItem[];
  essentialNeedsSpent: number;
  familyHouseholdSpent: number;
  debtObligationsSpent: number;
  // Combined Living Consumption (Pillar 1 + Pillar 2)
  totalLivingSpent: number;
  plannedLivingBudget: number;
  livingBudgetRemaining: number;
  // Pillar 3: Invested (Stocks, Equities & Crypto)
  investedAmount: number;
  plannedInvestmentBudget: number;
  investedPctOfIncome: number;
  // Pillar 4: Saved & Retained in Bank (Hybrid: Bank Retention + Explicit Savings Transactions)
  explicitSavingsTx: number;
  liveRetainedInBank: number;
  protectedBankRetention: number;
  effectiveSavedForBudget: number;
  totalActualRetainedAndSaved: number;
  plannedSavingsBudget: number;
  savedPctOfIncome: number;
  // Total Wealth Built (Saved + Invested)
  totalWealthBuilt: number;
  totalWealthPctOfIncome: number;
}

/**
 * Computes the complete 4-Pillar breakdown (Spent on Myself, Spent on Obligations, Invested, Saved/Retained in Bank)
 * supporting BOTH explicit savings transactions AND automatic Bank-as-Savings retention (where salary remains in the bank
 * without requiring a dummy transaction).
 */
export const computeFourPillarBreakdown = ({
  transactions,
  budgets = [],
  year,
  month,
  payrolls = [],
  wallets = [],
  isCurrentMonth = true,
  overrideTransactions,
}: {
  transactions: Transaction[];
  budgets?: CategoryBudget[];
  year: number;
  month: number;
  payrolls?: PayrollLike[];
  wallets?: Array<{ id: string; type?: string }>;
  isCurrentMonth?: boolean;
  /** Optional pre-filtered transaction list (e.g. for 'All Time' in Analytics) */
  overrideTransactions?: Transaction[];
}): FourPillarBreakdown => {
  const incomeData = overrideTransactions
    ? (() => {
        let total = 0;
        let salaryIncome = 0;
        let otherIncome = 0;
        const items: { label: string; amount: number }[] = [];
        overrideTransactions.forEach((tx) => {
          if (tx.type !== 'Income') return;
          const amt = Number.parseFloat(String(tx.amount)) || 0;
          if (amt <= 0) return;
          total += amt;
          const catLower = (tx.category || '').toLowerCase();
          const notesLower = (tx.notes || '').toLowerCase();
          if (tx.payrollId || catLower.includes('salary') || catLower.includes('payroll') || notesLower.includes('salary') || notesLower.includes('payroll')) {
            salaryIncome += amt;
          } else {
            otherIncome += amt;
          }
          items.push({ label: tx.notes || tx.category || 'Income', amount: amt });
        });
        return { items, total, salaryIncome, otherIncome };
      })()
    : getPeriodIncomeForMonth(transactions, year, month, payrolls);

  const periodIncome = incomeData.total;
  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const budgetMap = new Map<string, number>();
  monthBudgets.forEach((b) => {
    const norm = normalizeCategory(b.category);
    budgetMap.set(norm, (budgetMap.get(norm) || 0) + (Number.parseFloat(b.amount) || 0));
  });

  const targetTxs = overrideTransactions
    ? overrideTransactions
    : transactions.filter((tx) => isInMonth(tx, year, month, payrolls));

  const catSpentMap = new Map<string, { spent: number; count: number }>();
  let explicitInvested = 0;
  let explicitSavingsTx = 0;
  let essentialNeedsSpent = 0;
  let familyHouseholdSpent = 0;
  let debtObligationsSpent = 0;

  targetTxs.forEach((tx) => {
    let normCat = normalizeCategory(tx.category || '');
    if (tx.type === 'Transfer' && wallets && tx.destinationWalletId) {
      const dest = wallets.find((w) => w.id === tx.destinationWalletId);
      const destType = dest?.type?.toLowerCase();
      if (destType === 'investment') normCat = '📈 Investments';
      else if (destType === 'savings') normCat = '🛟 Emergency & goals Fund';
      else normCat = '🔄 Transfer';
    }

    if (tx.type === 'Expense') {
      const sourceWallet = wallets?.find((w) => w.id === tx.walletId);
      const sourceType = sourceWallet?.type?.toLowerCase();
      if (normCat === '📈 Investments' && sourceType === 'investment') return;
      if (normCat === '🛟 Emergency & goals Fund' && sourceType === 'savings') return;

      const amt = netExpenseOf(tx);
      if (amt <= 0) return;

      const cur = catSpentMap.get(normCat) || { spent: 0, count: 0 };
      catSpentMap.set(normCat, { spent: cur.spent + amt, count: cur.count + 1 });

      const pillar = getCategoryPillar(normCat);
      if (pillar === 'investments') {
        explicitInvested += amt;
      } else if (pillar === 'savings') {
        explicitSavingsTx += amt;
      } else if (pillar === 'obligations') {
        if (normCat === '🏠 Household & Family') familyHouseholdSpent += amt;
        else if (normCat === '💳 Debt & Obligations' || tx.category === 'Debt Repayment') debtObligationsSpent += amt;
        else essentialNeedsSpent += amt;
      }
    } else if (tx.type === 'Debt Repayment') {
      const amt = Number.parseFloat(String(tx.amount)) || 0;
      if (amt <= 0) return;
      const debtCat = '💳 Debt & Obligations';
      const cur = catSpentMap.get(debtCat) || { spent: 0, count: 0 };
      catSpentMap.set(debtCat, { spent: cur.spent + amt, count: cur.count + 1 });
      debtObligationsSpent += amt;
    } else if (tx.type === 'Transfer') {
      const amt = Number.parseFloat(String(tx.amount)) || 0;
      if (amt <= 0) return;
      if (normCat === '📈 Investments') {
        const cur = catSpentMap.get('📈 Investments') || { spent: 0, count: 0 };
        catSpentMap.set('📈 Investments', { spent: cur.spent + amt, count: cur.count + 1 });
        explicitInvested += amt;
      } else if (normCat === '🛟 Emergency & goals Fund') {
        const cur = catSpentMap.get('🛟 Emergency & goals Fund') || { spent: 0, count: 0 };
        catSpentMap.set('🛟 Emergency & goals Fund', { spent: cur.spent + amt, count: cur.count + 1 });
        explicitSavingsTx += amt;
      }
    }
  });

  const allLivingCats = new Set<string>([
    ...SPENT_ON_MYSELF_CATEGORIES,
    ...SPENT_ON_OBLIGATIONS_CATEGORIES,
  ]);
  catSpentMap.forEach((_v, k) => {
    const p = getCategoryPillar(k);
    if (p === 'myself' || p === 'obligations') allLivingCats.add(k);
  });
  budgetMap.forEach((_v, k) => {
    const p = getCategoryPillar(k);
    if (p === 'myself' || p === 'obligations') allLivingCats.add(k);
  });

  const myselfCategories: PillarCategoryItem[] = [];
  const obligationsCategories: PillarCategoryItem[] = [];
  let spentOnMyself = 0;
  let plannedMyselfBudget = 0;
  let spentOnObligations = 0;
  let plannedObligationsBudget = 0;

  Array.from(allLivingCats).forEach((cat) => {
    const pillar = getCategoryPillar(cat);
    const spentObj = catSpentMap.get(cat) || { spent: 0, count: 0 };
    const budgeted = budgetMap.get(cat) || 0;
    if (pillar === 'myself') {
      spentOnMyself += spentObj.spent;
      plannedMyselfBudget += budgeted;
      if (spentObj.spent > 0 || budgeted > 0) {
        myselfCategories.push({
          category: cat,
          pillar: 'myself',
          spent: spentObj.spent,
          budgeted,
          txCount: spentObj.count,
        });
      }
    } else if (pillar === 'obligations') {
      spentOnObligations += spentObj.spent;
      plannedObligationsBudget += budgeted;
      if (spentObj.spent > 0 || budgeted > 0) {
        obligationsCategories.push({
          category: cat,
          pillar: 'obligations',
          spent: spentObj.spent,
          budgeted,
          txCount: spentObj.count,
        });
      }
    }
  });

  myselfCategories.sort((a, b) => b.spent - a.spent || b.budgeted - a.budgeted);
  obligationsCategories.sort((a, b) => b.spent - a.spent || b.budgeted - a.budgeted);

  const totalLivingSpent = spentOnMyself + spentOnObligations;
  const plannedLivingBudget = plannedMyselfBudget + plannedObligationsBudget;
  const livingBudgetRemaining = plannedLivingBudget - totalLivingSpent;

  const plannedInvestmentBudget = budgetMap.get('📈 Investments') || 0;
  const plannedSavingsBudget = budgetMap.get('🛟 Emergency & goals Fund') || 0;

  // Bank-as-Savings Retention Logic:
  // 1. Live Retained in Bank = Income - Living Spent - Invested - Explicit Savings Tx
  const liveRetainedInBank = Math.max(
    0,
    periodIncome - totalLivingSpent - explicitInvested - explicitSavingsTx
  );

  // 2. Protected Bank Retention (for active month budget allocation):
  // Any income not committed to living budgets (or actual living spend if higher) and investment budgets
  // is automatically retained in the bank as savings without requiring a transaction.
  const committedLiving = isCurrentMonth && plannedLivingBudget > 0
    ? Math.max(totalLivingSpent, plannedLivingBudget)
    : totalLivingSpent;
  const committedInvestments = isCurrentMonth && plannedInvestmentBudget > 0
    ? Math.max(explicitInvested, plannedInvestmentBudget)
    : explicitInvested;

  const protectedBankRetention = Math.max(
    0,
    periodIncome - committedLiving - committedInvestments - explicitSavingsTx
  );

  // Effective saved credited toward '🛟 Emergency & goals Fund' budget card
  const effectiveSavedForBudget = explicitSavingsTx + (isCurrentMonth && plannedLivingBudget > 0 ? protectedBankRetention : liveRetainedInBank);
  const totalActualRetainedAndSaved = explicitSavingsTx + liveRetainedInBank;
  const totalWealthBuilt = totalActualRetainedAndSaved + explicitInvested;

  return {
    periodIncome,
    salaryIncome: incomeData.salaryIncome,
    otherIncome: incomeData.otherIncome,
    incomeItems: incomeData.items,
    spentOnMyself,
    plannedMyselfBudget,
    myselfPctOfIncome: periodIncome > 0 ? (spentOnMyself / periodIncome) * 100 : 0,
    myselfPctOfLivingSpend: totalLivingSpent > 0 ? (spentOnMyself / totalLivingSpent) * 100 : 0,
    myselfCategories,
    spentOnObligations,
    plannedObligationsBudget,
    obligationsPctOfIncome: periodIncome > 0 ? (spentOnObligations / periodIncome) * 100 : 0,
    obligationsPctOfLivingSpend: totalLivingSpent > 0 ? (spentOnObligations / totalLivingSpent) * 100 : 0,
    obligationsCategories,
    essentialNeedsSpent,
    familyHouseholdSpent,
    debtObligationsSpent,
    totalLivingSpent,
    plannedLivingBudget,
    livingBudgetRemaining,
    investedAmount: explicitInvested,
    plannedInvestmentBudget,
    investedPctOfIncome: periodIncome > 0 ? (explicitInvested / periodIncome) * 100 : 0,
    explicitSavingsTx,
    liveRetainedInBank,
    protectedBankRetention,
    effectiveSavedForBudget,
    totalActualRetainedAndSaved,
    plannedSavingsBudget,
    savedPctOfIncome: periodIncome > 0 ? (totalActualRetainedAndSaved / periodIncome) * 100 : 0,
    totalWealthBuilt,
    totalWealthPctOfIncome: periodIncome > 0 ? (totalWealthBuilt / periodIncome) * 100 : 0,
  };
};

export const getBudgetStatus = (budgetAmount: number | undefined, spent: number, category?: string) => {
  if (budgetAmount === undefined || !Number.isFinite(budgetAmount)) return { status: 'not_set' as BudgetStatus, usagePercentage: 0, remaining: 0 };
  const isWealth = category ? isWealthAllocationCategory(category) : false;
  if (budgetAmount <= 0) {
    if (isWealth) {
      return { status: 'normal' as BudgetStatus, usagePercentage: spent > 0 ? 100 : 0, remaining: 0 };
    }
    return { status: spent > 0 ? ('critical' as BudgetStatus) : ('normal' as BudgetStatus), usagePercentage: spent > 0 ? 100 : 0, remaining: budgetAmount - spent };
  }
  const usagePercentage = (spent / budgetAmount) * 100;
  if (isWealth) {
    // For Savings ('🛟 Emergency & goals Fund') & Investments ('📈 Investments'),
    // meeting or exceeding the target is POSITIVE ('normal'), whereas falling short is 'warning'.
    const status: BudgetStatus =
      usagePercentage >= 75
        ? 'normal'
        : usagePercentage >= 35
        ? 'warning'
        : 'over_budget';
    return { status, usagePercentage, remaining: budgetAmount - spent };
  }
  const status = usagePercentage >= BUDGET_STATUS_THRESHOLDS.critical ? 'critical' as BudgetStatus : usagePercentage >= BUDGET_STATUS_THRESHOLDS.overBudget ? 'over_budget' as BudgetStatus : usagePercentage >= BUDGET_STATUS_THRESHOLDS.warning ? 'warning' as BudgetStatus : 'normal' as BudgetStatus;
  return { status, usagePercentage, remaining: budgetAmount - spent };
};

export const getSpendingChange = (transactions: Transaction[], year: number, month: number, category: string | undefined, payrolls: PayrollLike[]) => {
  const previous = getPreviousFinancialMonth(payrolls, { year, month });
  const total = (ref: FinancialMonthRef | null) => ref ? getExpensesForMonth(transactions, ref.year, ref.month, payrolls).filter((transaction) => !category || normalizeCategory(transaction.category) === normalizeCategory(category)).reduce((sum, transaction) => sum + netExpenseOf(transaction), 0) : 0;
  const current = total({ year, month });
  const previousAmount = total(previous);
  const difference = current - previousAmount;
  return { current, previous: previousAmount, difference, percentage: previousAmount > 0 ? (difference / previousAmount) * 100 : null };
};

export const getSpendingPace = (actual: number, monthlyBudget: number, year: number, month: number, payrolls: PayrollLike[], now = new Date()) => {
  const bounds = getFinancialMonthBounds(payrolls, year, month);
  if (!bounds) return { ideal: 0, actual, difference: actual, elapsedDays: 0, daysInMonth: 0 };
  const totalDays = Math.round((bounds.end.getTime() - bounds.start.getTime()) / 86_400_000) + 1;
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - bounds.start.getTime()) / 86_400_000) + 1));
  const ideal = monthlyBudget * elapsedDays / totalDays;
  return { ideal, actual, difference: actual - ideal, elapsedDays, daysInMonth: totalDays };
};

export const getLargestExpenses = (transactions: Transaction[], year: number, month: number, payrolls: PayrollLike[], count = 5) => getExpensesForMonth(transactions, year, month, payrolls).slice().sort((a, b) => netExpenseOf(b) - netExpenseOf(a)).slice(0, count);

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const filterTransactions = (transactions: Transaction[], filters: TransactionFilters, now = new Date()) => {
  const query = filters.query?.trim().toLowerCase();
  const today = dateKey(now);
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonth = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
  const matchesDate = (transaction: Transaction) => {
    const key = dateKey(transactionDate(transaction));
    switch (filters.datePreset) {
      case 'today': return key === today;
      case 'week': return key >= dateKey(weekStart) && key <= today;
      case 'month': return key.slice(0, 7) === currentMonth;
      case 'last-month': return key.slice(0, 7) === previousMonth;
      case 'custom': return (!filters.startDate || key >= filters.startDate) && (!filters.endDate || key <= filters.endDate);
      default: return true;
    }
  };
  return transactions.filter((transaction) => {
    const haystack = [transaction.category, transaction.notes, transaction.linkedContactName].filter(Boolean).join(' ').toLowerCase();
    const amount = amountOf(transaction);
    return (!query || haystack.includes(query)) && matchesDate(transaction) && (!filters.types?.length || filters.types.includes(transaction.type)) && (!filters.categories?.length || filters.categories.map(normalizeCategory).includes(normalizeCategory(transaction.category))) && (!filters.wallets?.length || filters.wallets.includes(transaction.walletId)) && (filters.minAmount === undefined || amount >= filters.minAmount) && (filters.maxAmount === undefined || amount <= filters.maxAmount) && (filters.reimbursable === undefined || filters.reimbursable === 'all' || (filters.reimbursable === 'reimbursable') === Boolean(transaction.reimbursableAmount && amountOf({ amount: transaction.reimbursableAmount }) > 0)) && (filters.debtRelationship === undefined || filters.debtRelationship === 'all' || (filters.debtRelationship === 'debt-linked') === Boolean(transaction.linkedContactId));
  }).sort((a, b) => filters.sort === 'oldest' ? transactionDate(a).getTime() - transactionDate(b).getTime() : filters.sort === 'highest' ? amountOf(b) - amountOf(a) : filters.sort === 'lowest' ? amountOf(a) - amountOf(b) : transactionDate(b).getTime() - transactionDate(a).getTime());
};

export const getWhatIfAllowance = (kpis: KPI, purchaseAmount: number) => {
  const amount = Math.max(0, purchaseAmount || 0);
  const liquidityAfterPurchase = kpis.totalLiquidity - amount;
  const availableAfterPurchase = liquidityAfterPurchase - kpis.emergencyBuffer;
  const recalculatedDailyAllowance = availableAfterPurchase / Math.max(1, kpis.daysUntilPayday);
  const todaySpentAfterPurchase = kpis.dailySpent + amount;
  return { liquidityAfterPurchase, recalculatedDailyAllowance, todaySpentAfterPurchase, dailyRemainingAfterPurchase: recalculatedDailyAllowance - todaySpentAfterPurchase };
};

export const budgetFor = (budgets: CategoryBudget[], category: string, year: number, month: number) => budgets.find((budget) => budget.year === year && budget.month === month && normalizeCategory(budget.category) === normalizeCategory(category));
