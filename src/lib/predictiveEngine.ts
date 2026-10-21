import {
  CategoryBudget,
  Debt,
  FinancialContext,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Subscription,
  Transaction,
} from '../types';
import { getCurrentFinancialMonth } from './financialMonth';
import { isInMonth, netExpenseOf } from './finance';

export interface WhatIfScenarioParams {
  discretionaryCutPercent: number; // 0 to 50
  extraMonthlyDcaMad: number; // 0 to 10000
  oneTimeShockMad: number; // e.g. -3000 for purchase, +3000 for windfall
  incomeDeltaMad: number; // e.g. +1500 raise
  cancelReviewingSubs: boolean;
}

export interface DailyCashFlowPoint {
  date: string;
  label: string;
  dayOffset: number;
  projectedLiquidity: number;
  baselineLiquidity: number;
  safeFloor: number;
  inflow: number;
  outflow: number;
  events: string[];
  isPinchPoint: boolean;
}

export interface HorizonTrajectoryPoint {
  monthOffset: number;
  monthLabel: string;
  dateIso: string;
  baselineNetWorth: number;
  simulatedNetWorth: number;
  optimisticNetWorth: number;
  conservativeNetWorth: number;
  projectedLiquidity: number;
  projectedPortfolioMad: number;
  cumulativePassiveIncomeMad: number;
}

export interface CategoryBurnPrediction {
  category: string;
  budgetCap: number;
  spentSoFar: number;
  dailyVelocity: number;
  projectedEndOfCycle: number;
  projectedVariance: number; // positive = overrun, negative = under budget
  percentUsed: number;
  projectedPercent: number;
  daysUntilExhaustion: number | null; // null if won't exhaust or no cap
  exhaustionDateLabel: string | null;
  status: 'safe' | 'watch' | 'breach_imminent' | 'breached';
}

export interface GoalEtaPrediction {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercent: number;
  deadline: string | null;
  baselineMonthsToComplete: number | null;
  simulatedMonthsToComplete: number | null;
  baselineEtaLabel: string;
  simulatedEtaLabel: string;
  monthsSaved: number;
  onTrackForDeadline: boolean;
}

export interface PredictiveSignal {
  id: string;
  severity: 'positive' | 'warning' | 'critical' | 'info';
  domain: 'Liquidity' | 'Budgets' | 'Subscriptions' | 'Investments' | 'Goals' | 'Debts' | 'Seasonality';
  title: string;
  detail: string;
  impactMad: number;
  actionTab:
    | 'overview'
    | 'budgets'
    | 'subscriptions'
    | 'goals'
    | 'debts'
    | 'calendar'
    | 'transactions';
  actionLabel: string;
}

export interface DayOfWeekPattern {
  dayIndex: number;
  dayName: string;
  shortName: string;
  avgSpendMad: number;
  relativeMultiplier: number; // 1.0 = average day
  txCount: number;
}

export interface HolisticForecastReport {
  // Core Baseline & Simulated Summaries
  currentLiquidity: number;
  currentPortfolioMad: number;
  currentNetWorth: number;
  monthlyIncomeBaseline: number;
  monthlyFixedSubsBurn: number;
  monthlyVariableBurn: number;
  monthlyDcaCommitment: number;
  monthlyNetSavingsBaseline: number;
  monthlyNetSavingsSimulated: number;
  savingsRateBaseline: number;
  savingsRateSimulated: number;

  // Horizon Milestones
  projectedNetWorth30d: number;
  projectedNetWorth90d: number;
  projectedNetWorth6m: number;
  projectedNetWorth12m: number;
  projectedNetWorth24m: number;
  simulatedNetWorth12m: number;
  netWorthDelta12mFromWhatIf: number;

  // Cash Runway & Pinch Points
  survivalRunwayDays: number;
  lowest30dBalance: number;
  lowest30dDateLabel: string;
  hasLiquidityPinchBeforePayday: boolean;

  // Detailed Series
  dailyCashFlow30d: DailyCashFlowPoint[];
  horizonTrajectory24m: HorizonTrajectoryPoint[];
  categoryPredictions: CategoryBurnPrediction[];
  goalPredictions: GoalEtaPrediction[];
  dayOfWeekPatterns: DayOfWeekPattern[];
  signals: PredictiveSignal[];

