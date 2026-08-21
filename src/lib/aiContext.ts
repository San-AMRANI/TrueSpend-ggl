import type { CategoryBudget, Debt, KPI, Transaction } from '../types';
import {
  getFinancialMonthBounds,
  getCurrentFinancialMonth,
  getPreviousFinancialMonth,
  isInFinancialMonth,
  financialMonthLabel,
} from './financialMonth';

const RECENT_TRANSACTION_LIMIT = 30;
const MAX_NOTE_LENGTH = 100;

const toAmount = (value: string | number | null | undefined) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

const toDateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
};

const totalByCategory = (transactions: Transaction[], start?: Date, end?: Date) => {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    const transactionDate = new Date(transaction.createdAt);
    if (Number.isNaN(transactionDate.getTime())) continue;
    if (start && transactionDate < start) continue;
    if (end && transactionDate > end) continue;
    if (transaction.type !== 'Expense' && transaction.type !== 'Debt Repayment') continue;

    const category = transaction.category || 'Uncategorized';
    totals.set(category, (totals.get(category) || 0) + toAmount(transaction.amount));
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 12);
};

const sumTransactions = (
  transactions: Transaction[],
  start: Date,
  end: Date,
  typeMatcher: (type: Transaction['type']) => boolean,
) =>
  transactions
    .filter((t) => {
      const d = new Date(t.createdAt);
      return !Number.isNaN(d.getTime()) && d >= start && d <= end && typeMatcher(t.type);
    })
    .reduce((sum, t) => sum + toAmount(t.amount), 0);

/**
 * Reduces account data to the information the assistant needs most often. This avoids
 * sending an ever-growing transaction history with every chat message while retaining
 * current KPIs, category trends, recent records, budget utilization, and spending trends.
 *
 * Months here are FINANCIAL months (payday-to-payday), not calendar months.
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

  // ── Financial month references ──────────────────────────────────────────────
  const currentFM = getCurrentFinancialMonth(payday);
  const prevFM = getPreviousFinancialMonth(payday, currentFM.year, currentFM.month);

  const { start: fmStart, end: fmEnd } = getFinancialMonthBounds(payday, currentFM.year, currentFM.month);
  const { start: prevFmStart, end: prevFmEnd } = getFinancialMonthBounds(payday, prevFM.year, prevFM.month);

  // Days info within the current financial month
  const totalFmDays = Math.round((fmEnd.getTime() - fmStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const elapsedFmDays = Math.min(
    totalFmDays,
    Math.max(0, Math.round((now.getTime() - fmStart.getTime()) / (1000 * 60 * 60 * 24)) + 1),
  );
  const remainingFmDays = totalFmDays - elapsedFmDays;

  const isIncome = (t: Transaction) => t.type === 'Income';
  const isExpense = (t: Transaction) => t.type === 'Expense' || t.type === 'Debt Repayment';

  const thisMonthIncome = sumTransactions(transactions, fmStart, now, isIncome);
  const thisMonthExpenses = sumTransactions(transactions, fmStart, now, isExpense);
  const prevMonthExpenses = sumTransactions(transactions, prevFmStart, prevFmEnd, isExpense);
  const prevMonthIncome = sumTransactions(transactions, prevFmStart, prevFmEnd, isIncome);

  const netPositionThisMonth = Number((thisMonthIncome - thisMonthExpenses).toFixed(2));
  const spendingVsLastMonth =
    prevMonthExpenses > 0
      ? Number((((thisMonthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100).toFixed(1))
      : null;

  // Category breakdowns scoped to financial months
  const thisMonthByCategory = totalByCategory(transactions, fmStart, now);
  const allTimeByCategory = totalByCategory(transactions);

  // Budget utilization matched to financial month
  // Budgets are stored with calendar year/month — find ones that overlap the current financial month
  const currentCalendarMonthBudgets = budgets.filter(
    (b) =>
      (b.year === currentFM.year && b.month === currentFM.month) ||
      (b.year === prevFM.year && b.month === prevFM.month),
  );
  // Deduplicate by category keeping the one for currentFM first
  const seenCats = new Set<string>();
  const deduped = currentCalendarMonthBudgets.filter((b) => {
    if (seenCats.has(b.category)) return false;
    seenCats.add(b.category);
    return true;
  });

  const budgetUtilization = deduped.map((b) => {
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
  const activeDebts = debts.filter((d) => d.status === 'active' || d.status === 'Pending');
  const totalPayable = activeDebts
    .filter((d) => d.type === 'Payable')
    .reduce((sum, d) => sum + toAmount(d.remainingBalance), 0);
  const totalReceivable = activeDebts
    .filter((d) => d.type === 'Receivable')
    .reduce((sum, d) => sum + toAmount(d.remainingBalance), 0);
  const overdueDebts = activeDebts
    .filter((d) => d.dueDate && new Date(d.dueDate) < now)
    .map((d) => ({
      contact: d.contactName,
      type: d.type,
      remaining: toAmount(d.remainingBalance),
      dueDate: toDateKey(d.dueDate),
    }));

  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    asOf: toDateKey(now),
    currency: 'MAD',
    financialMonth: {
      label: financialMonthLabel(currentFM.year, currentFM.month),
      start: toDateKey(fmStart),
      end: toDateKey(fmEnd),
      totalDays: totalFmDays,
      elapsedDays: elapsedFmDays,
      remainingDays: remainingFmDays,
      payday,
      note: `Financial month runs from the ${payday}th of each month to the ${payday - 1}th of the next.`,
    },
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
          emergencyBuffer: toAmount(emergencyBuffer),
        }
      : null,
    settings: { payday, emergencyBuffer: toAmount(emergencyBuffer) },
    financialMonthSummary: {
      income: Number(thisMonthIncome.toFixed(2)),
      expenses: Number(thisMonthExpenses.toFixed(2)),
      netPosition: netPositionThisMonth,
      spendingVsPrevMonthPct: spendingVsLastMonth,
      previousMonthExpenses: Number(prevMonthExpenses.toFixed(2)),
      previousMonthIncome: Number(prevMonthIncome.toFixed(2)),
    },
    spending: {
      thisFinancialMonthByCategory: thisMonthByCategory,
      allTimeByCategory,
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
      inCurrentFinancialMonth: isInFinancialMonth(
        new Date(transaction.createdAt),
        payday,
        currentFM.year,
        currentFM.month,
      ),
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
