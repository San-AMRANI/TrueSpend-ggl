import type {
  CategoryBudget,
  Debt,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Subscription,
  Transaction,
  Wallet,
} from '../types/index.js';
import {
  computeFourPillarBreakdown,
  isLivingExpense,
  netExpenseOf,
} from './finance.js';
import {
  FinancialPeriod,
  getCurrentFinancialMonth,
  getFinancialPeriods,
} from './financialMonth.js';
import { normalizeCategory } from './categories.js';
import { computeBalanceSheetSummary } from './accountTaxonomy.js';

export interface ExecutiveKpiTile {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  tone: 'positive' | 'neutral' | 'warning' | 'negative';
  numericValue?: number;
  maskable?: boolean;
}

export interface BehavioralChallenge {
  id: string;
  title: string;
  description: string;
  currentLabel: string;
  targetLabel: string;
  progressPct: number;
  status: 'completed' | 'on_track' | 'at_risk';
  xpReward: number;
}

export interface PersonalRecord {
  id: string;
  label: string;
  value: string;
  context: string;
}

export interface DataGameProfile {
  level: number;
  tierTitle: string;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  levelProgressPct: number;
  xpBreakdown: Array<{ source: string; xp: number; detail: string }>;
  challenges: BehavioralChallenge[];
  records: PersonalRecord[];
  currentUnderCapStreak: number;
  bestUnderCapStreak: number;
  zeroSpendDays30d: number;
}

export interface HeatmapDayCell {
  dateKey: string;
  label: string;
  dayOfWeek: number; // 0 = Sun .. 6 = Sat
  spent: number;
  txCount: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface PaydayCycleDayPoint {
  cycleDay: number;
  label: string;
  avgSpend: number;
  currentCycleSpend: number;
  sampleCount: number;
}

export interface CategoryEfficiencyPoint {
  category: string;
  shortName: string;
  txCount: number;
  avgTicket: number;
  totalSpent: number;
  quadrant: 'Micro-Leak' | 'Heavy Hitter' | 'Core Driver' | 'Quiet';
}

export interface DisciplineRadarAxis {
  axis: string;
  score: number; // 0..100
  detail: string;
}

const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const stripLeadingEmoji = (str: string): string =>
  str.replace(/^[\p{Emoji}\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '').trim() || str;

export interface DataGameInput {
  kpis: KPI | null;
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  debts: Debt[];
  goals: Goal[];
  subscriptions: Subscription[];
  investmentsData?: InvestmentsData | null;
  now?: Date;
}

export function computeExecutiveKpiMatrix(input: DataGameInput): ExecutiveKpiTile[] {
  const now = input.now || new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wallets: Wallet[] = input.kpis?.accounts || [];
  const currentFm = getCurrentFinancialMonth(input.payrolls, now);
  const year = currentFm?.year ?? now.getFullYear();
  const month = currentFm?.month ?? now.getMonth() + 1;

  const fourPillar = computeFourPillarBreakdown({
    transactions: input.transactions,
    budgets: input.budgets,
    year,
    month,
    payrolls: input.payrolls,
    wallets,
    isCurrentMonth: true,
  });

  // Collect last 30d living expenses
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  const last30DailySpend = new Map<string, number>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    last30DailySpend.set(toDateKey(d), 0);
  }

  let smallTicketTotal = 0;
  let smallTicketCount = 0;
  let total30dLiving = 0;
  const ticketSizes30d: number[] = [];
  let weekendTotal = 0;
  let weekendDaysCount = 0;
  let weekdayTotal = 0;
  let weekdayDaysCount = 0;

  for (const tx of input.transactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (dayStart < thirtyDaysAgo || dayStart > today) continue;

    const amt = netExpenseOf(tx);
    if (amt <= 0) continue;
    const key = toDateKey(dayStart);
    last30DailySpend.set(key, (last30DailySpend.get(key) || 0) + amt);
    total30dLiving += amt;
    ticketSizes30d.push(amt);
    if (amt < 100) {
      smallTicketTotal += amt;
      smallTicketCount += 1;
    }
  }

  let zeroSpendDays = 0;
  for (const [key, val] of last30DailySpend.entries()) {
    if (val <= 0) zeroSpendDays += 1;
    const [y, m, d] = key.split('-').map(Number);
    const dow = new Date(y, (m || 1) - 1, d || 1).getDay();
    if (dow === 0 || dow === 6) {
      weekendTotal += val;
      weekendDaysCount += 1;
    } else {
      weekdayTotal += val;
      weekdayDaysCount += 1;
    }
  }

  const avgWeekendDay = weekendDaysCount > 0 ? weekendTotal / weekendDaysCount : 0;
  const avgWeekdayDay = weekdayDaysCount > 0 ? weekdayTotal / weekdayDaysCount : 0;
  const weekendMultiplier = avgWeekdayDay > 0 ? avgWeekendDay / avgWeekdayDay : 1;

  // Elapsed days in current cycle
  const elapsedDays = Math.max(
    1,
    currentFm
      ? Math.round((today.getTime() - new Date(currentFm.start.getFullYear(), currentFm.start.getMonth(), currentFm.start.getDate()).getTime()) / 86_400_000) + 1
      : today.getDate()
  );
  const savingsVelocity = fourPillar.totalActualRetainedAndSaved / elapsedDays;
  const burnRatioPct =
    fourPillar.periodIncome > 0
      ? (fourPillar.totalLivingSpent / fourPillar.periodIncome) * 100
      : 0;

  // Fixed Cost Load: Obligations + monthly active subscriptions / income
  const activeSubsMonthly = input.subscriptions
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => {
      const a = Number(s.amount) || 0;
      const c = (s.billingCycle || 'monthly').toLowerCase();
      if (c === 'yearly') return sum + a / 12;
      if (c === 'quarterly' || c === 'every_3_months') return sum + a / 3;
      if (c === 'every_6_months') return sum + a / 6;
      if (c === 'every_2_months') return sum + a / 2;
      if (c === 'weekly') return sum + (a * 52) / 12;
      if (c === 'biweekly') return sum + (a * 26) / 12;
      return sum + a;
    }, 0);
  const fixedLoadMad = Math.max(fourPillar.spentOnObligations, activeSubsMonthly);
  const fixedLoadPct =
    fourPillar.periodIncome > 0 ? (fixedLoadMad / fourPillar.periodIncome) * 100 : 0;

