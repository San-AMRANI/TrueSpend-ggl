import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';
import type { CategoryBudget, Payroll, Transaction, Wallet } from '../types';
import {
  computeFourPillarBreakdown,
  isLivingExpense,
  isWealthAllocationCategory,
  netExpenseOf,
  netIncomeOf,
} from './finance';
import {
  FinancialPeriod,
  financialPeriodLabel,
  getFinancialPeriods,
} from './financialMonth';
import { normalizeCategory } from './categories';

export interface DailyBurnPoint {
  dateKey: string;
  label: string;
  spend: number;
  income: number;
  rolling7: number;
  cumSpend: number;
  idealPace: number;
  status: 'under' | 'near' | 'over';
}

export interface DailyBurnSeriesResult {
  points: DailyBurnPoint[];
  dailyCap: number;
  peakDayLabel: string;
  peakAmount: number;
  zeroSpendDays: number;
  avgDailySpend: number;
  daysUnderCap: number;
  daysUnderCapPct: number;
  periodCaption: string;
}

export function buildDailyLivingBurnSeries(params: {
  transactions: Transaction[];
  period: FinancialPeriod | null;
  dailyAllowanceHint?: number;
  periodBudgetTotal?: number;
  wallets?: Array<Pick<Wallet, 'id' | 'type'>>;
  now?: Date;
}): DailyBurnSeriesResult {
  const {
    transactions,
    period,
    dailyAllowanceHint = 0,
    periodBudgetTotal = 0,
    wallets,
    now = new Date(),
  } = params;

  const today = startOfDay(now);
  const windowEnd = period
    ? startOfDay(period.end) < today
      ? startOfDay(period.end)
      : today
    : today;

  const rawStart = period ? startOfDay(period.start) : addDays(windowEnd, -29);
  const rawDays = Math.max(1, differenceInCalendarDays(windowEnd, rawStart) + 1);
  const totalDaysShown = Math.min(35, Math.max(7, rawDays));
  const windowStart =
    rawDays > 35
      ? addDays(windowEnd, -34)
      : rawDays < 7 && !period
      ? addDays(windowEnd, -6)
      : rawStart;

  const fullPeriodDays = period
    ? Math.max(1, differenceInCalendarDays(startOfDay(period.end), startOfDay(period.start)) + 1)
    : totalDaysShown;

  const dailySpendMap = new Map<string, number>();
  const dailyIncomeMap = new Map<string, number>();

  for (const tx of transactions) {
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const key = format(dt, 'yyyy-MM-dd');
    if (tx.type === 'Expense' && isLivingExpense(tx, wallets)) {
      const net = netExpenseOf(tx);
      if (net > 0) dailySpendMap.set(key, (dailySpendMap.get(key) || 0) + net);
    } else if (tx.type === 'Income') {
      const inc = netIncomeOf(tx);
      if (inc > 0) dailyIncomeMap.set(key, (dailyIncomeMap.get(key) || 0) + inc);
    }
  }

  // Derive daily cap: prefer explicit dailyAllowanceHint for active cycle, else period living budget / days, else period avg
  let dailyCap = dailyAllowanceHint > 0 ? dailyAllowanceHint : 0;
  if (dailyCap <= 0 && periodBudgetTotal > 0) {
    dailyCap = periodBudgetTotal / fullPeriodDays;
  }

  const points: DailyBurnPoint[] = [];
  let cumSpend = 0;
  const recentWindow: number[] = [];

  for (let i = 0; i < totalDaysShown; i++) {
    const d = addDays(windowStart, i);
    const key = format(d, 'yyyy-MM-dd');
    const spend = Math.round((dailySpendMap.get(key) || 0) * 100) / 100;
    const income = Math.round((dailyIncomeMap.get(key) || 0) * 100) / 100;
    cumSpend += spend;
    recentWindow.push(spend);
    if (recentWindow.length > 7) recentWindow.shift();
    const rolling7 =
      recentWindow.reduce((sum, v) => sum + v, 0) / Math.max(1, recentWindow.length);

    points.push({
      dateKey: key,
      label: format(d, 'MMM d'),
      spend,
      income,
      rolling7: Math.round(rolling7 * 100) / 100,
      cumSpend: Math.round(cumSpend * 100) / 100,
      idealPace: Math.round(dailyCap * (i + 1) * 100) / 100,
      status: 'under',
    });
  }

  const avgDailySpend = points.length > 0 ? cumSpend / points.length : 0;
  if (dailyCap <= 0 && avgDailySpend > 0) {
    dailyCap = avgDailySpend;
    points.forEach((pt, idx) => {
      pt.idealPace = Math.round(dailyCap * (idx + 1) * 100) / 100;
    });
  }

  let peak = points[0];
  let zeroSpendDays = 0;
  let daysUnderCap = 0;

  for (const pt of points) {
    pt.status =
      dailyCap <= 0
        ? 'under'
        : pt.spend > dailyCap
        ? 'over'
        : pt.spend >= dailyCap * 0.8
        ? 'near'
        : 'under';
    if (!peak || pt.spend > peak.spend) peak = pt;
    if (pt.spend === 0) zeroSpendDays += 1;
    if (dailyCap <= 0 || pt.spend <= dailyCap) daysUnderCap += 1;
  }

  return {
    points,
    dailyCap: Math.round(dailyCap),
    peakDayLabel: peak && peak.spend > 0 ? peak.label : 'None',
    peakAmount: peak ? Math.round(peak.spend) : 0,
    zeroSpendDays,
    avgDailySpend: Math.round(avgDailySpend),
    daysUnderCap,
    daysUnderCapPct: points.length > 0 ? Math.round((daysUnderCap / points.length) * 100) : 100,
    periodCaption: period
      ? `${financialPeriodLabel(period)} · Daily cap ${Math.round(dailyCap).toLocaleString()} MAD`
      : `Last ${points.length} days living spend vs daily cap`,
  };
}

