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
import { getCurrentFinancialMonth, getFinancialPeriods } from './financialMonth';
import {
  getProjectContextIds,
  isInMonth,
  isLivingExpense,
  isWealthAllocationCategory,
  netExpenseOf,
} from './finance';
import { normalizeCategory } from './categories';

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
  forecastMethod?: 'daily_cadence' | 'lump_sum' | 'historical_prior';
  txCount?: number;
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
  unlockedByWhatIf?: boolean;
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
    | 'investments'
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
  operatingLiquidity: number;
  protectedSavingsReserve: number;
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

  // Forecast Calibration, Assumption Transparency & Data Freshness
  calibrationAndFreshness?: {
    historyDaysAvailable: number;
    completedCyclesUsed: number;
    reliabilityScorePercent: number;
    reliabilityLabel: 'High (90+ days)' | 'Moderate (30–89 days)' | 'Low (<30 days)';
    confirmedInflowsCount: number;
    estimatedInflowsCount: number;
    keyAssumptions: string[];
    calibrationVariancePercent: number;
    freshnessStatus: 'live' | 'cached' | 'stale';
    computedAtIso: string;
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const LUMP_SUM_CATEGORY_KEYWORDS = [
  'home, tech',
  'equipment',
  'electronics',
  'housing',
  'rent',
  'loyer',
  'utilities',
  'clothing',
  'apparel',
  'health',
  'medical',
  'travel',
  'vacation',
  'education',
  'gift',
  'donation',
  'debt',
  'obligation',
  'insurance',
  'assurance',
  'maintenance',
  'repair',
  'furniture',
];

function isLumpSumCategory(category: string): boolean {
  const lower = normalizeCategory(category).toLowerCase();
  return LUMP_SUM_CATEGORY_KEYWORDS.some((kw) => lower.includes(kw));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function trimmedMean(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length <= 2) return values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = values.slice().sort((a, b) => a - b);
  const trimCount = values.length >= 5 ? 1 : 0;
  const sliced = trimCount > 0 ? sorted.slice(trimCount, sorted.length - trimCount) : sorted;
  return sliced.reduce((a, b) => a + b, 0) / sliced.length;
}

export const toIsoDateStr = (val: string | Date | null | undefined): string => {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val.toISOString().slice(0, 10);
  try {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

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
  userSettings?: {
    salary?: number | string;
    payday?: number;
    emergencyBuffer?: number | string;
  } | null;
  whatIf?: WhatIfScenarioParams;
  nowOverride?: Date;
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
    nowOverride,
  } = params;

  const now = nowOverride ? new Date(nowOverride.getTime()) : new Date();
  const currentFm = getCurrentFinancialMonth(payrolls, now);
  const year = currentFm?.year ?? now.getFullYear();
  const month = currentFm?.month ?? now.getMonth() + 1;

  const wallets = (kpis?.accounts || []).map((a) => ({ id: a.id, type: a.type }));
  const projectContextIds = getProjectContextIds(contexts);

  const isRecurringLivingTx = (tx: Transaction): boolean => {
    if (!isLivingExpense(tx, wallets)) return false;
    if (tx.contextId && projectContextIds.has(tx.contextId)) return false;
    return true;
  };

  // 1. Current Balances & Net Worth (strictly reconciled with zero double-counting)
  const currentLiquidity = Math.round(kpis?.totalLiquidity ?? 0);
  const investmentReserveMad = Math.round(kpis?.investmentReserve ?? 0);
  const nonInvestmentLiquidity = Math.max(0, (kpis?.totalLiquidity ?? 0) - (kpis?.investmentReserve ?? 0));
  const rawPortfolioMad = investmentsData?.totalPortfolioValueMad ?? 0;
  const currentPortfolioMad = rawPortfolioMad > 0 ? rawPortfolioMad : investmentReserveMad;
  const protectedSavingsReserve = Math.round(kpis?.emergencyBuffer ?? 0);
  const operatingLiquidity = Math.round(Math.max(0, nonInvestmentLiquidity - protectedSavingsReserve));

  const pendingReceivables = debts
    .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
    .reduce((s, d) => s + (parseFloat(d.remainingBalance) || 0), 0);
  const pendingPayables = debts
    .filter((d) => d.type === 'Payable' && d.status === 'Pending')
    .reduce((s, d) => s + (parseFloat(d.remainingBalance) || 0), 0);

  const netDebtOffset = pendingReceivables - pendingPayables;
  const currentNetWorth = Math.round(nonInvestmentLiquidity + currentPortfolioMad + netDebtOffset);

  // 2. Verified Active Salary & Recurring Monthly Income Baseline
  const validPayrolls = payrolls
    .filter((p) => p.scheduledFor && !Number.isNaN(new Date(p.scheduledFor).getTime()))
    .slice();

  const sortedPayrollsDesc = validPayrolls
    .slice()
    .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());

  const upcomingPayroll = validPayrolls
    .filter((p) => new Date(p.scheduledFor).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];

  const latestPayroll = sortedPayrollsDesc[0];
  const upcomingAmt = upcomingPayroll ? parseFloat(upcomingPayroll.amount) || 0 : 0;
  const latestAmt = latestPayroll ? parseFloat(latestPayroll.amount) || 0 : 0;
  const configuredSalary = kpis?.salary && kpis.salary > 0 ? kpis.salary : 0;

  const activeSalary =
    (upcomingAmt > 0 ? upcomingAmt : 0) ||
    (latestAmt > 0 ? latestAmt : 0) ||
    configuredSalary;

  const monthlyIncomeBaseline =
    activeSalary > 0
      ? activeSalary
      : kpis?.monthlyIncome && kpis.monthlyIncome > 0
      ? kpis.monthlyIncome
      : 0;

  const inferredPaydayDayOfMonth =
    (upcomingPayroll ? new Date(upcomingPayroll.scheduledFor).getDate() : null) ||
    (latestPayroll ? new Date(latestPayroll.scheduledFor).getDate() : null) ||
    (kpis?.payday && kpis.payday >= 1 && kpis.payday <= 31 ? kpis.payday : null) ||
    25;

  // 3. Subscriptions Burn (normalized monthly equivalent)
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
    const raw = (s.billingCycle || 'monthly').trim().toLowerCase();
    if (raw === 'yearly') return amtMad / 12;
    if (raw === 'every_6_months') return amtMad / 6;
    if (raw === 'quarterly' || raw === 'every_3_months') return amtMad / 3;
    if (raw === 'every_2_months') return amtMad / 2;
    if (raw === 'weekly') return (amtMad * 52) / 12;
    if (raw === 'biweekly') return (amtMad * 26) / 12;
    const customMonths = raw.match(/^every_(\d+)_months?$/);
    if (customMonths) return amtMad / Math.max(1, parseInt(customMonths[1], 10));
    const customDays = raw.match(/^every_(\d+)_days?$/);
    if (customDays) return (amtMad * 30.4375) / Math.max(1, parseInt(customDays[1], 10));
    return amtMad;
  };

  const monthlyFixedSubsBurn = activeSubs.reduce((sum, s) => sum + normalizeSubMonthly(s), 0);
  const optionalSubsSavings = whatIf.cancelReviewingSubs ? monthlyFixedSubsBurn * 0.35 : 0;

  // 4. Historical Living Burn & Day-of-Week Seasonality (strictly living expenses, outlier-resistant)
  const allLivingExpenses = transactions.filter(isRecurringLivingTx);
  const oldestTxTime = transactions.reduce((min, t) => {
    const ms = new Date(t.createdAt).getTime();
    return Number.isFinite(ms) && ms < min ? ms : min;
  }, now.getTime());
  const historyDaysAvailable = Math.max(1, Math.round((now.getTime() - oldestTxTime) / 86_400_000));

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000);
  const recentLivingExpenses = allLivingExpenses.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= ninetyDaysAgo && d <= now;
  });

  // Aggregate daily living spend totals over the last 90 days to winsorize extreme single-day spikes
  const recentDayTotalsMap = new Map<string, { dow: number; total: number; count: number }>();
  for (const tx of recentLivingExpenses) {
    const d = new Date(tx.createdAt);
    const key = toIsoDateStr(d);
    const prev = recentDayTotalsMap.get(key) || { dow: d.getDay(), total: 0, count: 0 };
    prev.total += netExpenseOf(tx);
    prev.count += 1;
    recentDayTotalsMap.set(key, prev);
  }

  const nonZeroDailyTotals = Array.from(recentDayTotalsMap.values())
    .map((v) => v.total)
    .filter((v) => v > 0);
  const medianActiveDaySpend = median(nonZeroDailyTotals);
  // Winsorize extreme one-off spikes (>5x median active day, floor 1500 MAD) when measuring weekday cadence
  const dowSpikeCap =
    medianActiveDaySpend > 0 ? Math.max(1500, medianActiveDaySpend * 5) : Number.POSITIVE_INFINITY;

  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const entry of recentDayTotalsMap.values()) {
    dowTotals[entry.dow] += Math.min(entry.total, dowSpikeCap);
    dowCounts[entry.dow] += entry.count;
  }

  const observedWindowDays = Math.max(7, Math.min(90, historyDaysAvailable));
  const weeksInWindow = Math.max(1, observedWindowDays / 7);
  const rawDowAvgs = dowTotals.map((tot) => tot / weeksInWindow);
  const rawDowMean = rawDowAvgs.reduce((a, b) => a + b, 0) / 7;

  // Completed historical financial periods (immune to Day-1 partial-cycle explosions)
  const allPeriods = getFinancialPeriods(payrolls);
  const completedPeriodSpends: number[] = [];
  for (const p of allPeriods) {
    if (p.end.getTime() >= now.getTime()) continue;
    const periodDays = Math.max(
      1,
      Math.round((p.end.getTime() - p.start.getTime()) / 86_400_000) + 1
    );
    if (periodDays < 15) continue;
    const periodTotal = allLivingExpenses
      .filter((t) => {
        const dt = new Date(t.createdAt);
        return dt >= p.start && dt <= p.end;
      })
      .reduce((s, t) => s + netExpenseOf(t), 0);
    if (periodTotal > 0) {
      // Normalize to a standard 30-day cycle
      completedPeriodSpends.push((periodTotal / periodDays) * 30);
    }
  }
  const recentCompletedSpends = completedPeriodSpends.slice(-6);
  const completedCyclesUsed = recentCompletedSpends.length;

  const historicalCycleMonthlyBurn =
    recentCompletedSpends.length >= 3
      ? median(recentCompletedSpends) * 0.5 + trimmedMean(recentCompletedSpends) * 0.5
      : recentCompletedSpends.length > 0
      ? recentCompletedSpends.reduce((a, b) => a + b, 0) / recentCompletedSpends.length
      : 0;

  const recent90dTotalLiving = recentLivingExpenses.reduce((s, t) => s + netExpenseOf(t), 0);
  const recent90dMonthlyBurn =
    observedWindowDays >= 14 ? (recent90dTotalLiving / observedWindowDays) * 30 : 0;

  // Current cycle living expenses
  const elapsedDays = Math.max(
    1,
    currentFm
      ? Math.round((now.getTime() - currentFm.start.getTime()) / 86_400_000) + 1
      : kpis?.forecast?.elapsedDays || 1
  );
  const totalCycleDays = Math.max(
    28,
    currentFm
      ? Math.round((currentFm.end.getTime() - currentFm.start.getTime()) / 86_400_000) + 1
      : kpis?.forecast?.totalDays || 30
  );
  const daysRemainingInCycle = Math.max(
    0,
    currentFm ? totalCycleDays - elapsedDays : kpis?.forecast?.daysRemaining ?? totalCycleDays - elapsedDays
  );

  const cycleLivingExpenses = allLivingExpenses.filter(
    (t) => currentFm && isInMonth(t, year, month, payrolls)
  );
  const cycleSpendSoFar = cycleLivingExpenses.reduce((s, t) => s + netExpenseOf(t), 0);

  // Sum of current-month living budgets (fallback only when no history exists)
  const currentMonthBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const livingBudgetsTotal = currentMonthBudgets
    .filter((b) => !isWealthAllocationCategory(b.category))
    .reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

  // Determine robust long-term monthly living outflow:
  // On Days 1-9 of a new cycle, current-cycle spend gets 0% weight so a Day-1 equipment purchase
  // never contaminates the 12-month forecast!
  let baseHistoricalMonthlyLiving = 0;
  if (historicalCycleMonthlyBurn > 0 && recent90dMonthlyBurn > 0) {
    baseHistoricalMonthlyLiving = historicalCycleMonthlyBurn * 0.7 + recent90dMonthlyBurn * 0.3;
  } else if (historicalCycleMonthlyBurn > 0) {
    baseHistoricalMonthlyLiving = historicalCycleMonthlyBurn;
  } else if (recent90dMonthlyBurn > 0) {
    baseHistoricalMonthlyLiving = recent90dMonthlyBurn;
  } else if (livingBudgetsTotal > 0) {
    baseHistoricalMonthlyLiving = livingBudgetsTotal;
  } else if (cycleSpendSoFar > 0) {
    // Only if brand new user with zero prior history & zero budgets
    baseHistoricalMonthlyLiving = (cycleSpendSoFar / Math.max(7, elapsedDays)) * 30;
  }

  // Blend current-cycle pace gently ONLY after cycle maturity (Day 10+)
  let totalBaselineMonthlyOutflow = baseHistoricalMonthlyLiving;
  if (elapsedDays >= 10 && cycleSpendSoFar > 0 && baseHistoricalMonthlyLiving > 0) {
    // Exclude one-off mega-transactions (>35% of monthly income) when measuring current-cycle recurring pace
    const singleTxCap =
      monthlyIncomeBaseline > 0 ? monthlyIncomeBaseline * 0.35 : Number.POSITIVE_INFINITY;
    const recurringCycleSpend = cycleLivingExpenses.reduce(
      (sum, tx) => sum + Math.min(netExpenseOf(tx), singleTxCap),
      0
    );
    const currentCycleProjectedMonthly = (recurringCycleSpend / elapsedDays) * totalCycleDays;
    const maturityWeight = Math.min(
      0.35,
      ((elapsedDays - 9) / Math.max(15, totalCycleDays - 9)) * 0.35
    );
    totalBaselineMonthlyOutflow =
      baseHistoricalMonthlyLiving * (1 - maturityWeight) +
      currentCycleProjectedMonthly * maturityWeight;
  }

  // Guarantee zero double-counting of recurring subscriptions:
  // Subscriptions are part of total monthly living outflow, not stacked on top of historical totals
  // that already include past subscription bills.
  totalBaselineMonthlyOutflow = Math.max(totalBaselineMonthlyOutflow, monthlyFixedSubsBurn);
  const monthlyVariableBurn = Math.max(0, totalBaselineMonthlyOutflow - monthlyFixedSubsBurn);

  const overallDowMean = rawDowMean > 0 ? rawDowMean : monthlyVariableBurn / 30;
  const dayOfWeekPatterns: DayOfWeekPattern[] = DAY_NAMES.map((name, i) => {
    const avg = rawDowAvgs[i] > 0 ? rawDowAvgs[i] : overallDowMean;
    const mult = overallDowMean > 0 ? avg / overallDowMean : 1;
    return {
      dayIndex: i,
      dayName: name,
      shortName: SHORT_DAYS[i],
      avgSpendMad: Math.round(avg * 10) / 10,
      relativeMultiplier: Math.max(0.5, Math.min(1.85, mult)),
      txCount: dowCounts[i],
    };
  });

  // 5. Stock Investment Allocation & Return Assumptions
  const monthlyDcaCommitment =
    investmentsData?.buyingPower?.monthlyInvestmentBudgetMad ||
    investmentsData?.safeToInvest?.currentMonthlyDcaTarget ||
    0;

  const annualDividendIncomeMad = investmentsData?.annualPassiveIncomeMad || 0;
  const monthlyPassiveIncomeMad = annualDividendIncomeMad / 12;

  // Baseline vs Simulated Monthly Net Cash Flow
  const monthlyNetSavingsBaseline =
    monthlyIncomeBaseline + monthlyPassiveIncomeMad - (monthlyVariableBurn + monthlyFixedSubsBurn);

  const simulatedVariableBurn =
    monthlyVariableBurn * (1 - whatIf.discretionaryCutPercent / 100);
  const simulatedFixedBurn = Math.max(0, monthlyFixedSubsBurn - optionalSubsSavings);
  const simulatedIncome = Math.max(0, monthlyIncomeBaseline + whatIf.incomeDeltaMad);

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

  // 6. Smart Category Burn & Budget Exhaustion Radar (Bayesian shrinkage + Lump-Sum detection)
  const categorySpendMap: Record<string, number> = {};
  const categoryTxCountMap: Record<string, number> = {};
  const categoryMaxTxMap: Record<string, number> = {};

  for (const tx of cycleLivingExpenses) {
    const cat = normalizeCategory(tx.category || 'Uncategorized');
    const net = netExpenseOf(tx);
    if (net <= 0) continue;
    categorySpendMap[cat] = (categorySpendMap[cat] || 0) + net;
    categoryTxCountMap[cat] = (categoryTxCountMap[cat] || 0) + 1;
    categoryMaxTxMap[cat] = Math.max(categoryMaxTxMap[cat] || 0, net);
  }

  // Historical 90-day monthly average per category (for Bayesian shrinkage prior)
  const histCategoryTotalMap: Record<string, number> = {};
  for (const tx of recentLivingExpenses) {
    const cat = normalizeCategory(tx.category || 'Uncategorized');
    histCategoryTotalMap[cat] = (histCategoryTotalMap[cat] || 0) + netExpenseOf(tx);
  }
  const histMonthsSpan = Math.max(1, observedWindowDays / 30);

  // Deduplicate normalized budgets for living expense categories only (exclude Savings/Investments)
  const budgetByNormCat = new Map<string, number>();
  for (const b of currentMonthBudgets) {
    const norm = normalizeCategory(b.category);
    if (isWealthAllocationCategory(norm)) continue;
    const amt = parseFloat(b.amount) || 0;
    if (amt > 0) {
      budgetByNormCat.set(norm, (budgetByNormCat.get(norm) || 0) + amt);
    }
  }

  const allLivingCategories = Array.from(
    new Set([
      ...Array.from(budgetByNormCat.keys()),
      ...Object.keys(categorySpendMap).filter((c) => !isWealthAllocationCategory(c)),
    ])
  );

  const categoryPredictions: CategoryBurnPrediction[] = allLivingCategories
    .map((category) => {
      const budgetCap = budgetByNormCat.get(category) || 0;
      const spentSoFar = categorySpendMap[category] || 0;
      const txCount = categoryTxCountMap[category] || 0;
      const maxSingleTx = categoryMaxTxMap[category] || 0;
      const histMonthlyAvg = (histCategoryTotalMap[category] || 0) / histMonthsSpan;
      const histDailyRate = histMonthlyAvg / 30;

      const isLumpCategory = isLumpSumCategory(category);
      const isSingleLargePurchase =
        txCount > 0 &&
        txCount <= 2 &&
        maxSingleTx >= Math.max(300, budgetCap > 0 ? budgetCap * 0.45 : 600) &&
        maxSingleTx / Math.max(1, spentSoFar) >= 0.65;

      const treatAsLumpSum = isLumpCategory || isSingleLargePurchase;
      const cutMultiplier = 1 - whatIf.discretionaryCutPercent / 100;

      let dailyVelocity = 0;
      let projectedEndOfCycle = spentSoFar;
      let forecastMethod: CategoryBurnPrediction['forecastMethod'] = 'daily_cadence';

      if (spentSoFar === 0) {
        // Nothing spent yet in this cycle — project calmly using historical rate capped conservatively
        forecastMethod = 'historical_prior';
        dailyVelocity = 0;
        const expectedFromHistory =
          histMonthlyAvg > 0
            ? Math.min(
                budgetCap > 0 ? budgetCap * 0.95 : histMonthlyAvg,
                histMonthlyAvg * (daysRemainingInCycle / totalCycleDays)
              ) * cutMultiplier
            : 0;
        projectedEndOfCycle = expectedFromHistory;
      } else if (treatAsLumpSum) {
        // One-off / periodic category (e.g. Home, Tech & Equipment; Rent; Clothing; Medical):
        // Do NOT multiply a Day-1 1,250 MAD equipment purchase by 30 days!
        forecastMethod = 'lump_sum';
        const residualRecurringSpend = Math.max(0, spentSoFar - maxSingleTx);
        const residualDailyFromCycle =
          elapsedDays >= 5 && residualRecurringSpend > 0
            ? residualRecurringSpend / elapsedDays
            : 0;
        // Expected additional spend is small residual drift, never duplicating the already-paid lump sum
        const expectedAdditional =
          histMonthlyAvg > spentSoFar
            ? Math.min(histMonthlyAvg - spentSoFar, histDailyRate * daysRemainingInCycle)
            : residualDailyFromCycle * daysRemainingInCycle;
        const clampedAdditional = Math.max(0, expectedAdditional) * cutMultiplier;
        dailyVelocity =
          daysRemainingInCycle > 0 ? clampedAdditional / daysRemainingInCycle : 0;
        projectedEndOfCycle = spentSoFar + clampedAdditional;
      } else {
        // Daily-cadence variable category (Groceries, Dining, Coffee, Transport, etc.):
        // Empirical-Bayes shrinkage with prior strength k = 7 days prevents Day-1 blowups
        // while reacting swiftly once 7-15+ days of actual spend accumulate.
        forecastMethod = 'daily_cadence';
        const priorStrengthDays = 7;
        const fallbackDailyFromBudget =
          budgetCap > 0 ? (budgetCap * 0.72) / totalCycleDays : 0;
        const priorDailyRate = histDailyRate > 0 ? histDailyRate : fallbackDailyFromBudget;

        const blendedDaily =
          (spentSoFar + priorStrengthDays * priorDailyRate) /
          (elapsedDays + priorStrengthDays);

        dailyVelocity = blendedDaily * cutMultiplier;
        projectedEndOfCycle = spentSoFar + dailyVelocity * daysRemainingInCycle;
      }

      projectedEndOfCycle = Math.round(projectedEndOfCycle);
      const projectedVariance = budgetCap > 0 ? Math.round(projectedEndOfCycle - budgetCap) : 0;
      const percentUsed = budgetCap > 0 ? (spentSoFar / budgetCap) * 100 : 0;
      const projectedPercent =
        budgetCap > 0 ? (projectedEndOfCycle / budgetCap) * 100 : 0;

      let daysUntilExhaustion: number | null = null;
      let exhaustionDateLabel: string | null = null;

      if (budgetCap > 0) {
        if (spentSoFar >= budgetCap) {
          daysUntilExhaustion = 0;
          exhaustionDateLabel = 'Cap reached';
        } else if (dailyVelocity > 0.5 && projectedEndOfCycle > budgetCap) {
          const remainingCap = budgetCap - spentSoFar;
          const dLeft = Math.ceil(remainingCap / dailyVelocity);
          if (dLeft <= daysRemainingInCycle) {
            daysUntilExhaustion = dLeft;
            const exhaustDate = new Date(now.getTime() + dLeft * 86_400_000);
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
        else if (projectedEndOfCycle > budgetCap * 1.03) status = 'breach_imminent';
        else if (percentUsed >= 80 || projectedEndOfCycle > budgetCap * 0.88) status = 'watch';
      }

      return {
        category,
        budgetCap,
        spentSoFar: Math.round(spentSoFar),
        dailyVelocity: Math.round(dailyVelocity * 10) / 10,
        projectedEndOfCycle,
        projectedVariance,
        percentUsed: Math.round(percentUsed * 10) / 10,
        projectedPercent: Math.round(projectedPercent * 10) / 10,
        daysUntilExhaustion,
        exhaustionDateLabel,
        status,
        forecastMethod,
        txCount,
      };
    })
    .filter((c) => c.budgetCap > 0 || c.spentSoFar > 0)
    .sort((a, b) => {
      const score = (s: CategoryBurnPrediction['status']) =>
        s === 'breached' ? 4 : s === 'breach_imminent' ? 3 : s === 'watch' ? 2 : 1;
      if (score(b.status) !== score(a.status)) return score(b.status) - score(a.status);
      return b.spentSoFar - a.spentSoFar || b.projectedEndOfCycle - a.projectedEndOfCycle;
    });

  // 7. Day-by-Day 30-Day Forward Cash Flow & Liquidity Stress Simulation
  const emergencyFloor = Math.round(kpis?.emergencyBuffer ?? 0);
  const dailyCashFlow30d: DailyCashFlowPoint[] = [];
  let runningBaseline = nonInvestmentLiquidity;
  let runningSimulated = nonInvestmentLiquidity + whatIf.oneTimeShockMad;
  let lowest30dBalance = runningSimulated;
  let lowest30dDateLabel = 'Today';
  let hasLiquidityPinchBeforePayday = false;

  const monthsWithExistingPayroll = new Set<string>();
  for (const p of validPayrolls) {
    if (p.scheduledFor) {
      const pDate = new Date(p.scheduledFor);
      if (!Number.isNaN(pDate.getTime())) {
        monthsWithExistingPayroll.add(`${pDate.getFullYear()}-${pDate.getMonth() + 1}`);
      }
    }
  }

  const monthsWithSalaryAppliedInWindow = new Set<string>();
  const billedSubsInWindow = new Set<string>();
  const daysUntilNextPayday =
    kpis?.daysUntilPayday && kpis.daysUntilPayday > 0 ? kpis.daysUntilPayday : daysRemainingInCycle;

  for (let d = 0; d <= 30; d++) {
    const targetDate = new Date(now.getTime() + d * 86_400_000);
    const dateIso = targetDate.toISOString().slice(0, 10);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    const yearMonthKey = `${targetYear}-${targetMonth}`;
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
      // 1. Scheduled or projected payroll
      const matchingScheduledPayroll = payrolls.find(
        (p) => toIsoDateStr(p.scheduledFor) === dateIso
      );

      if (matchingScheduledPayroll) {
        const payAmt = parseFloat(matchingScheduledPayroll.amount) || monthlyIncomeBaseline;
        const totalPay = Math.max(0, payAmt + whatIf.incomeDeltaMad);
        if (totalPay > 0) {
          dayInflow += totalPay;
          events.push(`Payday (+${Math.round(totalPay).toLocaleString()} MAD)`);
        }
        monthsWithSalaryAppliedInWindow.add(yearMonthKey);
      } else if (
        dayOfMonth === inferredPaydayDayOfMonth &&
        !monthsWithExistingPayroll.has(yearMonthKey) &&
        !monthsWithSalaryAppliedInWindow.has(yearMonthKey)
      ) {
        const totalPay = Math.max(0, monthlyIncomeBaseline + whatIf.incomeDeltaMad);
        if (totalPay > 0) {
          dayInflow += totalPay;
          events.push(`Projected Salary (+${Math.round(totalPay).toLocaleString()} MAD)`);
        }
        monthsWithSalaryAppliedInWindow.add(yearMonthKey);
      }

      // 2. Subscriptions billing on this date
      const subDiscountFactor = whatIf.cancelReviewingSubs ? 0.65 : 1;
      for (const sub of activeSubs) {
        const subMonthKey = `${sub.id}-${yearMonthKey}`;
        if (billedSubsInWindow.has(subMonthKey)) continue;

        let isDueToday = false;
        if (toIsoDateStr(sub.nextBillingDate) === dateIso) {
          isDueToday = true;
        } else if (sub.nextBillingDate) {
          const subDate = new Date(sub.nextBillingDate);
          if (
            sub.billingCycle === 'monthly' &&
            subDate.getDate() === dayOfMonth &&
            targetDate >= subDate
          ) {
            isDueToday = true;
          }
        } else if (sub.createdAt) {
          const createdDay = new Date(sub.createdAt).getDate();
          if (createdDay === dayOfMonth && sub.billingCycle === 'monthly') {
            isDueToday = true;
          }
        }

        if (isDueToday) {
          const cost = normalizeSubMonthly(sub) * subDiscountFactor;
          dayFixedOutflow += cost;
          events.push(`${sub.name} (−${Math.round(cost).toLocaleString()} MAD)`);
          billedSubsInWindow.add(subMonthKey);
        }
      }

      // 3. Debts due on this date
      for (const debt of debts) {
        if (debt.status === 'Pending' && toIsoDateStr(debt.dueDate) === dateIso) {
          const rem = parseFloat(debt.remainingBalance) || 0;
          if (debt.type === 'Payable') {
            dayFixedOutflow += rem;
            events.push(`Debt Due: ${debt.contactName} (−${Math.round(rem).toLocaleString()} MAD)`);
          } else {
            dayInflow += rem;
            events.push(`Receivable Due: ${debt.contactName} (+${Math.round(rem).toLocaleString()} MAD)`);
          }
        }
      }

      // Daily variable spend modulated by normalized day-of-week multiplier
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

    const isPinchPoint =
      runningSimulated < 0 || (emergencyFloor > 0 && runningSimulated < emergencyFloor);
    if (isPinchPoint && d <= Math.max(1, daysUntilNextPayday)) {
      hasLiquidityPinchBeforePayday = true;
    }

    dailyCashFlow30d.push({
      date: dateIso,
      label,
      dayOffset: d,
      projectedLiquidity: Math.round(runningSimulated),
      baselineLiquidity: Math.round(runningBaseline),
      safeFloor: emergencyFloor,
      inflow: Math.round(dayInflow),
      outflow: Math.round(dayFixedOutflow + (d > 0 ? simulatedVariableBurn / 30 : 0)),
      events,
      isPinchPoint,
    });
  }

  lowest30dBalance = Math.round(lowest30dBalance);

  // 8. Multi-Horizon 24-Month Wealth & Net Worth Trajectory (Guaranteed Non-Inverted Cone!)
  const horizonTrajectory24m: HorizonTrajectoryPoint[] = [];
  let baseCash = nonInvestmentLiquidity;
  let simCash = nonInvestmentLiquidity + whatIf.oneTimeShockMad;
  let basePortfolio = currentPortfolioMad;
  let simPortfolio = currentPortfolioMad;
  let optPortfolio = currentPortfolioMad;
  let consPortfolio = currentPortfolioMad;
  let optCash = nonInvestmentLiquidity + whatIf.oneTimeShockMad;
  let consCash = nonInvestmentLiquidity + whatIf.oneTimeShockMad;
  let cumulativePassive = 0;

  const expectedMonthlyRate = 0.085 / 12; // 8.5% p.a.
  const optimisticMonthlyRate = 0.14 / 12; // 14.0% p.a.
  const conservativeMonthlyRate = 0.035 / 12; // 3.5% p.a.

  const effectiveDividendYieldAnnual =
    currentPortfolioMad > 0 && annualDividendIncomeMad > 0
      ? Math.min(0.12, annualDividendIncomeMad / currentPortfolioMad)
      : 0.028;

  // Symmetric uncertainty spread around simulated monthly surplus so Optimistic >= Simulated >= Conservative
  // ALWAYS holds even under negative-surplus stress tests!
  const monthlyPositiveUpside = Math.max(
    simulatedIncome * 0.05,
    simulatedVariableBurn * 0.12,
    250
  );
  const monthlyDownsideRisk = Math.max(
    simulatedIncome * 0.06,
    simulatedVariableBurn * 0.15,
    300
  );

  for (let m = 0; m <= 24; m++) {
    const pointDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const monthLabel =
      m === 0
        ? 'Now'
        : pointDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    if (m > 0) {
      const totalSimDca = monthlyDcaCommitment + whatIf.extraMonthlyDcaMad;

      // Baseline step
      baseCash = baseCash + monthlyNetSavingsBaseline - monthlyDcaCommitment;
      basePortfolio = basePortfolio * (1 + expectedMonthlyRate) + monthlyDcaCommitment;

      // Simulated step
      const monthDiv = simPortfolio * (effectiveDividendYieldAnnual / 12);
      cumulativePassive += monthDiv;
      simCash = simCash + monthlyNetSavingsSimulated - totalSimDca;
      simPortfolio = simPortfolio * (1 + expectedMonthlyRate) + totalSimDca + monthDiv;

      // Optimistic Band (lower variable burn / higher efficiency + 14% p.a. compounding)
      const optMonthDiv = optPortfolio * (effectiveDividendYieldAnnual / 12);
      optCash = optCash + (monthlyNetSavingsSimulated + monthlyPositiveUpside) - totalSimDca;
      optPortfolio = optPortfolio * (1 + optimisticMonthlyRate) + totalSimDca + optMonthDiv;

      // Conservative Band (unexpected cost buffer + 3.5% p.a. compounding)
      const consMonthDiv = consPortfolio * ((effectiveDividendYieldAnnual * 0.8) / 12);
      consCash = consCash + (monthlyNetSavingsSimulated - monthlyDownsideRisk) - totalSimDca;
      consPortfolio = consPortfolio * (1 + conservativeMonthlyRate) + totalSimDca + consMonthDiv;
    }

    const baseNw = Math.round(baseCash + basePortfolio + netDebtOffset);
    const simNw = Math.round(simCash + simPortfolio + netDebtOffset);
    const rawOptNw = Math.round(optCash + optPortfolio + netDebtOffset);
    const rawConsNw = Math.round(consCash + consPortfolio + netDebtOffset);

    horizonTrajectory24m.push({
      monthOffset: m,
      monthLabel,
      dateIso: pointDate.toISOString().slice(0, 10),
      baselineNetWorth: baseNw,
      simulatedNetWorth: simNw,
      optimisticNetWorth: Math.max(simNw, rawOptNw),
      conservativeNetWorth: Math.min(simNw, rawConsNw),
      projectedLiquidity: Math.round(simCash),
      projectedPortfolioMad: Math.round(simPortfolio),
      cumulativePassiveIncomeMad: Math.round(cumulativePassive),
    });
  }

  const projectedNetWorth30d = horizonTrajectory24m[1]?.simulatedNetWorth ?? currentNetWorth;
  const projectedNetWorth90d = horizonTrajectory24m[3]?.simulatedNetWorth ?? currentNetWorth;
  const projectedNetWorth6m = horizonTrajectory24m[6]?.simulatedNetWorth ?? currentNetWorth;
  const projectedNetWorth12m = horizonTrajectory24m[12]?.baselineNetWorth ?? currentNetWorth;
  const projectedNetWorth24m = horizonTrajectory24m[24]?.simulatedNetWorth ?? currentNetWorth;
  const simulatedNetWorth12m = horizonTrajectory24m[12]?.simulatedNetWorth ?? currentNetWorth;
  const netWorthDelta12mFromWhatIf = simulatedNetWorth12m - projectedNetWorth12m;

  // 9. Honest Goal Completion ETA Forecaster (ZERO double-counting, honest pause when deficit)
  const goalShareFactor = goals.length <= 1 ? 0.75 : 0.75 / goals.length;

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
        unlockedByWhatIf: false,
        onTrackForDeadline: true,
      };
    }

    const baseMonthlyAlloc =
      monthlyNetSavingsBaseline > 0 ? monthlyNetSavingsBaseline * goalShareFactor : 0;
    const simMonthlyAlloc =
      monthlyNetSavingsSimulated > 0 ? monthlyNetSavingsSimulated * goalShareFactor : 0;

    const baseMonths =
      baseMonthlyAlloc >= 50 ? Math.ceil(remainingAmount / baseMonthlyAlloc) : null;
    const simMonths =
      simMonthlyAlloc >= 50 ? Math.ceil(remainingAmount / simMonthlyAlloc) : null;

    const formatEta = (months: number | null): string => {
      if (months === null) return 'Paused (deficit)';
      if (months > 120) return '10+ years';
      const targetDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
      return targetDate.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    };

    let onTrack = false;
    if (simMonths !== null) {
      if (g.deadline) {
        const simDate = new Date(now.getFullYear(), now.getMonth() + simMonths, 1);
        onTrack = simDate <= new Date(g.deadline);
      } else {
        onTrack = true;
      }
    }

    const monthsSaved =
      baseMonths !== null && simMonths !== null ? Math.max(0, baseMonths - simMonths) : 0;
    const unlockedByWhatIf = baseMonths === null && simMonths !== null;

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
      baselineEtaLabel: formatEta(baseMonths),
      simulatedEtaLabel: formatEta(simMonths),
      monthsSaved,
      unlockedByWhatIf,
      onTrackForDeadline: onTrack,
    };
  });

  // 10. Survival Runway Days (how long liquid reserves last at simulated living burn with 0 new income)
  const rawDailyBurn = (simulatedVariableBurn + simulatedFixedBurn) / 30;
  const effectiveLiquidity = Math.max(0, nonInvestmentLiquidity + whatIf.oneTimeShockMad);
  const survivalRunwayDays =
    rawDailyBurn > 0.01
      ? Math.max(0, Math.round(effectiveLiquidity / rawDailyBurn))
      : effectiveLiquidity > 0
      ? 365
      : 0;

  // 11. Cross-Domain Predictive Signals
  const signals: PredictiveSignal[] = [];

  // Signal A: Category Breach or High-Utilization Warnings
  const breachingCats = categoryPredictions.filter(
    (c) => c.status === 'breached' || c.status === 'breach_imminent'
  );
  const watchCats = categoryPredictions.filter((c) => c.status === 'watch');

  if (breachingCats.length > 0) {
    const topCat = breachingCats[0];
    signals.push({
      id: 'sig-cat-breach',
      severity: topCat.status === 'breached' ? 'critical' : 'warning',
      domain: 'Budgets',
      title: `${topCat.category} projected to ${
        topCat.status === 'breached' ? 'exceed' : 'breach'
      } budget by +${Math.max(0, topCat.projectedVariance).toLocaleString()} MAD`,
      detail: topCat.exhaustionDateLabel
        ? `At ${topCat.dailyVelocity.toFixed(1)} MAD/day blended velocity, this cap exhausts around ${topCat.exhaustionDateLabel}.`
        : `Projected cycle total is ${topCat.projectedEndOfCycle.toLocaleString()} MAD vs ${topCat.budgetCap.toLocaleString()} MAD cap.`,
      impactMad: -Math.abs(topCat.projectedVariance),
      actionTab: 'budgets',
      actionLabel: 'Rebalance Budgets',
    });
  } else if (watchCats.length > 0) {
    const topWatch = watchCats[0];
    const remaining = Math.max(0, topWatch.budgetCap - topWatch.spentSoFar);
    signals.push({
      id: 'sig-cat-watch',
      severity: 'info',
      domain: 'Budgets',
      title: `${topWatch.category} at ${topWatch.percentUsed.toFixed(0)}% of cap (${remaining.toLocaleString()} MAD left)`,
      detail:
        topWatch.forecastMethod === 'lump_sum'
          ? `Detected as a one-off purchase (${topWatch.spentSoFar.toLocaleString()} of ${topWatch.budgetCap.toLocaleString()} MAD); not extrapolated linearly across remaining days.`
          : `Projected end-of-cycle total is ${topWatch.projectedEndOfCycle.toLocaleString()} MAD vs ${topWatch.budgetCap.toLocaleString()} MAD budget.`,
      impactMad: -Math.max(0, topWatch.projectedVariance),
      actionTab: 'budgets',
      actionLabel: 'Review Budgets',
    });
  }

  // Signal B: Liquidity Pinch & Cash Overdraft Detection
  if (lowest30dBalance < 0) {
    signals.push({
      id: 'sig-liquidity-pinch',
      severity: 'critical',
      domain: 'Liquidity',
      title: `Projected cash shortfall of ${Math.abs(lowest30dBalance).toLocaleString()} MAD around ${lowest30dDateLabel}`,
      detail: `Forward 30-day cash flow drops to ${lowest30dBalance.toLocaleString()} MAD before next payday (${survivalRunwayDays}-day survival runway).`,
      impactMad: lowest30dBalance,
      actionTab: 'calendar',
      actionLabel: 'Inspect Cash Flow',
    });
  } else if (hasLiquidityPinchBeforePayday) {
    signals.push({
      id: 'sig-liquidity-pinch',
      severity: 'critical',
      domain: 'Liquidity',
      title: `Projected cash dips below protected savings reserve around ${lowest30dDateLabel}`,
      detail: `Forward 30-day cash flow reaches ${lowest30dBalance.toLocaleString()} MAD (below your ${emergencyFloor.toLocaleString()} MAD protected reserve) before next payday.`,
      impactMad: lowest30dBalance - emergencyFloor,
      actionTab: 'calendar',
      actionLabel: 'Inspect Cash Flow',
    });
  } else {
    const headroom = Math.max(0, lowest30dBalance - emergencyFloor);
    signals.push({
      id: 'sig-liquidity-healthy',
      severity: 'positive',
      domain: 'Liquidity',
      title:
        emergencyFloor > 0
          ? `30-day cash trajectory stays +${headroom.toLocaleString()} MAD above savings reserve`
          : `30-day cash trajectory stays positive (${lowest30dBalance.toLocaleString()} MAD floor)`,
      detail: `Lowest projected balance over the next 30 days is ${lowest30dBalance.toLocaleString()} MAD on ${lowest30dDateLabel}, maintaining a ${survivalRunwayDays}-day survival runway.`,
      impactMad: emergencyFloor > 0 ? headroom : lowest30dBalance,
      actionTab: 'calendar',
      actionLabel: 'View Calendar',
    });
  }

  // Signal C: Peak Day-of-Week Seasonality
  const sortedDow = [...dayOfWeekPatterns].sort((a, b) => b.avgSpendMad - a.avgSpendMad);
  if (sortedDow[0] && sortedDow[0].relativeMultiplier > 1.2 && overallDowMean > 10) {
    signals.push({
      id: 'sig-dow-seasonality',
      severity: 'info',
      domain: 'Seasonality',
      title: `${sortedDow[0].dayName}s are your highest-velocity spend days (${sortedDow[0].relativeMultiplier.toFixed(1)}x average)`,
      detail: `90-day living cadence averages ${sortedDow[0].avgSpendMad.toFixed(0)} MAD on ${sortedDow[0].dayName}s vs ${sortedDow[6].avgSpendMad.toFixed(0)} MAD on ${sortedDow[6].dayName}s (outlier-trimmed).`,
      impactMad: Math.round(-(sortedDow[0].avgSpendMad - overallDowMean) * 4),
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
    }${wealthGain12m.toLocaleString()} MAD)`,
    detail: `Combines ${Math.round(monthlyNetSavingsSimulated).toLocaleString()} MAD/mo projected net savings, ${Math.round(
      monthlyDcaCommitment + whatIf.extraMonthlyDcaMad
    ).toLocaleString()} MAD/mo DCA contributions, and portfolio compounding.`,
    impactMad: wealthGain12m,
    actionTab: 'investments',
    actionLabel: 'Open Stock Portfolio',
  });

  // Signal E: Subscriptions Load
  if (monthlyFixedSubsBurn > 0) {
    signals.push({
      id: 'sig-subs-burn',
      severity: monthlyFixedSubsBurn > monthlyIncomeBaseline * 0.15 ? 'warning' : 'info',
      domain: 'Subscriptions',
      title: `Recurring subscriptions lock ${Math.round(monthlyFixedSubsBurn * 12).toLocaleString()} MAD/year (${((monthlyFixedSubsBurn / Math.max(1, monthlyIncomeBaseline)) * 100).toFixed(1)}% of income)`,
      detail: `${activeSubs.length} active subscriptions cost ${Math.round(monthlyFixedSubsBurn).toLocaleString()} MAD/mo before variable living spend.`,
      impactMad: -Math.round(monthlyFixedSubsBurn * 12),
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
          ? `+${Math.round(pendingReceivables).toLocaleString()} MAD in pending receivables awaiting collection`
          : `${Math.round(pendingPayables).toLocaleString()} MAD in pending payables scheduled for settlement`,
      detail: `Settling active debt positions shifts liquid net worth by ${Math.round(
        pendingReceivables - pendingPayables
      ).toLocaleString()} MAD.`,
      impactMad: Math.round(pendingReceivables - pendingPayables),
      actionTab: 'debts',
      actionLabel: 'Manage Debts',
    });
  }

  // True cycle-to-cycle historical variance (CV%) instead of Day-1 partial-cycle comparison!
  let calibrationVariancePercent = 12.0;
  if (recentCompletedSpends.length >= 2) {
    const meanCycle =
      recentCompletedSpends.reduce((a, b) => a + b, 0) / recentCompletedSpends.length;
    if (meanCycle > 0) {
      const variance =
        recentCompletedSpends.reduce((acc, v) => acc + Math.pow(v - meanCycle, 2), 0) /
        recentCompletedSpends.length;
      calibrationVariancePercent = Math.min(
        65,
        Math.round((Math.sqrt(variance) / meanCycle) * 1000) / 10
      );
    }
  }

  const reliabilityScorePercent = Math.min(
    98,
    Math.max(
      35,
      Math.round(
        (Math.min(historyDaysAvailable, 120) / 120) * 75 +
          Math.min(completedCyclesUsed, 4) * 5.75
      )
    )
  );
  const reliabilityLabel: 'High (90+ days)' | 'Moderate (30–89 days)' | 'Low (<30 days)' =
    historyDaysAvailable >= 90
      ? 'High (90+ days)'
      : historyDaysAvailable >= 30
      ? 'Moderate (30–89 days)'
      : 'Low (<30 days)';

  const confirmedInflowsCount = payrolls.filter(
    (p) => p.status === 'confirmed' || p.status === 'matched'
  ).length;
  const estimatedInflowsCount = Math.max(0, payrolls.length - confirmedInflowsCount);

  const burnBasisLabel =
    completedCyclesUsed >= 2
      ? `median of last ${completedCyclesUsed} closed cycles`
      : `90-day living velocity`;

  const keyAssumptions = [
    `Baseline monthly income: ${Math.round(monthlyIncomeBaseline).toLocaleString()} MAD (${confirmedInflowsCount} confirmed / ${estimatedInflowsCount} expected payrolls)`,
    `Variable living burn: ${Math.round(monthlyVariableBurn).toLocaleString()} MAD/mo (${(monthlyVariableBurn / 30).toFixed(0)} MAD/day · ${burnBasisLabel})`,
    `Recurring subscriptions: ${Math.round(monthlyFixedSubsBurn).toLocaleString()} MAD/mo across ${activeSubs.length} active services (deduplicated from living burn)`,
    `Portfolio compounding: 8.5% expected p.a. (3.5% conservative – 14.0% optimistic band)`,
  ];

  return {
    currentLiquidity,
    operatingLiquidity,
    protectedSavingsReserve,
    currentPortfolioMad: Math.round(currentPortfolioMad),
    currentNetWorth,
    monthlyIncomeBaseline: Math.round(monthlyIncomeBaseline),
    monthlyFixedSubsBurn: Math.round(monthlyFixedSubsBurn),
    monthlyVariableBurn: Math.round(monthlyVariableBurn),
    monthlyDcaCommitment: Math.round(monthlyDcaCommitment),
    monthlyNetSavingsBaseline: Math.round(monthlyNetSavingsBaseline),
    monthlyNetSavingsSimulated: Math.round(monthlyNetSavingsSimulated),
    savingsRateBaseline: Math.round(savingsRateBaseline * 10) / 10,
    savingsRateSimulated: Math.round(savingsRateSimulated * 10) / 10,
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
      holdings: investmentsData?.positions?.length ?? 0,
      contexts: contexts.length,
    },
    calibrationAndFreshness: {
      historyDaysAvailable,
      completedCyclesUsed,
      reliabilityScorePercent,
      reliabilityLabel,
      confirmedInflowsCount,
      estimatedInflowsCount,
      keyAssumptions,
      calibrationVariancePercent,
      freshnessStatus: investmentsData?.marketDataStatus?.status === 'cache_only' ? 'cached' : 'live',
      computedAtIso: now.toISOString(),
    },
  };
}