  // Liquidity Coverage Months
  const balanceSheet = computeBalanceSheetSummary(wallets, {
    stockPortfolioMad: input.investmentsData?.totalPortfolioValueMad ?? 0,
    activeReceivablesMad: input.debts
      .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
      .reduce((s, d) => s + (Number(d.remainingBalance) || 0), 0),
    activePayablesMad: input.debts
      .filter((d) => d.type === 'Payable' && d.status === 'Pending')
      .reduce((s, d) => s + (Number(d.remainingBalance) || 0), 0),
  });
  const monthlyBurnBase = Math.max(1, total30dLiving || fourPillar.totalLivingSpent || 1);
  const liquidityMonths =
    (Math.max(0, balanceSheet.liquidAssetsMad) + Math.max(0, balanceSheet.reserveAssetsMad)) /
    monthlyBurnBase;

  // Median & Mean ticket
  ticketSizes30d.sort((a, b) => a - b);
  const medianTicket =
    ticketSizes30d.length > 0
      ? ticketSizes30d[Math.floor(ticketSizes30d.length / 2)]
      : 0;
  const meanTicket =
    ticketSizes30d.length > 0
      ? total30dLiving / ticketSizes30d.length
      : 0;

  // Top Category Concentration
  const allLivingCats = [...fourPillar.myselfCategories, ...fourPillar.obligationsCategories]
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const topCat = allLivingCats[0];
  const topCatPct =
    topCat && fourPillar.totalLivingSpent > 0
      ? (topCat.spent / fourPillar.totalLivingSpent) * 100
      : 0;

  // Payday 7-day Surge %
  const cycleCurve = buildPaydayCycleCurve(input.transactions, input.payrolls, wallets, now);
  const first7Sum = cycleCurve
    .filter((p) => p.cycleDay <= 7)
    .reduce((s, p) => s + p.avgSpend, 0);
  const full30Sum = cycleCurve.reduce((s, p) => s + p.avgSpend, 0);
  const paydaySurgePct = full30Sum > 0 ? (first7Sum / full30Sum) * 100 : 0;

  // Goal Funding ETA
  const remainingGoalNeed = input.goals.reduce((sum, g) => {
    const rem = Math.max(0, (Number(g.targetAmount) || 0) - (Number(g.currentAmount) || 0));
    return sum + rem;
  }, 0);
  const monthlySurplusEst = Math.max(
    0,
    fourPillar.periodIncome - Math.max(total30dLiving, fourPillar.totalLivingSpent)
  );
  const goalMonthsEta =
    remainingGoalNeed <= 0
      ? 0
      : monthlySurplusEst > 50
      ? remainingGoalNeed / monthlySurplusEst
      : null;

