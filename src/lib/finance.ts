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
 * Returns the total reimbursed / reimbursable split portion linked to an Expense transaction.
 * Checks both `transaction.reimbursableAmount` and `transaction.splits` (Receivable splits)
 * so linked reimbursements are never counted as spent on a category.
 */
export const reimbursedAmountOf = (
  transaction: Pick<Transaction, 'amount' | 'type'> &
    Partial<Pick<Transaction, 'reimbursableAmount' | 'linkedDebtType' | 'category' | 'splits'>>,
): number => {
  if (transaction.type !== 'Expense') return 0;
  // Payable debt repayments or bill settlements are out-of-pocket obligations, never reimbursable
  if (transaction.linkedDebtType === 'Payable' || transaction.category === 'Debt Repayment') {
    return 0;
  }
  const gross = Number.parseFloat(String(transaction.amount)) || 0;
  if (gross <= 0) return 0;

  const directReimb = transaction.reimbursableAmount
    ? Number.parseFloat(String(transaction.reimbursableAmount)) || 0
    : 0;

  let splitsReimb = 0;
  if (Array.isArray(transaction.splits) && transaction.splits.length > 0) {
    splitsReimb = transaction.splits
      .filter((s) => s.linkedDebtType === 'Receivable' || !s.linkedDebtType)
      .reduce((sum, s) => sum + (Number.parseFloat(String(s.reimbursableAmount || '0')) || 0), 0);
  }

  const effectiveReimb = Math.max(directReimb, splitsReimb);
  return Math.min(gross, Math.max(0, effectiveReimb));
};

/**
 * Returns the effective net expense of a transaction after subtracting any linked reimbursements.
 * For example: 1,500 MAD dining expense with 300 MAD reimbursed returns 1,200 MAD net expense.
 */
export const netExpenseOf = (
  transaction: Pick<Transaction, 'amount' | 'type'> &
    Partial<Pick<Transaction, 'reimbursableAmount' | 'linkedDebtType' | 'category' | 'splits'>>,
) => {
  const gross = Number.parseFloat(String(transaction.amount)) || 0;
  if (transaction.type !== 'Expense') return gross;
  return Math.max(0, gross - reimbursedAmountOf(transaction));
};

/**
 * Identifies whether an Income transaction is a pass-through reimbursement, friend split settlement,
 * or loan/debt repayment received — which must NEVER be counted as real earned income.
 */
export const isReimbursementIncome = (
  transaction: Pick<Transaction, 'type'> &
    Partial<Pick<Transaction, 'category' | 'notes' | 'linkedDebtType' | 'splits' | 'reimbursableAmount' | 'payrollId'>>,
): boolean => {
  if (transaction.type !== 'Income') return false;
  if (transaction.payrollId) return false;

  const rawCat = (transaction.category || '').trim();
  const normCat = normalizeCategory(rawCat);
  const catLower = rawCat.toLowerCase();
  const notesLower = (transaction.notes || '').toLowerCase();

  if (normCat === '🔙 Reimbursement' || rawCat === 'Reimbursement' || rawCat === '🔙 Reimbursement') {
    return true;
  }
  if (transaction.linkedDebtType === 'Receivable') {
    return true;
  }
  if (
    Array.isArray(transaction.splits) &&
    transaction.splits.some(
      (s) =>
        s.linkedDebtType === 'Receivable' ||
        (Number.parseFloat(String(s.reimbursableAmount || '0')) > 0 && s.linkedDebtType !== 'Payable'),
    )
  ) {
    return true;
  }
  if (
    transaction.reimbursableAmount &&
    Number.parseFloat(String(transaction.reimbursableAmount)) > 0 &&
    transaction.linkedDebtType !== 'Payable'
  ) {
    return true;
  }
  if (
    catLower.includes('reimburs') ||
    notesLower.includes('reimburs') ||
    notesLower.includes('settlement for ') ||
    notesLower.includes('repayment received') ||
    notesLower.includes('loan repayment received') ||
    normCat === '💳 Debt & Obligations' ||
    normCat === '🤝 Loan Received'
  ) {
    return true;
  }
  return false;
};

/**
 * Returns the true net earned income of a transaction (0 if it is a reimbursement or pass-through settlement).
 */