export interface MultiCycleTrendPoint {
  label: string;
  periodRange: string;
  income: number;
  livingSpend: number;
  wealthBuilt: number;
  netSurplus: number;
  savingsRate: number;
}

interface ChartCycleWindow {
  start: Date;
  end: Date;
  year: number;
  month: number;
  label: string;
  periodRange: string;
  isPayrollBacked: boolean;
}

function deriveChartCycles(
  transactions: Transaction[],
  payrolls: Payroll[],
  maxCycles: number,
  now: Date
): ChartCycleWindow[] {
  const payrollPeriods = getFinancialPeriods(payrolls)
    .filter((p) => p.start.getTime() <= now.getTime())
    .slice(-maxCycles);

  if (payrollPeriods.length >= 2) {
    return payrollPeriods.map((p) => ({
      start: p.start,
      end: p.end,
      year: p.year,
      month: p.month,
      label: format(p.end, 'MMM yy'),
      periodRange: financialPeriodLabel(p),
      isPayrollBacked: true,
    }));
  }

  // Fallback to calendar months spanned by actual transactions so multi-month users still see trends
  const monthKeys = new Set<string>();
  for (const tx of transactions) {
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime()) || dt.getTime() > now.getTime()) continue;
    monthKeys.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  const sortedKeys = Array.from(monthKeys).sort().slice(-maxCycles);
  return sortedKeys.map((key) => {
    const [yrStr, moStr] = key.split('-');
    const year = Number(yrStr);
    const month = Number(moStr);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return {
      start,
      end,
      year,
      month,
      label: format(start, 'MMM yy'),
      periodRange: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
      isPayrollBacked: false,
    };
  });
}

