import { Transaction, KPI, Goal, Debt, CategoryBudget, WealthAssetBenchmark, OpportunitySwap, LifeEnergyProfile } from '../types';

export const ASSET_BENCHMARKS: WealthAssetBenchmark[] = [
  {
    id: 'sp500',
    name: 'S&P 500 / Global Equities',
    tickerOrCode: 'VOO / MSCI World',
    cagrPercent: 10.2,
    description: 'Long-term historical annualized return of broad diversified global equity markets.',
    category: 'Equities',
    riskLabel: 'Moderate',
  },
  {
    id: 'tech',
    name: 'High-Growth Tech Basket',
    tickerOrCode: 'NASDAQ-100 / QQQ',
    cagrPercent: 14.5,
    description: 'Tech-heavy growth index with rapid compounding and cyclical volatility.',
    category: 'Tech',
    riskLabel: 'High',
  },
  {
    id: 'gold',
    name: 'Gold & Hard Assets',
    tickerOrCode: 'GLD / Physical',
    cagrPercent: 8.1,
    description: 'Sovereign inflation hedge and monetary store of value across economic cycles.',
    category: 'Real Assets',
    riskLabel: 'Moderate',
  },
  {
    id: 'bonds',
    name: 'Treasury & Fixed Term Deposit',
    tickerOrCode: 'BAM / Sovereign 5Y',
    cagrPercent: 4.8,
    description: 'Capital preservation rate backed by local treasury bills and risk-free deposits.',
    category: 'Fixed Income',
    riskLabel: 'Low',
  },
  {
    id: 'debt-avalanche',
    name: 'High-Interest Debt Elimination',
    tickerOrCode: 'Revolving Credit APR',
    cagrPercent: 18.0,
    description: 'Guaranteed risk-free return by halting toxic revolving debt interest bleed.',
    category: 'Debt Payoff',
    riskLabel: 'Guaranteed',
  },
];

export interface CompoundCalculationResult {
  monthlyContribution: number;
  years: number;
  annualRatePercent: number;
  futureValue: number;
  principalTotal: number;
  compoundInterestTotal: number;
  doublingYears: number;
  yearsTo100k: number | null;
  yearsTo500k: number | null;
  yearsTo1M: number | null;
  trajectory: {
    year: number;
    principal: number;
    interest: number;
    total: number;
  }[];
}

export function calculateCompoundGrowth(
  monthlyContribution: number,
  years: number,
  annualRatePercent: number,
  initialLumpSum = 0
): CompoundCalculationResult {
  const r = annualRatePercent / 100;
  const n = 12; // monthly compounding
  const monthlyRate = r / n;

  const trajectory: { year: number; principal: number; interest: number; total: number }[] = [];

  let currentTotal = initialLumpSum;
  let currentPrincipal = initialLumpSum;

  for (let y = 1; y <= years; y++) {
    for (let m = 1; m <= 12; m++) {
      currentTotal = (currentTotal + monthlyContribution) * (1 + monthlyRate);
      currentPrincipal += monthlyContribution;
    }
    trajectory.push({
      year: y,
      principal: Math.round(currentPrincipal),
      interest: Math.round(Math.max(0, currentTotal - currentPrincipal)),
      total: Math.round(currentTotal),
    });
  }

  const futureValue = currentTotal;
  const principalTotal = currentPrincipal;
  const compoundInterestTotal = Math.max(0, futureValue - principalTotal);

  // Doubling Horizon (Rule of 72)
  const doublingYears = annualRatePercent > 0 ? parseFloat((72 / annualRatePercent).toFixed(1)) : 0;

  // Milestone Time Solvers
  const solveYearsToTarget = (target: number): number | null => {
    if (monthlyContribution <= 0 || r <= 0) return null;
    if (initialLumpSum >= target) return 0;
    
    // Using formula for FV of annuity with initial lump sum
    // Target = initial * (1+i)^m + P * [((1+i)^m - 1)/i]
    // Iterative month-by-month solver for high numerical stability
    let bal = initialLumpSum;
    let months = 0;
    const maxMonths = 12 * 60; // 60 years cap
    while (bal < target && months < maxMonths) {
      bal = (bal + monthlyContribution) * (1 + monthlyRate);
      months++;
    }
    return months < maxMonths ? parseFloat((months / 12).toFixed(1)) : null;
  };

  return {
    monthlyContribution,
    years,
    annualRatePercent,
    futureValue: Math.round(futureValue),
    principalTotal: Math.round(principalTotal),
    compoundInterestTotal: Math.round(compoundInterestTotal),
    doublingYears,
    yearsTo100k: solveYearsToTarget(100_000),
    yearsTo500k: solveYearsToTarget(500_000),
    yearsTo1M: solveYearsToTarget(1_000_000),
    trajectory,
  };
}

