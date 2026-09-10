import { Transaction, Payroll, Debt, CategoryBudget } from '../types/index.js';
import { getCurrentFinancialMonth, getNextPayroll, isInFinancialMonth,  FinancialMonthBounds } from './financialMonth.js';

export interface FinancialEngineWalletInput {
  id: string;
  name: string;
  type: 'Bank' | 'Cash' | 'Savings' | string;
  isMain?: boolean;
  initialBalance?: string | number;
}

export interface FinancialEngineInput {
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  budgets: CategoryBudget[];
  userSettings: {
    emergencyBuffer: number;
    salary: number;
  };
  wallets?: FinancialEngineWalletInput[];
  now?: Date;
}

export function computeFinancialState(input: FinancialEngineInput) {
  const now = input.now || new Date();
  const toCalendarDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = toCalendarDay(now);
  const currentFm = getCurrentFinancialMonth(input.payrolls, now);

  const userWallets = input.wallets || [];
  const mainBank = userWallets.find(w => w.type === 'Bank' && w.isMain) || userWallets.find(w => w.type === 'Bank');
  const defaultCash = userWallets.find(w => w.type === 'Cash') || mainBank;

  // Track balances per wallet
  const walletBalances: { [key: string]: number } = {
    Bank: 0,
    Cash: 0,
    Savings: 0,
  };
  const openingWalletBalances: { [key: string]: number } = {
    Bank: 0,
    Cash: 0,
    Savings: 0,
  };

  // Initialize wallet balances with their initial balance
  for (const w of userWallets) {
    const initBal = parseFloat((w.initialBalance ?? '0') as string) || 0;
    walletBalances[w.id] = initBal;
    openingWalletBalances[w.id] = initBal;
  }

  let monthlyExpenses = 0;
  let monthlyIncome = 0;
  let dailySpent = 0;
  let todaysIncome = 0;
  let debtRepayments = 0;
  let reimbursements = 0;

  const isExpenseOutflow = (type: string) => type === 'Expense' || type === 'Debt Repayment';

  const applyTransaction = (tx: Transaction, balances: { [key: string]: number }) => {
    const amount = parseFloat(tx.amount as unknown as string);
    if (!Number.isFinite(amount)) return;

    // Determine the source wallet ID or key
    let sourceId: string;
    if (tx.walletId && (balances[tx.walletId] !== undefined || userWallets.length === 0)) {
      sourceId = tx.walletId;
    } else if (tx.sourceWallet === 'Cash' && defaultCash) {
      sourceId = defaultCash.id;
    } else if (tx.sourceWallet === 'Bank' && mainBank) {
      sourceId = mainBank.id;
    } else if (tx.sourceWallet) {
      sourceId = tx.sourceWallet;
    } else if (tx.walletId) {
      sourceId = tx.walletId;
    } else {
      sourceId = mainBank ? mainBank.id : 'Bank';
    }

    if (balances[sourceId] === undefined) {
      balances[sourceId] = 0;
    }

    if (tx.type === 'Income') {
      balances[sourceId] += amount;
    } else if (isExpenseOutflow(tx.type)) {
      balances[sourceId] -= amount;
    } else if (tx.type === 'Transfer') {
      // Determine destination wallet ID or key
      let destId = (tx as any).destinationWalletId || (tx as any).toWalletId;
      if (!destId || balances[destId] === undefined) {
        const fromIsBank = sourceId === 'Bank' || (mainBank && sourceId === mainBank.id);
        if (fromIsBank) {
          destId = defaultCash ? defaultCash.id : 'Cash';
        } else {
          destId = mainBank ? mainBank.id : 'Bank';
        }
      }
      if (balances[destId] === undefined) {
        balances[destId] = 0;
      }
      balances[sourceId] -= amount;
      balances[destId] += amount;
    }
  };

  const transactions = [...input.transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const tx of transactions) {
    const txAmount = parseFloat(tx.amount as unknown as string);
    const txDate = new Date(tx.createdAt);
    const transactionDay = toCalendarDay(txDate);

    if (transactionDay < today) {
      applyTransaction(tx, openingWalletBalances);
    }
    if (transactionDay <= today) {
      applyTransaction(tx, walletBalances);
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

  const emergencyBuffer = userWallets.length > 0
    ? userWallets.filter(w => w.type === 'Savings').reduce((sum, w) => sum + (walletBalances[w.id] || 0), 0)
    : walletBalances.Savings || 0;
  const totalLiquidity = userWallets.length > 0
    ? userWallets.reduce((sum, w) => sum + (walletBalances[w.id] || 0), 0)
    : (walletBalances.Bank || 0) + (walletBalances.Cash || 0) + (walletBalances.Savings || 0);
  const openingLiquidity = userWallets.length > 0
    ? userWallets.reduce((sum, w) => sum + (openingWalletBalances[w.id] || 0), 0)
    : (openingWalletBalances.Bank || 0) + (openingWalletBalances.Cash || 0) + (openingWalletBalances.Savings || 0);
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

  const safeToSpend = totalLiquidity - emergencyBuffer - pendingPayables;

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

  let bankBalance = 0;
  let cashOnHand = 0;
  if (userWallets.length > 0) {
    for (const w of userWallets) {
      const bal = walletBalances[w.id] || 0;
      if (w.type === 'Bank') bankBalance += bal;
      else if (w.type === 'Cash') cashOnHand += bal;
    }
    walletBalances.Bank = bankBalance;
    walletBalances.Cash = cashOnHand;
  } else {
    bankBalance = walletBalances.Bank || 0;
    cashOnHand = walletBalances.Cash || 0;
  }

  return {
    totalLiquidity,
    walletBalances,
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
  // Target is roughly 3x monthly expenses
  const targetBuffer = input.monthlyExpenses * 3 > 0 ? input.monthlyExpenses * 3 : 5000; // fallback target
  const bufferCoverage = Math.min(1, input.emergencyBuffer / targetBuffer);
  const bufferScore = Math.round(bufferCoverage * 20);
  const bufferLabel = bufferCoverage >= 1 ? 'Buffer fully funded (3x expenses)' : bufferCoverage >= 0.3 ? 'Buffer partially funded' : 'Buffer needs funding';
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
