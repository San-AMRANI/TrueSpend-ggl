import { CategoryBudget, KPI, Transaction } from '../types/index.js';
import { normalizeCategory } from './categories.js';
import { FinancialMonthRef, PayrollLike, getFinancialMonthBounds, getFinancialMonthRef, getPreviousFinancialMonth, isInFinancialMonth } from './financialMonth.js';

export const BUDGET_STATUS_THRESHOLDS = { warning: 80, overBudget: 100, critical: 120 } as const;
export type BudgetStatus = 'normal' | 'warning' | 'over_budget' | 'critical' | 'not_set';

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
export const transactionMonth = (transaction: Pick<Transaction, 'createdAt'>, payrolls: PayrollLike[]): FinancialMonthRef | null => getFinancialMonthRef(transactionDate(transaction), payrolls);
export const monthLabel = (year: number, month: number) => new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
export const isInMonth = (transaction: Pick<Transaction, 'createdAt'>, year: number, month: number, payrolls: PayrollLike[]) => isInFinancialMonth(transactionDate(transaction), payrolls, year, month);
export const isExpense = (transaction: Pick<Transaction, 'type'>) => transaction.type === 'Expense';
export const getExpensesForMonth = (transactions: Transaction[], year: number, month: number, payrolls: PayrollLike[]) => transactions.filter((transaction) => isExpense(transaction) && isInMonth(transaction, year, month, payrolls));
export const getCategorySpending = (transactions: Transaction[], category: string, year: number, month: number, payrolls: PayrollLike[]) => getExpensesForMonth(transactions, year, month, payrolls).filter((transaction) => normalizeCategory(transaction.category) === normalizeCategory(category)).reduce((total, transaction) => total + amountOf(transaction), 0);

export const getBudgetStatus = (budgetAmount: number | undefined, spent: number) => {
  if (budgetAmount === undefined || !Number.isFinite(budgetAmount)) return { status: 'not_set' as BudgetStatus, usagePercentage: 0, remaining: 0 };
  if (budgetAmount <= 0) return { status: spent > 0 ? ('critical' as BudgetStatus) : ('normal' as BudgetStatus), usagePercentage: spent > 0 ? 100 : 0, remaining: budgetAmount - spent };
  const usagePercentage = (spent / budgetAmount) * 100;
  const status = usagePercentage >= BUDGET_STATUS_THRESHOLDS.critical ? 'critical' as BudgetStatus : usagePercentage >= BUDGET_STATUS_THRESHOLDS.overBudget ? 'over_budget' as BudgetStatus : usagePercentage >= BUDGET_STATUS_THRESHOLDS.warning ? 'warning' as BudgetStatus : 'normal' as BudgetStatus;
  return { status, usagePercentage, remaining: budgetAmount - spent };
};

export const getSpendingChange = (transactions: Transaction[], year: number, month: number, category: string | undefined, payrolls: PayrollLike[]) => {
  const previous = getPreviousFinancialMonth(payrolls, { year, month });
  const total = (ref: FinancialMonthRef | null) => ref ? getExpensesForMonth(transactions, ref.year, ref.month, payrolls).filter((transaction) => !category || normalizeCategory(transaction.category) === normalizeCategory(category)).reduce((sum, transaction) => sum + amountOf(transaction), 0) : 0;
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

export const getLargestExpenses = (transactions: Transaction[], year: number, month: number, payrolls: PayrollLike[], count = 5) => getExpensesForMonth(transactions, year, month, payrolls).slice().sort((a, b) => amountOf(b) - amountOf(a)).slice(0, count);

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
    return (!query || haystack.includes(query)) && matchesDate(transaction) && (!filters.types?.length || filters.types.includes(transaction.type)) && (!filters.categories?.length || filters.categories.map(normalizeCategory).includes(normalizeCategory(transaction.category))) && (!filters.wallets?.length || filters.wallets.includes(transaction.sourceWallet)) && (filters.minAmount === undefined || amount >= filters.minAmount) && (filters.maxAmount === undefined || amount <= filters.maxAmount) && (filters.reimbursable === undefined || filters.reimbursable === 'all' || (filters.reimbursable === 'reimbursable') === Boolean(transaction.reimbursableAmount && amountOf({ amount: transaction.reimbursableAmount }) > 0)) && (filters.debtRelationship === undefined || filters.debtRelationship === 'all' || (filters.debtRelationship === 'debt-linked') === Boolean(transaction.linkedContactId));
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
