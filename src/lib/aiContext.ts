import type { CategoryBudget, Debt, KPI, Payroll, Transaction } from '../types/index.js';
import { financialPeriodLabel, getCurrentFinancialMonth, getPreviousFinancialMonth, isInFinancialMonth } from './financialMonth.js';

const amountOf = (value: string | number | null | undefined) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0;
const dateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
};

export function buildAiContextSnapshot({
  kpis, transactions, debts, budgets, emergencyBuffer, payrolls,
}: {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  emergencyBuffer: number;
  payrolls: Payroll[];
}) {
  const current = getCurrentFinancialMonth(payrolls);
  const previous = current ? getPreviousFinancialMonth(payrolls, current) : null;
  const inPeriod = (transaction: Transaction, period = current) => Boolean(period && new Date(transaction.createdAt) >= period.start && new Date(transaction.createdAt) <= period.end);
  const periodTransactions = transactions.filter((transaction) => inPeriod(transaction));
  const previousTransactions = transactions.filter((transaction) => inPeriod(transaction, previous));
  const income = periodTransactions.filter((transaction) => transaction.type === 'Income').reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);
  const expenses = periodTransactions.filter((transaction) => transaction.type === 'Expense' || transaction.type === 'Debt Repayment').reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);

  return {
    asOf: dateKey(new Date()),
    currency: 'MAD',
    financialPeriod: current ? {
      label: financialPeriodLabel(current),
      start: dateKey(current.start),
      end: dateKey(current.end),
      startsWithPayroll: amountOf(current.startPayroll.amount),
      closesWithPayroll: dateKey(current.endPayroll.scheduledFor),
    } : { configured: false, message: 'No complete financial period is configured. Add consecutive payroll dates in Financial Calendar.' },
    kpis: kpis ? {
      totalLiquidity: amountOf(kpis.totalLiquidity), bankBalance: amountOf(kpis.bankBalance), cashOnHand: amountOf(kpis.cashOnHand),
      monthlyIncome: amountOf(kpis.monthlyIncome), monthlyExpenses: amountOf(kpis.monthlyExpenses), dailyAllowance: amountOf(kpis.dailyAllowance),
      dailySpent: amountOf(kpis.dailySpent), dailyRemaining: amountOf(kpis.dailyRemaining), daysUntilPayroll: kpis.daysUntilPayday,
    } : null,
    financialPeriodSummary: { income: amountOf(income), expenses: amountOf(expenses), netPosition: amountOf(income - expenses), previousPeriodExpenses: previousTransactions.filter((transaction) => transaction.type === 'Expense').reduce((sum, transaction) => sum + amountOf(transaction.amount), 0) },
    payrolls: payrolls.map((payroll) => ({ date: dateKey(payroll.scheduledFor), amount: amountOf(payroll.amount) })),
    budgets: budgets.slice(0, 30).map((budget) => ({ category: budget.category, amount: amountOf(budget.amount), year: budget.year, month: budget.month })),
    emergencyBuffer: amountOf(emergencyBuffer),
    debts: debts.slice(0, 20).map((debt) => ({ contact: debt.contactName, type: debt.type, remaining: amountOf(debt.remainingBalance), dueDate: dateKey(debt.dueDate) })),
    recentTransactions: transactions.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 30).map((transaction) => ({ date: dateKey(transaction.createdAt), amount: amountOf(transaction.amount), type: transaction.type, category: transaction.category, note: transaction.notes, inCurrentFinancialPeriod: current ? isInFinancialMonth(new Date(transaction.createdAt), payrolls, current.year, current.month) : false })),
  };
}