  // Data Coverage Telemetry
  dataPointsAnalyzed: {
    transactions: number;
    wallets: number;
    budgets: number;
    subscriptions: number;
    debts: number;
    goals: number;
    holdings: number;
    contexts: number;
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function computeHolisticForecast(params: {
  kpis: KPI | null;
  transactions: Transaction[];
  payrolls: Payroll[];
  budgets: CategoryBudget[];
  subscriptions: Subscription[];
  debts: Debt[];
  goals: Goal[];
  investmentsData?: InvestmentsData | null;
  contexts: FinancialContext[];
  whatIf?: WhatIfScenarioParams;
}): HolisticForecastReport {
  const {
    kpis,
    transactions = [],
    payrolls = [],
    budgets = [],
    subscriptions = [],
    debts = [],
    goals = [],
    investmentsData = null,
    contexts = [],
    whatIf = {
      discretionaryCutPercent: 0,
      extraMonthlyDcaMad: 0,
      oneTimeShockMad: 0,
      incomeDeltaMad: 0,
      cancelReviewingSubs: false,
    },
  } = params;

  const now = new Date();
  const currentFm = getCurrentFinancialMonth(payrolls);
  const year = currentFm?.year ?? now.getFullYear();
  const month = currentFm?.month ?? now.getMonth() + 1;

  // 1. Current Balances & Net Worth
  const currentLiquidity = kpis?.totalLiquidity ?? 0;
  const currentPortfolioMad = investmentsData?.totalPortfolioValueMad ?? 0;
  const pendingReceivables = debts
    .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
    .reduce((s, d) => s + (parseFloat(d.remainingBalance) || 0), 0);
  const pendingPayables = debts
    .filter((d) => d.type === 'Payable' && d.status === 'Pending')
    .reduce((s, d) => s + (parseFloat(d.remainingBalance) || 0), 0);

  const currentNetWorth =
    currentLiquidity + currentPortfolioMad + pendingReceivables - pendingPayables;

  // 2. Monthly Income Baseline (from salary, recent payrolls, or monthly income KPI)
  const recentPayrollAmounts = payrolls
    .slice()
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime())
    .slice(0, 3)
    .map((p) => parseFloat(p.amount) || 0)
    .filter((v) => v > 0);

  const avgPayroll =
    recentPayrollAmounts.length > 0
      ? recentPayrollAmounts.reduce((a, b) => a + b, 0) / recentPayrollAmounts.length
      : 0;

  const monthlyIncomeBaseline =
    (kpis?.salary && kpis.salary > 0 ? kpis.salary : 0) ||
    avgPayroll ||
    (kpis?.monthlyIncome && kpis.monthlyIncome > 0 ? kpis.monthlyIncome : 6000);

  // 3. Subscriptions Burn
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const normalizeSubMonthly = (s: Subscription) => {
    const amt = parseFloat(s.amount) || 0;
    const rate =
      s.currency === 'USD'
        ? investmentsData?.rates?.USD_TO_MAD || 10
        : s.currency === 'EUR'
        ? investmentsData?.rates?.EUR_TO_MAD || 10.8
        : 1;
    const amtMad = amt * rate;
    if (s.billingCycle === 'yearly') return amtMad / 12;
    if (s.billingCycle === 'quarterly') return amtMad / 3;
    if (s.billingCycle === 'weekly') return (amtMad * 52) / 12;
    return amtMad;
  };

  const monthlyFixedSubsBurn = activeSubs.reduce((sum, s) => sum + normalizeSubMonthly(s), 0);
  const optionalSubsSavings = whatIf.cancelReviewingSubs ? monthlyFixedSubsBurn * 0.35 : 0;

  // 4. Historical Daily Velocity & Day-of-Week Seasonality (last 90 days)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
  const recentExpenses = transactions.filter((t) => {
    if (t.type !== 'Expense') return false;
    const d = new Date(t.createdAt);
    return d >= ninetyDaysAgo && d <= now;
  });

  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];

  for (const tx of recentExpenses) {
    const d = new Date(tx.createdAt);
    const dow = d.getDay();
    dowTotals[dow] += netExpenseOf(tx);
    dowCounts[dow] += 1;
  }

  // Count how many of each weekday occurred in the last 90 days (~12.85)
  const weeksInWindow = Math.max(1, recentExpenses.length > 0 ? 12.85 : 4);
  const rawDowAvgs = dowTotals.map((tot) => tot / weeksInWindow);
  const overallDowMean =
    rawDowAvgs.reduce((a, b) => a + b, 0) / 7 || (kpis?.avgDailySpend ?? 120);

