import type { CategoryBudget, Debt, KPI, Transaction } from '../types';

const RECENT_TRANSACTION_LIMIT = 20;
const MAX_NOTE_LENGTH = 80;

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
    .slice(0, 10);
};

const incomeThisMonth = (transactions: Transaction[], from: Date) =>
  transactions
    .filter((t) => t.type === 'Income' && new Date(t.createdAt) >= from)
    .reduce((sum, t) => sum + toAmount(t.amount), 0);

const expensesThisMonth = (transactions: Transaction[], from: Date) =>
  transactions
    .filter((t) => (t.type === 'Expense' || t.type === 'Debt Repayment') && new Date(t.createdAt) >= from)
    .reduce((sum, t) => sum + toAmount(t.amount), 0);

const expensesLastMonth = (transactions: Transaction[], lastMonthStart: Date, lastMonthEnd: Date) =>
  transactions
    .filter((t) => {
      const d = new Date(t.createdAt);
      return (t.type === 'Expense' || t.type === 'Debt Repayment') && d >= lastMonthStart && d < lastMonthEnd;
    })
    .reduce((sum, t) => sum + toAmount(t.amount), 0);

/**
 * Reduces account data to the information the assistant needs most often. This avoids
 * sending an ever-growing transaction history with every chat message while retaining
 * current KPIs, category trends, recent records, budget utilization, and spending trends.
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
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemainingInMonth = daysInMonth - dayOfMonth;

  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const thisMonthByCategory = totalByCategory(transactions, monthStart);
  const thisMonthIncome = incomeThisMonth(transactions, monthStart);
  const thisMonthExpenses = expensesThisMonth(transactions, monthStart);
  const lastMonthExpenses = expensesLastMonth(transactions, lastMonthStart, lastMonthEnd);
  const netPositionThisMonth = Number((thisMonthIncome - thisMonthExpenses).toFixed(2));
  const spendingVsLastMonth =
    lastMonthExpenses > 0
      ? Number((((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100).toFixed(1))
      : null;

  // Budget utilization: match budgets to spending for the current month
  const currentMonthBudgets = budgets.filter(
    (b) => b.year === now.getFullYear() && b.month === now.getMonth() + 1,
  );
  const budgetUtilization = currentMonthBudgets.map((b) => {
    const spent = thisMonthByCategory.find((c) => c.category === b.category)?.amount ?? 0;
    const limit = toAmount(b.amount);
    const remaining = Number((limit - spent).toFixed(2));
    const pctUsed = limit > 0 ? Number(((spent / limit) * 100).toFixed(1)) : null;
    return {
      category: b.category,
      limit,
      spent: Number(spent.toFixed(2)),
      remaining,
      pctUsed,
      overBudget: remaining < 0,
    };
  });

  // Debt summary
  const activeDebts = debts.filter((d) => d.status === 'active');
  const totalPayable = activeDebts
    .filter((d) => d.type === 'Payable')
    .reduce((sum, d) => sum + toAmount(d.remainingBalance), 0);
  const totalReceivable = activeDebts
    .filter((d) => d.type === 'Receivable')
    .reduce((sum, d) => sum + toAmount(d.remainingBalance), 0);
  const overdueDebts = activeDebts
    .filter((d) => d.dueDate && new Date(d.dueDate) < now)
    .map((d) => ({ contact: d.contactName, type: d.type, remaining: toAmount(d.remainingBalance), dueDate: toDateKey(d.dueDate) }));

  return {
    asOf: toDateKey(now),
    dayOfMonth,
    daysInMonth,
    daysRemainingInMonth,
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
    monthSummary: {
      income: Number(thisMonthIncome.toFixed(2)),
      expenses: Number(thisMonthExpenses.toFixed(2)),
      netPosition: netPositionThisMonth,
      spendingVsLastMonthPct: spendingVsLastMonth,
      lastMonthExpenses: Number(lastMonthExpenses.toFixed(2)),
    },
    spending: {
      thisMonthByCategory,
      allTimeByCategory: totalByCategory(transactions),
    },
    budgetUtilization,
    debtSummary: {
      totalPayable: Number(totalPayable.toFixed(2)),
      totalReceivable: Number(totalReceivable.toFixed(2)),
      overdueDebts,
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
    debts: debts.slice(0, 20).map((debt) => ({
      id: debt.id,
      contact: debt.contactName,
      type: debt.type,
      remaining: toAmount(debt.remainingBalance),
      status: debt.status,
      dueDate: debt.dueDate ? toDateKey(debt.dueDate) : undefined,
    })),
  };
}
