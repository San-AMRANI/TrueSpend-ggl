import { Transaction, Payroll, Debt, CategoryBudget, Goal } from '../types/index.js';
import { getCurrentFinancialMonth, getNextPayroll, isInFinancialMonth,  FinancialMonthBounds } from './financialMonth.js';

export interface FinancialEngineInput {
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  budgets: CategoryBudget[];
  goals: Goal[];
  userSettings: {
    emergencyBuffer: number;
    salary: number;
  };
  now?: Date;
}

export function computeFinancialState(input: FinancialEngineInput) {
  const now = input.now || new Date();
  const toCalendarDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = toCalendarDay(now);
  const currentFm = getCurrentFinancialMonth(input.payrolls, now);

  let bankBalance = 0;
  let cashOnHand = 0;
  let openingBankBalance = 0;
  let openingCashOnHand = 0;
  let monthlyExpenses = 0;
  let monthlyIncome = 0;
  let dailySpent = 0;
  let todaysIncome = 0;
  let debtRepayments = 0;
  let reimbursements = 0;

  const isExpenseOutflow = (type: string) => type === 'Expense' || type === 'Debt Repayment';

  const applyTransaction = (tx: Transaction, balances: { bank: number; cash: number }) => {
    const amount = parseFloat(tx.amount as unknown as string);
    if (tx.sourceWallet === 'Bank') {
      if (tx.type === 'Income') balances.bank += amount;
      if (isExpenseOutflow(tx.type)) balances.bank -= amount;
      if (tx.type === 'Transfer') { balances.bank -= amount; balances.cash += amount; }
    } else {
      if (tx.type === 'Income') balances.cash += amount;
      if (isExpenseOutflow(tx.type)) balances.cash -= amount;
      if (tx.type === 'Transfer') { balances.cash -= amount; balances.bank += amount; }
    }
  };

  for (const tx of input.transactions) {
    const txAmount = parseFloat(tx.amount as unknown as string);
    const txDate = new Date(tx.createdAt);
    const transactionDay = toCalendarDay(txDate);

    if (transactionDay < today) {
      const openingBalances = { bank: openingBankBalance, cash: openingCashOnHand };
      applyTransaction(tx, openingBalances);
      openingBankBalance = openingBalances.bank;
      openingCashOnHand = openingBalances.cash;
    }
    if (transactionDay <= today) {
      const currentBalances = { bank: bankBalance, cash: cashOnHand };
      applyTransaction(tx, currentBalances);
      bankBalance = currentBalances.bank;
      cashOnHand = currentBalances.cash;
    }

    if (currentFm && transactionDay <= today && isInFinancialMonth(txDate, input.payrolls, currentFm.year, currentFm.month)) {
      if (tx.type === 'Expense') monthlyExpenses += txAmount;
      if (tx.type === 'Income') monthlyIncome += txAmount;
    }
    if (transactionDay.getTime() === today.getTime()) {
      if (isExpenseOutflow(tx.type)) dailySpent += txAmount;
      if (tx.type === 'Income') todaysIncome += txAmount;
    }

    if (currentFm && transactionDay <= today && isInFinancialMonth(txDate, input.payrolls, currentFm.year, currentFm.month)) {
      if (tx.type === 'Expense' && ['💳 Debt & Obligations', 'Debt Repayment', 'Loan', '🔄 Transfer', 'Transfer'].includes(tx.category || '')) debtRepayments += txAmount;
      if (tx.type === 'Income' && ['Reimbursement', '🔙 Reimbursement', 'Refund'].includes(tx.category || '')) reimbursements += txAmount;
    }
  }

  const emergencyBuffer = input.userSettings.emergencyBuffer || 0;
  const totalLiquidity = bankBalance + cashOnHand;
  const openingLiquidity = openingBankBalance + openingCashOnHand;
  const nextPayroll = getNextPayroll(input.payrolls, now);
  const nextPayday = nextPayroll ? new Date(nextPayroll.scheduledFor) : null;
  const daysUntilPayday = nextPayday ? Math.max(0, Math.ceil((nextPayday.getTime() - today.getTime()) / 86_400_000)) : 0;
  
  // Phase 1 Intelligence - Core Definitions
  const pendingPayables = input.debts
    .filter(d => d.type === 'Payable' && d.status === 'Pending')
    .reduce((sum, d) => sum + (parseFloat(d.remainingBalance as string) || 0), 0);
    
  const pendingReceivables = input.debts
    .filter(d => d.type === 'Receivable' && d.status === 'Pending')
    .reduce((sum, d) => sum + (parseFloat(d.remainingBalance as string) || 0), 0);

  // Goal-aware additions
  // If we wanted to reserve required goal contributions, we'd add them here.
  const safeToSpend = Math.max(0, totalLiquidity - emergencyBuffer - pendingPayables);

  let avgDailySpend = 0;
  let elapsedDays = 1;
  let totalDaysInMonth = 30; // fallback
  let daysRemaining = 0;
  let expectedEndBalance = 0;
  let bestEndBalance = 0;
  let worstEndBalance = 0;
  let spendingPacePercent = 0;

  const currentMonthBudgets = currentFm 
    ? input.budgets.filter(b => b.year === currentFm.year && b.month === currentFm.month) 
    : [];
  const totalBudget = currentMonthBudgets.reduce((sum, b) => sum + (parseFloat(b.amount as string) || 0), 0);

  if (currentFm) {
    totalDaysInMonth = Math.max(1, Math.round((currentFm.end.getTime() - currentFm.start.getTime()) / 86_400_000) + 1);
    elapsedDays = Math.max(1, Math.round((today.getTime() - currentFm.start.getTime()) / 86_400_000) + 1);
    daysRemaining = Math.max(0, totalDaysInMonth - elapsedDays);
    avgDailySpend = monthlyExpenses / elapsedDays;

    const projectedTotalExpenses = monthlyExpenses + (avgDailySpend * daysRemaining);
    expectedEndBalance = totalLiquidity - (avgDailySpend * daysRemaining);

    const idealSpendToDate = totalBudget > 0 ? (totalBudget * elapsedDays / totalDaysInMonth) : 0;
    spendingPacePercent = idealSpendToDate > 0 ? ((monthlyExpenses / idealSpendToDate) * 100) : 0;

    bestEndBalance = totalLiquidity - (avgDailySpend * 0.8 * daysRemaining);
    worstEndBalance = totalLiquidity - (avgDailySpend * 1.3 * daysRemaining);
  }

  const runwayDays = avgDailySpend > 0 ? Math.floor(safeToSpend / avgDailySpend) : safeToSpend > 0 ? 999 : 0;

  const dailyAllowance = daysUntilPayday > 0 ? (openingLiquidity + todaysIncome - emergencyBuffer) / daysUntilPayday : 0;
  const dailyRemaining = dailyAllowance - dailySpent;
  const dailyUsagePercent = dailyAllowance > 0 ? (dailySpent / dailyAllowance) * 100 : dailySpent > 0 ? 100 : 0;
  const dailyStatus = dailyRemaining < 0 || dailyUsagePercent >= 100 ? 'critical' : dailyUsagePercent >= 80 ? 'warning' : 'on_track';

  // Compute Health Score
  const salary = input.userSettings.salary || 0;
  const health = computeHealthScore({
    totalLiquidity,
    emergencyBuffer,
    monthlyIncome,
    monthlyExpenses,
    safeToSpend,
    pendingPayables,
    pendingReceivables,
    runwayDays,
    dailyUsagePercent,
    salary,
    totalBudget,
    spendingPacePercent,
    daysUntilPayday,
  });

  return {
    totalLiquidity,
    bankBalance,
    cashOnHand,
    monthlyExpenses,
    monthlyIncome,
    adjustedTrueSpend: monthlyExpenses - debtRepayments - reimbursements,
    daysUntilPayday,
    dailyAllowance,
    dailySpent,
    dailyRemaining,
    dailyUsagePercent,
    dailyStatus,
    payday: null,
    currentFinancialAmount: currentFm ? Number(currentFm.startPayroll.amount) : 0,
    financialPeriodStart: currentFm ? currentFm.start.toISOString() : null,
    financialPeriodEnd: currentFm ? currentFm.end.toISOString() : null,
    nextPayrollDate: nextPayroll ? new Date(nextPayroll.scheduledFor).toISOString() : null,
    financialMonthReady: Boolean(currentFm),
    financialMonthMessage: currentFm ? null : 'Add a payroll for this month and the next month in Financial Calendar to define your financial period.',
    emergencyBuffer,
    safeToSpend,
    pendingPayables,
    pendingReceivables,
    runwayDays,
    avgDailySpend: Math.round(avgDailySpend * 100) / 100,
    forecast: {
      expected: Math.round(expectedEndBalance * 100) / 100,
      best: Math.round(bestEndBalance * 100) / 100,
      worst: Math.round(worstEndBalance * 100) / 100,
      daysRemaining,
      totalDays: totalDaysInMonth,
      elapsedDays,
      spendingPacePercent: Math.round(spendingPacePercent * 10) / 10,
    },
    healthScore: health.total,
    healthFactors: health.factors,
  };
}