  const smallLeakPct = total30dLiving > 0 ? (smallTicketTotal / total30dLiving) * 100 : 0;

  return [
    {
      id: 'zero_spend_days',
      label: 'Zero-Spend Days (30d)',
      value: `${zeroSpendDays} / 30d`,
      sublabel: `${Math.round((zeroSpendDays / 30) * 100)}% no-spend discipline`,
      tone: zeroSpendDays >= 10 ? 'positive' : zeroSpendDays >= 5 ? 'neutral' : 'warning',
    },
    {
      id: 'liquidity_months',
      label: 'Cash Runway Coverage',
      value: `${Math.min(99, liquidityMonths).toFixed(1)} mo`,
      sublabel: 'Liquid + Reserves vs 30d burn',
      tone: liquidityMonths >= 6 ? 'positive' : liquidityMonths >= 3 ? 'neutral' : 'warning',
    },
    {
      id: 'burn_ratio',
      label: 'Cycle Burn Ratio',
      value: `${burnRatioPct.toFixed(1)}%`,
      sublabel: 'Living spend / cycle income',
      tone: burnRatioPct <= 55 ? 'positive' : burnRatioPct <= 80 ? 'neutral' : 'negative',
    },
    {
      id: 'savings_velocity',
      label: 'Retention Velocity',
      value: `${Math.round(savingsVelocity).toLocaleString()} MAD/d`,
      sublabel: `Across ${elapsedDays}d elapsed in cycle`,
      tone: savingsVelocity > 0 ? 'positive' : 'negative',
      maskable: true,
    },
    {
      id: 'micro_leak',
      label: 'Small-Ticket Leak (<100)',
      value: `${Math.round(smallTicketTotal).toLocaleString()} MAD`,
      sublabel: `${smallTicketCount} txs · ${smallLeakPct.toFixed(0)}% of 30d spend`,
      tone: smallLeakPct <= 15 ? 'positive' : smallLeakPct <= 28 ? 'warning' : 'negative',
      maskable: true,
    },
    {
      id: 'weekend_ratio',
      label: 'Weekend Spend Factor',
      value: `${weekendMultiplier.toFixed(2)}x`,
      sublabel:
        weekendMultiplier > 1.15
          ? 'Heavier spend on Sat/Sun'
          : weekendMultiplier < 0.85
          ? 'Leaner weekends vs weekdays'
          : 'Balanced weekday/weekend pace',
      tone: weekendMultiplier <= 1.25 ? 'positive' : 'warning',
    },
    {
      id: 'payday_surge',
      label: 'First-7d Payday Surge',
      value: `${paydaySurgePct.toFixed(0)}%`,
      sublabel: 'Share of cycle spend in days 1–7',
      tone: paydaySurgePct <= 30 ? 'positive' : paydaySurgePct <= 45 ? 'neutral' : 'warning',
    },
    {
      id: 'fixed_cost_load',
      label: 'Fixed & Obligation Load',
      value: `${fixedLoadPct.toFixed(1)}%`,
      sublabel: `${Math.round(activeSubsMonthly).toLocaleString()} MAD/mo in active bills`,
      tone: fixedLoadPct <= 35 ? 'positive' : fixedLoadPct <= 55 ? 'neutral' : 'warning',
    },
    {
      id: 'ticket_profile',
      label: 'Median / Mean Ticket',
      value: `${Math.round(medianTicket)} / ${Math.round(meanTicket)} MAD`,
      sublabel: `${ticketSizes30d.length} living purchases (30d)`,
      tone: 'neutral',
      maskable: true,
    },
    {
      id: 'top_cat_share',
      label: 'Top Category Share',
      value: topCat ? `${topCatPct.toFixed(0)}%` : '—',
      sublabel: topCat ? stripLeadingEmoji(topCat.category) : 'No living spend yet',
      tone: topCatPct <= 35 ? 'positive' : topCatPct <= 55 ? 'neutral' : 'warning',
    },
    {
      id: 'debt_to_asset',
      label: 'Debt-to-Asset Ratio',
      value: `${balanceSheet.debtToAssetPct.toFixed(1)}%`,
      sublabel:
        balanceSheet.totalLiabilitiesMad > 0
          ? `${Math.round(balanceSheet.totalLiabilitiesMad).toLocaleString()} MAD total liabilities`
          : 'Debt-free balance sheet',
      tone:
        balanceSheet.debtToAssetPct <= 5
          ? 'positive'
          : balanceSheet.debtToAssetPct <= 25
          ? 'neutral'
          : 'negative',
    },
    {
      id: 'goal_eta',
      label: 'Active Goals ETA',
      value:
        input.goals.length === 0
          ? 'No Goals'
          : remainingGoalNeed <= 0
          ? '100% Funded'
          : goalMonthsEta !== null
          ? `${goalMonthsEta.toFixed(1)} mo`
          : 'Paused',
      sublabel:
        remainingGoalNeed > 0
          ? `${Math.round(remainingGoalNeed).toLocaleString()} MAD remaining`
          : `${input.goals.length} active goal${input.goals.length === 1 ? '' : 's'}`,
      tone: remainingGoalNeed <= 0 || (goalMonthsEta !== null && goalMonthsEta <= 12) ? 'positive' : 'neutral',
    },
  ];
}

