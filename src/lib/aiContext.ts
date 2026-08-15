import type { CategoryBudget, Debt, KPI, Transaction } from '../types';

const RECENT_TRANSACTION_LIMIT = 24;
const MAX_NOTE_LENGTH = 72;

const toAmount = (value: string | number | null | undefined) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

const toDateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
};

const totalByCategory = (transactions: Transaction[], from?: Date) => {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    const transactionDate = new Date(transaction.createdAt);
    if (from && (Number.isNaN(transactionDate.getTime()) || transactionDate < from)) continue;
    if (transaction.type !== 'Expense' && transaction.type !== 'Debt Repayment') continue;

    const category = transaction.category || 'Uncategorized';
    totals.set(category, (totals.get(category) || 0) + toAmount(transaction.amount));
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 12);
};

/**
 * Creates a compact, structured snapshot for the AI request. It deliberately keeps
 * identifiers only for records that may be edited, while preserving aggregate trends
 * from the full transaction history for financial insights.
 */
export function buildAiContextSnapshot({
  kpis,
  transactions,
  debts,
  budgets,
  emergencyBuffer,
  payday,
}: {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  emergencyBuffer: number;
  payday: number;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    version: 1,
    asOf: toDateKey(now),
    currency: 'MAD',
    kpis: kpis
      ? {
          totalLiquidity: toAmount(kpis.totalLiquidity),
          bankBalance: toAmount(kpis.bankBalance),
          cashOnHand: toAmount(kpis.cashOnHand),
          monthlyIncome: toAmount(kpis.monthlyIncome),
          monthlyExpenses: toAmount(kpis.monthlyExpenses),
          dailyAllowance: toAmount(kpis.dailyAllowance),
          dailySpent: toAmount(kpis.dailySpent),
          dailyRemaining: toAmount(kpis.dailyRemaining),
          daysUntilPayday: kpis.daysUntilPayday,
          dailyStatus: kpis.dailyStatus,
        }
      : null,
    settings: { payday, emergencyBuffer: toAmount(emergencyBuffer) },
    spending: {
      thisMonthByCategory: totalByCategory(transactions, monthStart),
      allTimeByCategory: totalByCategory(transactions),
    },
    recentTransactions: sortedTransactions.slice(0, RECENT_TRANSACTION_LIMIT).map((transaction) => ({
      id: transaction.id,
      date: toDateKey(transaction.createdAt),
      amount: toAmount(transaction.amount),
      type: transaction.type,
      wallet: transaction.sourceWallet,
      category: transaction.category || 'Uncategorized',
      note: transaction.notes?.slice(0, MAX_NOTE_LENGTH) || undefined,
    })),
    debts: debts.slice(0, 30).map((debt) => ({
      id: debt.id,
      contact: debt.contactName,
      type: debt.type,
      remaining: toAmount(debt.remainingBalance),
      original: toAmount(debt.originalAmount),
      status: debt.status,
      dueDate: debt.dueDate ? toDateKey(debt.dueDate) : undefined,
    })),
    budgets: budgets
      .filter((budget) => budget.year === now.getFullYear() && budget.month === now.getMonth() + 1)
      .map((budget) => ({ category: budget.category, amount: toAmount(budget.amount) })),
  };
}