export function buildMultiCycleTrendSeries(params: {
  transactions: Transaction[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  wallets?: Array<Pick<Wallet, 'id' | 'type'>>;
  maxCycles?: number;
  now?: Date;
}): MultiCycleTrendPoint[] {
  const { transactions, budgets, payrolls, wallets, maxCycles = 6, now = new Date() } = params;
  const cycles = deriveChartCycles(transactions, payrolls, maxCycles, now);

  return cycles.map((c) => {
    if (c.isPayrollBacked) {
      const isCurrent = now >= c.start && now <= c.end;
      const breakdown = computeFourPillarBreakdown({
        transactions,
        budgets,
        year: c.year,
        month: c.month,
        payrolls,
        wallets,
        isCurrentMonth: isCurrent,
      });
      const income = Math.round(breakdown.periodIncome);
      const livingSpend = Math.round(breakdown.totalLivingSpent);
      const wealthBuilt = Math.round(breakdown.totalWealthBuilt);
      const netSurplus = Math.round(income - livingSpend);
      const savingsRate =
        income > 0 ? Math.max(-100, Math.min(100, Math.round((netSurplus / income) * 100))) : 0;

      return {
        label: c.label,
        periodRange: c.periodRange,
        income,
        livingSpend,
        wealthBuilt,
        netSurplus,
        savingsRate,
      };
    }

    // Calendar-month aggregation fallback
    let income = 0;
    let livingSpend = 0;
    for (const tx of transactions) {
      const dt = new Date(tx.createdAt);
      if (Number.isNaN(dt.getTime()) || dt < c.start || dt > c.end) continue;
      if (tx.type === 'Income') {
        income += netIncomeOf(tx);
      } else if (tx.type === 'Expense' && isLivingExpense(tx, wallets)) {
        livingSpend += netExpenseOf(tx);
      }
    }
    income = Math.round(income);
    livingSpend = Math.round(livingSpend);
    const netSurplus = Math.round(income - livingSpend);
    const savingsRate =
      income > 0 ? Math.max(-100, Math.min(100, Math.round((netSurplus / income) * 100))) : 0;

    return {
      label: c.label,
      periodRange: c.periodRange,
      income,
      livingSpend,
      wealthBuilt: Math.max(0, netSurplus),
      netSurplus,
      savingsRate,
    };
  });
}

export interface WeekdaySpendPoint {
  dayIndex: number;
  shortName: string;
  dayName: string;
  totalSpend: number;
  avgSpend: number;
  txCount: number;
  sharePct: number;
  isPeak: boolean;
  isLowest: boolean;
}

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildWeekdaySpendProfile(
  filteredTransactions: Transaction[],
  wallets?: Array<Pick<Wallet, 'id' | 'type'>>
): WeekdaySpendPoint[] {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const uniqueDatesByDow: Array<Set<string>> = Array.from({ length: 7 }, () => new Set<string>());

  for (const tx of filteredTransactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const net = netExpenseOf(tx);
    if (net <= 0) continue;
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const dow = dt.getDay();
    totals[dow] += net;
    counts[dow] += 1;
    uniqueDatesByDow[dow].add(format(dt, 'yyyy-MM-dd'));
  }

  const grandTotal = totals.reduce((a, b) => a + b, 0);
  const rawAvgs = totals.map((t, i) =>
    uniqueDatesByDow[i].size > 0 ? t / uniqueDatesByDow[i].size : 0
  );
  const maxAvg = Math.max(...rawAvgs);
  const positiveAvgs = rawAvgs.filter((v) => v > 0);
  const minPositiveAvg = positiveAvgs.length > 0 ? Math.min(...positiveAvgs) : 0;

  return WEEKDAY_FULL.map((dayName, i) => ({
    dayIndex: i,
    shortName: WEEKDAY_SHORT[i],
    dayName,
    totalSpend: Math.round(totals[i]),
    avgSpend: Math.round(rawAvgs[i]),
    txCount: counts[i],
    sharePct: grandTotal > 0 ? Math.round((totals[i] / grandTotal) * 1000) / 10 : 0,
    isPeak: maxAvg > 0 && rawAvgs[i] === maxAvg,
    isLowest: minPositiveAvg > 0 && rawAvgs[i] === minPositiveAvg && rawAvgs[i] < maxAvg,
  }));
}

export interface SpendSizeBucket {
  id: string;
  label: string;
  rangeLabel: string;
  totalAmount: number;
  txCount: number;
  amountSharePct: number;
  countSharePct: number;
  color: string;
}

export function buildSpendSizeDistribution(
  filteredTransactions: Transaction[],
  wallets?: Array<Pick<Wallet, 'id' | 'type'>>
): SpendSizeBucket[] {
  const defs = [
    { id: 'micro', label: 'Micro', rangeLabel: '< 50 MAD', min: 0, max: 50, color: '#10b981' },
    { id: 'everyday', label: 'Everyday', rangeLabel: '50–150', min: 50, max: 150, color: '#0ea5e9' },
    { id: 'mid', label: 'Mid-Size', rangeLabel: '150–500', min: 150, max: 500, color: '#6366f1' },
    { id: 'major', label: 'Major', rangeLabel: '500–1.5k', min: 500, max: 1500, color: '#f59e0b' },
    { id: 'big', label: 'Big-Ticket', rangeLabel: '1.5k+', min: 1500, max: Infinity, color: '#f43f5e' },
  ];

  const buckets = defs.map((d) => ({ ...d, totalAmount: 0, txCount: 0 }));
  let grandAmount = 0;
  let grandCount = 0;

  for (const tx of filteredTransactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const net = netExpenseOf(tx);
    if (net <= 0) continue;
    const bucket = buckets.find((b) => net >= b.min && net < b.max) || buckets[buckets.length - 1];
    bucket.totalAmount += net;
    bucket.txCount += 1;
    grandAmount += net;
    grandCount += 1;
  }

  return buckets.map((b) => ({
    id: b.id,
    label: b.label,
    rangeLabel: b.rangeLabel,
    totalAmount: Math.round(b.totalAmount),
    txCount: b.txCount,
    amountSharePct: grandAmount > 0 ? Math.round((b.totalAmount / grandAmount) * 1000) / 10 : 0,
    countSharePct: grandCount > 0 ? Math.round((b.txCount / grandCount) * 1000) / 10 : 0,
    color: b.color,
  }));
}

export interface BudgetPacingPoint {
  category: string;
  shortCategory: string;
  spent: number;
  budget: number;
  pctUsed: number;
  cappedPct: number;
  status: 'safe' | 'watch' | 'over';
}

export function buildBudgetPacingSeries(params: {
  budgets: CategoryBudget[];
  filteredTransactions: Transaction[];
  year: number;
  month: number;
  wallets?: Array<Pick<Wallet, 'id' | 'type'>>;
}): BudgetPacingPoint[] {
  const { budgets, filteredTransactions, year, month, wallets } = params;
  const budgetMap = new Map<string, number>();

  for (const b of budgets) {
    if (b.year !== year || b.month !== month) continue;
    const norm = normalizeCategory(b.category);
    if (isWealthAllocationCategory(norm)) continue;
    const amt = parseFloat(b.amount) || 0;
    if (amt > 0) budgetMap.set(norm, (budgetMap.get(norm) || 0) + amt);
  }

  const spentMap = new Map<string, number>();
  for (const tx of filteredTransactions) {
    if (!isLivingExpense(tx, wallets)) continue;
    const norm = normalizeCategory(tx.category || 'Uncategorized');
    if (isWealthAllocationCategory(norm)) continue;
    spentMap.set(norm, (spentMap.get(norm) || 0) + netExpenseOf(tx));
  }

  const rows: BudgetPacingPoint[] = [];
  for (const [category, budget] of budgetMap.entries()) {
    const spent = Math.round(spentMap.get(category) || 0);
    const pctUsed = budget > 0 ? Math.round((spent / budget) * 1000) / 10 : 0;
    const cleanLabel = category.replace(/^[^\p{L}\p{N}]+/u, '').trim() || category;
    rows.push({
      category,
      shortCategory: cleanLabel.length > 18 ? `${cleanLabel.slice(0, 17)}…` : cleanLabel,
      spent,
      budget: Math.round(budget),
      pctUsed,
      cappedPct: Math.min(140, pctUsed),
      status: pctUsed >= 100 ? 'over' : pctUsed >= 80 ? 'watch' : 'safe',
    });
  }

  return rows.sort((a, b) => b.pctUsed - a.pctUsed).slice(0, 10);
}

export interface CategoryTrendResult {
  categories: string[];
  series: Array<Record<string, string | number>>;
}

export function buildTopCategoriesMultiCycleTrend(params: {
  transactions: Transaction[];
  payrolls: Payroll[];
  wallets?: Array<Pick<Wallet, 'id' | 'type'>>;
  maxCycles?: number;
  topN?: number;
  now?: Date;
}): CategoryTrendResult {
  const { transactions, payrolls, wallets, maxCycles = 6, topN = 5, now = new Date() } = params;
  const cycles = deriveChartCycles(transactions, payrolls, maxCycles, now);

  if (cycles.length === 0) {
    return { categories: [], series: [] };
  }

  const livingTxs = transactions.filter((t) => isLivingExpense(t, wallets));
  const totalByCat = new Map<string, number>();
  const periodCatTotals: Array<Map<string, number>> = cycles.map(() => new Map());

  for (const tx of livingTxs) {
    const dt = new Date(tx.createdAt);
    if (Number.isNaN(dt.getTime())) continue;
    const net = netExpenseOf(tx);
    if (net <= 0) continue;
    const norm = normalizeCategory(tx.category || 'Uncategorized');
    if (isWealthAllocationCategory(norm)) continue;

    for (let i = 0; i < cycles.length; i++) {
      const p = cycles[i];
      if (dt >= p.start && dt <= p.end) {
        periodCatTotals[i].set(norm, (periodCatTotals[i].get(norm) || 0) + net);
        totalByCat.set(norm, (totalByCat.get(norm) || 0) + net);
        break;
      }
    }
  }

  const topCategories = Array.from(totalByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([cat]) => cat);

  const series = cycles.map((p, i) => {
    const row: Record<string, string | number> = {
      label: p.label,
      periodRange: p.periodRange,
    };
    let otherTotal = 0;
    for (const [cat, val] of periodCatTotals[i].entries()) {
      if (topCategories.includes(cat)) {
        row[cat] = Math.round(val);
      } else {
        otherTotal += val;
      }
    }
    for (const cat of topCategories) {
      if (row[cat] === undefined) row[cat] = 0;
    }
    if (otherTotal > 0) {
      row['Other'] = Math.round(otherTotal);
    }
    return row;
  });

  const hasOther = series.some((r) => Number(r['Other'] || 0) > 0);
  return {
    categories: hasOther ? [...topCategories, 'Other'] : topCategories,
    series,
  };
}