export function buildSpendingHeatmap90d(
  transactions: Transaction[],
  dailyAllowance: number,
  wallets?: Wallet[],
  now = new Date()
): HeatmapDayCell[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89);

  const dayMap = new Map<string, { spent: number; txCount: number }>();
  for (const tx of transactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (day < start || day > today) continue;
    const amt = netExpenseOf(tx);
    if (amt <= 0) continue;
    const key = toDateKey(day);
    const cur = dayMap.get(key) || { spent: 0, txCount: 0 };
    cur.spent += amt;
    cur.txCount += 1;
    dayMap.set(key, cur);
  }

  // Determine dynamic reference cap if dailyAllowance is 0
  const nonZeroValues = Array.from(dayMap.values())
    .map((v) => v.spent)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const medianDay =
    nonZeroValues.length > 0 ? nonZeroValues[Math.floor(nonZeroValues.length / 2)] : 150;
  const capRef = dailyAllowance > 20 ? dailyAllowance : Math.max(80, medianDay * 1.4);

  const cells: HeatmapDayCell[] = [];
  for (let i = 89; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = toDateKey(d);
    const entry = dayMap.get(key);
    const spent = entry ? Number(entry.spent.toFixed(0)) : 0;
    const txCount = entry?.txCount ?? 0;

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (spent > 0) {
      const ratio = spent / capRef;
      if (ratio <= 0.4) intensity = 1;
      else if (ratio <= 0.85) intensity = 2;
      else if (ratio <= 1.1) intensity = 3;
      else intensity = 4;
    }

    cells.push({
      dateKey: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
      dayOfWeek: d.getDay(),
      spent,
      txCount,
      intensity,
    });
  }
  return cells;
}

export function buildPaydayCycleCurve(
  transactions: Transaction[],
  payrolls: Payroll[],
  wallets?: Wallet[],
  now = new Date()
): PaydayCycleDayPoint[] {
  const allPeriods: FinancialPeriod[] = getFinancialPeriods(payrolls).filter(
    (p) => p.start.getTime() <= now.getTime()
  );
  const currentFm = getCurrentFinancialMonth(payrolls, now);

  const buckets = Array.from({ length: 30 }, (_, idx) => ({
    cycleDay: idx + 1,
    totalHistorical: 0,
    samplePeriods: new Set<string>(),
    currentCycleSpend: 0,
  }));

  if (allPeriods.length > 0) {
    for (const tx of transactions) {
      if (!isLivingExpense(tx, wallets)) continue;
      const dt = new Date(tx.createdAt);
      if (Number.isNaN(dt.getTime())) continue;
      const amt = netExpenseOf(tx);
      if (amt <= 0) continue;

      const matched = allPeriods.find((p) => dt >= p.start && dt <= p.end);
      if (!matched) continue;
      const dayIdx = Math.min(
        29,
        Math.max(0, Math.floor((dt.getTime() - matched.start.getTime()) / 86_400_000))
      );
      const periodKey = `${matched.year}-${matched.month}`;
      buckets[dayIdx].totalHistorical += amt;
      buckets[dayIdx].samplePeriods.add(periodKey);
      if (currentFm && matched.year === currentFm.year && matched.month === currentFm.month) {
        buckets[dayIdx].currentCycleSpend += amt;
      }
    }
    const totalCompletedOrActive = Math.max(1, allPeriods.length);
    return buckets.map((b) => ({
      cycleDay: b.cycleDay,
      label: `D${b.cycleDay}`,
      avgSpend: Number((b.totalHistorical / totalCompletedOrActive).toFixed(0)),
      currentCycleSpend: Number(b.currentCycleSpend.toFixed(0)),
      sampleCount: totalCompletedOrActive,
    }));
  }

  // Fallback by day-of-month (1..30)
  const monthsSeen = new Set<string>();
  const curMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  for (const tx of transactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const amt = netExpenseOf(tx);
    if (amt <= 0) continue;
    const mKey = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
    monthsSeen.add(mKey);
    const dayIdx = Math.min(29, Math.max(0, dt.getDate() - 1));
    buckets[dayIdx].totalHistorical += amt;
    if (mKey === curMonthKey) {
      buckets[dayIdx].currentCycleSpend += amt;
    }
  }
  const monthDiv = Math.max(1, monthsSeen.size);
  return buckets.map((b) => ({
    cycleDay: b.cycleDay,
    label: `D${b.cycleDay}`,
    avgSpend: Number((b.totalHistorical / monthDiv).toFixed(0)),
    currentCycleSpend: Number(b.currentCycleSpend.toFixed(0)),
    sampleCount: monthDiv,
  }));
}

