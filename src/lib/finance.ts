import { CategoryBudget, KPI, Transaction } from '../types';
import { normalizeCategory } from './categories';
import { getFinancialMonthRef, isInFinancialMonth, financialMonthLabel } from './financialMonth';

export const BUDGET_STATUS_THRESHOLDS = {
  warning: 80,
  overBudget: 100,
  critical: 120,
} as const;

export type BudgetStatus = 'normal' | 'warning' | 'over_budget' | 'critical' | 'not_set';

type MonthRef = { year: number; month: number };

export interface TransactionFilters {
  query?: string;
  datePreset?: 'all' | 'today' | 'week' | 'month' | 'last-month' | 'custom';
  startDate?: string;
  endDate?: string;
  types?: Transaction['type'][];
  categories?: string[];
  wallets?: Transaction['sourceWallet'][];
  minAmount?: number;
  maxAmount?: number;
  reimbursable?: 'all' | 'reimbursable' | 'non-reimbursable';
  debtRelationship?: 'all' | 'debt-linked' | 'not-debt-related';
  sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
}

export const amountOf = (transaction: Pick<Transaction, 'amount'>) => Number.parseFloat(transaction.amount) || 0;

export const transactionDate = (transaction: Pick<Transaction, 'createdAt'>) => new Date(transaction.createdAt);

/** Returns the financial month reference for a transaction based on the user's payday. */
export const transactionMonth = (transaction: Pick<Transaction, 'createdAt'>, payday: number): MonthRef => {
  const date = transactionDate(transaction);
  return getFinancialMonthRef(date, payday);
};

export const monthLabel = (year: number, month: number) => financialMonthLabel(year, month);

export const isInMonth = (transaction: Pick<Transaction, 'createdAt'>, year: number, month: number, payday: number = 25) => {
  return isInFinancialMonth(transactionDate(transaction), payday, year, month);
};

export const isExpense = (transaction: Pick<Transaction, 'type'>) => transaction.type === 'Expense';

export const getExpensesForMonth = (transactions: Transaction[], year: number, month: number, payday: number = 25) =>
  transactions.filter((transaction) => isExpense(transaction) && isInMonth(transaction, year, month, payday));

export const getCategorySpending = (transactions: Transaction[], category: string, year: number, month: number, payday: number = 25) =>
  getExpensesForMonth(transactions, year, month, payday)
    .filter((transaction) => normalizeCategory(transaction.category) === normalizeCategory(category))
    .reduce((total, transaction) => total + amountOf(transaction), 0);

export const getBudgetStatus = (budgetAmount: number | undefined, spent: number) => {
  if (budgetAmount === undefined || !Number.isFinite(budgetAmount)) {
    return { status: 'not_set' as BudgetStatus, usagePercentage: 0, remaining: 0 };
  }
  if (budgetAmount <= 0) {
    return { status: spent > 0 ? ('critical' as BudgetStatus) : ('normal' as BudgetStatus), usagePercentage: spent > 0 ? 100 : 0, remaining: budgetAmount - spent };
  }

  const usagePercentage = (spent / budgetAmount) * 100;
  const status: BudgetStatus = usagePercentage >= BUDGET_STATUS_THRESHOLDS.critical
    ? 'critical'
    : usagePercentage >= BUDGET_STATUS_THRESHOLDS.overBudget
      ? 'over_budget'
      : usagePercentage >= BUDGET_STATUS_THRESHOLDS.warning
        ? 'warning'
        : 'normal';
  return { status, usagePercentage, remaining: budgetAmount - spent };
};

export const getSpendingChange = (transactions: Transaction[], year: number, month: number, category?: string, payday: number = 25) => {
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const total = (ref: MonthRef) => getExpensesForMonth(transactions, ref.year, ref.month, payday)
    .filter((transaction) => !category || normalizeCategory(transaction.category) === normalizeCategory(category))
    .reduce((sum, transaction) => sum + amountOf(transaction), 0);
  const current = total({ year, month });
  const previousAmount = total(previous);
  const difference = current - previousAmount;
  return {
    current,
    previous: previousAmount,
    difference,
    percentage: previousAmount > 0 ? (difference / previousAmount) * 100 : null,
  };
};

import { getFinancialMonthBounds } from './financialMonth';