  const dayOfWeekPatterns: DayOfWeekPattern[] = DAY_NAMES.map((name, i) => {
    const avg = rawDowAvgs[i] > 0 ? rawDowAvgs[i] : overallDowMean;
    const mult = overallDowMean > 0 ? avg / overallDowMean : 1;
    return {
      dayIndex: i,
      dayName: name,
      shortName: SHORT_DAYS[i],
      avgSpendMad: avg,
      relativeMultiplier: Math.max(0.4, Math.min(2.2, mult)),
      txCount: dowCounts[i],
    };
  });

  // Current cycle daily burn velocity
  const elapsedDays = Math.max(1, kpis?.forecast?.elapsedDays || 15);
  const totalCycleDays = Math.max(28, kpis?.forecast?.totalDays || 30);
  const daysRemainingInCycle = Math.max(0, kpis?.forecast?.daysRemaining ?? totalCycleDays - elapsedDays);

  const cycleExpenses = transactions.filter(
    (t) => t.type === 'Expense' && currentFm && isInMonth(t, year, month, payrolls)
  );
  const cycleSpendSoFar = cycleExpenses.reduce((s, t) => s + netExpenseOf(t), 0);

  const weightedDailyBurn =
    kpis?.avgDailySpend && kpis.avgDailySpend > 0
      ? kpis.avgDailySpend * 0.65 + overallDowMean * 0.35
      : cycleSpendSoFar / elapsedDays || overallDowMean || 110;

  const monthlyVariableBurn = Math.max(
    0,
    weightedDailyBurn * 30 - monthlyFixedSubsBurn
  );

  // 5. DCA & Investment Return Assumptions
  const monthlyDcaCommitment =
    investmentsData?.safeToInvest?.currentMonthlyDcaTarget ||
    (investmentsData?.dcaPlans || [])
      .filter((p) => p.status === 'active')
      .reduce((s, p) => s + (parseFloat(p.targetAmount) || 0), 0);

  const annualDividendIncomeMad = investmentsData?.annualPassiveIncomeMad || 0;
  const monthlyPassiveIncomeMad = annualDividendIncomeMad / 12;

  // Planned active contexts unspent budget
  const activeContextsCommitted = contexts
    .filter((c) => c.status === 'Active' || c.status === 'Planned')
    .reduce((s, c) => s + (parseFloat(c.budget || '0') || 0), 0);

  // Baseline vs Simulated Monthly Net Cash Flow
  const totalBaselineMonthlyOutflow = monthlyVariableBurn + monthlyFixedSubsBurn;
  const monthlyNetSavingsBaseline =
    monthlyIncomeBaseline + monthlyPassiveIncomeMad - totalBaselineMonthlyOutflow;

  const simulatedVariableBurn =
    monthlyVariableBurn * (1 - whatIf.discretionaryCutPercent / 100);
  const simulatedFixedBurn = Math.max(0, monthlyFixedSubsBurn - optionalSubsSavings);
  const simulatedIncome = monthlyIncomeBaseline + whatIf.incomeDeltaMad;

  const monthlyNetSavingsSimulated =
    simulatedIncome +
    monthlyPassiveIncomeMad -
    (simulatedVariableBurn + simulatedFixedBurn);

  const savingsRateBaseline =
    monthlyIncomeBaseline > 0
      ? (monthlyNetSavingsBaseline / monthlyIncomeBaseline) * 100
      : 0;
  const savingsRateSimulated =
    simulatedIncome > 0 ? (monthlyNetSavingsSimulated / simulatedIncome) * 100 : 0;

  // 6. Category Burn & Breach Radar
  const currentMonthBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const categorySpendMap: Record<string, number> = {};
  for (const tx of cycleExpenses) {
    const cat = tx.category || 'Uncategorized';
    categorySpendMap[cat] = (categorySpendMap[cat] || 0) + netExpenseOf(tx);
  }

  const allCategories = Array.from(
    new Set([
      ...currentMonthBudgets.map((b) => b.category),
      ...Object.keys(categorySpendMap),
    ])
  );