export function computeRealHourlyWage(profile: LifeEnergyProfile): {
  nominalHourly: number;
  realHourly: number;
  monthlyWorkHours: number;
  commuteHoursMonthly: number;
  deductedMonthlyCosts: number;
} {
  const { monthlyNetSalary, weeklyWorkHours, weeklyCommuteHours, monthlyWorkDirectExpenses } = profile;
  
  // Nominal standard (4.33 weeks/mo)
  const nominalMonthlyHours = Math.max(1, weeklyWorkHours * 4.333);
  const nominalHourly = monthlyNetSalary / nominalMonthlyHours;

  const totalWeeklyHours = weeklyWorkHours + weeklyCommuteHours;
  const monthlyWorkHours = Math.max(1, totalWeeklyHours * 4.333);
  const commuteHoursMonthly = weeklyCommuteHours * 4.333;

  const netAvailableIncome = Math.max(50, monthlyNetSalary - monthlyWorkDirectExpenses);
  const realHourly = netAvailableIncome / monthlyWorkHours;

  return {
    nominalHourly: parseFloat(nominalHourly.toFixed(2)),
    realHourly: parseFloat(realHourly.toFixed(2)),
    monthlyWorkHours: Math.round(monthlyWorkHours),
    commuteHoursMonthly: Math.round(commuteHoursMonthly),
    deductedMonthlyCosts: monthlyWorkDirectExpenses,
  };
}

export interface CategoryOpportunityMetric {
  category: string;
  monthlySpend: number;
  annualSpend: number;
  lifeHoursMonthly: number;
  workDaysMonthly: number;
  workWeeksAnnual: number;
  fiveYearCompounded: number;
  tenYearCompounded: number;
  twentyYearCompounded: number;
  sampleItemsCount: number;
  isDiscretionary: boolean;
}

const DISCRETIONARY_KEYWORDS = [
  'dining',
  'restaurant',
  'food delivery',
  'uber',
  'glovo',
  'coffee',
  'cafe',
  'snack',
  'entertainment',
  'shopping',
  'clothes',
  'fashion',
  'gadget',
  'electronics',
  'hobby',
  'games',
  'subscriptions',
  'drinks',
  'bars',
  'leisure',
  'travel',
];