export const getSpendingPace = (actual: number, monthlyBudget: number, year: number, month: number, payday: number = 25, now = new Date()) => {
  const { start, end } = getFinancialMonthBounds(payday, year, month);
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1));
  const ideal = monthlyBudget * elapsedDays / totalDays;
  return { ideal, actual, difference: actual - ideal, elapsedDays, daysInMonth: totalDays };
};

export const getLargestExpenses = (transactions: Transaction[], year: number, month: number, payday: number = 25, count = 5) =>
  getExpensesForMonth(transactions, year, month, payday)
    .slice()
    .sort((a, b) => amountOf(b) - amountOf(a))
    .slice(0, count);

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export const filterTransactions = (transactions: Transaction[], filters: TransactionFilters, now = new Date()) => {
  const query = filters.query?.trim().toLowerCase();
  const today = dateKey(now);
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(day);
  weekStart.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const currentMonth = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const previousMonth = currentMonth.month === 1 ? { year: currentMonth.year - 1, month: 12 } : { year: currentMonth.year, month: currentMonth.month - 1 };

  const matchesDate = (transaction: Transaction) => {
    const key = dateKey(transactionDate(transaction));
    // Provide a default payday for filters if not available in context.
    const filterPayday = 25; 
    switch (filters.datePreset) {
      case 'today': return key === today;
      case 'week': return key >= dateKey(weekStart) && key <= today;
      case 'month': return isInMonth(transaction, currentMonth.year, currentMonth.month, filterPayday);
      case 'last-month': return isInMonth(transaction, previousMonth.year, previousMonth.month, filterPayday);
      case 'custom': return (!filters.startDate || key >= filters.startDate) && (!filters.endDate || key <= filters.endDate);
      default: return true;
    }
  };

  const filtered = transactions.filter((transaction) => {
    const haystack = [transaction.category, transaction.notes, transaction.linkedContactName].filter(Boolean).join(' ').toLowerCase();
    const amount = amountOf(transaction);
    return (!query || haystack.includes(query))
      && matchesDate(transaction)
      && (!filters.types?.length || filters.types.includes(transaction.type))
      && (!filters.categories?.length || filters.categories.map(normalizeCategory).includes(normalizeCategory(transaction.category)))
      && (!filters.wallets?.length || filters.wallets.includes(transaction.sourceWallet))
      && (filters.minAmount === undefined || amount >= filters.minAmount)
      && (filters.maxAmount === undefined || amount <= filters.maxAmount)
      && (filters.reimbursable === undefined || filters.reimbursable === 'all' || (filters.reimbursable === 'reimbursable') === Boolean(transaction.reimbursableAmount && amountOf({ amount: transaction.reimbursableAmount }) > 0))
      && (filters.debtRelationship === undefined || filters.debtRelationship === 'all' || (filters.debtRelationship === 'debt-linked') === Boolean(transaction.linkedContactId));
  });

  return filtered.sort((a, b) => {
    if (filters.sort === 'oldest') return transactionDate(a).getTime() - transactionDate(b).getTime();
    if (filters.sort === 'highest') return amountOf(b) - amountOf(a);
    if (filters.sort === 'lowest') return amountOf(a) - amountOf(b);
    return transactionDate(b).getTime() - transactionDate(a).getTime();
  });
};

/**
 * Simulates a purchase without persisting a transaction. The safe daily amount is reallocated
 * from the post-purchase liquidity, and the purchase is included in today's spending.
 */
export const getWhatIfAllowance = (kpis: KPI, purchaseAmount: number) => {
  const amount = Math.max(0, purchaseAmount || 0);
  const liquidityAfterPurchase = kpis.totalLiquidity - amount;
  const availableAfterPurchase = liquidityAfterPurchase - kpis.emergencyBuffer;
  const recalculatedDailyAllowance = availableAfterPurchase / Math.max(1, kpis.daysUntilPayday);
  const todaySpentAfterPurchase = kpis.dailySpent + amount;
  const dailyRemainingAfterPurchase = recalculatedDailyAllowance - todaySpentAfterPurchase;
  return { liquidityAfterPurchase, recalculatedDailyAllowance, todaySpentAfterPurchase, dailyRemainingAfterPurchase };
};

export const budgetFor = (budgets: CategoryBudget[], category: string, year: number, month: number) =>
  budgets.find((budget) => budget.year === year && budget.month === month && normalizeCategory(budget.category) === normalizeCategory(category));
