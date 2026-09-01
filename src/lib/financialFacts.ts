import { CategoryBudget, Debt, KPI, Transaction } from '../types';
import { amountOf, getExpensesForMonth, isInMonth, transactionDate } from './finance';
import { normalizeCategory } from './categories';
import { getCurrentFinancialMonth, getPreviousFinancialMonth, type PayrollLike } from './financialMonth';

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
  | 'layers';

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
    | 'daily';
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

  // ── REIMBURSEMENT FACTS ──────────────────────────────────────────────────

  const reimbursableTxs = thisMonthExpenses.filter(
    (t) => t.reimbursableAmount && Number.parseFloat(t.reimbursableAmount) > 0,
  );
  if (reimbursableTxs.length > 0) {
    const totalReimbursable = reimbursableTxs.reduce(
      (s, t) => s + Number.parseFloat(t.reimbursableAmount!),
      0,
    );
    facts.push({
      id: 'pending-reimbursement',
      type: 'reimbursement',
      title: 'Pending reimbursements',
      message: `You have ${reimbursableTxs.length} reimbursable expense${reimbursableTxs.length > 1 ? 's' : ''} this month.`,
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

  // ── DAILY ALLOWANCE FACTS ────────────────────────────────────────────────

  // Today's allowance
  facts.push({
    id: 'daily-allowance',
    type: 'daily',
    title: "Today's allowance",
    message: `Your daily spending allowance based on your current liquidity and ${kpis.daysUntilPayday} days until payday.`,
    value: `${fmt(kpis.dailyAllowance)} MAD / day`,
    icon: 'calendar',
    priority: 2,
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
      priority: isOver ? 1 : 3,
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
    priority: kpis.daysUntilPayday <= 3 ? 2 : 4,
  });

  return facts;
}

// ─── Dedup & Diversify ───────────────────────────────────────────────────────

/**
 * Selects a diverse, non-repetitive set of facts.
 * Groups by type and deduplicates near-identical facts.
 * The first card is randomly picked from high-priority facts.
 */
export function selectFacts(facts: FinancialFact[], maxCount = 12): FinancialFact[] {
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