interface HealthInput {
  totalLiquidity: number;
  emergencyBuffer: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  safeToSpend: number;
  pendingPayables: number;
  pendingReceivables: number;
  runwayDays: number;
  dailyUsagePercent: number;
  salary: number;
  totalBudget: number;
  spendingPacePercent: number;
  daysUntilPayday: number;
}

function computeHealthScore(input: HealthInput) {
  const factors = [];

  // 1. Savings rate (20 pts)
  const savingsRate = input.monthlyIncome > 0 ? ((input.monthlyIncome - input.monthlyExpenses) / input.monthlyIncome) * 100 : 0;
  const savingsScore = Math.min(20, Math.max(0, Math.round(savingsRate)));
  const savingsLabel = savingsRate >= 20 ? 'Excellent saving' : savingsRate >= 10 ? 'Good saving' : savingsRate > 0 ? 'Low saving' : 'No savings this period';
  factors.push({ name: 'Savings', score: savingsScore, maxPoints: 20, label: savingsLabel });

  // 2. Emergency buffer coverage (20 pts)
  const bufferCoverage = input.emergencyBuffer > 0 ? Math.min(1, input.totalLiquidity / (input.emergencyBuffer * 2)) : (input.totalLiquidity > 0 ? 0.5 : 0);
  const bufferScore = Math.round(bufferCoverage * 20);
  const bufferLabel = bufferCoverage >= 1 ? 'Buffer fully covered' : bufferCoverage >= 0.5 ? 'Buffer partially covered' : 'Buffer at risk';
  factors.push({ name: 'Emergency Buffer', score: bufferScore, maxPoints: 20, label: bufferLabel });

  // 3. Debt load (15 pts)
  const debtRatio = input.monthlyIncome > 0 ? Math.min(1, input.pendingPayables / input.monthlyIncome) : (input.pendingPayables > 0 ? 1 : 0);
  const debtScore = Math.round((1 - debtRatio) * 15);
  const debtLabel = debtRatio <= 0.1 ? 'Minimal debt' : debtRatio <= 0.3 ? 'Manageable debt' : 'Heavy debt load';
  factors.push({ name: 'Debt Load', score: debtScore, maxPoints: 15, label: debtLabel });

  // 4. Budget adherence (15 pts)
  let budgetScore = 8;
  let budgetLabel = 'No budgets set';
  if (input.totalBudget > 0) {
    const adherence = input.spendingPacePercent;
    budgetScore = adherence <= 100 ? 15 : adherence <= 120 ? 10 : adherence <= 150 ? 5 : 0;
    budgetLabel = adherence <= 90 ? 'Under budget' : adherence <= 100 ? 'On budget' : adherence <= 120 ? 'Slightly over budget' : 'Significantly over budget';
  }
  factors.push({ name: 'Budget Control', score: budgetScore, maxPoints: 15, label: budgetLabel });

  // 5. Runway (15 pts)
  let runwayScore = 0;
  let runwayLabel = 'Short runway';
  if (input.daysUntilPayday > 0) {
    const runwayRatio = input.runwayDays / input.daysUntilPayday;
    runwayScore = runwayRatio >= 1 ? 15 : runwayRatio >= 0.5 ? 10 : runwayRatio >= 0.25 ? 5 : 0;
    runwayLabel = runwayRatio >= 1 ? 'Sufficient runway' : runwayRatio >= 0.5 ? 'Moderate runway' : 'Short runway';
  } else if (input.runwayDays > 30) {
    runwayScore = 15;
    runwayLabel = 'Excellent runway';
  }
  factors.push({ name: 'Runway', score: runwayScore, maxPoints: 15, label: runwayLabel });

  // 6. Daily Discipline (15 pts)
  const disciplineScore = input.dailyUsagePercent <= 100 ? 15 : input.dailyUsagePercent <= 150 ? 8 : 0;
  const disciplineLabel = input.dailyUsagePercent <= 80 ? 'Excellent discipline' : input.dailyUsagePercent <= 100 ? 'Good discipline' : 'Overspending today';
  factors.push({ name: 'Daily Discipline', score: disciplineScore, maxPoints: 15, label: disciplineLabel });

  return {
    total: factors.reduce((sum, f) => sum + f.score, 0),
    factors
  };
}
