import type { CategoryBudget, Debt, KPI, Payroll, Transaction, Goal, InvestmentsData } from '../types/index.js';
import { financialPeriodLabel, getCurrentFinancialMonth, getPreviousFinancialMonth } from './financialMonth.js';
import { computeHolisticForecast } from './predictiveEngine.js';

const amountOf = (value: string | number | null | undefined) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0;
const dateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
};

export function buildAiContextSnapshot({
  kpis, transactions, debts, budgets, payrolls, goals = [], investmentsData = null,
}: {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  goals?: Goal[];
  investmentsData?: InvestmentsData | null;
}) {
  const current = getCurrentFinancialMonth(payrolls);
  const previous = current ? getPreviousFinancialMonth(payrolls, current) : null;
  const inPeriod = (transaction: Transaction, period = current) => Boolean(period && new Date(transaction.createdAt) >= period.start && new Date(transaction.createdAt) <= period.end);
  const periodTransactions = transactions.filter((transaction) => inPeriod(transaction));
  const previousTransactions = transactions.filter((transaction) => inPeriod(transaction, previous));
  const income = periodTransactions.filter((transaction) => transaction.type === 'Income').reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);
  const expenses = periodTransactions.filter((transaction) => transaction.type === 'Expense' || transaction.type === 'Debt Repayment').reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);

  const forecast = computeHolisticForecast({
    kpis,
    transactions,
    payrolls,
    budgets,
    subscriptions: [],
    debts,
    goals,
    investmentsData,
    contexts: [],
  });

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
    stockPortfolio: investmentsData ? {
      totalPortfolioValueMad: investmentsData.totalPortfolioValueMad,
      totalPortfolioValueUsd: investmentsData.totalPortfolioValueUsd,
      totalUnrealizedPnlMad: investmentsData.totalUnrealizedPnlMad,
      totalUnrealizedPnlPercent: investmentsData.totalUnrealizedPnlPercent,
      annualDividendIncomeMad: investmentsData.annualPassiveIncomeMad,
      monthlyDividendIncomeMad: investmentsData.monthlyPassiveIncomeMad,
      deployableBuyingPowerMad: investmentsData.buyingPower.deployableSurplusMad,
      deployableBuyingPowerUsd: investmentsData.buyingPower.deployableSurplusUsd,
      positions: investmentsData.positions.map(p => ({
        ticker: p.ticker,
        company: p.companyName,
        market: p.market,
        shares: p.sharesNum,
        avgCost: p.avgCostNum,
        currentPrice: p.currentPriceNum,
        currency: p.currency,
        valueMad: p.marketValueMad,
        pnlPercent: p.unrealizedPnlPercent,
        weightPercent: p.actualWeightPercent,
      })),
    } : null,
    predictiveForecast: {
      projectedNetWorth90d: forecast.projectedNetWorth90d,
      projectedNetWorth12m: forecast.projectedNetWorth12m,
      projectedNetSavingsMonthly: forecast.monthlyNetSavingsBaseline,
      lowest30dBalance: forecast.lowest30dBalance,
      lowest30dDate: forecast.lowest30dDateLabel,
      survivalRunwayDays: forecast.survivalRunwayDays,
      hasLiquidityPinchBeforePayday: forecast.hasLiquidityPinchBeforePayday,
      topSignals: forecast.signals.slice(0, 4).map((s) => ({ title: s.title, detail: s.detail, severity: s.severity })),
      categoryRadar: forecast.categoryPredictions.slice(0, 8).map((c) => ({
        category: c.category,
        spentSoFar: c.spentSoFar,
        budgetLimit: c.budgetCap,
        projectedCycleEnd: c.projectedEndOfCycle,
        status: c.status,
        exhaustionDate: c.exhaustionDateLabel,
      })),
    },
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
    currentPeriodTransactions: (current ? periodTransactions : transactions.slice(0, 30))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .map((transaction) => ({ date: dateKey(transaction.createdAt), amount: amountOf(transaction.amount), type: transaction.type, category: transaction.category, note: transaction.notes })),
  };
}

