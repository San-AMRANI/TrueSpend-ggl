import { CategoryBudget, Debt, KPI, Transaction } from '../types/index.js';
import { amountOf, getExpensesForMonth, isInMonth, transactionDate } from './finance.js';
import { normalizeCategory } from './categories.js';
import { getCurrentFinancialMonth, getPreviousFinancialMonth, type PayrollLike } from './financialMonth.js';

// ─── Fact Shape ─────────────────────────────────────────────────────────────

export type FactIcon =
  | 'trending-up'
  | 'trending-down'
  | 'wallet'
  | 'calendar'
  | 'coffee'
  | 'shopping-bag'
  | 'landmark'
  | 'banknote'
  | 'piggy-bank'
  | 'receipt'
  | 'alert-triangle'
  | 'bar-chart'
  | 'activity'
  | 'clock'
  | 'repeat'
  | 'zap'
  | 'target'
  | 'arrow-up-right'
  | 'arrow-down-right'
  | 'shield-check'
  | 'users'
  | 'hand-coins'
  | 'layers'
  | 'utensils'
  | 'award'
  | 'sparkles'
  | 'percent'
  | 'pie-chart';

export interface FinancialFact {
  id: string;
  type:
    | 'spending'
    | 'budget'
    | 'liquidity'
    | 'debt'
    | 'reimbursement'
    | 'income'
    | 'behavioral'
    | 'daily'
    | 'savings'
    | 'milestone';
  title: string;
  message: string;
  value: string;
  icon: FactIcon;
  /** 1 (highest) → 5 (lowest). Lower number = shown earlier in prioritized sort. */
  priority: 1 | 2 | 3 | 4 | 5;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Return only real expense transactions (no transfers, no debt repayments). */
const realExpenses = (txs: Transaction[]) =>
  txs.filter((t) => t.type === 'Expense' && normalizeCategory(t.category) !== 'Debt Repayment');

/** Day-of-week label. */
const dayName = (d: Date) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];

/** UTC midnight date key. */
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

// ─── Generator ──────────────────────────────────────────────────────────────