export function buildCategoryEfficiencyScatter(
  transactions: Transaction[],
  wallets?: Wallet[],
  days = 90,
  now = new Date()
): CategoryEfficiencyPoint[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const catMap = new Map<string, { count: number; total: number }>();

  for (const tx of transactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime()) || dt < cutoff) continue;
    const amt = netExpenseOf(tx);
    if (amt <= 0) continue;
    const cat = normalizeCategory(tx.category || '📦 Others');
    const cur = catMap.get(cat) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total += amt;
    catMap.set(cat, cur);
  }

  const raw = Array.from(catMap.entries()).map(([category, v]) => ({
    category,
    shortName: stripLeadingEmoji(category).slice(0, 18),
    txCount: v.count,
    avgTicket: Number((v.total / v.count).toFixed(0)),
    totalSpent: Number(v.total.toFixed(0)),
  }));

  if (raw.length === 0) return [];

  const medianCount = raw.map((r) => r.txCount).sort((a, b) => a - b)[Math.floor(raw.length / 2)] || 3;
  const medianTicket = raw.map((r) => r.avgTicket).sort((a, b) => a - b)[Math.floor(raw.length / 2)] || 100;

  return raw
    .map((r) => {
      let quadrant: CategoryEfficiencyPoint['quadrant'] = 'Quiet';
      if (r.txCount >= medianCount && r.avgTicket < medianTicket) quadrant = 'Micro-Leak';
      else if (r.txCount < medianCount && r.avgTicket >= medianTicket) quadrant = 'Heavy Hitter';
      else if (r.txCount >= medianCount && r.avgTicket >= medianTicket) quadrant = 'Core Driver';
      return { ...r, quadrant };
    })
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 12);
}