  const categoryPredictions: CategoryBurnPrediction[] = allCategories
    .map((category) => {
      const budgetObj = currentMonthBudgets.find((b) => b.category === category);
      const budgetCap = budgetObj ? parseFloat(budgetObj.amount) || 0 : 0;
      const spentSoFar = categorySpendMap[category] || 0;
      const dailyVelocity = spentSoFar / elapsedDays;
      const projectedEndOfCycle =
        spentSoFar +
        dailyVelocity *
          daysRemainingInCycle *
          (1 - whatIf.discretionaryCutPercent / 100);
      const projectedVariance = budgetCap > 0 ? projectedEndOfCycle - budgetCap : 0;
      const percentUsed = budgetCap > 0 ? (spentSoFar / budgetCap) * 100 : 0;
      const projectedPercent =
        budgetCap > 0 ? (projectedEndOfCycle / budgetCap) * 100 : 0;

      let daysUntilExhaustion: number | null = null;
      let exhaustionDateLabel: string | null = null;

      if (budgetCap > 0) {
        if (spentSoFar >= budgetCap) {
          daysUntilExhaustion = 0;
          exhaustionDateLabel = 'Already exhausted';
        } else if (dailyVelocity > 0) {
          const remainingCap = budgetCap - spentSoFar;
          const dLeft = Math.ceil(remainingCap / dailyVelocity);
          if (dLeft <= daysRemainingInCycle) {
            daysUntilExhaustion = dLeft;
            const exhaustDate = new Date(now.getTime() + dLeft * 86400000);
            exhaustionDateLabel = exhaustDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
          }
        }
      }

      let status: CategoryBurnPrediction['status'] = 'safe';
      if (budgetCap > 0) {
        if (spentSoFar >= budgetCap) status = 'breached';
        else if (projectedEndOfCycle > budgetCap * 1.02) status = 'breach_imminent';
        else if (projectedEndOfCycle > budgetCap * 0.88) status = 'watch';
      }

      return {
        category,
        budgetCap,
        spentSoFar,
        dailyVelocity,
        projectedEndOfCycle,
        projectedVariance,
        percentUsed,
        projectedPercent,
        daysUntilExhaustion,
        exhaustionDateLabel,
        status,
      };
    })
    .filter((c) => c.budgetCap > 0 || c.spentSoFar > 0)
    .sort((a, b) => {
      const score = (s: CategoryBurnPrediction['status']) =>
        s === 'breached' ? 4 : s === 'breach_imminent' ? 3 : s === 'watch' ? 2 : 1;
      if (score(b.status) !== score(a.status)) return score(b.status) - score(a.status);
      return b.projectedEndOfCycle - a.projectedEndOfCycle;
    });

  // 7. Day-by-Day 30-Day Forward Cash Flow & Liquidity Stress Simulation
  const emergencyFloor = kpis?.emergencyBuffer ?? 1000;
  const dailyCashFlow30d: DailyCashFlowPoint[] = [];
  let runningBaseline = currentLiquidity;
  let runningSimulated = currentLiquidity + whatIf.oneTimeShockMad;
  let lowest30dBalance = runningSimulated;
  let lowest30dDateLabel = 'Today';
  let hasLiquidityPinchBeforePayday = false;

  const paydayDayOfMonth = kpis?.payday || 25;