export function generateFacts(
  kpis: KPI | null,
  transactions: Transaction[],
  debts: Debt[],
  budgets: CategoryBudget[],
  payrolls: PayrollLike[] = [],
): FinancialFact[] {
  if (!kpis) return [];

  const currentPeriod = getCurrentFinancialMonth(payrolls);
  if (!currentPeriod) return [];
  const now = new Date();
  const year = currentPeriod.year;
  const month = currentPeriod.month;

  const thisMonthExpenses = realExpenses(getExpensesForMonth(transactions, year, month, payrolls));
  const allExpenses = realExpenses(transactions);

  const prevMonthRef = getPreviousFinancialMonth(payrolls, currentPeriod);
  const prevMonthExpenses = prevMonthRef ? realExpenses(getExpensesForMonth(transactions, prevMonthRef.year, prevMonthRef.month, payrolls)) : [];

  const facts: FinancialFact[] = [];

  // ── SPENDING FACTS ───────────────────────────────────────────────────────

  // Top spending category
  if (thisMonthExpenses.length >= 2) {
    const byCategory: Record<string, number> = {};
    for (const t of thisMonthExpenses) {
      const cat = normalizeCategory(t.category) || t.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + amountOf(t);
    }
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topCat, topAmt] = sorted[0];
      facts.push({
        id: 'top-category',
        type: 'spending',
        title: 'Top spending category',
        message: `Your biggest spending category this month is ${topCat}.`,
        value: `${fmt(topAmt)} MAD`,
        icon: 'bar-chart',
        priority: 2,
      });
    }
  }

  // Largest expense this month
  if (thisMonthExpenses.length >= 1) {
    const largest = [...thisMonthExpenses].sort((a, b) => amountOf(b) - amountOf(a))[0];
    facts.push({
      id: 'largest-expense',
      type: 'spending',
      title: 'Largest expense',
      message: `Your largest expense this month was${largest.notes ? ` "${largest.notes}"` : ''} on ${normalizeCategory(largest.category) || largest.category}.`,
      value: `${fmt(amountOf(largest))} MAD`,
      icon: 'arrow-up-right',
      priority: 3,
    });
  }

  // Small purchases (< 50 MAD)
  const smallPurchases = thisMonthExpenses.filter((t) => amountOf(t) < 50);
  if (smallPurchases.length >= 3) {
    facts.push({
      id: 'small-purchases',
      type: 'spending',
      title: 'Small purchases',
      message: `You made ${smallPurchases.length} purchases under 50 MAD this month.`,
      value: `${fmt(smallPurchases.reduce((s, t) => s + amountOf(t), 0))} MAD total`,
      icon: 'receipt',
      priority: 4,
    });
  }

  // Most frequent category
  if (thisMonthExpenses.length >= 3) {
    const byCount: Record<string, number> = {};
    for (const t of thisMonthExpenses) {
      const cat = normalizeCategory(t.category) || t.category || 'Other';
      byCount[cat] = (byCount[cat] || 0) + 1;
    }
    const sorted = Object.entries(byCount).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 3) {
      const [freqCat, count] = sorted[0];
      facts.push({
        id: 'frequent-category',
        type: 'spending',
        title: 'Most frequent category',
        message: `${freqCat} is your most frequent spending category this month.`,
        value: `${count} transactions`,
        icon: 'repeat',
        priority: 4,
      });
    }
  }

  // Coffee habit
  const coffeeTxs = thisMonthExpenses.filter((t) => normalizeCategory(t.category) === '☕ Coffee & Quick Food');
  if (coffeeTxs.length >= 2) {
    const coffeeTotal = coffeeTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'coffee-habit',
      type: 'spending',
      title: 'Coffee habit',
      message: `You made ${coffeeTxs.length} coffee purchases this month.`,
      value: `${fmt(coffeeTotal)} MAD`,
      icon: 'coffee',
      priority: 4,
    });
  }

  // Average transaction this month
  if (thisMonthExpenses.length >= 3) {
    const avg = thisMonthExpenses.reduce((s, t) => s + amountOf(t), 0) / thisMonthExpenses.length;
    facts.push({
      id: 'avg-transaction',
      type: 'spending',
      title: 'Average expense',
      message: `Your average expense this month across ${thisMonthExpenses.length} transactions.`,
      value: `${fmt(avg)} MAD`,
      icon: 'activity',
      priority: 5,
    });
  }

  // Weekend spending
  const weekendTxs = thisMonthExpenses.filter((t) => {
    const d = transactionDate(t).getDay();
    return d === 0 || d === 6;
  });
  if (weekendTxs.length >= 2) {
    const weekendTotal = weekendTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'weekend-spending',
      type: 'spending',
      title: 'Weekend spending',
      message: `You spent ${weekendTxs.length} transactions' worth on weekends this month.`,
      value: `${fmt(weekendTotal)} MAD`,
      icon: 'calendar',
      priority: 5,
    });
  }

  // Recent spending (last 7 days)
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const recentTxs = allExpenses.filter((t) => transactionDate(t) >= sevenDaysAgo);
  if (recentTxs.length >= 2) {
    const recentTotal = recentTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'recent-spending',
      type: 'spending',
      title: 'Last 7 days',
      message: `You've made ${recentTxs.length} expense transactions in the last 7 days.`,
      value: `${fmt(recentTotal)} MAD`,
      icon: 'clock',
      priority: 3,
    });
  }

  // Largest recent purchase (last 7 days)
  if (recentTxs.length >= 1) {
    const largestRecent = [...recentTxs].sort((a, b) => amountOf(b) - amountOf(a))[0];
    facts.push({
      id: 'largest-recent',
      type: 'spending',
      title: 'Biggest recent purchase',
      message: `Your largest purchase in the last 7 days was${largestRecent.notes ? ` "${largestRecent.notes}"` : ''}.`,
      value: `${fmt(amountOf(largestRecent))} MAD`,
      icon: 'zap',
      priority: 3,
    });
  }

  // Spending concentration (top 3)
  if (thisMonthExpenses.length >= 4) {
    const sorted = [...thisMonthExpenses].sort((a, b) => amountOf(b) - amountOf(a));
    const total = sorted.reduce((s, t) => s + amountOf(t), 0);
    const top3 = sorted.slice(0, 3).reduce((s, t) => s + amountOf(t), 0);
    const pct = total > 0 ? (top3 / total) * 100 : 0;
    if (pct >= 30) {
      facts.push({
        id: 'spending-concentration',
        type: 'spending',
        title: 'Spending concentration',
        message: `Your top 3 expenses represent ${pct.toFixed(0)}% of your total spending this month.`,
        value: `${fmt(top3)} MAD`,
        icon: 'layers',
        priority: 3,
      });
    }
  }

  // Transaction frequency (total expense count)
  if (thisMonthExpenses.length >= 5) {
    facts.push({
      id: 'tx-frequency',
      type: 'spending',
      title: 'Transaction count',
      message: `You've made ${thisMonthExpenses.length} expense transactions this month.`,
      value: `${thisMonthExpenses.length} transactions`,
      icon: 'receipt',
      priority: 5,
    });
  }

  // Food spending mix (Groceries vs Dining & Coffee)
  const groceryTxs = thisMonthExpenses.filter((t) => normalizeCategory(t.category) === '🛒 Groceries');
  const diningTxs = thisMonthExpenses.filter((t) => {
    const cat = normalizeCategory(t.category);
    return cat === '🍔 Dining & Takeaway' || cat === '☕ Coffee & Quick Food';
  });
  const groceryTotal = groceryTxs.reduce((s, t) => s + amountOf(t), 0);
  const diningTotal = diningTxs.reduce((s, t) => s + amountOf(t), 0);
  const totalFood = groceryTotal + diningTotal;
  if (totalFood >= 80) {
    const groceryPct = (groceryTotal / totalFood) * 100;
    const isMoreGroceries = groceryTotal >= diningTotal;
    facts.push({
      id: 'food-spending-mix',
      type: 'spending',
      title: 'Food spending mix',
      message: isMoreGroceries
        ? `You invested ${fmt(groceryTotal)} MAD in home groceries vs ${fmt(diningTotal)} MAD on dining out & cafes.`
        : `Dining out and cafes took ${fmt(diningTotal)} MAD vs ${fmt(groceryTotal)} MAD on home groceries.`,
      value: `${isMoreGroceries ? groceryPct.toFixed(0) : (100 - groceryPct).toFixed(0)}% ${isMoreGroceries ? 'groceries' : 'dining out'}`,
      icon: 'utensils',
      priority: 4,
    });
  }

  // Single-day spending peak
  if (thisMonthExpenses.length >= 3) {
    const byDate: Record<string, { total: number; count: number; date: Date }> = {};
    for (const t of thisMonthExpenses) {
      const d = transactionDate(t);
      const k = dateKey(d);
      if (!byDate[k]) {
        byDate[k] = { total: 0, count: 0, date: d };
      }
      byDate[k].total += amountOf(t);
      byDate[k].count += 1;
    }
    const peak = Object.values(byDate).sort((a, b) => b.total - a.total)[0];
    if (peak && peak.total >= 150) {
      facts.push({
        id: 'peak-spending-day',
        type: 'spending',
        title: 'Single-day peak outflow',
        message: `Your highest single-day spend was on ${peak.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} across ${peak.count} purchase${peak.count > 1 ? 's' : ''}.`,
        value: `${fmt(peak.total)} MAD`,
        icon: 'zap',
        priority: 3,
      });
    }
  }

  // Micro-purchases leakage (< 25 MAD)
  const microTxs = thisMonthExpenses.filter((t) => amountOf(t) < 25);
  if (microTxs.length >= 4) {
    const microTotal = microTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'micro-purchases-leakage',
      type: 'spending',
      title: 'Micro-expense leakage',
      message: `Small purchases under 25 MAD quietly accumulated to ${fmt(microTotal)} MAD across ${microTxs.length} purchases.`,
      value: `${fmt(microTotal)} MAD`,
      icon: 'receipt',
      priority: 4,
    });
  }

  // Transportation & Mobility
  const transportTxs = thisMonthExpenses.filter((t) => normalizeCategory(t.category) === '🚗 Transportation');
  if (transportTxs.length >= 2) {
    const transportTotal = transportTxs.reduce((s, t) => s + amountOf(t), 0);
    if (transportTotal >= 50) {
      facts.push({
        id: 'transport-spending',
        type: 'spending',
        title: 'Transit & mobility',
        message: `You've spent ${fmt(transportTotal)} MAD on transport, fuel, and travel across ${transportTxs.length} trips this month.`,
        value: `${fmt(transportTotal)} MAD`,
        icon: 'landmark',
        priority: 4,
      });
    }
  }

  // Telecom & Subscriptions
  const subTxs = thisMonthExpenses.filter((t) => normalizeCategory(t.category) === '📱 Telecom & Subscriptions');
  if (subTxs.length >= 1) {
    const subTotal = subTxs.reduce((s, t) => s + amountOf(t), 0);
    if (subTotal >= 30) {
      facts.push({
        id: 'telecom-subs-spending',
        type: 'spending',
        title: 'Subscriptions & telecom',
        message: `Monthly recurring digital subscriptions and telecom charges total ${fmt(subTotal)} MAD.`,
        value: `${fmt(subTotal)} MAD`,
        icon: 'repeat',
        priority: 4,
      });
    }
  }

  // Social & Leisure
  const socialTxs = thisMonthExpenses.filter((t) => {
    const cat = normalizeCategory(t.category);
    return cat === '🎬 Entertainment' || cat === '👥 Social';
  });
  if (socialTxs.length >= 2) {
    const socialTotal = socialTxs.reduce((s, t) => s + amountOf(t), 0);
    if (socialTotal >= 50) {
      facts.push({
        id: 'social-leisure-spending',
        type: 'spending',
        title: 'Social & entertainment',
        message: `You spent ${fmt(socialTotal)} MAD enjoying social outings and entertainment activities this cycle.`,
        value: `${fmt(socialTotal)} MAD`,
        icon: 'shopping-bag',
        priority: 4,
      });
    }
  }

  // Context & Mission & Project Outlay
  const contextTxs = thisMonthExpenses.filter((t) => t.contextId);
  if (contextTxs.length >= 2) {
    const contextTotal = contextTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'context-project-outlay',
      type: 'spending',
      title: 'Project & mission spending',
      message: `You logged ${contextTxs.length} expenses tied to specific project or trip contexts this month.`,
      value: `${fmt(contextTotal)} MAD`,
      icon: 'layers',
      priority: 3,
    });
  }

  // Spending Category Diversity
  if (thisMonthExpenses.length >= 5) {
    const uniqueCats = new Set(thisMonthExpenses.map((t) => normalizeCategory(t.category) || t.category));
    if (uniqueCats.size >= 4) {
      facts.push({
        id: 'spending-diversity',
        type: 'spending',
        title: 'Spending diversity',
        message: `Your expenses this cycle are spread across ${uniqueCats.size} distinct lifestyle categories.`,
        value: `${uniqueCats.size} categories`,
        icon: 'pie-chart',
        priority: 5,
      });
    }
  }

  // Fixed vs Discretionary Ratio
  const fixedCategories = new Set([
    '🏠 Housing & Utilities',
    '📱 Telecom & Subscriptions',
    '💳 Debt & Obligations',
    '🩺 Health & Medical',
  ]);
  let fixedSpend = 0;
  let discretionarySpend = 0;
  for (const t of thisMonthExpenses) {
    const cat = normalizeCategory(t.category);
    if (fixedCategories.has(cat)) {
      fixedSpend += amountOf(t);
    } else {
      discretionarySpend += amountOf(t);
    }
  }
  const totalAssessed = fixedSpend + discretionarySpend;
  if (totalAssessed >= 200 && fixedSpend > 0 && discretionarySpend > 0) {
    const fixedPct = (fixedSpend / totalAssessed) * 100;
    facts.push({
      id: 'fixed-vs-discretionary',
      type: 'spending',
      title: 'Fixed vs flexible spending',
      message: `${fixedPct.toFixed(0)}% of your expenses went to fixed essentials (${fmt(fixedSpend)} MAD) vs flexible choices (${fmt(discretionarySpend)} MAD).`,
      value: `${fixedPct.toFixed(0)}% fixed`,
      icon: 'pie-chart',
      priority: 4,
    });
  }

  // Average Daily Outflow (Realized Burn)
  if (typeof kpis.avgDailySpend === 'number' && kpis.avgDailySpend > 0) {
    facts.push({
      id: 'avg-daily-burn',
      type: 'spending',
      title: 'Average daily burn',
      message: 'Your realized daily average outflow across the current financial cycle.',
      value: `${fmt(kpis.avgDailySpend)} MAD / day`,
      icon: 'trending-up',
      priority: 3,
    });
  }

  // Month-end Forecast Projection
  if (kpis.forecast && kpis.forecast.expected > 0 && kpis.forecast.elapsedDays >= 3) {
    facts.push({
      id: 'forecast-projection',
      type: 'spending',
      title: 'Projected cycle spend',
      message: `Projected month-end expenses based on your pace (expected: ${fmtInt(kpis.forecast.expected)} MAD, range: ${fmtInt(kpis.forecast.best)} – ${fmtInt(kpis.forecast.worst)} MAD).`,
      value: `~${fmtInt(kpis.forecast.expected)} MAD`,
      icon: 'bar-chart',
      priority: 3,
    });
  }

  // ── EXCLUSIVE SPENDING FACTS (Not served elsewhere in the app) ─────────

  // Pareto 80/20 Spending Concentration
  if (thisMonthExpenses.length >= 4) {
    const sortedByAmount = [...thisMonthExpenses].sort((a, b) => amountOf(b) - amountOf(a));
    const totalSpend = sortedByAmount.reduce((s, t) => s + amountOf(t), 0);
    if (totalSpend > 0) {
      let runningTotal = 0;
      let topCount = 0;
      for (const t of sortedByAmount) {
        runningTotal += amountOf(t);
        topCount++;
        if (runningTotal / totalSpend >= 0.7) break;
      }
      const pctOfSpend = Math.round((runningTotal / totalSpend) * 100);
      if (topCount <= Math.max(1, Math.floor(thisMonthExpenses.length * 0.45))) {
        facts.push({
          id: 'pareto-concentration',
          type: 'spending',
          title: '80/20 spending concentration',
          message: `Just ${topCount} out of ${thisMonthExpenses.length} purchases generate ${pctOfSpend}% of your entire monthly outflow.`,
          value: `${pctOfSpend}% in top ${topCount}`,
          icon: 'pie-chart',
          priority: 2,
        });
      }
    }
  }

  // Annualized Micro-Habit Cost (The Latte Factor)
  const habitTxs = thisMonthExpenses.filter((t) => {
    const cat = normalizeCategory(t.category);
    return cat === '☕ Coffee & Quick Food' || cat === '🍔 Dining & Takeaway';
  });
  if (habitTxs.length >= 3 && currentPeriod) {
    const elapsedDays = Math.max(1, Math.min(now.getDate(), 30));
    const habitTotal = habitTxs.reduce((s, t) => s + amountOf(t), 0);
    const dailyHabitSpend = habitTotal / elapsedDays;
    if (dailyHabitSpend >= 8) {
      const annualProjected = Math.round(dailyHabitSpend * 365);
      facts.push({
        id: 'latte-factor-annualized',
        type: 'spending',
        title: 'Annualized habit cost',
        message: `At your current pace of ${fmt(dailyHabitSpend)} MAD/day on quick treats & cafes, this represents ~${fmtInt(annualProjected)} MAD per year.`,
        value: `~${fmtInt(annualProjected)} MAD / yr`,
        icon: 'coffee',
        priority: 2,
      });
    }
  }

  // Statistical Skew: Median vs Mean Expense
  if (thisMonthExpenses.length >= 4) {
    const amounts = thisMonthExpenses.map((t) => amountOf(t)).sort((a, b) => a - b);
    const totalAmt = amounts.reduce((s, a) => s + a, 0);
    const mean = totalAmt / amounts.length;
    const mid = Math.floor(amounts.length / 2);
    const median = amounts.length % 2 !== 0 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;

    if (mean >= 1.4 * median && median > 0) {
      facts.push({
        id: 'mean-vs-median-skew',
        type: 'spending',
        title: 'Median vs average purchase',
        message: `Your median purchase is only ${fmt(median)} MAD, while the average is ${fmt(mean)} MAD. A few high-ticket exceptions pull up your arithmetic average.`,
        value: `${fmt(median)} MAD median`,
        icon: 'bar-chart',
        priority: 2,
      });
    }
  }

  // 50/30/20 Discretionary "Wants" Ratio
  const lifestyleCategories = new Set([
    '🍔 Dining & Takeaway',
    '☕ Coffee & Quick Food',
    '🎬 Entertainment',
    '👥 Social',
    '🛍️ Shopping',
    '💇 Personal Care',
  ]);
  let lifestyleSpend = 0;
  for (const t of thisMonthExpenses) {
    if (lifestyleCategories.has(normalizeCategory(t.category))) {
      lifestyleSpend += amountOf(t);
    }
  }
  const totalMonthSpendAll = thisMonthExpenses.reduce((s, t) => s + amountOf(t), 0);
  if (totalMonthSpendAll >= 150 && lifestyleSpend > 0) {
    const lifestylePct = Math.round((lifestyleSpend / totalMonthSpendAll) * 100);
    const isUnder30 = lifestylePct <= 30;
    facts.push({
      id: 'lifestyle-wants-ratio',
      type: 'spending',
      title: '50/30/20 "Wants" ratio',
      message: isUnder30
        ? `Discretionary lifestyle choices took ${lifestylePct}% of your spend (${fmt(lifestyleSpend)} MAD), comfortably under the 30% golden rule.`
        : `Discretionary lifestyle choices took ${lifestylePct}% of your outflow (${fmt(lifestyleSpend)} MAD), above the recommended 30% threshold.`,
      value: `${lifestylePct}% lifestyle`,
      icon: isUnder30 ? 'sparkles' : 'alert-triangle',
      priority: 2,
    });
  }

  // Single Largest Outflow Weight
  if (thisMonthExpenses.length >= 3) {
    const sortedByAmount = [...thisMonthExpenses].sort((a, b) => amountOf(b) - amountOf(a));
    const biggestTx = sortedByAmount[0];
    const biggestAmt = amountOf(biggestTx);
    if (totalMonthSpendAll > 0) {
      const biggestPct = Math.round((biggestAmt / totalMonthSpendAll) * 100);
      if (biggestPct >= 20) {
        facts.push({
          id: 'single-largest-expense-weight',
          type: 'spending',
          title: 'Single largest expense weight',
          message: `A single ${fmt(biggestAmt)} MAD payment for ${biggestTx.category || 'purchases'} accounted for ${biggestPct}% of your entire month's spend.`,
          value: `${biggestPct}% of month`,
          icon: 'layers',
          priority: 2,
        });
      }
    }
  }

  // Fixed Baseline Overhead Daily Drag
  if (fixedSpend > 0 && currentPeriod) {
    const cycleDays = Math.max(1, Math.round((currentPeriod.end.getTime() - currentPeriod.start.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyFixedDrag = fixedSpend / cycleDays;
    if (dailyFixedDrag >= 5) {
      facts.push({
        id: 'fixed-overhead-daily-drag',
        type: 'spending',
        title: 'Fixed baseline drag',
        message: `Fixed baseline commitments consume ${fmt(dailyFixedDrag)} MAD every single day before any flexible living expenses.`,
        value: `${fmt(dailyFixedDrag)} MAD / day fixed`,
        icon: 'landmark',
        priority: 3,
      });
    }
  }

  // Small Leaks Allowance Drag
  if (microTxs.length >= 3 && kpis.dailyAllowance > 0) {
    const microTotalAmt = microTxs.reduce((s, t) => s + amountOf(t), 0);
    const allowanceDaysEquivalent = microTotalAmt / kpis.dailyAllowance;
    if (allowanceDaysEquivalent >= 1.2) {
      facts.push({
        id: 'small-leaks-allowance-impact',
        type: 'spending',
        title: 'Micro-purchases budget drag',
        message: `Small purchases under 25 MAD accumulated to ${fmt(microTotalAmt)} MAD, absorbing ${allowanceDaysEquivalent.toFixed(1)} full days of your daily allowance.`,
        value: `${allowanceDaysEquivalent.toFixed(1)} days allowance`,
        icon: 'receipt',
        priority: 2,
      });
    }
  }

  // ── BUDGET FACTS ─────────────────────────────────────────────────────────

  const currentBudgets = budgets.filter((b) => b.year === year && b.month === month);

  if (currentBudgets.length > 0) {
    const budgetUsages = currentBudgets.map((b) => {
      const cat = normalizeCategory(b.category);
      const spent = thisMonthExpenses
        .filter((t) => normalizeCategory(t.category) === cat)
        .reduce((s, t) => s + amountOf(t), 0);
      const limit = Number.parseFloat(b.amount);
      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      return { category: b.category, spent, limit, pct, remaining: limit - spent };
    });

    // Budget usage (highest used)
    const highestUsed = [...budgetUsages].sort((a, b) => b.pct - a.pct)[0];
    if (highestUsed && highestUsed.pct >= 10) {
      const isOver = highestUsed.pct >= 100;
      facts.push({
        id: 'budget-usage',
        type: 'budget',
        title: isOver ? 'Budget exceeded' : 'Budget usage',
        message: `You've used ${highestUsed.pct.toFixed(0)}% of your ${highestUsed.category} budget this month.`,
        value: `${fmt(highestUsed.spent)} / ${fmt(highestUsed.limit)} MAD`,
        icon: isOver ? 'alert-triangle' : 'target',
        priority: isOver ? 1 : 2,
      });
    }

    // Budget leader
    if (budgetUsages.length >= 2) {
      const leader = [...budgetUsages].sort((a, b) => b.pct - a.pct)[0];
      if (leader && leader.pct >= 50 && leader.pct < 100) {
        facts.push({
          id: 'budget-leader',
          type: 'budget',
          title: 'Most-used budget',
          message: `${leader.category} is currently your most-used budget at ${leader.pct.toFixed(0)}%.`,
          value: `${fmt(leader.spent)} MAD spent`,
          icon: 'bar-chart',
          priority: 3,
        });
      }
    }

    // Best budget (under by most)
    const mostUnder = [...budgetUsages].sort((a, b) => b.remaining - a.remaining)[0];
    if (mostUnder && mostUnder.remaining > 50) {
      facts.push({
        id: 'under-budget',
        type: 'budget',
        title: 'Budget remaining',
        message: `You have ${fmt(mostUnder.remaining)} MAD remaining in your ${mostUnder.category} budget.`,
        value: `${fmt(mostUnder.remaining)} MAD left`,
        icon: 'shield-check',
        priority: 4,
      });
    }

    // Total unbudgeted spending
    const budgetedCategories = new Set(currentBudgets.map((b) => normalizeCategory(b.category)));
    const unbudgetedSpend = thisMonthExpenses
      .filter((t) => !budgetedCategories.has(normalizeCategory(t.category)))
      .reduce((s, t) => s + amountOf(t), 0);
    if (unbudgetedSpend > 50) {
      facts.push({
        id: 'unbudgeted-spend',
        type: 'budget',
        title: 'Outside your budgets',
        message: `You still have spending outside your current category budgets this month.`,
        value: `${fmt(unbudgetedSpend)} MAD untracked`,
        icon: 'layers',
        priority: 4,
      });
    }

    // Overall budget cushion & adherence rate
    if (currentBudgets.length >= 2) {
      const totalBudgetAmt = currentBudgets.reduce((s, b) => s + (Number.parseFloat(b.amount) || 0), 0);
      const totalBudgetSpent = budgetUsages.reduce((s, u) => s + u.spent, 0);
      const totalHeadroom = Math.max(0, totalBudgetAmt - totalBudgetSpent);
      if (totalHeadroom > 50) {
        facts.push({
          id: 'total-budget-headroom',
          type: 'budget',
          title: 'Overall budget cushion',
          message: `You have ${fmt(totalHeadroom)} MAD in total unspent cushion remaining across all your active category budgets.`,
          value: `${fmt(totalHeadroom)} MAD cushion`,
          icon: 'shield-check',
          priority: 3,
        });
      }

      const onTrackCount = budgetUsages.filter((u) => u.pct < 100).length;
      facts.push({
        id: 'budget-adherence-rate',
        type: 'budget',
        title: 'Budget health',
        message: `${onTrackCount} of your ${currentBudgets.length} category budgets are currently within planned limits.`,
        value: `${onTrackCount} / ${currentBudgets.length} on track`,
        icon: onTrackCount === currentBudgets.length ? 'shield-check' : 'target',
        priority: onTrackCount < currentBudgets.length ? 2 : 4,
      });
    }
  }

  // ── LIQUIDITY FACTS ──────────────────────────────────────────────────────

  // Current liquidity
  facts.push({
    id: 'current-liquidity',
    type: 'liquidity',
    title: 'Current liquidity',
    message: `You currently have money spread across your Bank and Cash wallets.`,
    value: `${fmt(kpis.totalLiquidity)} MAD`,
    icon: 'wallet',
    priority: 3,
  });

  // Cash position (if cash is 0 or low)
  if (kpis.cashOnHand === 0) {
    facts.push({
      id: 'cash-empty',
      type: 'liquidity',
      title: 'Cash wallet',
      message: `Your cash wallet is currently empty. All your liquidity is in the bank.`,
      value: `0.00 MAD`,
      icon: 'banknote',
      priority: 4,
    });
  } else if (kpis.cashOnHand > 0) {
    const cashPct = kpis.totalLiquidity > 0 ? (kpis.cashOnHand / kpis.totalLiquidity) * 100 : 0;
    facts.push({
      id: 'cash-vs-bank',
      type: 'liquidity',
      title: 'Cash vs bank',
      message: `${cashPct.toFixed(0)}% of your liquidity is in cash, the rest in your bank.`,
      value: `${fmt(kpis.cashOnHand)} MAD cash`,
      icon: 'banknote',
      priority: 4,
    });
  }

  // Low liquidity warning
  if (kpis.totalLiquidity < 500 && kpis.daysUntilPayday > 3) {
    facts.push({
      id: 'low-liquidity',
      type: 'liquidity',
      title: 'Low liquidity',
      message: `Your current liquidity is low with ${kpis.daysUntilPayday} days until payday.`,
      value: `${fmt(kpis.totalLiquidity)} MAD`,
      icon: 'alert-triangle',
      priority: 1,
    });
  }

  // Free liquidity (after buffer)
  const freeLiquidity = kpis.totalLiquidity - kpis.emergencyBuffer;
  if (kpis.emergencyBuffer > 0) {
    facts.push({
      id: 'free-liquidity',
      type: 'liquidity',
      title: 'Spendable balance',
      message: `After your ${fmt(kpis.emergencyBuffer)} MAD emergency buffer, your free liquidity is:`,
      value: `${fmt(freeLiquidity)} MAD`,
      icon: 'shield-check',
      priority: 3,
    });
  }

  // Safe to Spend Hero Metric
  if (typeof kpis.safeToSpend === 'number') {
    const isHealthy = kpis.safeToSpend > 0;
    facts.push({
      id: 'safe-to-spend-status',
      type: 'liquidity',
      title: isHealthy ? 'Safe to Spend reserve' : 'Tight spending cushion',
      message: isHealthy
        ? 'Uncommitted spendable funds after isolating fixed bills, pending debts, and your safety buffer.'
        : 'Your upcoming obligations and safety reserve exceed your unallocated cash. Spend conservatively before payday.',
      value: `${fmt(kpis.safeToSpend)} MAD`,
      icon: isHealthy ? 'shield-check' : 'alert-triangle',
      priority: isHealthy ? 2 : 1,
    });
  }

  // Financial Runway (Days Coverage)
  if (typeof kpis.runwayDays === 'number' && kpis.runwayDays > 0) {
    facts.push({
      id: 'financial-runway',
      type: 'liquidity',
      title: 'Estimated runway',
      message: kpis.runwayDays >= 30
        ? 'Your current liquidity can sustain over a month of typical variable spending.'
        : `At your current average daily burn rate, your funds cover approximately ${kpis.runwayDays} days.`,
      value: `${kpis.runwayDays} days`,
      icon: 'clock',
      priority: kpis.runwayDays <= 7 ? 1 : 3,
    });
  }

  // Emergency Buffer Coverage Duration
  if (kpis.emergencyBuffer > 0 && typeof kpis.avgDailySpend === 'number' && kpis.avgDailySpend > 0) {
    const coverageDays = Math.round(kpis.emergencyBuffer / kpis.avgDailySpend);
    facts.push({
      id: 'buffer-coverage-duration',
      type: 'liquidity',
      title: 'Emergency buffer security',
      message: `Your ${fmt(kpis.emergencyBuffer)} MAD emergency reserve cushions approx. ${coverageDays} days of typical spending.`,
      value: `${coverageDays} days safe`,
      icon: 'shield-check',
      priority: 3,
    });
  }

  // Dedicated Savings Wallets Stash
  if (kpis.accounts && kpis.accounts.length > 0) {
    const savingsWallets = kpis.accounts.filter((w) => w.type === 'Savings');
    const savingsTotal = savingsWallets.reduce((s, w) => s + (w.balance || 0), 0);
    if (savingsTotal > 0) {
      facts.push({
        id: 'savings-wallets-stash',
        type: 'savings',
        title: 'Dedicated savings fund',
        message: `You have ${fmt(savingsTotal)} MAD tucked away safely in your savings wallet${savingsWallets.length > 1 ? 's' : ''}.`,
        value: `${fmt(savingsTotal)} MAD`,
        icon: 'piggy-bank',
        priority: 3,
      });
    }

    const activeWallets = kpis.accounts.filter((w) => (w.balance || 0) > 0);
    if (activeWallets.length >= 2) {
      facts.push({
        id: 'wallet-distribution',
        type: 'liquidity',
        title: 'Wallet distribution',
        message: `Your liquidity is structured across ${activeWallets.length} accounts, keeping day-to-day spending and reserves separate.`,
        value: `${activeWallets.length} active wallets`,
        icon: 'wallet',
        priority: 4,
      });
    }
  }

  // Emergency Buffer Months of Fixed Overhead
  if (kpis.emergencyBuffer > 0 && fixedSpend > 0) {
    const monthsProtected = (kpis.emergencyBuffer / fixedSpend).toFixed(1);
    facts.push({
      id: 'emergency-buffer-fixed-months',
      type: 'liquidity',
      title: 'Fixed bills emergency cushion',
      message: `Your emergency buffer can cover ${monthsProtected} months of non-negotiable fixed bills without any incoming salary.`,
      value: `${monthsProtected} months safe`,
      icon: 'shield-check',
      priority: 2,
    });
  }

  // Capital Reallocation / Transfers
  const internalTransfers = transactions.filter((t) => t.type === 'Transfer' && isInMonth(t, year, month, payrolls));
  if (internalTransfers.length > 0) {
    const transferTotal = internalTransfers.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'capital-transfers-volume',
      type: 'liquidity',
      title: 'Capital reallocation',
      message: `You completed ${internalTransfers.length} transfer${internalTransfers.length > 1 ? 's' : ''} moving ${fmt(transferTotal)} MAD between accounts this month.`,
      value: `${fmt(transferTotal)} MAD moved`,
      icon: 'repeat',
      priority: 3,
    });
  }

  // ── DEBT FACTS ───────────────────────────────────────────────────────────

  const pendingPayables = debts.filter((d) => d.type === 'Payable' && d.status === 'Pending');
  const pendingReceivables = debts.filter((d) => d.type === 'Receivable' && d.status === 'Pending');
  const totalOwed = pendingPayables.reduce((s, d) => s + Number.parseFloat(d.remainingBalance), 0);
  const totalOwedToYou = pendingReceivables.reduce((s, d) => s + Number.parseFloat(d.remainingBalance), 0);

  if (pendingPayables.length > 0) {
    facts.push({
      id: 'money-you-owe',
      type: 'debt',
      title: 'Money you owe',
      message: `You currently have ${pendingPayables.length} outstanding debt${pendingPayables.length > 1 ? 's' : ''}.`,
      value: `${fmt(totalOwed)} MAD`,
      icon: 'arrow-up-right',
      priority: 2,
    });

    // Largest debt
    const largestDebt = [...pendingPayables].sort(
      (a, b) => Number.parseFloat(b.remainingBalance) - Number.parseFloat(a.remainingBalance),
    )[0];
    facts.push({
      id: 'largest-debt',
      type: 'debt',
      title: 'Largest outstanding debt',
      message: `Your largest outstanding debt is to ${largestDebt.contactName}.`,
      value: `${fmt(Number.parseFloat(largestDebt.remainingBalance))} MAD`,
      icon: 'alert-triangle',
      priority: 2,
    });
  }

  if (pendingReceivables.length > 0) {
    facts.push({
      id: 'money-owed-to-you',
      type: 'debt',
      title: 'Money owed to you',
      message: `${pendingReceivables.length} person${pendingReceivables.length > 1 ? 's owe' : ' owes'} you money.`,
      value: `${fmt(totalOwedToYou)} MAD`,
      icon: 'hand-coins',
      priority: 2,
    });
  }

  // Net debt position
  if (pendingPayables.length > 0 && pendingReceivables.length > 0) {
    const net = totalOwedToYou - totalOwed;
    facts.push({
      id: 'net-debt',
      type: 'debt',
      title: 'Net debt position',
      message: net >= 0
        ? `The money owed to you currently exceeds what you owe by ${fmt(Math.abs(net))} MAD.`
        : `You currently owe ${fmt(Math.abs(net))} MAD more than what others owe you.`,
      value: `${net >= 0 ? '+' : ''}${fmt(net)} MAD`,
      icon: net >= 0 ? 'trending-up' : 'trending-down',
      priority: 3,
    });
  }

  // Debt repayment progress (settlements this month)
  const debtRepaymentTxs = transactions.filter(
    (t) =>
      (t.type === 'Debt Repayment' || normalizeCategory(t.category) === 'Debt Repayment') &&
      isInMonth(t, year, month, payrolls),
  );
  if (debtRepaymentTxs.length > 0) {
    const repaid = debtRepaymentTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'debt-progress',
      type: 'debt',
      title: 'Debt repayments',
      message: `You've made ${debtRepaymentTxs.length} debt repayment${debtRepaymentTxs.length > 1 ? 's' : ''} this month.`,
      value: `${fmt(repaid)} MAD repaid`,
      icon: 'arrow-down-right',
      priority: 3,
    });
  }

  // Top Debt Counterparty (Largest single friend / contact balance)
  const counterpartyBalances: Record<string, { name: string; amount: number; type: 'Receivable' | 'Payable' }> = {};
  for (const d of debts.filter((d) => d.status === 'Pending')) {
    const rem = Number.parseFloat(d.remainingBalance) || 0;
    if (rem <= 0) continue;
    const name = d.contactName || 'Unknown';
    if (!counterpartyBalances[name]) {
      counterpartyBalances[name] = { name, amount: 0, type: d.type };
    }
    counterpartyBalances[name].amount += rem;
  }
  const topCounterparty = Object.values(counterpartyBalances).sort((a, b) => b.amount - a.amount)[0];
  if (topCounterparty && topCounterparty.amount >= 50) {
    const isRec = topCounterparty.type === 'Receivable';
    facts.push({
      id: 'top-debt-counterparty',
      type: 'debt',
      title: isRec ? 'Top pending receivable' : 'Main outstanding balance',
      message: isRec
        ? `${topCounterparty.name} owes you the largest balance among your contacts (${fmt(topCounterparty.amount)} MAD).`
        : `Your largest pending payable balance is owed to ${topCounterparty.name}.`,
      value: `${fmt(topCounterparty.amount)} MAD`,
      icon: isRec ? 'hand-coins' : 'arrow-up-right',
      priority: 2,
    });
  }

  // Debt Aging & Turnaround Time (Stale Receivables)
  if (pendingReceivables.length > 0) {
    const nowMs = now.getTime();
    let oldestAgeDays = 0;
    let oldestContact = '';
    let oldestAmount = 0;
    for (const d of pendingReceivables) {
      const createdMs = d.createdAt ? new Date(d.createdAt).getTime() : nowMs;
      const ageDays = Math.max(0, Math.floor((nowMs - createdMs) / (1000 * 60 * 60 * 24)));
      if (ageDays > oldestAgeDays) {
        oldestAgeDays = ageDays;
        oldestContact = d.contactName || 'A contact';
        oldestAmount = Number.parseFloat(d.remainingBalance) || 0;
      }
    }
    if (oldestAgeDays >= 14 && oldestAmount >= 40) {
      facts.push({
        id: 'debt-aging-alert',
        type: 'debt',
        title: 'Receivable turnaround',
        message: `${fmt(oldestAmount)} MAD owed by ${oldestContact} has been pending for ${oldestAgeDays} days. A friendly reminder could release this cash.`,
        value: `${oldestAgeDays} days waiting`,
        icon: 'clock',
        priority: 2,
      });
    }
  }

  // Solvency Ratio: Cash Liquidity vs Pending Payables
  if (totalOwed > 50 && kpis.totalLiquidity > 0) {
    const solvencyRatio = kpis.totalLiquidity / totalOwed;
    facts.push({
      id: 'solvency-coverage-ratio',
      type: 'debt',
      title: solvencyRatio >= 1.5 ? 'Debt solvency resilience' : 'Debt leverage exposure',
      message: solvencyRatio >= 1.5
        ? `Your available cash covers your total outstanding payables ${solvencyRatio.toFixed(1)} times over, indicating strong solvency.`
        : `Outstanding payables equal ${(100 / solvencyRatio).toFixed(0)}% of your available liquidity. Prioritize settling obligations.`,
      value: `${solvencyRatio.toFixed(1)}x coverage`,
      icon: solvencyRatio >= 1.5 ? 'shield-check' : 'alert-triangle',
      priority: solvencyRatio < 1.0 ? 1 : 2,
    });
  }

  // Combined True Economic Net Position
  const netWorth = (kpis.totalLiquidity || 0) + totalOwedToYou - totalOwed;
  facts.push({
    id: 'net-worth-fact',
    type: 'liquidity',
    title: 'Net financial position',
    message: netWorth >= 0
      ? `Your combined cash, bank balances, and net receivables create a positive net worth of ${fmt(netWorth)} MAD.`
      : `Your debt obligations currently exceed your total cash and receivables by ${fmt(Math.abs(netWorth))} MAD.`,
    value: `${netWorth >= 0 ? '+' : ''}${fmt(netWorth)} MAD`,
    icon: netWorth >= 0 ? 'trending-up' : 'trending-down',
    priority: 3,
  });

  // ── REIMBURSEMENT FACTS ──────────────────────────────────────────────────

  const pendingReimbursableTxs = thisMonthExpenses.filter((t) => {
    if (!t.reimbursableAmount || Number.parseFloat(t.reimbursableAmount) <= 0) return false;
    if (t.linkedContactId) {
      const debt = debts.find(d => d.id === t.linkedContactId);
      return debt && debt.status === 'Pending' && Number.parseFloat(debt.remainingBalance) > 0;
    }
    return true; // legacy fallback
  });

  if (pendingReimbursableTxs.length > 0) {
    const totalReimbursable = pendingReimbursableTxs.reduce((s, t) => {
      if (t.linkedContactId) {
        const debt = debts.find(d => d.id === t.linkedContactId);
        return s + (debt ? Number.parseFloat(debt.remainingBalance) : 0);
      }
      return s + Number.parseFloat(t.reimbursableAmount!);
    }, 0);

    facts.push({
      id: 'pending-reimbursement',
      type: 'reimbursement',
      title: 'Pending reimbursements',
      message: `You have ${pendingReimbursableTxs.length} pending reimbursable expense${pendingReimbursableTxs.length > 1 ? 's' : ''} this month.`,
      value: `${fmt(totalReimbursable)} MAD coming back`,
      icon: 'users',
      priority: 2,
    });
  }

  // Shared spending (linked contacts)
  const sharedTxs = thisMonthExpenses.filter((t) => t.linkedContactId || t.linkedContactName);
  if (sharedTxs.length > 0) {
    const sharedTotal = sharedTxs.reduce((s, t) => s + amountOf(t), 0);
    facts.push({
      id: 'shared-spending',
      type: 'reimbursement',
      title: 'Shared expenses',
      message: `You have ${sharedTxs.length} expense${sharedTxs.length > 1 ? 's' : ''} this month involving another person.`,
      value: `${fmt(sharedTotal)} MAD shared`,
      icon: 'users',
      priority: 3,
    });
  }

  // Adjusted True Spend relief
  const totalRawExpenses = thisMonthExpenses.reduce((s, t) => s + amountOf(t), 0);
  if (typeof kpis.adjustedTrueSpend === 'number' && totalRawExpenses - kpis.adjustedTrueSpend >= 30) {
    const relief = totalRawExpenses - kpis.adjustedTrueSpend;
    facts.push({
      id: 'adjusted-true-spend-relief',
      type: 'reimbursement',
      title: 'Shared expense relief',
      message: 'Pending reimbursements and shared costs reduce your True Spend burden below raw expense figures.',
      value: `-${fmt(relief)} MAD relief`,
      icon: 'users',
      priority: 3,
    });
  }

  // ── INCOME FACTS ─────────────────────────────────────────────────────────

  const incomeThisMonth = transactions.filter((t) => t.type === 'Income' && isInMonth(t, year, month, payrolls));
  if (incomeThisMonth.length > 0) {
    const totalIncome = incomeThisMonth.reduce((s, t) => s + amountOf(t), 0);

    facts.push({
      id: 'income-received',
      type: 'income',
      title: 'Income this cycle',
      message: `You've received income ${incomeThisMonth.length} time${incomeThisMonth.length > 1 ? 's' : ''} this month.`,
      value: `${fmt(totalIncome)} MAD`,
      icon: 'arrow-down-right',
      priority: 3,
    });

    // Income vs spending
    const totalSpent = thisMonthExpenses.reduce((s, t) => s + amountOf(t), 0);
    const net = totalIncome - totalSpent;
    if (net !== 0) {
      facts.push({
        id: 'income-vs-spending',
        type: 'income',
        title: net >= 0 ? 'Positive flow' : 'Spending exceeds income',
        message: net >= 0
          ? `Your income currently exceeds your expenses this month by ${fmt(net)} MAD.`
          : `Your expenses exceed your income this month by ${fmt(Math.abs(net))} MAD.`,
        value: `${net >= 0 ? '+' : ''}${fmt(net)} MAD`,
        icon: net >= 0 ? 'trending-up' : 'trending-down',
        priority: net < 0 ? 1 : 3,
      });
    }

    // Realized Savings Rate
    if (totalSpent > 0) {
      const savingsRate = ((totalIncome - totalSpent) / totalIncome) * 100;
      facts.push({
        id: 'savings-rate-pct',
        type: 'savings',
        title: savingsRate >= 20 ? 'Strong savings rate' : savingsRate >= 0 ? 'Net savings rate' : 'Deficit burn rate',
        message: savingsRate >= 0
          ? `You are currently retaining ${savingsRate.toFixed(0)}% of your received income this cycle.`
          : `Your expenses currently exceed cycle income by ${Math.abs(savingsRate).toFixed(0)}%.`,
        value: `${savingsRate >= 0 ? '+' : ''}${savingsRate.toFixed(0)}%`,
        icon: savingsRate >= 20 ? 'piggy-bank' : 'trending-down',
        priority: savingsRate < 0 ? 1 : 2,
      });
    }

    // Capital Retention Efficiency (Unspent Income retained)
    if (totalIncome > 0 && totalSpent > 0 && totalIncome >= totalSpent) {
      const retainedPer100 = Math.round(((totalIncome - totalSpent) / totalIncome) * 100);
      facts.push({
        id: 'capital-retention-per-100',
        type: 'savings',
        title: 'Capital retention rate',
        message: `For every 100 MAD of earned income this cycle, ${retainedPer100} MAD has been retained as net wealth.`,
        value: `${retainedPer100} MAD kept / 100`,
        icon: 'piggy-bank',
        priority: 2,
      });
    }
  }

  // ── BEHAVIORAL FACTS ─────────────────────────────────────────────────────

  // Spending change vs previous month
  if (prevMonthExpenses.length >= 3 && thisMonthExpenses.length >= 3) {
    const prevTotal = prevMonthExpenses.reduce((s, t) => s + amountOf(t), 0);
    const currTotal = thisMonthExpenses.reduce((s, t) => s + amountOf(t), 0);
    if (prevTotal > 0) {
      const changePct = ((currTotal - prevTotal) / prevTotal) * 100;
      if (Math.abs(changePct) >= 5) {
        const isHigher = changePct > 0;
        facts.push({
          id: 'spending-change',
          type: 'behavioral',
          title: isHigher ? 'Spending increase' : 'Spending decrease',
          message: `Your spending is ${Math.abs(changePct).toFixed(0)}% ${isHigher ? 'higher' : 'lower'} than last month.`,
          value: `${isHigher ? '+' : ''}${changePct.toFixed(0)}%`,
          icon: isHigher ? 'trending-up' : 'trending-down',
          priority: Math.abs(changePct) >= 25 ? 1 : 3,
        });
      }
    }
  }

  // Best spending day of week
  if (thisMonthExpenses.length >= 7) {
    const byDay: Record<number, number> = {};
    for (const t of thisMonthExpenses) {
      const d = transactionDate(t).getDay();
      byDay[d] = (byDay[d] || 0) + amountOf(t);
    }
    const topDay = Object.entries(byDay).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    if (topDay) {
      facts.push({
        id: 'spending-day',
        type: 'behavioral',
        title: 'Busiest spending day',
        message: `You tend to spend the most on ${dayName(new Date(2024, 0, parseInt(topDay[0]) + 1))}s this month.`,
        value: `${fmt(Number(topDay[1]))} MAD`,
        icon: 'calendar',
        priority: 5,
      });
    }
  }

  // Unusual category spending (vs prev month)
  if (prevMonthExpenses.length >= 3) {
    const categoryTotals = (txs: Transaction[]) => {
      const map: Record<string, number> = {};
      for (const t of txs) {
        const cat = normalizeCategory(t.category) || t.category;
        map[cat] = (map[cat] || 0) + amountOf(t);
      }
      return map;
    };
    const curr = categoryTotals(thisMonthExpenses);
    const prev = categoryTotals(prevMonthExpenses);
    for (const [cat, currAmt] of Object.entries(curr)) {
      const prevAmt = prev[cat];
      if (prevAmt && prevAmt > 0) {
        const change = ((currAmt - prevAmt) / prevAmt) * 100;
        if (change >= 50 && currAmt >= 100) {
          facts.push({
            id: `unusual-spending-${cat}`,
            type: 'behavioral',
            title: 'Unusual spending',
            message: `Your ${cat} spending this month is significantly higher than last month (+${change.toFixed(0)}%).`,
            value: `${fmt(currAmt)} MAD`,
            icon: 'alert-triangle',
            priority: 2,
          });
          break; // Only one unusual spending fact
        }
      }
    }
  }

  // Zero-Spend Days & Streak
  if (thisMonthExpenses.length > 0 && currentPeriod) {
    const expenseDateKeys = new Set(thisMonthExpenses.map((t) => dateKey(transactionDate(t))));
    const cycleStart = new Date(currentPeriod.start);
    const todayDateKey = dateKey(now);
    const periodEndTime = Math.min(now.getTime(), currentPeriod.end.getTime());

    let zeroSpendDays = 0;
    const dIter = new Date(cycleStart);
    while (dIter.getTime() <= periodEndTime) {
      const k = dateKey(dIter);
      if (k <= todayDateKey && !expenseDateKeys.has(k)) {
        zeroSpendDays++;
      }
      dIter.setDate(dIter.getDate() + 1);
    }

    if (zeroSpendDays >= 2) {
      facts.push({
        id: 'zero-spend-days',
        type: 'behavioral',
        title: 'No-spend days',
        message: `You went without recording any expenses on ${zeroSpendDays} days this cycle. Great discipline!`,
        value: `${zeroSpendDays} days`,
        icon: 'shield-check',
        priority: 3,
      });
    }

    // Current zero-spend streak
    let streak = 0;
    const streakIter = new Date(now);
    while (streakIter.getTime() >= cycleStart.getTime()) {
      const k = dateKey(streakIter);
      if (!expenseDateKeys.has(k)) {
        streak++;
        streakIter.setDate(streakIter.getDate() - 1);
      } else {
        break;
      }
    }

    if (streak >= 2) {
      facts.push({
        id: 'no-spend-streak',
        type: 'milestone',
        title: 'Zero-spend streak',
        message: `You have gone ${streak} consecutive days without recording an expense!`,
        value: `${streak} day streak`,
        icon: 'zap',
        priority: 2,
      });
    }
  }

  // Evening Spending Tendency
  if (thisMonthExpenses.length >= 5) {
    const eveningTxs = thisMonthExpenses.filter((t) => {
      const hours = transactionDate(t).getHours();
      return hours >= 18;
    });
    const eveningPct = (eveningTxs.length / thisMonthExpenses.length) * 100;
    if (eveningPct >= 45 && eveningTxs.length >= 3) {
      const eveningAmt = eveningTxs.reduce((s, t) => s + amountOf(t), 0);
      facts.push({
        id: 'evening-spending-habit',
        type: 'behavioral',
        title: 'Evening spending tendency',
        message: `${eveningPct.toFixed(0)}% of your transactions (${fmt(eveningAmt)} MAD) occur after 6:00 PM.`,
        value: `${eveningPct.toFixed(0)}% after 6 PM`,
        icon: 'clock',
        priority: 5,
      });
    }
  }

  // Weekday vs Weekend Split
  const weekdayTxs = thisMonthExpenses.filter((t) => {
    const d = transactionDate(t).getDay();
    return d >= 1 && d <= 5;
  });
  if (weekdayTxs.length >= 3 && weekendTxs.length >= 2) {
    const weekdayTotal = weekdayTxs.reduce((s, t) => s + amountOf(t), 0);
    const weekendTotal = weekendTxs.reduce((s, t) => s + amountOf(t), 0);
    const grandTotal = weekdayTotal + weekendTotal;
    if (grandTotal > 0) {
      const weekdayPct = (weekdayTotal / grandTotal) * 100;
      facts.push({
        id: 'weekday-vs-weekend-split',
        type: 'behavioral',
        title: 'Weekday vs weekend split',
        message: `${weekdayPct.toFixed(0)}% of your expense volume occurs Monday through Friday (${fmt(weekdayTotal)} MAD).`,
        value: `${weekdayPct.toFixed(0)}% weekday`,
        icon: 'calendar',
        priority: 5,
      });
    }
  }

  // ── EXCLUSIVE BEHAVIORAL & PATTERN FACTS (Not served elsewhere in the app) ──

  // Cycle Spend Velocity Curve (Post-Payday Surge vs Steady Pacing)
  if (thisMonthExpenses.length >= 5 && currentPeriod) {
    const cycleStart = new Date(currentPeriod.start).getTime();
    const weekOneMs = 7 * 24 * 60 * 60 * 1000;
    const weekOneExpenses = thisMonthExpenses.filter((t) => {
      const txTime = transactionDate(t).getTime();
      return txTime >= cycleStart && txTime < cycleStart + weekOneMs;
    });
    const totalMonthSpend = thisMonthExpenses.reduce((s, t) => s + amountOf(t), 0);
    const weekOneSpend = weekOneExpenses.reduce((s, t) => s + amountOf(t), 0);
    if (totalMonthSpend > 150) {
      const weekOnePct = Math.round((weekOneSpend / totalMonthSpend) * 100);
      if (weekOnePct >= 45) {
        facts.push({
          id: 'spending-velocity-surge',
          type: 'behavioral',
          title: 'Post-payday surge',
          message: `${weekOnePct}% of your entire cycle's expenses were spent in the first 7 days following payroll.`,
          value: `${weekOnePct}% in week 1`,
          icon: 'trending-up',
          priority: 2,
        });
      } else if (weekOnePct <= 28 && weekOneExpenses.length >= 1) {
        facts.push({
          id: 'spending-velocity-smooth',
          type: 'behavioral',
          title: 'Smooth cycle pacing',
          message: 'Your spending is evenly distributed throughout the cycle with no post-payday outflow spike.',
          value: 'Balanced pacing',
          icon: 'shield-check',
          priority: 3,
        });
      }
    }
  }

  // Payment Modality (Physical Cash vs Digital / Card)
  if (thisMonthExpenses.length >= 3 && kpis.accounts && kpis.accounts.length > 0) {
    const walletMap = new Map<string, string>();
    for (const w of kpis.accounts) {
      walletMap.set(w.id, w.type);
    }
    let cashCount = 0;
    let cashTotal = 0;
    let digitalCount = 0;
    let digitalTotal = 0;

    for (const t of thisMonthExpenses) {
      const wType = t.walletId ? walletMap.get(t.walletId) : undefined;
      const amt = amountOf(t);
      if (wType === 'Cash') {
        cashCount++;
        cashTotal += amt;
      } else if (wType === 'Bank' || wType === 'Savings') {
        digitalCount++;
        digitalTotal += amt;
      }
    }

    const assessedCount = cashCount + digitalCount;
    if (assessedCount >= 3) {
      const cashPct = Math.round((cashCount / assessedCount) * 100);
      const isPredominantlyCash = cashPct >= 60;
      const isPredominantlyDigital = cashPct <= 35;
      if (isPredominantlyCash || isPredominantlyDigital) {
        facts.push({
          id: 'payment-modality-split',
          type: 'behavioral',
          title: isPredominantlyCash ? 'Cash-first preference' : 'Digital-first preference',
          message: isPredominantlyCash
            ? `Physical cash accounted for ${cashPct}% of purchases (${fmt(cashTotal)} MAD), common for local everyday trade.`
            : `Electronic bank/card transactions accounted for ${100 - cashPct}% of purchases (${fmt(digitalTotal)} MAD).`,
          value: isPredominantlyCash ? `${cashPct}% cash` : `${100 - cashPct}% card/bank`,
          icon: isPredominantlyCash ? 'banknote' : 'landmark',
          priority: 2,
        });
      }
    }
  }

  // Merchant / Destination Clustering
  if (thisMonthExpenses.length >= 4) {
    const merchantCounts: Record<string, { count: number; total: number; name: string }> = {};
    for (const t of thisMonthExpenses) {
      const raw = (t.notes || t.category || '').trim();
      const clean = raw.replace(/[0-9#\-_,.:]/g, ' ').trim();
      const firstTwoWords = clean.split(/\s+/).slice(0, 2).join(' ');
      if (firstTwoWords.length >= 3 && !firstTwoWords.match(/^(expense|payment|purchase|cash|other|transfer)$/i)) {
        const key = firstTwoWords.toLowerCase();
        if (!merchantCounts[key]) {
          merchantCounts[key] = { count: 0, total: 0, name: firstTwoWords };
        }
        merchantCounts[key].count++;
        merchantCounts[key].total += amountOf(t);
      }
    }
    const topSpot = Object.values(merchantCounts).sort((a, b) => b.count - a.count)[0];
    if (topSpot && topSpot.count >= 3) {
      facts.push({
        id: 'frequent-destination-spot',
        type: 'behavioral',
        title: 'Most frequented spot',
        message: `You recorded ${topSpot.count} purchases at "${topSpot.name}" this cycle, tallying ${fmt(topSpot.total)} MAD.`,
        value: `${topSpot.count} visits`,
        icon: 'shopping-bag',
        priority: 2,
      });
    }
  }

  // Round-Number Psychological Bias
  if (thisMonthExpenses.length >= 4) {
    const roundCount = thisMonthExpenses.filter((t) => {
      const amt = amountOf(t);
      return amt >= 10 && amt % 10 === 0;
    }).length;
    const roundPct = Math.round((roundCount / thisMonthExpenses.length) * 100);
    if (roundPct >= 40) {
      facts.push({
        id: 'round-number-bias',
        type: 'behavioral',
        title: 'Round-number tendency',
        message: `${roundPct}% of your expenses are exact round numbers (e.g. 50, 100 MAD), typical of cash or estimated expenses.`,
        value: `${roundPct}% round amounts`,
        icon: 'percent',
        priority: 3,
      });
    }
  }

  // Weekly Peak Spend Day
  if (thisMonthExpenses.length >= 5) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const t of thisMonthExpenses) {
      const dIdx = transactionDate(t).getDay();
      dayTotals[dIdx] += amountOf(t);
      dayCounts[dIdx]++;
    }
    const maxIdx = dayTotals.reduce((maxI, curr, i, arr) => (curr > arr[maxI] ? i : maxI), 0);
    const totalMonthSpendAllDays = dayTotals.reduce((s, d) => s + d, 0);
    if (totalMonthSpendAllDays > 100 && dayTotals[maxIdx] > 0) {
      const peakPct = Math.round((dayTotals[maxIdx] / totalMonthSpendAllDays) * 100);
      if (peakPct >= 25 && dayCounts[maxIdx] >= 2) {
        facts.push({
          id: 'peak-day-of-week',
          type: 'behavioral',
          title: 'Weekly peak spend day',
          message: `${days[maxIdx]}s drive ${peakPct}% of your total outflow, averaging ${fmt(dayTotals[maxIdx] / dayCounts[maxIdx])} MAD per ${days[maxIdx]}.`,
          value: `${days[maxIdx]}s peak`,
          icon: 'calendar',
          priority: 2,
        });
      }
    }
  }

  // Weekend Burn Rate Multiplier
  if (thisMonthExpenses.length >= 5) {
    let weekendSpend = 0;
    let weekendCount = 0;
    let weekdaySpend = 0;
    let weekdayCount = 0;
    for (const t of thisMonthExpenses) {
      const d = transactionDate(t).getDay();
      if (d === 0 || d === 6) {
        weekendSpend += amountOf(t);
        weekendCount++;
      } else {
        weekdaySpend += amountOf(t);
        weekdayCount++;
      }
    }
    if (weekendCount >= 2 && weekdayCount >= 3) {
      const weekendDaily = weekendSpend / weekendCount;
      const weekdayDaily = weekdaySpend / weekdayCount;
      if (weekdayDaily > 0) {
        const ratio = weekendDaily / weekdayDaily;
        if (ratio >= 1.35) {
          facts.push({
            id: 'weekend-burn-multiplier',
            type: 'behavioral',
            title: 'Weekend burn rate',
            message: `You spend ${ratio.toFixed(1)}x more per purchase on weekends (${fmt(weekendDaily)} MAD) than on weekdays (${fmt(weekdayDaily)} MAD).`,
            value: `${ratio.toFixed(1)}x on weekends`,
            icon: 'zap',
            priority: 2,
          });
        }
      }
    }
  }

  // Transaction Audit Trail & Logging Discipline
  if (thisMonthExpenses.length >= 4) {
    const withNotes = thisMonthExpenses.filter((t) => (t.notes || '').trim().length >= 3).length;
    const notePct = Math.round((withNotes / thisMonthExpenses.length) * 100);
    if (notePct >= 60) {
      facts.push({
        id: 'logging-clarity-discipline',
        type: 'behavioral',
        title: 'Transaction audit trail',
        message: `${notePct}% of your expenses include descriptive notes, keeping your records crystal clear for tracking.`,
        value: `${notePct}% documented`,
        icon: 'receipt',
        priority: 3,
      });
    }
  }

  // Active Spending Momentum Streak
  if (thisMonthExpenses.length >= 3) {
    const expenseDates = new Set(thisMonthExpenses.map((t) => dateKey(transactionDate(t))));
    let currentOutflowStreak = 0;
    const testD = new Date(now);
    while (expenseDates.has(dateKey(testD))) {
      currentOutflowStreak++;
      testD.setDate(testD.getDate() - 1);
    }
    if (currentOutflowStreak >= 3) {
      facts.push({
        id: 'spending-momentum-streak',
        type: 'behavioral',
        title: 'Active spending streak',
        message: `You've recorded purchases on ${currentOutflowStreak} consecutive days. A planned zero-spend day will reset momentum.`,
        value: `${currentOutflowStreak} days running`,
        icon: 'activity',
        priority: 2,
      });
    }
  }

  // Mid-Cycle Pace Shift (First half vs Second half)
  if (thisMonthExpenses.length >= 6 && currentPeriod) {
    const startMs = currentPeriod.start.getTime();
    const endMs = currentPeriod.end.getTime();
    const midMs = startMs + (endMs - startMs) / 2;
    const firstHalfTxs = thisMonthExpenses.filter((t) => transactionDate(t).getTime() < midMs);
    const secondHalfTxs = thisMonthExpenses.filter((t) => transactionDate(t).getTime() >= midMs);
    if (firstHalfTxs.length >= 2 && secondHalfTxs.length >= 2) {
      const firstHalfSpend = firstHalfTxs.reduce((s, t) => s + amountOf(t), 0);
      const secondHalfSpend = secondHalfTxs.reduce((s, t) => s + amountOf(t), 0);
      if (firstHalfSpend > 0) {
        const diffPct = Math.round(((secondHalfSpend - firstHalfSpend) / firstHalfSpend) * 100);
        if (Math.abs(diffPct) >= 20) {
          const isDecel = diffPct < 0;
          facts.push({
            id: 'mid-cycle-pace-shift',
            type: 'behavioral',
            title: isDecel ? 'Mid-cycle spend slowdown' : 'Mid-cycle spend acceleration',
            message: isDecel
              ? `You slowed down spending by ${Math.abs(diffPct)}% in the second half of this cycle compared to the first half.`
              : `Your spending pace accelerated by ${diffPct}% in the second half of this cycle compared to the first half.`,
            value: `${diffPct > 0 ? '+' : ''}${diffPct}% pace shift`,
            icon: isDecel ? 'trending-down' : 'trending-up',
            priority: 2,
          });
        }
      }
    }
  }

  // Purchase Cadence Rate
  if (thisMonthExpenses.length >= 4 && currentPeriod) {
    const elapsedDays = Math.max(1, Math.min(now.getDate(), 30));
    const txPerDay = (thisMonthExpenses.length / elapsedDays).toFixed(1);
    facts.push({
      id: 'purchase-cadence-rate',
      type: 'behavioral',
      title: 'Purchase cadence',
      message: `You average ${txPerDay} expense transactions per day across this financial period.`,
      value: `${txPerDay} / day`,
      icon: 'repeat',
      priority: 3,
    });
  }

  // Financial Health Score & Drivers
  if (typeof kpis.healthScore === 'number' && kpis.healthScore > 0) {
    facts.push({
      id: 'financial-health-score',
      type: 'behavioral',
      title: 'Financial health score',
      message: kpis.healthScore >= 80
        ? 'Strong financial health! Consistent discipline across savings, budget pacing, and debt obligations.'
        : kpis.healthScore >= 50
        ? 'Balanced financial health with steady liquidity and moderate spending control.'
        : 'Your financial health is under strain from spending acceleration or debt exposure.',
      value: `${kpis.healthScore} / 100`,
      icon: 'activity',
      priority: 4,
    });

    if (kpis.healthFactors && kpis.healthFactors.length > 0) {
      const sortedFactors = [...kpis.healthFactors].sort(
        (a, b) => b.score / b.maxPoints - a.score / a.maxPoints,
      );
      const best = sortedFactors[0];
      if (best && best.score / best.maxPoints >= 0.8) {
        facts.push({
          id: 'health-top-factor',
          type: 'milestone',
          title: 'Strongest financial pillar',
          message: `You earned top marks for ${best.name}: ${best.label}.`,
          value: `${best.score} / ${best.maxPoints} pts`,
          icon: 'award',
          priority: 4,
        });
      }

      const weakest = sortedFactors[sortedFactors.length - 1];
      if (weakest && weakest.score / weakest.maxPoints < 0.6) {
        facts.push({
          id: 'health-focus-factor',
          type: 'behavioral',
          title: 'Top improvement area',
          message: `Boosting ${weakest.name} (${weakest.label}) will make the biggest positive difference to your health score.`,
          value: `${weakest.score} / ${weakest.maxPoints} pts`,
          icon: 'target',
          priority: 3,
        });
      }
    }
  }

  // ── DAILY ALLOWANCE FACTS ────────────────────────────────────────────────

  // Today's allowance
  facts.push({
    id: 'daily-allowance',
    type: 'daily',
    title: "Today's allowance",
    message: `Your daily spending allowance based on your current liquidity and ${kpis.daysUntilPayday} days until payday.`,
    value: `${fmt(kpis.dailyAllowance)} MAD / day`,
    icon: 'calendar',
    priority: 5,
  });

  // Remaining today
  if (kpis.dailySpent > 0) {
    const pctUsed = kpis.dailyAllowance > 0 ? (kpis.dailySpent / kpis.dailyAllowance) * 100 : 100;
    const isOver = pctUsed >= 100;
    facts.push({
      id: 'daily-remaining',
      type: 'daily',
      title: isOver ? 'Over today\'s allowance' : 'Remaining today',
      message: isOver
        ? `You've already exceeded today's daily allowance by ${fmt(Math.abs(kpis.dailyRemaining))} MAD.`
        : `You've used ${pctUsed.toFixed(0)}% of today's allowance, with ${fmt(kpis.dailyRemaining)} MAD remaining.`,
      value: `${fmt(kpis.dailySpent)} MAD spent`,
      icon: isOver ? 'alert-triangle' : 'clock',
      priority: isOver ? 1 : 4,
    });
  }

  // Payday countdown
  facts.push({
    id: 'payday-countdown',
    type: 'daily',
    title: 'Days until payday',
    message:
      kpis.daysUntilPayday === 0
        ? `Today is payday! Your daily allowance will reset after your income arrives.`
        : `You have ${kpis.daysUntilPayday} day${kpis.daysUntilPayday === 1 ? '' : 's'} left to stretch your current allowance.`,
    value: kpis.daysUntilPayday === 0 ? 'Today!' : `${kpis.daysUntilPayday} days`,
    icon: 'calendar',
    priority: 5,
  });

  // Payday Homestretch
  if (kpis.daysUntilPayday <= 5 && kpis.daysUntilPayday > 0) {
    facts.push({
      id: 'payday-homestretch',
      type: 'daily',
      title: 'Payday homestretch',
      message: `You have ${fmt(kpis.totalLiquidity)} MAD in liquidity to smoothly navigate the last ${kpis.daysUntilPayday} days before your next payroll.`,
      value: `${kpis.daysUntilPayday} days left`,
      icon: 'calendar',
      priority: 1,
    });
  }

  // Financial Cycle Progress
  if (kpis.forecast && kpis.forecast.totalDays > 0 && kpis.forecast.elapsedDays > 0) {
    const elapsedPct = Math.round((kpis.forecast.elapsedDays / kpis.forecast.totalDays) * 100);
    facts.push({
      id: 'financial-cycle-progress',
      type: 'daily',
      title: 'Financial cycle progress',
      message: `Day ${kpis.forecast.elapsedDays} of ${kpis.forecast.totalDays} in this financial month.`,
      value: `${elapsedPct}% elapsed`,
      icon: 'calendar',
      priority: 4,
    });
  }

  return facts;
}