export function analyzeLedgerOpportunities(
  transactions: Transaction[],
  realHourlyWage: number,
  benchmarkCAGR = 10.2
): {
  categories: CategoryOpportunityMetric[];
  totalDiscretionaryMonthly: number;
  totalLifeHoursSacrificed: number;
  tenYearOpportunityTotal: number;
  twentyYearOpportunityTotal: number;
} {
  const safeWage = Math.max(1, realHourlyWage);
  const expenseTx = transactions.filter((t) => t.type === 'Expense');

  if (expenseTx.length === 0) {
    return {
      categories: [],
      totalDiscretionaryMonthly: 0,
      totalLifeHoursSacrificed: 0,
      tenYearOpportunityTotal: 0,
      twentyYearOpportunityTotal: 0,
    };
  }

  // Determine span in months
  const dates = expenseTx.map((t) => new Date(t.createdAt).getTime()).filter((t) => !isNaN(t));
  const minDate = dates.length ? Math.min(...dates) : Date.now();
  const maxDate = dates.length ? Math.max(...dates) : Date.now();
  const daySpan = Math.max(14, (maxDate - minDate) / (1000 * 60 * 60 * 24));
  const monthSpan = Math.max(0.75, daySpan / 30.417);

  // Group by category
  const catMap: Record<string, { total: number; count: number }> = {};

  for (const tx of expenseTx) {
    const rawCat = (tx.category || 'General Discretionary').trim();
    const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    const amt = Math.abs(parseFloat(tx.amount) || 0);

    if (!catMap[cat]) {
      catMap[cat] = { total: 0, count: 0 };
    }
    catMap[cat].total += amt;
    catMap[cat].count += 1;
  }

  const resultCategories: CategoryOpportunityMetric[] = [];
  let totalDiscretionaryMonthly = 0;

  for (const [category, data] of Object.entries(catMap)) {
    const monthlySpend = data.total / monthSpan;
    const annualSpend = monthlySpend * 12;

    const lowerCat = category.toLowerCase();
    const isDiscretionary = DISCRETIONARY_KEYWORDS.some((kw) => lowerCat.includes(kw));

    const lifeHoursMonthly = monthlySpend / safeWage;
    const workDaysMonthly = lifeHoursMonthly / 8;
    const workWeeksAnnual = annualSpend / (safeWage * 40);

    // Compounding models
    const fiveYearCompounded = calculateCompoundGrowth(monthlySpend, 5, benchmarkCAGR).futureValue;
    const tenYearCompounded = calculateCompoundGrowth(monthlySpend, 10, benchmarkCAGR).futureValue;
    const twentyYearCompounded = calculateCompoundGrowth(monthlySpend, 20, benchmarkCAGR).futureValue;

    if (isDiscretionary) {
      totalDiscretionaryMonthly += monthlySpend;
    }

    resultCategories.push({
      category,
      monthlySpend: Math.round(monthlySpend),
      annualSpend: Math.round(annualSpend),
      lifeHoursMonthly: parseFloat(lifeHoursMonthly.toFixed(1)),
      workDaysMonthly: parseFloat(workDaysMonthly.toFixed(1)),
      workWeeksAnnual: parseFloat(workWeeksAnnual.toFixed(1)),
      fiveYearCompounded,
      tenYearCompounded,
      twentyYearCompounded,
      sampleItemsCount: data.count,
      isDiscretionary,
    });
  }

  // Sort discretionary first, then by highest monthly spend
  resultCategories.sort((a, b) => {
    if (a.isDiscretionary && !b.isDiscretionary) return -1;
    if (!a.isDiscretionary && b.isDiscretionary) return 1;
    return b.monthlySpend - a.monthlySpend;
  });

  const totalLifeHoursSacrificed = parseFloat((totalDiscretionaryMonthly / safeWage).toFixed(1));
  const tenYearOpportunityTotal = calculateCompoundGrowth(totalDiscretionaryMonthly, 10, benchmarkCAGR).futureValue;
  const twentyYearOpportunityTotal = calculateCompoundGrowth(totalDiscretionaryMonthly, 20, benchmarkCAGR).futureValue;

  return {
    categories: resultCategories,
    totalDiscretionaryMonthly: Math.round(totalDiscretionaryMonthly),
    totalLifeHoursSacrificed,
    tenYearOpportunityTotal,
    twentyYearOpportunityTotal,
  };
}

export interface WealthVelocityAudit {
  score: number;
  status: 'Velocity Master' | 'Prudent Builder' | 'Fragile Treadmill' | 'Capital Drain';
  statusColor: string;
  monthlyInflow: number;
  monthlyCapitalFormed: number;
  velocityRatePercent: number;
  discretionaryBleedPercent: number;
  fixedOverheadPercent: number;
  insight: string;
}