export function buildFinancialDisciplineRadar(input: DataGameInput): DisciplineRadarAxis[] {
  const now = input.now || new Date();
  const wallets = input.kpis?.accounts || [];
  const currentFm = getCurrentFinancialMonth(input.payrolls, now);
  const year = currentFm?.year ?? now.getFullYear();
  const month = currentFm?.month ?? now.getMonth() + 1;

  const fourPillar = computeFourPillarBreakdown({
    transactions: input.transactions,
    budgets: input.budgets,
    year,
    month,
    payrolls: input.payrolls,
    wallets,
    isCurrentMonth: true,
  });

  // 1. Savings Rate (target 35%+ = 100)
  const savingsScore = Math.round(Math.max(0, Math.min(100, (fourPillar.savedPctOfIncome / 35) * 100)));

  // 2. Budget Adherence (% of budgeted living categories staying under cap)
  const livingBudgeted = [...fourPillar.myselfCategories, ...fourPillar.obligationsCategories].filter(
    (c) => c.budgeted > 0
  );
  const withinCapCount = livingBudgeted.filter((c) => c.spent <= c.budgeted).length;
  const budgetScore =
    livingBudgeted.length > 0 ? Math.round((withinCapCount / livingBudgeted.length) * 100) : 65;

  // 3. Liquidity Cushion (Runway days vs 120d benchmark)
  const runway = input.kpis?.runwayDays ?? 0;
  const liquidityScore = Math.round(Math.max(0, Math.min(100, (runway / 120) * 100)));

  // 4. Daily Cap Discipline (under-cap days in last 30d)
  const heatmap = buildSpendingHeatmap90d(
    input.transactions,
    input.kpis?.dailyAllowance ?? 0,
    wallets,
    now
  );
  const last30 = heatmap.slice(-30);
  const underCap30 = last30.filter((d) => d.intensity < 4).length;
  const capDisciplineScore = Math.round((underCap30 / Math.max(1, last30.length)) * 100);

  // 5. Fixed-Cost Flexibility (100 when obligations <= 25% of income, drops toward 0 at 75%+)
  const oblPct = fourPillar.obligationsPctOfIncome;
  const flexibilityScore = Math.round(Math.max(0, Math.min(100, ((75 - oblPct) / 50) * 100)));

  // 6. Wealth Diversification (Balance across Liquid + Reserve + Investments)
  const balanceSheet = computeBalanceSheetSummary(wallets, {
    stockPortfolioMad: input.investmentsData?.totalPortfolioValueMad ?? 0,
  });
  const activeBuckets = [
    balanceSheet.liquidAssetsMad > 0,
    balanceSheet.reserveAssetsMad > 0,
    balanceSheet.growthAssetsMad > 0,
  ].filter(Boolean).length;
  const investedBonus = Math.min(40, (balanceSheet.growthSharePct / 20) * 40);
  const reserveBonus = Math.min(30, (balanceSheet.reserveSharePct / 25) * 30);
  const diversificationScore = Math.round(
    Math.max(0, Math.min(100, activeBuckets * 15 + investedBonus + reserveBonus))
  );

  return [
    {
      axis: 'Savings Rate',
      score: savingsScore,
      detail: `${fourPillar.savedPctOfIncome.toFixed(1)}% retained of cycle income (100 = 35%+)`,
    },
    {
      axis: 'Budget Control',
      score: budgetScore,
      detail:
        livingBudgeted.length > 0
          ? `${withinCapCount}/${livingBudgeted.length} living caps on track`
          : 'Set category caps to track adherence',
    },
    {
      axis: 'Cash Cushion',
      score: liquidityScore,
      detail: `${runway}d liquid runway (100 = 120d+)`,
    },
    {
      axis: 'Daily Cap',
      score: capDisciplineScore,
      detail: `${underCap30}/30 recent days stayed within daily cap`,
    },
    {
      axis: 'Cost Agility',
      score: flexibilityScore,
      detail: `Obligations are ${oblPct.toFixed(1)}% of income`,
    },
    {
      axis: 'Wealth Mix',
      score: diversificationScore,
      detail: `${activeBuckets}/3 asset classes active (Liquid, Reserves, Growth)`,
    },
  ];
}