  for (let d = 0; d <= 30; d++) {
    const targetDate = new Date(now.getTime() + d * 86400000);
    const dateIso = targetDate.toISOString().slice(0, 10);
    const dayOfMonth = targetDate.getDate();
    const dow = targetDate.getDay();
    const label =
      d === 0
        ? 'Today'
        : targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const events: string[] = [];
    let dayInflow = 0;
    let dayFixedOutflow = 0;

    if (d > 0) {
      // Check Payday
      const matchingScheduledPayroll = payrolls.find(
        (p) => p.scheduledFor && p.scheduledFor.slice(0, 10) === dateIso
      );
      if (matchingScheduledPayroll) {
        const payAmt = parseFloat(matchingScheduledPayroll.amount) || monthlyIncomeBaseline;
        dayInflow += payAmt + whatIf.incomeDeltaMad;
        events.push(`Payday (+${(payAmt + whatIf.incomeDeltaMad).toFixed(0)} MAD)`);
      } else if (dayOfMonth === paydayDayOfMonth) {
        dayInflow += monthlyIncomeBaseline + whatIf.incomeDeltaMad;
        events.push(`Projected Salary (+${(monthlyIncomeBaseline + whatIf.incomeDeltaMad).toFixed(0)} MAD)`);
      }

      // Check Subscriptions billing on this date or day-of-month
      for (const sub of activeSubs) {
        if (sub.nextBillingDate && sub.nextBillingDate.slice(0, 10) === dateIso) {
          const cost = normalizeSubMonthly(sub);
          dayFixedOutflow += cost;
          events.push(`${sub.name} (−${cost.toFixed(0)} MAD)`);
        } else if (!sub.nextBillingDate && sub.createdAt) {
          const createdDay = new Date(sub.createdAt).getDate();
          if (createdDay === dayOfMonth && sub.billingCycle === 'monthly') {
            const cost = normalizeSubMonthly(sub);
            dayFixedOutflow += cost;
            events.push(`${sub.name} (−${cost.toFixed(0)} MAD)`);
          }
        }
      }

      // Check Debts due on this date
      for (const debt of debts) {
        if (debt.status === 'Pending' && debt.dueDate && debt.dueDate.slice(0, 10) === dateIso) {
          const rem = parseFloat(debt.remainingBalance) || 0;
          if (debt.type === 'Payable') {
            dayFixedOutflow += rem;
            events.push(`Debt Due: ${debt.contactName} (−${rem.toFixed(0)} MAD)`);
          } else {
            dayInflow += rem;
            events.push(`Receivable Due: ${debt.contactName} (+${rem.toFixed(0)} MAD)`);
          }
        }
      }

      // Daily variable spend modulated by day-of-week multiplier
      const dowMult = dayOfWeekPatterns[dow]?.relativeMultiplier ?? 1;
      const baseDailyVar = (monthlyVariableBurn / 30) * dowMult;
      const simDailyVar = baseDailyVar * (1 - whatIf.discretionaryCutPercent / 100);

      runningBaseline = runningBaseline + dayInflow - dayFixedOutflow - baseDailyVar;
      runningSimulated = runningSimulated + dayInflow - dayFixedOutflow - simDailyVar;
    }

    if (runningSimulated < lowest30dBalance) {
      lowest30dBalance = runningSimulated;
      lowest30dDateLabel = label;
    }

    const isPinchPoint = runningSimulated < emergencyFloor;
    if (isPinchPoint && d <= (kpis?.daysUntilPayday || 15)) {
      hasLiquidityPinchBeforePayday = true;
    }

    dailyCashFlow30d.push({
      date: dateIso,
      label,
      dayOffset: d,
      projectedLiquidity: Math.round(runningSimulated),
      baselineLiquidity: Math.round(runningBaseline),
      safeFloor: Math.round(emergencyFloor),
      inflow: Math.round(dayInflow),
      outflow: Math.round(dayFixedOutflow + (d > 0 ? monthlyVariableBurn / 30 : 0)),
      events,
      isPinchPoint,
    });
  }

  // 8. Multi-Horizon 24-Month Wealth & Net Worth Trajectory
  const horizonTrajectory24m: HorizonTrajectoryPoint[] = [];
  let baseCash = currentLiquidity;
  let simCash = currentLiquidity + whatIf.oneTimeShockMad;
  let basePortfolio = currentPortfolioMad;
  let simPortfolio = currentPortfolioMad;
  let optPortfolio = currentPortfolioMad;
  let consPortfolio = currentPortfolioMad;
  let optCash = currentLiquidity + whatIf.oneTimeShockMad;
  let consCash = currentLiquidity + whatIf.oneTimeShockMad;
  let cumulativePassive = 0;

  // Monthly investment compound rates
  const expectedMonthlyRate = 0.085 / 12; // 8.5% p.a.
  const optimisticMonthlyRate = 0.14 / 12; // 14% p.a.
  const conservativeMonthlyRate = 0.035 / 12; // 3.5% p.a.

  const effectiveDividendYieldAnnual =
    currentPortfolioMad > 0 && annualDividendIncomeMad > 0
      ? annualDividendIncomeMad / currentPortfolioMad
      : 0.028;