export function computeWealthVelocity(
  kpis: KPI | null,
  payrolls: any[],
  debts: Debt[],
  goals: Goal[],
  monthlyDiscretionary: number
): WealthVelocityAudit {
  const monthlySalary = kpis?.salary || (payrolls?.[0]?.amount ? parseFloat(payrolls[0].amount) : 12000);
  const monthlyInflow = Math.max(1000, monthlySalary);

  // Capital formed: monthly surplus + goal allocations + debt principal reductions
  const monthlyExpenses = kpis?.monthlyExpenses || 8000;
  const rawSurplus = Math.max(0, monthlyInflow - monthlyExpenses);

  // Goal funding
  const activeGoalContributions = goals.reduce((sum, g) => sum + (parseFloat((g as any).monthlyTarget || '0') || 0), 0);

  const monthlyCapitalFormed = Math.round(rawSurplus + activeGoalContributions);
  const velocityRatePercent = Math.min(100, Math.max(0, parseFloat(((monthlyCapitalFormed / monthlyInflow) * 100).toFixed(1))));

  const discretionaryBleedPercent = Math.min(100, Math.max(0, parseFloat(((monthlyDiscretionary / monthlyInflow) * 100).toFixed(1))));
  const fixedOverheadPercent = Math.min(100, Math.max(0, parseFloat((((monthlyExpenses - monthlyDiscretionary) / monthlyInflow) * 100).toFixed(1))));

  let score = Math.round(velocityRatePercent * 1.5 + (100 - discretionaryBleedPercent) * 0.4);
  score = Math.min(100, Math.max(10, score));

  let status: WealthVelocityAudit['status'] = 'Prudent Builder';
  let statusColor = 'text-emerald-500';
  let insight = '';

  if (velocityRatePercent >= 35) {
    status = 'Velocity Master';
    statusColor = 'text-emerald-500';
    insight = 'Over a third of your incoming revenue converts into durable balance-sheet net worth. Compounding is accelerating.';
  } else if (velocityRatePercent >= 20) {
    status = 'Prudent Builder';
    statusColor = 'text-indigo-500';
    insight = 'Solid capital retention rate. Pruning 10-15% of your discretionary leaks will catapult you into elite velocity.';
  } else if (velocityRatePercent >= 8) {
    status = 'Fragile Treadmill';
    statusColor = 'text-amber-500';
    insight = 'High cash velocity into consumptive expenses. A moderate income pause or shock would stall net worth growth.';
  } else {
    status = 'Capital Drain';
    statusColor = 'text-rose-500';
    insight = 'Over 92% of incoming cash evaporates into expenses. Shifting even 300 MAD/month can halt the stagnation.';
  }

  return {
    score,
    status,
    statusColor,
    monthlyInflow,
    monthlyCapitalFormed,
    velocityRatePercent,
    discretionaryBleedPercent,
    fixedOverheadPercent,
    insight,
  };
}

export const PRESET_WEALTH_SWAPS: OpportunitySwap[] = [
  {
    id: 'swap-artisan-coffee',
    title: 'Artisan Home Brew Swap',
    category: 'Coffee & Snacks',
    monthlyAmountMAD: 650,
    tradeoffDescription: 'Brew freshly roasted beans at home 4 days/week instead of café takeout.',
    streakWeeks: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'swap-delivery-detox',
    title: 'Food Delivery Detox',
    category: 'Dining & Delivery',
    monthlyAmountMAD: 950,
    tradeoffDescription: 'Replace 2 weekly delivery app orders with gourmet home batch cooking.',
    streakWeeks: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'swap-sub-purge',
    title: 'Digital Subscription Prune',
    category: 'Subscriptions',
    monthlyAmountMAD: 220,
    tradeoffDescription: 'Cancel 2 unused streaming and cloud tiers you have not opened this month.',
    streakWeeks: 8,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'swap-weekend-chill',
    title: 'Zero-Spend Nature Weekend',
    category: 'Entertainment',
    monthlyAmountMAD: 1200,
    tradeoffDescription: 'Substitute 1 lavish commercial weekend per month with outdoor hikes and home dining.',
    streakWeeks: 2,
    createdAt: new Date().toISOString(),
  },
];