export const netIncomeOf = (
  transaction: Pick<Transaction, 'amount' | 'type'> &
    Partial<Pick<Transaction, 'category' | 'notes' | 'linkedDebtType' | 'splits' | 'reimbursableAmount' | 'payrollId'>>,
): number => {
  if (transaction.type !== 'Income') return 0;
  if (isReimbursementIncome(transaction)) return 0;
  return Math.max(0, Number.parseFloat(String(transaction.amount)) || 0);
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
 * Calculates total NET income for a financial month (respecting custom payroll cycle boundaries,
 * e.g. 24th of previous calendar month to 23rd of current month), strictly excluding reimbursements
 * and friend split repayments, with fallback to configured payroll.
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
  let reimbursedIncomeExcluded = 0;

  transactions.forEach((tx) => {
    if (tx.type !== 'Income') return;
    if (!isInMonth(tx, year, month, payrolls)) return;
    const amt = Number.parseFloat(String(tx.amount)) || 0;
    if (amt <= 0) return;

    // Never count friend reimbursements or debt settlements as income
    if (isReimbursementIncome(tx)) {
      reimbursedIncomeExcluded += amt;
      return;
    }

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
    reimbursedIncomeExcluded,
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
  reimbursedIncomeExcluded: number;
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
        let reimbursedIncomeExcluded = 0;
        const items: { label: string; amount: number }[] = [];
        overrideTransactions.forEach((tx) => {
          if (tx.type !== 'Income') return;
          const amt = Number.parseFloat(String(tx.amount)) || 0;
          if (amt <= 0) return;
          if (isReimbursementIncome(tx)) {
            reimbursedIncomeExcluded += amt;
            return;
          }
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
        return { items, total, salaryIncome, otherIncome, reimbursedIncomeExcluded };
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
    reimbursedIncomeExcluded: incomeData.reimbursedIncomeExcluded || 0,
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

// ─── Chronological Financial-Period Pattern Analyzer (Oldest -> Current) ─────

export interface PeriodCategoryHistoryEntry {
  periodIndex: number;
  year: number;
  month: number;
  periodLabel: string;
  monthName: string;
  isCurrentPeriod: boolean;
  grossSpentMad: number;
  reimbursedMad: number;
  netSpentMad: number;
  txCount: number;
}

export interface CategoryPatternProfile {
  category: string;
  pillar: FinancialPillar;
  activePeriodsCount: number;
  totalPeriodsAnalyzed: number;
  consistencyRatio: number; // 0..1
  patternType: 'Core Fixed / Habit' | 'Regular Variable' | 'Occasional / Episodic' | 'Wealth Target';
  historicalMedianNetMad: number;
  recencyWeightedAvgNetMad: number;
  historicalAvgNetMad: number;
  minNetMad: number;
  maxNetMad: number;
  totalReimbursedDeductedMad: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  periodHistory: PeriodCategoryHistoryEntry[];
  suggestedPatternBudgetMad: number;
  suggestedPctOfIncome: number;
  patternReasoning: string;
}

export interface ChronologicalPeriodSummary {
  periodIndex: number;
  year: number;
  month: number;
  periodLabel: string;
  monthName: string;
  startDate: string;
  endDate: string;
  isCurrentPeriod: boolean;
  elapsedRatio: number; // 0..1
  netIncomeMad: number;
  reimbursedInflowExcludedMad: number;
  grossExpensesMad: number;
  reimbursedExpensesDeductedMad: number;
  netLivingSpentMad: number;
  spentOnObligationsMad: number;
  spentOnMyselfMad: number;
  investedMad: number;
  retainedInBankMad: number;
  categoryNetSpend: Record<string, { gross: number; reimbursed: number; net: number; count: number }>;
}

export interface ChronologicalPatternAnalysis {
  targetYear: number;
  targetMonth: number;
  targetIncomeBaselineMad: number;
  periodsOldestToCurrent: ChronologicalPeriodSummary[];
  categoryProfiles: CategoryPatternProfile[];
  totalReimbursementsStrippedMad: number;
  recommendedBudgets: {
    category: string;
    pillar: FinancialPillar;
    amount: number;
    pctOfIncome: number;
    historicalAvgNetMad: number;
    reasoning: string;
  }[];
  pillarSummary: {
    obligationsMad: number;
    obligationsPct: number;
    myselfMad: number;
    myselfPct: number;
    investmentsMad: number;
    investmentsPct: number;
    bankRetentionSavingsMad: number;
    bankRetentionSavingsPct: number;
  };
}

/**
 * Groups all historical transactions by financial periods from the OLDEST period to the CURRENT period,
 * strictly deducting linked reimbursements from expenses and excluding reimbursement inflows from income,
 * and synthesizes a personalized TrueSpend Pattern Budget Plan.
 */
export const buildChronologicalPeriodPatternSummary = ({
  transactions,
  payrolls,
  targetYear,
  targetMonth,
  targetIncomeMad,
  subscriptions = [],
  debts = [],
  wallets = [],
  now = new Date(),
}: {
  transactions: Transaction[];
  payrolls: PayrollLike[];
  targetYear: number;
  targetMonth: number;
  targetIncomeMad?: number;
  subscriptions?: Array<{ name: string; amount: string | number; billingCycle?: string; category?: string; status?: string }>;
  debts?: Array<{ type: string; status: string; remainingBalance: string | number; dueDate?: string | null; contactName?: string }>;
  wallets?: Array<{ id: string; type?: string }>;
  now?: Date;
}): ChronologicalPatternAnalysis => {
  const allPeriods = getFinancialPeriods(payrolls);
  // Filter to periods that have started on or before `now` (or up to targetYear/targetMonth), sorted OLDEST -> CURRENT
  const nonFuturePeriods = allPeriods
    .filter((p) => p.start.getTime() <= now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Fallback if no payroll periods are configured: group by calendar months present in transactions (oldest -> current)
  const effectivePeriods =
    nonFuturePeriods.length > 0
      ? nonFuturePeriods
      : (() => {
          const monthKeys = new Set<string>();
          transactions.forEach((tx) => {
            const d = new Date(tx.createdAt);
            if (!Number.isNaN(d.getTime()) && d.getTime() <= now.getTime()) {
              monthKeys.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
            }
          });
          return Array.from(monthKeys)
            .sort()
            .map((key) => {
              const [y, m] = key.split('-').map(Number);
              const start = new Date(Date.UTC(y, m - 1, 1));
              const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
              return {
                year: y,
                month: m,
                start,
                end,
                startPayroll: { id: key, scheduledFor: start, amount: 0 },
                endPayroll: { id: `${key}-end`, scheduledFor: end, amount: 0 },
              };
            });
        })();

  let totalReimbursementsStrippedMad = 0;

  const periodsOldestToCurrent: ChronologicalPeriodSummary[] = effectivePeriods.map((p, idx) => {
    const isCurrentPeriod = now >= p.start && now <= p.end;
    const totalDays = Math.max(1, Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000) + 1);
    const elapsedDays = isCurrentPeriod
      ? Math.max(1, Math.min(totalDays, Math.round((now.getTime() - p.start.getTime()) / 86_400_000) + 1))
      : totalDays;
    const elapsedRatio = isCurrentPeriod ? Math.min(1, Math.max(0.2, elapsedDays / totalDays)) : 1;

    const periodTxs = transactions.filter((tx) => {
      const d = new Date(tx.createdAt);
      return d >= p.start && d <= p.end;
    });

    let netIncomeMad = 0;
    let reimbursedInflowExcludedMad = 0;
    let grossExpensesMad = 0;
    let reimbursedExpensesDeductedMad = 0;
    let netLivingSpentMad = 0;
    let spentOnObligationsMad = 0;
    let spentOnMyselfMad = 0;
    let investedMad = 0;
    let explicitSavingsMad = 0;

    const categoryNetSpend: Record<string, { gross: number; reimbursed: number; net: number; count: number }> = {};

    periodTxs.forEach((tx) => {
      const grossAmt = Number.parseFloat(String(tx.amount)) || 0;
      if (grossAmt <= 0) return;

      if (tx.type === 'Income') {
        if (isReimbursementIncome(tx)) {
          reimbursedInflowExcludedMad += grossAmt;
          totalReimbursementsStrippedMad += grossAmt;
        } else {
          netIncomeMad += grossAmt;
        }
        return;
      }

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

        const reimb = reimbursedAmountOf(tx);
        const netAmt = netExpenseOf(tx);
        grossExpensesMad += grossAmt;
        reimbursedExpensesDeductedMad += reimb;
        totalReimbursementsStrippedMad += reimb;

        if (!categoryNetSpend[normCat]) {
          categoryNetSpend[normCat] = { gross: 0, reimbursed: 0, net: 0, count: 0 };
        }
        categoryNetSpend[normCat].gross += grossAmt;
        categoryNetSpend[normCat].reimbursed += reimb;
        categoryNetSpend[normCat].net += netAmt;
        categoryNetSpend[normCat].count += 1;

        const pillar = getCategoryPillar(normCat);
        if (pillar === 'investments') {
          investedMad += netAmt;
        } else if (pillar === 'savings') {
          explicitSavingsMad += netAmt;
        } else if (pillar === 'myself') {
          spentOnMyselfMad += netAmt;
          netLivingSpentMad += netAmt;
        } else {
          spentOnObligationsMad += netAmt;
          netLivingSpentMad += netAmt;
        }
      } else if (tx.type === 'Debt Repayment') {
        const debtCat = '💳 Debt & Obligations';
        grossExpensesMad += grossAmt;
        if (!categoryNetSpend[debtCat]) {
          categoryNetSpend[debtCat] = { gross: 0, reimbursed: 0, net: 0, count: 0 };
        }
        categoryNetSpend[debtCat].gross += grossAmt;
        categoryNetSpend[debtCat].net += grossAmt;
        categoryNetSpend[debtCat].count += 1;
        spentOnObligationsMad += grossAmt;
        netLivingSpentMad += grossAmt;
      } else if (tx.type === 'Transfer') {
        if (normCat === '📈 Investments') {
          if (!categoryNetSpend['📈 Investments']) {
            categoryNetSpend['📈 Investments'] = { gross: 0, reimbursed: 0, net: 0, count: 0 };
          }
          categoryNetSpend['📈 Investments'].gross += grossAmt;
          categoryNetSpend['📈 Investments'].net += grossAmt;
          categoryNetSpend['📈 Investments'].count += 1;
          investedMad += grossAmt;
        } else if (normCat === '🛟 Emergency & goals Fund') {
          if (!categoryNetSpend['🛟 Emergency & goals Fund']) {
            categoryNetSpend['🛟 Emergency & goals Fund'] = { gross: 0, reimbursed: 0, net: 0, count: 0 };
          }
          categoryNetSpend['🛟 Emergency & goals Fund'].gross += grossAmt;
          categoryNetSpend['🛟 Emergency & goals Fund'].net += grossAmt;
          categoryNetSpend['🛟 Emergency & goals Fund'].count += 1;
          explicitSavingsMad += grossAmt;
        }
      }
    });

    const configuredPayrollAmt = Number.parseFloat(String(p.startPayroll?.amount || 0)) || 0;
    if (netIncomeMad === 0 && configuredPayrollAmt > 0) {
      netIncomeMad = configuredPayrollAmt;
    }

    const retainedInBankMad = Math.max(0, netIncomeMad - netLivingSpentMad - investedMad);

    const fmtDate = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      periodIndex: idx + 1,
      year: p.year,
      month: p.month,
      periodLabel: `${fmtDate(p.start)} – ${fmtDate(p.end)}`,
      monthName: monthLabel(p.year, p.month),
      startDate: p.start.toISOString().slice(0, 10),
      endDate: p.end.toISOString().slice(0, 10),
      isCurrentPeriod,
      elapsedRatio,
      netIncomeMad: Math.round(netIncomeMad * 100) / 100,
      reimbursedInflowExcludedMad: Math.round(reimbursedInflowExcludedMad * 100) / 100,
      grossExpensesMad: Math.round(grossExpensesMad * 100) / 100,
      reimbursedExpensesDeductedMad: Math.round(reimbursedExpensesDeductedMad * 100) / 100,
      netLivingSpentMad: Math.round(netLivingSpentMad * 100) / 100,
      spentOnObligationsMad: Math.round(spentOnObligationsMad * 100) / 100,
      spentOnMyselfMad: Math.round(spentOnMyselfMad * 100) / 100,
      investedMad: Math.round(investedMad * 100) / 100,
      retainedInBankMad: Math.round(retainedInBankMad * 100) / 100,
      categoryNetSpend,
    };
  });

  // Determine target income baseline
  const targetMonthIncomeObj = getPeriodIncomeForMonth(transactions, targetYear, targetMonth, payrolls);
  const historicalAvgIncome =
    periodsOldestToCurrent.length > 0
      ? periodsOldestToCurrent.reduce((s, p) => s + p.netIncomeMad, 0) / periodsOldestToCurrent.length
      : 0;
  const effectiveTargetIncome =
    targetIncomeMad && targetIncomeMad > 0
      ? targetIncomeMad
      : targetMonthIncomeObj.total > 0
      ? targetMonthIncomeObj.total
      : historicalAvgIncome > 0
      ? historicalAvgIncome
      : 6000;

  // Compute monthly subscription floors per category
  const subscriptionFloorByCategory = new Map<string, number>();
  subscriptions
    .filter((s) => !s.status || s.status === 'active' || s.status === 'planned')
    .forEach((sub) => {
      const amt = Number.parseFloat(String(sub.amount)) || 0;
      if (amt <= 0) return;
      const cycle = (sub.billingCycle || 'monthly').toLowerCase();
      let monthlyEquiv = amt;
      if (cycle === 'yearly' || cycle === 'annual') monthlyEquiv = amt / 12;
      else if (cycle === 'quarterly' || cycle === 'every_3_months') monthlyEquiv = amt / 3;
      else if (cycle === 'every_6_months') monthlyEquiv = amt / 6;
      else if (cycle === 'every_2_months') monthlyEquiv = amt / 2;
      else if (cycle === 'weekly') monthlyEquiv = amt * 4.33;
      else if (cycle === 'biweekly') monthlyEquiv = amt * 2.165;

      const normCat = normalizeCategory(sub.category || '📱 Telecom & Subscriptions');
      subscriptionFloorByCategory.set(normCat, (subscriptionFloorByCategory.get(normCat) || 0) + monthlyEquiv);
    });

  // Compute active Payable debt obligation floor
  const pendingPayableDebts = debts.filter((d) => d.type === 'Payable' && d.status === 'Pending');
  const totalPayableRemaining = pendingPayableDebts.reduce(
    (s, d) => s + (Number.parseFloat(String(d.remainingBalance)) || 0),
    0,
  );
  const dueInTargetMonthDebt = pendingPayableDebts
    .filter((d) => {
      if (!d.dueDate) return false;
      const dt = new Date(d.dueDate);
      return dt.getUTCFullYear() === targetYear && dt.getUTCMonth() + 1 === targetMonth;
    })
    .reduce((s, d) => s + (Number.parseFloat(String(d.remainingBalance)) || 0), 0);

  const canonicalCategories = [
    ...SPENT_ON_OBLIGATIONS_CATEGORIES,
    ...SPENT_ON_MYSELF_CATEGORIES,
    '📈 Investments',
    '🛟 Emergency & goals Fund',
  ];

  // Build profile for each canonical category from oldest period to current period
  const categoryProfiles: CategoryPatternProfile[] = canonicalCategories.map((category) => {
    const pillar = getCategoryPillar(category);
    const periodHistory: PeriodCategoryHistoryEntry[] = periodsOldestToCurrent.map((p) => {
      const entry = p.categoryNetSpend[category] || { gross: 0, reimbursed: 0, net: 0, count: 0 };
      return {
        periodIndex: p.periodIndex,
        year: p.year,
        month: p.month,
        periodLabel: p.periodLabel,
        monthName: p.monthName,
        isCurrentPeriod: p.isCurrentPeriod,
        grossSpentMad: Math.round(entry.gross * 100) / 100,
        reimbursedMad: Math.round(entry.reimbursed * 100) / 100,
        netSpentMad: Math.round(entry.net * 100) / 100,
        txCount: entry.count,
      };
    });

    // Normalize partial current period only if it has spending and is < 85% elapsed, capped conservatively
    const normalizedSeries = periodHistory.map((h, i) => {
      const p = periodsOldestToCurrent[i];
      if (h.isCurrentPeriod && p.elapsedRatio < 0.85 && h.netSpentMad > 0) {
        // Blend actual so far with gentle run-rate projection so a day-1 spike doesn't explode
        return Math.min(h.netSpentMad * 1.5, h.netSpentMad / Math.max(0.4, p.elapsedRatio));
      }
      return h.netSpentMad;
    });

    const activeValues = normalizedSeries.filter((v) => v > 0);
    const activePeriodsCount = periodHistory.filter((h) => h.netSpentMad > 0).length;
    const totalPeriodsAnalyzed = Math.max(1, periodsOldestToCurrent.length);
    const consistencyRatio = activePeriodsCount / totalPeriodsAnalyzed;

    // Median across active periods (or 0 if never used)
    const sortedVals = [...(activeValues.length > 0 ? activeValues : [0])].sort((a, b) => a - b);
    const mid = Math.floor(sortedVals.length / 2);
    const historicalMedianNetMad =
      sortedVals.length % 2 !== 0 ? sortedVals[mid] : (sortedVals[mid - 1] + sortedVals[mid]) / 2;

    // Recency-weighted average (Oldest -> Current: weights 1, 2, 3, ..., N)
    let weightedSum = 0;
    let weightTotal = 0;
    normalizedSeries.forEach((val, idx) => {
      const weight = idx + 1; // older periods have smaller weight, newer periods have higher weight
      weightedSum += val * weight;
      weightTotal += weight;
    });
    const recencyWeightedAvgNetMad = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const historicalAvgNetMad =
      normalizedSeries.length > 0
        ? normalizedSeries.reduce((s, v) => s + v, 0) / normalizedSeries.length
        : 0;

    const minNetMad = activeValues.length > 0 ? Math.min(...activeValues) : 0;
    const maxNetMad = activeValues.length > 0 ? Math.max(...activeValues) : 0;
    const totalReimbursedDeductedMad = periodHistory.reduce((s, h) => s + h.reimbursedMad, 0);

    // Trend detection (first half vs second half of periods)
    let trendDirection: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (normalizedSeries.length >= 2) {
      const half = Math.floor(normalizedSeries.length / 2);
      const olderAvg = normalizedSeries.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(1, half);
      const newerAvg =
        normalizedSeries.slice(half).reduce((s, v) => s + v, 0) /
        Math.max(1, normalizedSeries.length - half);
      if (olderAvg > 0) {
        const changeRatio = (newerAvg - olderAvg) / olderAvg;
        if (changeRatio > 0.15) trendDirection = 'increasing';
        else if (changeRatio < -0.15) trendDirection = 'decreasing';
      } else if (newerAvg > 50) {
        trendDirection = 'increasing';
      }
    }

    const patternType: CategoryPatternProfile['patternType'] =
      pillar === 'savings' || pillar === 'investments'
        ? 'Wealth Target'
        : consistencyRatio >= 0.75
        ? 'Core Fixed / Habit'
        : consistencyRatio >= 0.4
        ? 'Regular Variable'
        : 'Occasional / Episodic';

    // Compute initial pattern-driven budget before global income reconciliation
    let rawRecommended = 0;
    let reasoning = '';

    if (category === '💳 Debt & Obligations') {
      if (dueInTargetMonthDebt > 0) {
        rawRecommended = Math.round(dueInTargetMonthDebt);
        reasoning = `Sized to cover ${dueInTargetMonthDebt.toFixed(0)} MAD in Payable debts due this cycle.`;
      } else if (totalPayableRemaining > 0) {
        rawRecommended = Math.round(Math.min(totalPayableRemaining, Math.max(200, recencyWeightedAvgNetMad || totalPayableRemaining * 0.25)));
        reasoning = `Active payable debt balance of ${totalPayableRemaining.toFixed(0)} MAD; allocates ${rawRecommended} MAD toward debt payoff.`;
      } else {
        rawRecommended = 0;
        reasoning = `All historical debt obligations are cleared (0 MAD active payable debt).`;
      }
    } else if (pillar === 'obligations') {
      const subFloor = subscriptionFloorByCategory.get(category) || 0;
      const basePattern =
        consistencyRatio >= 0.6
          ? Math.max(historicalMedianNetMad, recencyWeightedAvgNetMad)
          : recencyWeightedAvgNetMad * 0.85;
      rawRecommended = Math.round(Math.max(subFloor, basePattern));
      if (subFloor > 0 && rawRecommended === Math.round(subFloor)) {
        reasoning = `Anchored to active recurring subscriptions (${subFloor.toFixed(0)} MAD/mo floor) across ${activePeriodsCount}/${totalPeriodsAnalyzed} periods.`;
      } else if (rawRecommended > 0) {
        reasoning = `Based on ${activePeriodsCount}/${totalPeriodsAnalyzed} financial periods (Net median ${historicalMedianNetMad.toFixed(0)} MAD, recency-weighted ${recencyWeightedAvgNetMad.toFixed(0)} MAD${totalReimbursedDeductedMad > 0 ? `, after stripping ${totalReimbursedDeductedMad.toFixed(0)} MAD in reimbursements` : ''}).`;
      } else {
        reasoning = `No historical obligation spend recorded in this category across ${totalPeriodsAnalyzed} periods.`;
      }
    } else if (pillar === 'myself') {
      // Lifestyle optimization: blend median and recency-weighted average, gently trimming by 8% if trending up
      const baseMyself = (historicalMedianNetMad * 0.55 + recencyWeightedAvgNetMad * 0.45);
      const trimFactor = trendDirection === 'increasing' ? 0.92 : 1.0;
      rawRecommended = Math.round(baseMyself * trimFactor);
      if (rawRecommended > 0) {
        reasoning = `Personal lifestyle net pattern across ${activePeriodsCount}/${totalPeriodsAnalyzed} periods (${recencyWeightedAvgNetMad.toFixed(0)} MAD recency avg${totalReimbursedDeductedMad > 0 ? `, excluding ${totalReimbursedDeductedMad.toFixed(0)} MAD reimbursed by friends` : ''}${trendDirection === 'increasing' ? '; gently trimmed 8% to curb upward drift' : ''}).`;
      } else {
        reasoning = `Minimal or zero net personal spend across previous financial periods.`;
      }
    } else if (category === '📈 Investments') {
      const histInv = Math.max(historicalMedianNetMad, recencyWeightedAvgNetMad);
      rawRecommended = histInv > 0 ? Math.round(histInv) : Math.round(effectiveTargetIncome * 0.08);
      reasoning = histInv > 0
        ? `Matches your historical investment funding cadence (${histInv.toFixed(0)} MAD/period avg).`
        : `Suggested 8% wealth-building allocation (${rawRecommended} MAD) for brokerage & stock positions.`;
    } else if (category === '🛟 Emergency & goals Fund') {
      // Will be set to exact Bank-as-Savings retained remainder below!
      rawRecommended = 0;
      reasoning = `Bank-as-Savings retention target: automatically retains all unspent salary in your main bank account.`;
    }

    // Round to nearest 10 MAD for clean budgeting if > 50
    if (rawRecommended >= 50) {
      rawRecommended = Math.round(rawRecommended / 10) * 10;
    }

    return {
      category,
      pillar,
      activePeriodsCount,
      totalPeriodsAnalyzed,
      consistencyRatio,
      patternType,
      historicalMedianNetMad: Math.round(historicalMedianNetMad * 100) / 100,
      recencyWeightedAvgNetMad: Math.round(recencyWeightedAvgNetMad * 100) / 100,
      historicalAvgNetMad: Math.round(historicalAvgNetMad * 100) / 100,
      minNetMad: Math.round(minNetMad * 100) / 100,
      maxNetMad: Math.round(maxNetMad * 100) / 100,
      totalReimbursedDeductedMad: Math.round(totalReimbursedDeductedMad * 100) / 100,
      trendDirection,
      periodHistory,
      suggestedPatternBudgetMad: rawRecommended,
      suggestedPctOfIncome: effectiveTargetIncome > 0 ? (rawRecommended / effectiveTargetIncome) * 100 : 0,
      patternReasoning: reasoning,
    };
  });

  // Reconcile living + investment allocations against effectiveTargetIncome and compute Bank-as-Savings retention
  const nonSavingsProfiles = categoryProfiles.filter((p) => p.category !== '🛟 Emergency & goals Fund');
  const rawNonSavingsTotal = nonSavingsProfiles.reduce((s, p) => s + p.suggestedPatternBudgetMad, 0);

  // Ensure at least 10% of income is retained in bank as savings if raw historical pattern exceeded 90% of income
  const maxSpendAndInvestCap = Math.round(effectiveTargetIncome * 0.88);
  if (rawNonSavingsTotal > maxSpendAndInvestCap && rawNonSavingsTotal > 0) {
    // Scale down 'myself' categories first, then variable obligations if needed
    const myselfTotal = nonSavingsProfiles
      .filter((p) => p.pillar === 'myself')
      .reduce((s, p) => s + p.suggestedPatternBudgetMad, 0);
    const excess = rawNonSavingsTotal - maxSpendAndInvestCap;
    if (myselfTotal > 0 && excess <= myselfTotal * 0.4) {
      const scale = Math.max(0.6, (myselfTotal - excess) / myselfTotal);
      nonSavingsProfiles.forEach((p) => {
        if (p.pillar === 'myself') {
          p.suggestedPatternBudgetMad = Math.round((p.suggestedPatternBudgetMad * scale) / 10) * 10;
        }
      });
    } else {
      const globalScale = maxSpendAndInvestCap / rawNonSavingsTotal;
      nonSavingsProfiles.forEach((p) => {
        p.suggestedPatternBudgetMad = Math.round((p.suggestedPatternBudgetMad * globalScale) / 10) * 10;
      });
    }
  }

  const finalNonSavingsTotal = nonSavingsProfiles.reduce((s, p) => s + p.suggestedPatternBudgetMad, 0);
  const bankRetentionAmount = Math.max(0, Math.round(effectiveTargetIncome - finalNonSavingsTotal));

  const savingsProfile = categoryProfiles.find((p) => p.category === '🛟 Emergency & goals Fund');
  if (savingsProfile) {
    savingsProfile.suggestedPatternBudgetMad = bankRetentionAmount;
    savingsProfile.suggestedPctOfIncome =
      effectiveTargetIncome > 0 ? (bankRetentionAmount / effectiveTargetIncome) * 100 : 0;
    savingsProfile.patternReasoning = `Bank-as-Savings Zero-Transaction Retention: after allocating ${finalNonSavingsTotal.toFixed(0)} MAD across Obligations, Yourself & Investments, ${bankRetentionAmount.toFixed(0)} MAD (${savingsProfile.suggestedPctOfIncome.toFixed(1)}% of net income) remains protected in your bank.`;
  }

  categoryProfiles.forEach((p) => {
    p.suggestedPctOfIncome =
      effectiveTargetIncome > 0
        ? Math.round(((p.suggestedPatternBudgetMad / effectiveTargetIncome) * 100) * 10) / 10
        : 0;
  });

  const recommendedBudgets = categoryProfiles
    .filter((p) => p.suggestedPatternBudgetMad > 0)
    .map((p) => ({
      category: p.category,
      pillar: p.pillar,
      amount: p.suggestedPatternBudgetMad,
      pctOfIncome: p.suggestedPctOfIncome,
      historicalAvgNetMad: p.recencyWeightedAvgNetMad,
      reasoning: p.patternReasoning,
    }));

  const obligationsMad = recommendedBudgets
    .filter((b) => b.pillar === 'obligations')
    .reduce((s, b) => s + b.amount, 0);
  const myselfMad = recommendedBudgets
    .filter((b) => b.pillar === 'myself')
    .reduce((s, b) => s + b.amount, 0);
  const investmentsMad = recommendedBudgets
    .filter((b) => b.pillar === 'investments')
    .reduce((s, b) => s + b.amount, 0);
  const bankRetentionSavingsMad = recommendedBudgets
    .filter((b) => b.pillar === 'savings')
    .reduce((s, b) => s + b.amount, 0);

  return {
    targetYear,
    targetMonth,
    targetIncomeBaselineMad: effectiveTargetIncome,
    periodsOldestToCurrent,
    categoryProfiles,
    totalReimbursementsStrippedMad: Math.round(totalReimbursementsStrippedMad * 100) / 100,
    recommendedBudgets,
    pillarSummary: {
      obligationsMad,
      obligationsPct: effectiveTargetIncome > 0 ? (obligationsMad / effectiveTargetIncome) * 100 : 0,
      myselfMad,
      myselfPct: effectiveTargetIncome > 0 ? (myselfMad / effectiveTargetIncome) * 100 : 0,
      investmentsMad,
      investmentsPct: effectiveTargetIncome > 0 ? (investmentsMad / effectiveTargetIncome) * 100 : 0,
      bankRetentionSavingsMad,
      bankRetentionSavingsPct:
        effectiveTargetIncome > 0 ? (bankRetentionSavingsMad / effectiveTargetIncome) * 100 : 0,
    },
  };
};