  for (let m = 0; m <= 24; m++) {
    const pointDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const monthLabel =
      m === 0
        ? 'Now'
        : pointDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    if (m > 0) {
      const totalSimDca = monthlyDcaCommitment + whatIf.extraMonthlyDcaMad;

      // Baseline step
      const baseCashAfterDca = baseCash + monthlyNetSavingsBaseline - monthlyDcaCommitment;
      basePortfolio = basePortfolio * (1 + expectedMonthlyRate) + monthlyDcaCommitment;
      baseCash = baseCashAfterDca;

      // Simulated step
      const monthDiv = simPortfolio * (effectiveDividendYieldAnnual / 12);
      cumulativePassive += monthDiv;
      simCash = simCash + monthlyNetSavingsSimulated - totalSimDca;
      simPortfolio = simPortfolio * (1 + expectedMonthlyRate) + totalSimDca + monthDiv;

      // Optimistic Band (+10% savings efficiency + 14% market return)
      optCash = optCash + monthlyNetSavingsSimulated * 1.12 - totalSimDca;
      optPortfolio = optPortfolio * (1 + optimisticMonthlyRate) + totalSimDca * 1.05;

      // Conservative Band (-12% unexpected expenses + 3.5% market return)
      consCash = consCash + monthlyNetSavingsSimulated * 0.82 - totalSimDca;
      consPortfolio = consPortfolio * (1 + conservativeMonthlyRate) + totalSimDca;
    }

    const netDebtOffset = pendingReceivables - pendingPayables - (m > 0 ? activeContextsCommitted * Math.min(1, m / 6) : 0);

    horizonTrajectory24m.push({
      monthOffset: m,
      monthLabel,
      dateIso: pointDate.toISOString().slice(0, 10),
      baselineNetWorth: Math.round(baseCash + basePortfolio + netDebtOffset),
      simulatedNetWorth: Math.round(simCash + simPortfolio + netDebtOffset),
      optimisticNetWorth: Math.round(optCash + optPortfolio + netDebtOffset),
      conservativeNetWorth: Math.round(consCash + consPortfolio + netDebtOffset),
      projectedLiquidity: Math.round(simCash),
      projectedPortfolioMad: Math.round(simPortfolio),
      cumulativePassiveIncomeMad: Math.round(cumulativePassive),
    });
  }

  const projectedNetWorth30d = horizonTrajectory24m[1]?.simulatedNetWorth ?? currentNetWorth;
  const projectedNetWorth90d = horizonTrajectory24m[3]?.simulatedNetWorth ?? currentNetWorth;
  const projectedNetWorth6m = horizonTrajectory24m[6]?.simulatedNetWorth ?? currentNetWorth;
  const projectedNetWorth12m = horizonTrajectory24m[12]?. baselineNetWorth ?? currentNetWorth;
  const projectedNetWorth24m = horizonTrajectory24m[24]?.simulatedNetWorth ?? currentNetWorth;
  const simulatedNetWorth12m = horizonTrajectory24m[12]?.simulatedNetWorth ?? currentNetWorth;
  const netWorthDelta12mFromWhatIf = simulatedNetWorth12m - projectedNetWorth12m;

  // 9. Goal Completion ETA Forecaster
  const positiveBaseSurplus = Math.max(250, monthlyNetSavingsBaseline * 0.5);
  const positiveSimSurplus = Math.max(
    250,
    monthlyNetSavingsSimulated * 0.5 +
      (monthlyVariableBurn * (whatIf.discretionaryCutPercent / 100))
  );