// ─── Dedup & Diversify ───────────────────────────────────────────────────────

/**
 * Selects a diverse, non-repetitive set of facts.
 * Groups by type and deduplicates near-identical facts.
 * The first card is randomly picked from high-priority facts.
 */
export function selectFacts(facts: FinancialFact[], maxCount = 32): FinancialFact[] {
  if (facts.length === 0) return [];

  // Deduplicate: keep only the best fact per id prefix (e.g. unusual-spending-*)
  const seen = new Set<string>();
  const deduped = facts.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  // Sort by priority ascending (1 = most important)
  const sorted = [...deduped].sort((a, b) => a.priority - b.priority);

  // Pick a random first card from facts with priority 1–3
  const highPriority = sorted.filter((f) => f.priority <= 3);
  const firstCard = highPriority.length > 0
    ? highPriority[Math.floor(Math.random() * highPriority.length)]
    : sorted[0];

  // Build a diverse set: aim for at least one fact per type
  const typesSeen = new Set<string>();
  const selected: FinancialFact[] = [firstCard];
  typesSeen.add(firstCard.type);

  // First pass: one from each type not yet represented
  for (const f of sorted) {
    if (selected.length >= maxCount) break;
    if (f.id === firstCard.id) continue;
    if (!typesSeen.has(f.type)) {
      selected.push(f);
      typesSeen.add(f.type);
    }
  }

  // Second pass: fill remaining slots with other facts (by priority)
  for (const f of sorted) {
    if (selected.length >= maxCount) break;
    if (!selected.find((s) => s.id === f.id)) {
      selected.push(f);
    }
  }

  return selected;
}