export function computeDataGameProfile(input: DataGameInput): DataGameProfile {
  const now = input.now || new Date();
  const wallets = input.kpis?.accounts || [];
  const currentFm = getCurrentFinancialMonth(input.payrolls, now);
  const year = currentFm?.year ?? now.getFullYear();
  const month = currentFm?.month ?? now.getMonth() + 1;

  const fourPillar = computeFourPillarBreakdown({
    transactions: input.transactions,
    budgets: input.budgets,
    year,
    month,
    payrolls: input.payrolls,
    wallets,
    isCurrentMonth: true,
  });

  const heatmap90 = buildSpendingHeatmap90d(
    input.transactions,
    input.kpis?.dailyAllowance ?? 0,
    wallets,
    now
  );
  const last30 = heatmap90.slice(-30);
  const zeroSpendDays30d = last30.filter((d) => d.spent === 0).length;

  // Compute current & best under-cap streaks across last 90 days
  let bestStreak = 0;
  let running = 0;
  for (const day of heatmap90) {
    if (day.intensity < 4) {
      running += 1;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }
  const currentStreak = running;

  // Historical cycle records
  const periods = getFinancialPeriods(input.payrolls).filter(
    (p) => p.start.getTime() <= now.getTime()
  );
  let bestSavingsRate = -Infinity;
  let bestSavingsPeriodLabel = '';
  let positiveSavingsCycles = 0;

  for (const p of periods) {
    const fp = computeFourPillarBreakdown({
      transactions: input.transactions,
      budgets: input.budgets,
      year: p.year,
      month: p.month,
      payrolls: input.payrolls,
      wallets,
      isCurrentMonth: false,
    });
    if (fp.periodIncome > 0) {
      if (fp.savedPctOfIncome > 0) positiveSavingsCycles += 1;
      if (fp.savedPctOfIncome > bestSavingsRate) {
        bestSavingsRate = fp.savedPctOfIncome;
        bestSavingsPeriodLabel = new Date(p.year, p.month - 1, 1).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
      }
    }
  }

  // Leanest 7-day rolling window in last 90d
  let leanestWeekSpend = Infinity;
  let leanestWeekLabel = '';
  if (heatmap90.length >= 7) {
    for (let i = 0; i <= heatmap90.length - 7; i += 1) {
      const slice = heatmap90.slice(i, i + 7);
      const sum = slice.reduce((s, c) => s + c.spent, 0);
      const hasAnyActivityBefore = i > 0 || sum > 0;
      if (hasAnyActivityBefore && sum < leanestWeekSpend) {
        leanestWeekSpend = sum;
        leanestWeekLabel = `${slice[0].dateKey.slice(5)} → ${slice[6].dateKey.slice(5)}`;
      }
    }
  }

  // Micro-leak stats for challenge
  const total30dSpend = last30.reduce((s, d) => s + d.spent, 0);
  const thirtyStart = last30[0]?.dateKey || '';
  let microSpend30d = 0;
  for (const tx of input.transactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime()) || toDateKey(dt) < thirtyStart) continue;
    const amt = netExpenseOf(tx);
    if (amt > 0 && amt < 100) microSpend30d += amt;
  }
  const microSharePct = total30dSpend > 0 ? (microSpend30d / total30dSpend) * 100 : 0;

  // First 7d payday surge challenge
  const cycleCurve = buildPaydayCycleCurve(input.transactions, input.payrolls, wallets, now);
  const first7Current = cycleCurve.slice(0, 7).reduce((s, p) => s + p.currentCycleSpend, 0);
  const first7ShareOfIncome =
    fourPillar.periodIncome > 0 ? (first7Current / fourPillar.periodIncome) * 100 : 0;

  // Deterministic XP breakdown strictly from real verifiable ledger milestones
  const clearedDebtsCount = input.debts.filter((d) => d.status === 'Cleared').length;
  const activeGoalsFunded = input.goals.filter(
    (g) => (Number(g.currentAmount) || 0) >= (Number(g.targetAmount) || 1)
  ).length;
  const budgetedOnTrack = [...fourPillar.myselfCategories, ...fourPillar.obligationsCategories].filter(
    (c) => c.budgeted > 0 && c.spent <= c.budgeted
  ).length;
  const hasInvestedCapital =
    (input.investmentsData?.totalPortfolioValueMad ?? 0) > 0 || fourPillar.investedAmount > 0;

  const xpBreakdown: Array<{ source: string; xp: number; detail: string }> = [
    {
      source: 'Zero-Spend Days (30d)',
      xp: zeroSpendDays30d * 25,
      detail: `${zeroSpendDays30d} days × 25 XP`,
    },
    {
      source: 'Positive Savings Cycles',
      xp: positiveSavingsCycles * 150,
      detail: `${positiveSavingsCycles} cycle${positiveSavingsCycles === 1 ? '' : 's'} × 150 XP`,
    },
    {
      source: 'Under-Cap Streak Bonus',
      xp: bestStreak * 15,
      detail: `${bestStreak}d best streak × 15 XP`,
    },
    {
      source: 'Budgets Held Under Cap',
      xp: budgetedOnTrack * 40,
      detail: `${budgetedOnTrack} categories × 40 XP`,
    },
    {
      source: 'Debts Cleared',
      xp: clearedDebtsCount * 60,
      detail: `${clearedDebtsCount} settled × 60 XP`,
    },
    {
      source: 'Active Wealth & Goals',
      xp: (hasInvestedCapital ? 200 : 0) + activeGoalsFunded * 250,
      detail: hasInvestedCapital ? 'Portfolio active + completed goals' : 'Completed savings goals',
    },
  ];

  const totalXp = xpBreakdown.reduce((s, item) => s + item.xp, 0);
  const xpPerLevel = 500;
  const level = Math.max(1, Math.floor(totalXp / xpPerLevel) + 1);
  const currentLevelXp = totalXp % xpPerLevel;
  const levelProgressPct = Math.round((currentLevelXp / xpPerLevel) * 100);

  const tierTitle =
    level >= 10
      ? 'Capital Architect'
      : level >= 7
      ? 'Wealth Strategist'
      : level >= 5
      ? 'Surplus Builder'
      : level >= 3
      ? 'Disciplined Saver'
      : 'Ledger Starter';

  const challenges: BehavioralChallenge[] = [
    {
      id: 'zero_spend_10',
      title: '10 Zero-Spend Days (30d)',
      description: 'Log at least 10 full days with zero living expenses in a rolling 30-day window.',
      currentLabel: `${zeroSpendDays30d} days`,
      targetLabel: '10 days',
      progressPct: Math.min(100, Math.round((zeroSpendDays30d / 10) * 100)),
      status: zeroSpendDays30d >= 10 ? 'completed' : zeroSpendDays30d >= 6 ? 'on_track' : 'at_risk',
      xpReward: 250,
    },
    {
      id: 'streak_14',
      title: '14-Day Under-Cap Streak',
      description: 'Stay below your daily safe spending cap for 14 consecutive days.',
      currentLabel: `${currentStreak}d active`,
      targetLabel: '14d streak',
      progressPct: Math.min(100, Math.round((currentStreak / 14) * 100)),
      status: currentStreak >= 14 ? 'completed' : currentStreak >= 5 ? 'on_track' : 'at_risk',
      xpReward: 210,
    },
    {
      id: 'retention_30',
      title: '30%+ Cycle Cash Retention',
      description: 'Keep at least 30% of current cycle income retained in bank or invested.',
      currentLabel: `${fourPillar.totalWealthPctOfIncome.toFixed(1)}%`,
      targetLabel: '30% target',
      progressPct: Math.min(100, Math.round((fourPillar.totalWealthPctOfIncome / 30) * 100)),
      status:
        fourPillar.totalWealthPctOfIncome >= 30
          ? 'completed'
          : fourPillar.totalWealthPctOfIncome >= 18
          ? 'on_track'
          : 'at_risk',
      xpReward: 300,
    },
    {
      id: 'micro_leak_tamer',
      title: 'Small-Ticket Guard (<15%)',
      description: 'Keep small purchases under 100 MAD below 15% of your 30-day living spend.',
      currentLabel: `${microSharePct.toFixed(1)}% share`,
      targetLabel: '≤ 15% cap',
      progressPct:
        microSharePct <= 15
          ? 100
          : Math.max(10, Math.round((15 / Math.max(15, microSharePct)) * 100)),
      status: microSharePct <= 15 ? 'completed' : microSharePct <= 25 ? 'on_track' : 'at_risk',
      xpReward: 180,
    },
    {
      id: 'payday_calm',
      title: 'Payday Calm (First 7 Days)',
      description: 'Keep spending during the first 7 days of your pay cycle under 30% of income.',
      currentLabel: `${first7ShareOfIncome.toFixed(1)}% spent`,
      targetLabel: '≤ 30% income',
      progressPct:
        first7ShareOfIncome <= 30
          ? 100
          : Math.max(10, Math.round((30 / Math.max(30, first7ShareOfIncome)) * 100)),
      status:
        first7ShareOfIncome <= 30 ? 'completed' : first7ShareOfIncome <= 45 ? 'on_track' : 'at_risk',
      xpReward: 160,
    },
  ];

  const records: PersonalRecord[] = [
    {
      id: 'best_savings',
      label: 'Best Cycle Retention',
      value: Number.isFinite(bestSavingsRate) ? `${bestSavingsRate.toFixed(1)}%` : '—',
      context: bestSavingsPeriodLabel || 'Current cycle',
    },
    {
      id: 'best_streak',
      label: 'Longest Cap Streak (90d)',
      value: `${bestStreak} days`,
      context: currentStreak === bestStreak && bestStreak > 0 ? 'Active record' : `Current: ${currentStreak}d`,
    },
    {
      id: 'leanest_week',
      label: 'Leanest 7-Day Stretch',
      value: Number.isFinite(leanestWeekSpend) ? `${Math.round(leanestWeekSpend).toLocaleString()} MAD` : '—',
      context: leanestWeekLabel || 'Last 90 days',
    },
    {
      id: 'total_ledger_tx',
      label: 'Tracked Ledger Depth',
      value: `${input.transactions.length.toLocaleString()} txs`,
      context: `${wallets.length} account${wallets.length === 1 ? '' : 's'} · ${periods.length} cycles`,
    },
  ];

  return {
    level,
    tierTitle,
    totalXp,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    levelProgressPct,
    xpBreakdown,
    challenges,
    records,
    currentUnderCapStreak: currentStreak,
    bestUnderCapStreak: bestStreak,
    zeroSpendDays30d,
  };
}