  const goalPredictions: GoalEtaPrediction[] = goals.map((g) => {
    const targetAmount = parseFloat(g.targetAmount) || 0;
    const currentAmount = parseFloat(g.currentAmount) || 0;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);
    const progressPercent =
      targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 100;

    if (remainingAmount <= 0) {
      return {
        id: g.id,
        name: g.name,
        category: g.category || 'General',
        targetAmount,
        currentAmount,
        remainingAmount: 0,
        progressPercent: 100,
        deadline: g.deadline || null,
        baselineMonthsToComplete: 0,
        simulatedMonthsToComplete: 0,
        baselineEtaLabel: 'Completed',
        simulatedEtaLabel: 'Completed',
        monthsSaved: 0,
        onTrackForDeadline: true,
      };
    }

    // Allocate proportional share of monthly surplus per goal
    const goalShareFactor = 1 / Math.max(1, goals.length);
    const baseMonthlyAlloc = Math.max(200, positiveBaseSurplus * goalShareFactor);
    const simMonthlyAlloc = Math.max(200, positiveSimSurplus * goalShareFactor);

    const baseMonths = Math.ceil(remainingAmount / baseMonthlyAlloc);
    const simMonths = Math.ceil(remainingAmount / simMonthlyAlloc);

    const baseDate = new Date(now.getFullYear(), now.getMonth() + baseMonths, 1);
    const simDate = new Date(now.getFullYear(), now.getMonth() + simMonths, 1);

    let onTrack = true;
    if (g.deadline) {
      const deadlineDate = new Date(g.deadline);
      onTrack = simDate <= deadlineDate;
    }

    return {
      id: g.id,
      name: g.name,
      category: g.category || 'Savings',
      targetAmount,
      currentAmount,
      remainingAmount,
      progressPercent,
      deadline: g.deadline || null,
      baselineMonthsToComplete: baseMonths,
      simulatedMonthsToComplete: simMonths,
      baselineEtaLabel: baseDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      simulatedEtaLabel: simDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      monthsSaved: Math.max(0, baseMonths - simMonths),
      onTrackForDeadline: onTrack,
    };
  });

  // 10. Survival Runway Days (how long current liquidity lasts at current burn with 0 new income)
  const totalDailyBurn = Math.max(1, (simulatedVariableBurn + simulatedFixedBurn) / 30);
  const survivalRunwayDays = Math.max(
    0,
    Math.round((currentLiquidity + whatIf.oneTimeShockMad) / totalDailyBurn)
  );

  // 11. Cross-Domain Predictive Signals
  const signals: PredictiveSignal[] = [];

  // Signal A: Category Breach Warnings
  const breachingCats = categoryPredictions.filter(
    (c) => c.status === 'breached' || c.status === 'breach_imminent'
  );
  if (breachingCats.length > 0) {
    const topCat = breachingCats[0];
    signals.push({
      id: 'sig-cat-breach',
      severity: topCat.status === 'breached' ? 'critical' : 'warning',
      domain: 'Budgets',
      title: `${topCat.category} projected to ${
        topCat.status === 'breached' ? 'exceed' : 'breach'
      } budget by +${Math.max(0, topCat.projectedVariance).toFixed(0)} MAD`,
      detail: topCat.exhaustionDateLabel
        ? `At ${topCat.dailyVelocity.toFixed(1)} MAD/day velocity, this category cap exhausts around ${topCat.exhaustionDateLabel}.`
        : `Projected cycle total is ${topCat.projectedEndOfCycle.toFixed(0)} MAD vs ${topCat.budgetCap.toFixed(0)} MAD budget.`,
      impactMad: -Math.abs(topCat.projectedVariance),
      actionTab: 'budgets',
      actionLabel: 'Rebalance Budgets',
    });
  }

  // Signal B: Liquidity Pinch Detection
  if (hasLiquidityPinchBeforePayday) {
    signals.push({
      id: 'sig-liquidity-pinch',
      severity: 'critical',
      domain: 'Liquidity',
      title: `Liquidity dips below emergency buffer around ${lowest30dDateLabel}`,
      detail: `Forward 30-day cash flow shows balance reaching ${lowest30dBalance.toFixed(0)} MAD (below ${emergencyFloor.toFixed(0)} MAD buffer) before next payday.`,
      impactMad: lowest30dBalance - emergencyFloor,
      actionTab: 'calendar',
      actionLabel: 'Inspect Cash Flow',
    });
  } else {
    signals.push({
      id: 'sig-liquidity-healthy',
      severity: 'positive',
      domain: 'Liquidity',
      title: `30-day cash trajectory stays +${Math.max(0, lowest30dBalance - emergencyFloor).toFixed(0)} MAD above safety floor`,
      detail: `Lowest projected balance over the next 30 days is ${lowest30dBalance.toFixed(0)} MAD on ${lowest30dDateLabel}, maintaining a ${survivalRunwayDays}-day survival runway.`,
      impactMad: Math.max(0, lowest30dBalance - emergencyFloor),
      actionTab: 'calendar',
      actionLabel: 'View Calendar',
    });
  }

  // Signal C: Peak Day-of-Week Seasonality
  const sortedDow = [...dayOfWeekPatterns].sort((a, b) => b.avgSpendMad - a.avgSpendMad);
  if (sortedDow[0] && sortedDow[0].relativeMultiplier > 1.2) {
    signals.push({
      id: 'sig-dow-seasonality',
      severity: 'info',
      domain: 'Seasonality',
      title: `${sortedDow[0].dayName}s are your highest-velocity spend days (${sortedDow[0].relativeMultiplier.toFixed(1)}x average)`,
      detail: `Historical transaction cadence shows an average of ${sortedDow[0].avgSpendMad.toFixed(0)} MAD spent on ${sortedDow[0].dayName}s vs ${sortedDow[6].avgSpendMad.toFixed(0)} MAD on ${sortedDow[6].dayName}s.`,
      impactMad: -(sortedDow[0].avgSpendMad - overallDowMean) * 4,
      actionTab: 'transactions',
      actionLabel: 'Review History',
    });
  }

  // Signal D: Investment & Compounding Trajectory
  const wealthGain12m = simulatedNetWorth12m - currentNetWorth;
  signals.push({
    id: 'sig-wealth-12m',
    severity: wealthGain12m >= 0 ? 'positive' : 'warning',
    domain: 'Investments',
    title: `12-Month Net Worth projected at ${simulatedNetWorth12m.toLocaleString()} MAD (${
      wealthGain12m >= 0 ? '+' : ''
    }${wealthGain12m.toFixed(0)} MAD)`,
    detail: `Combines ${monthlyNetSavingsSimulated.toFixed(0)} MAD/mo projected net savings, ${(
      monthlyDcaCommitment + whatIf.extraMonthlyDcaMad
    ).toFixed(0)} MAD/mo DCA contributions, and portfolio compounding.`,
    impactMad: wealthGain12m,
    actionTab: 'goals',
    actionLabel: 'Open Goals Hub',
  });

  // Signal E: Subscriptions Load
  if (monthlyFixedSubsBurn > 0) {
    signals.push({
      id: 'sig-subs-burn',
      severity: monthlyFixedSubsBurn > monthlyIncomeBaseline * 0.12 ? 'warning' : 'info',
      domain: 'Subscriptions',
      title: `Recurring subscriptions lock ${ (monthlyFixedSubsBurn * 12).toFixed(0) } MAD/year (${((monthlyFixedSubsBurn / Math.max(1, monthlyIncomeBaseline)) * 100).toFixed(1)}% of income)`,
      detail: `${activeSubs.length} active subscriptions cost ${monthlyFixedSubsBurn.toFixed(0)} MAD every month before discretionary spending begins.`,
      impactMad: -(monthlyFixedSubsBurn * 12),
      actionTab: 'subscriptions',
      actionLabel: 'Audit Subscriptions',
    });
  }

  // Signal F: Pending Receivables / Payables
  if (pendingReceivables > 0 || pendingPayables > 0) {
    signals.push({
      id: 'sig-debts-net',
      severity: pendingPayables > pendingReceivables ? 'warning' : 'positive',
      domain: 'Debts',
      title:
        pendingReceivables >= pendingPayables
          ? `+${pendingReceivables.toFixed(0)} MAD in pending receivables awaiting collection`
          : `${pendingPayables.toFixed(0)} MAD in pending payables scheduled for settlement`,
      detail: `Settling active debt positions shifts liquid net worth by ${(
        pendingReceivables - pendingPayables
      ).toFixed(0)} MAD.`,
      impactMad: pendingReceivables - pendingPayables,
      actionTab: 'debts',
      actionLabel: 'Manage Debts',
    });
  }

  return {
    currentLiquidity,
    currentPortfolioMad,
    currentNetWorth,
    monthlyIncomeBaseline,
    monthlyFixedSubsBurn,
    monthlyVariableBurn,
    monthlyDcaCommitment,
    monthlyNetSavingsBaseline,
    monthlyNetSavingsSimulated,
    savingsRateBaseline,
    savingsRateSimulated,
    projectedNetWorth30d,
    projectedNetWorth90d,
    projectedNetWorth6m,
    projectedNetWorth12m,
    projectedNetWorth24m,
    simulatedNetWorth12m,
    netWorthDelta12mFromWhatIf,
    survivalRunwayDays,
    lowest30dBalance,
    lowest30dDateLabel,
    hasLiquidityPinchBeforePayday,
    dailyCashFlow30d,
    horizonTrajectory24m,
    categoryPredictions,
    goalPredictions,
    dayOfWeekPatterns,
    signals,
    dataPointsAnalyzed: {
      transactions: transactions.length,
      wallets: kpis?.accounts?.length ?? 0,
      budgets: budgets.length,
      subscriptions: subscriptions.length,
      debts: debts.length,
      goals: goals.length,
      holdings: investmentsData?.holdings?.length ?? 0,
      contexts: contexts.length,
    },
  };
}
