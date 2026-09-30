import type { CategoryBudget, Debt, KPI, Payroll, Transaction, Goal, FinancialHomeResponse, PortfolioSummary } from '../types/index.js';
import { financialPeriodLabel, getCurrentFinancialMonth, getPreviousFinancialMonth, isInFinancialMonth } from './financialMonth.js';

const amountOf = (value: string | number | null | undefined) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0;
const dateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
};

export function buildAiContextSnapshot({
  kpis, transactions, debts, budgets, payrolls, goals = [], financialHome = null, portfolio = null,
}: {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  goals?: Goal[];
  financialHome?: FinancialHomeResponse | null;
  portfolio?: PortfolioSummary | null;
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
    wallets: kpis ? kpis.accounts.map(w => ({ id: w.id, name: w.name, type: w.type, balance: amountOf(w.balance) })) : [],
    kpis: kpis ? {
      totalLiquidity: amountOf(kpis.totalLiquidity), bankBalance: amountOf(kpis.bankBalance), cashOnHand: amountOf(kpis.cashOnHand),
      monthlyIncome: amountOf(kpis.monthlyIncome), monthlyExpenses: amountOf(kpis.monthlyExpenses), dailyAllowance: amountOf(kpis.dailyAllowance),
      dailySpent: amountOf(kpis.dailySpent), dailyRemaining: amountOf(kpis.dailyRemaining), daysUntilPayroll: kpis.daysUntilPayday,
    } : null,
    financialPeriodSummary: { income: amountOf(income), expenses: amountOf(expenses), netPosition: amountOf(income - expenses), previousPeriodExpenses: previousTransactions.filter((transaction) => transaction.type === 'Expense').reduce((sum, transaction) => sum + amountOf(transaction.amount), 0) },
    payrolls: payrolls.map((payroll) => ({ date: dateKey(payroll.scheduledFor), amount: amountOf(payroll.amount) })),
    budgets: budgets.slice(0, 30).map((budget) => ({ category: budget.category, amount: amountOf(budget.amount), year: budget.year, month: budget.month })),
    emergencyBuffer: kpis ? amountOf(kpis.emergencyBuffer) : 0,
    debts: debts.slice(0, 20).map((debt) => ({ contact: debt.contactName, type: debt.type, remaining: amountOf(debt.remainingBalance), dueDate: dateKey(debt.dueDate) })),
    goals: goals.map((goal) => {
      const linkedWallet = kpis?.accounts?.find((w) => w.id === goal.walletId);
      return {
        id: goal.id,
        name: goal.name,
        category: goal.category,
        targetAmount: amountOf(goal.targetAmount),
        currentAmount: amountOf(goal.currentAmount),
        walletId: goal.walletId || null,
        linkedWalletName: linkedWallet ? `${linkedWallet.name} (${linkedWallet.type})` : null,
        autoSyncBalance: Boolean(goal.autoSyncBalance),
        deadline: dateKey(goal.deadline),
        notes: goal.notes,
      };
    }),
    financialOperatingSystem: financialHome ? {
      snapshot: {
        asOf: financialHome.snapshot.asOf,
        financialPeriod: financialHome.snapshot.financialPeriod,
        liquidCash: financialHome.snapshot.liquidCash,
        protectedEmergencyCash: financialHome.snapshot.protectedEmergencyCash,
        reservedForCommitments: financialHome.snapshot.reservedForCommitments,
        reservedForGoals: financialHome.snapshot.reservedForGoals,
        safeToSpend: financialHome.snapshot.safeToSpend,
        investmentCapacity: financialHome.snapshot.investmentCapacity,
        pendingPayables: financialHome.snapshot.pendingPayables,
        pendingReceivables: financialHome.snapshot.pendingReceivables,
        investmentMarketValue: financialHome.snapshot.investmentMarketValue,
        netWorth: financialHome.snapshot.netWorth,
        forecast: financialHome.snapshot.forecast,
        buffer: financialHome.snapshot.buffer,
        confidence: financialHome.snapshot.confidence,
        assumptions: financialHome.snapshot.assumptions,
        safeToSpendBreakdown: financialHome.snapshot.safeToSpendBreakdown,
      },
      profile: { strategy: financialHome.profile.strategy, riskPreference: financialHome.profile.riskPreference, investmentExperience: financialHome.profile.investmentExperience, investmentHorizon: financialHome.profile.investmentHorizon },
      activePlan: financialHome.activePlan ? { id: financialHome.activePlan.id, status: financialHome.activePlan.status, incomeAmount: financialHome.activePlan.incomeAmount, allocations: financialHome.activePlan.allocations.map((allocation) => ({ id: allocation.id, type: allocation.type, name: allocation.name, amount: allocation.amount, status: allocation.status })) } : null,
      recommendations: financialHome.recommendations.map((recommendation) => ({ id: recommendation.id, type: recommendation.type, title: recommendation.title, summary: recommendation.summary, confidence: recommendation.confidence })),
      portfolio: portfolio ? { marketValue: portfolio.marketValue, totalContributions: portfolio.totalContributions, unrealizedGain: portfolio.unrealizedGain, realizedGain: portfolio.realizedGain, riskConcentration: portfolio.riskConcentration, priceFreshness: portfolio.priceFreshness, latestPriceAsOf: portfolio.holdings.map((holding) => holding.priceAsOf).filter(Boolean).sort().at(-1) || null } : null,
      limitations: 'Investment values are not cash available to spend. Explain deterministic facts and proposals; never predict prices or guarantee returns.',
    } : null,
    currentPeriodTransactions: (current ? periodTransactions : transactions.slice(0, 30))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((transaction) => ({ date: dateKey(transaction.createdAt), amount: amountOf(transaction.amount), type: transaction.type, category: transaction.category, note: transaction.notes })),
  };
}
