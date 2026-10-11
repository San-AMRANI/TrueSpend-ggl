import React, { useMemo, useState } from 'react';
import { Debt, Payroll, Transaction, Wallet, CategoryBudget, Goal, Subscription, DashboardTab } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { normalizeCategory } from '../../lib/categories';
import {
  getSpendingChange,
  monthLabel,
  transactionMonth,
  netExpenseOf,
  isInvestmentTransaction,
} from '../../lib/finance';
import {
  financialPeriodLabel,
  getFinancialMonthsFromTransactions,
  getCurrentFinancialMonth,
  getPreviousFinancialMonth,
} from '../../lib/financialMonth';
import {
  Banknote,
  Landmark,
  X,
  FileText,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertCircle,
  PieChart as PieChartIcon,
  BarChart3,
  Repeat,
  Target,
  ArrowRight,
  ArrowUpRight,
  Zap,
  Store,
  Layers,
  Calendar,
  Filter,
  ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
  '#f97316',
  '#a855f7',
];

type AnalyticsSubView = 'overview' | 'categories' | 'recurring' | 'merchants' | 'debts_goals';

interface AnalyticsTabProps {
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  analyticsMonth: string;
  setAnalyticsMonth: (month: string) => void;
  wallets?: Wallet[];
  budgets?: CategoryBudget[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  setActiveTab?: (tab: DashboardTab) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  transactions,
  payrolls,
  debts,
  analyticsMonth,
  setAnalyticsMonth,
  wallets = [],
  budgets = [],
  goals = [],
  subscriptions = [],
  setActiveTab,
}) => {
  const [subView, setSubView] = useState<AnalyticsSubView>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const availableMonthRefs = useMemo(
    () => getFinancialMonthsFromTransactions(transactions, payrolls),
    [transactions, payrolls]
  );

  const availableMonths = useMemo(() => {
    return ['All Time', ...availableMonthRefs.map(financialPeriodLabel)];
  }, [availableMonthRefs]);

  const filteredTransactions = useMemo(() => {
    if (analyticsMonth === 'All Time') return transactions;
    const ref = availableMonthRefs.find((m) => financialPeriodLabel(m) === analyticsMonth);
    if (!ref) return transactions;
    return transactions.filter(
      (t) => new Date(t.createdAt) >= ref.start && new Date(t.createdAt) <= ref.end
    );
  }, [transactions, analyticsMonth, availableMonthRefs]);

  // Expenses by Category
  const categoryData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      const category = normalizeCategory(curr.category) || 'Uncategorized';
      acc[category] = (acc[category] || 0) + netExpenseOf(curr);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Income by Category
  const incomeCategoryData = useMemo(() => {
    const incomes = filteredTransactions.filter((t) => t.type === 'Income');
    const grouped = incomes.reduce((acc, curr) => {
      const category = normalizeCategory(curr.category) || 'Uncategorized';
      acc[category] = (acc[category] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const activeCategory = [...categoryData, ...incomeCategoryData].some(
    (category) => category.name === selectedCategory
  )
    ? selectedCategory
    : null;
  const isIncomeCategory = incomeCategoryData.some((c) => c.name === activeCategory);

  // Wallets spending breakdown
  const walletData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const walletSums: Record<string, number> = {};

    expenses.forEach((t) => {
      walletSums[t.walletId] = (walletSums[t.walletId] || 0) + netExpenseOf(t);
    });

    return Object.entries(walletSums)
      .map(([walletId, value]) => {
        const wallet = wallets.find((w) => w.id === walletId);
        return {
          name: wallet ? wallet.name : walletId,
          value,
        };
      })
      .filter((w) => w.value > 0);
  }, [filteredTransactions, wallets]);

  // Financial month references for comparison
  const comparisonMonth = useMemo(() => {
    if (analyticsMonth === 'All Time') {
      return getCurrentFinancialMonth(payrolls);
    }
    const ref = availableMonthRefs.find((m) => financialPeriodLabel(m) === analyticsMonth);
    return ref || getCurrentFinancialMonth(payrolls);
  }, [analyticsMonth, availableMonthRefs, payrolls]);

  const spendingChange = useMemo(
    () =>
      comparisonMonth
        ? getSpendingChange(transactions, comparisonMonth.year, comparisonMonth.month, undefined, payrolls)
        : { current: 0, previous: 0, difference: 0, percentage: null },
    [comparisonMonth, transactions, payrolls]
  );

  const changeCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions
      .filter((transaction) => transaction.type === 'Expense')
      .forEach((transaction) => {
        if (!comparisonMonth) return;
        const ref = transactionMonth(transaction, payrolls);
        const previous = getPreviousFinancialMonth(payrolls, comparisonMonth);
        if (
          ref &&
          ((ref.year === comparisonMonth.year && ref.month === comparisonMonth.month) ||
            (previous && ref.year === previous.year && ref.month === previous.month))
        ) {
          categories.add(normalizeCategory(transaction.category) || 'Uncategorized');
        }
      });
    return Array.from(categories)
      .map((category) => ({
        category,
        ...(comparisonMonth
          ? getSpendingChange(transactions, comparisonMonth.year, comparisonMonth.month, category, payrolls)
          : { current: 0, previous: 0, difference: 0, percentage: null }),
      }))
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [comparisonMonth, transactions, payrolls]);

  const selectedCategoryTransactions = useMemo(() => {
    if (!activeCategory) return [];

    return filteredTransactions
      .filter(
        (transaction) =>
          (normalizeCategory(transaction.category) || 'Uncategorized') === activeCategory
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeCategory, filteredTransactions]);

  const selectedCategoryTotal = selectedCategoryTransactions.reduce(
    (total, transaction) =>
      total + (transaction.type === 'Expense' ? netExpenseOf(transaction) : parseFloat(transaction.amount)),
    0
  );

  const incomeVsExpenseData = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === 'Income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = filteredTransactions
      .filter((t) => t.type === 'Expense')
      .reduce((sum, t) => sum + netExpenseOf(t), 0);
    return [
      { name: 'Income', amount: income },
      { name: 'Expense', amount: expense },
    ];
  }, [filteredTransactions]);

  const totalIncome = incomeVsExpenseData[0].amount;
  const totalExpense = incomeVsExpenseData[1].amount;
  const netSavings = totalIncome - totalExpense;

  const historicalAverages = useMemo(() => {
    const allMonths = new Set<string>();
    let histIncome = 0;
    let histExpense = 0;

    transactions.forEach((t) => {
      const date = new Date(t.createdAt);
      allMonths.add(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

      if (t.type === 'Income') histIncome += parseFloat(t.amount);
      if (t.type === 'Expense') histExpense += netExpenseOf(t);
    });

    const monthCount = allMonths.size > 0 ? allMonths.size : 1;
    return {
      avgIncome: histIncome / monthCount,
      avgExpense: histExpense / monthCount,
    };
  }, [transactions]);

  const adjustedTrueSpendData = useMemo(() => {
    let totalGrossExpenses = 0;
    let totalExpenses = 0;
    let debtRepayments = 0;
    let reimbursements = 0;
    let pendingReimbursable = 0;
    let investmentCapital = 0;

    filteredTransactions.forEach((tx) => {
      const amount = parseFloat(tx.amount);
      const isInvest = isInvestmentTransaction(tx, wallets);
      if (tx.type === 'Expense') {
        totalGrossExpenses += amount;
        if (isInvest) {
          investmentCapital += netExpenseOf(tx);
        } else {
          totalExpenses += netExpenseOf(tx);
        }
      }

      if (
        tx.type === 'Expense' &&
        ['💳 Debt & Obligations', 'Debt Repayment', 'Loan', '🔄 Transfer', 'Transfer'].includes(
          tx.category || ''
        )
      ) {
        debtRepayments += amount;
      }

      const isPayableTx = (tx as any).linkedDebtType === 'Payable' || tx.category === 'Debt Repayment';
      if (
        tx.type === 'Expense' &&
        !isPayableTx &&
        tx.reimbursableAmount &&
        parseFloat(tx.reimbursableAmount) > 0
      ) {
        reimbursements += parseFloat(tx.reimbursableAmount);

        if (tx.linkedContactId) {
          const linkedDebt = debts.find((d) => d.id === tx.linkedContactId);
          if (linkedDebt && linkedDebt.type === 'Receivable' && linkedDebt.status === 'Pending') {
            pendingReimbursable += parseFloat(linkedDebt.remainingBalance);
          }
        } else {
          pendingReimbursable += parseFloat(tx.reimbursableAmount);
        }
      }
    });

    return {
      totalGrossExpenses,
      totalExpenses,
      debtRepayments,
      reimbursements,
      pendingReimbursable,
      investmentCapital,
      adjustedTrueSpend: totalExpenses - debtRepayments,
    };
  }, [filteredTransactions, debts, wallets]);

  const savingsRate = useMemo(() => {
    if (totalIncome === 0) return 0;
    return ((totalIncome - totalExpense) / totalIncome) * 100;
  }, [totalIncome, totalExpense]);

  const topExpense = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    if (expenses.length === 0) return null;
    return expenses.reduce((max, current) =>
      netExpenseOf(current) > netExpenseOf(max) ? current : max
    );
  }, [filteredTransactions]);

  const comparisonLabel = comparisonMonth
    ? financialPeriodLabel(comparisonMonth)
    : 'No configured financial period';

  // Digest summary
  const digestData = useMemo(() => {
    let targetRange: { start: Date; end: Date; label: string } | null = null;

    if (analyticsMonth !== 'All Time') {
      const ref = availableMonthRefs.find((m) => financialPeriodLabel(m) === analyticsMonth);
      if (ref) {
        targetRange = { start: ref.start, end: ref.end, label: analyticsMonth };
      }
    }

    if (!targetRange) {
      const currentFm = getCurrentFinancialMonth(payrolls);
      const lastFm = currentFm ? getPreviousFinancialMonth(payrolls, currentFm) : null;
      if (lastFm) {
        targetRange = { start: lastFm.start, end: lastFm.end, label: financialPeriodLabel(lastFm) };
      } else if (availableMonthRefs.length > 0) {
        const latest = availableMonthRefs[0];
        targetRange = { start: latest.start, end: latest.end, label: financialPeriodLabel(latest) };
      }
    }

    if (!targetRange) return null;

    const { start, end, label } = targetRange;

    const periodTxs = transactions.filter((t) => {
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate <= end;
    });

    const income = periodTxs
      .filter((t) => t.type === 'Income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = periodTxs
      .filter((t) => t.type === 'Expense')
      .reduce((sum, t) => sum + netExpenseOf(t), 0);
    const moneySaved = income - expense;
    const periodSavingsRate = income > 0 ? (moneySaved / income) * 100 : 0;

    const topCategoriesMap = periodTxs
      .filter((t) => t.type === 'Expense')
      .reduce((acc, curr) => {
        const category = normalizeCategory(curr.category) || 'Uncategorized';
        acc[category] = (acc[category] || 0) + netExpenseOf(curr);
        return acc;
      }, {} as Record<string, number>);

    const sortedCategories = Object.entries(topCategoriesMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const periodDebts = debts.filter((d) => {
      const debtDate = new Date(d.createdAt);
      return debtDate >= start && debtDate <= end;
    });

    const settledDebts = periodDebts.filter((d) => d.status === 'Cleared').length;
    const newDebts = periodDebts.length;

    return {
      month: label,
      income,
      expense,
      moneySaved,
      savingsRate: periodSavingsRate,
      topCategories: sortedCategories,
      debtStats: {
        settledDebts,
        newDebts,
      },
    };
  }, [transactions, debts, payrolls, analyticsMonth, availableMonthRefs]);

  // Interconnected: Budget vs Actual Variance Analysis
  const budgetVarianceData = useMemo(() => {
    if (!comparisonMonth) return [];
    const periodBudgets = budgets.filter(
      (b) => b.year === comparisonMonth.year && b.month === comparisonMonth.month
    );
    const periodExpenses = filteredTransactions.filter((t) => t.type === 'Expense');

    const actuals: Record<string, number> = {};
    periodExpenses.forEach((t) => {
      const cat = normalizeCategory(t.category) || 'Uncategorized';
      actuals[cat] = (actuals[cat] || 0) + netExpenseOf(t);
    });

    const allCategories = Array.from(
      new Set([
        ...periodBudgets.map((b) => normalizeCategory(b.category)),
        ...Object.keys(actuals),
      ])
    ).filter(Boolean);

    return allCategories
      .map((cat) => {
        const budgetObj = periodBudgets.find((b) => normalizeCategory(b.category) === cat);
        const budgeted = budgetObj ? parseFloat(budgetObj.amount || '0') : 0;
        const spent = actuals[cat] || 0;
        const diff = budgeted - spent; // positive = under budget, negative = over budget
        const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : spent > 0 ? 100 : 0;
        return {
          category: cat,
          budgeted,
          spent,
          remaining: diff,
          isOver: diff < 0 && budgeted > 0,
          percentUsed,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [comparisonMonth, budgets, filteredTransactions]);

  const budgetSummary = useMemo(() => {
    const totalBudgeted = budgetVarianceData.reduce((s, b) => s + b.budgeted, 0);
    const totalSpentInBudgets = budgetVarianceData.reduce((s, b) => s + b.spent, 0);
    const overBudgetCount = budgetVarianceData.filter((b) => b.isOver).length;
    const onTrackCount = budgetVarianceData.filter((b) => b.budgeted > 0 && !b.isOver).length;
    const netVariance = totalBudgeted - totalSpentInBudgets;

    return {
      totalBudgeted,
      totalSpentInBudgets,
      overBudgetCount,
      onTrackCount,
      netVariance,
    };
  }, [budgetVarianceData]);

  // Interconnected: Subscriptions & Recurring vs Flexible Breakdown
  const recurringAnalysis = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.status === 'active');
    const monthlySubTotal = activeSubs.reduce((acc, sub) => {
      const amt = parseFloat(sub.amount || '0') || 0;
      if (sub.billingCycle === 'monthly') return acc + amt;
      if (sub.billingCycle === 'yearly') return acc + amt / 12;
      if (sub.billingCycle === 'quarterly') return acc + amt / 3;
      if (sub.billingCycle === 'weekly') return acc + amt * 4.33;
      return acc + amt;
    }, 0);

    const yearlySubTotal = monthlySubTotal * 12;
    const fixedOutflows = monthlySubTotal + adjustedTrueSpendData.debtRepayments;
    const discretionarySpend = Math.max(0, totalExpense - fixedOutflows);
    const fixedRatio = totalExpense > 0 ? (fixedOutflows / totalExpense) * 100 : 0;

    const breakdownChartData = [
      { name: 'Fixed Subscriptions', value: Number(monthlySubTotal.toFixed(2)), color: '#6366f1' },
      { name: 'Debt Repayments', value: Number(adjustedTrueSpendData.debtRepayments.toFixed(2)), color: '#f59e0b' },
      { name: 'Discretionary Living', value: Number(discretionarySpend.toFixed(2)), color: '#10b981' },
    ].filter((item) => item.value > 0);

    return {
      activeSubs,
      monthlySubTotal,
      yearlySubTotal,
      fixedOutflows,
      discretionarySpend,
      fixedRatio,
      breakdownChartData,
    };
  }, [subscriptions, adjustedTrueSpendData.debtRepayments, totalExpense]);

  // Interconnected: Cumulative Day-by-Day Burn Trajectory
  const cashFlowTrajectoryData = useMemo(() => {
    let start: Date;
    let end: Date;

    if (analyticsMonth !== 'All Time') {
      const ref = availableMonthRefs.find((m) => financialPeriodLabel(m) === analyticsMonth);
      if (ref) {
        start = new Date(ref.start);
        end = new Date(ref.end);
      } else {
        const cur = getCurrentFinancialMonth(payrolls);
        start = cur ? new Date(cur.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        end = cur ? new Date(cur.end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      }
    } else {
      const cur = getCurrentFinancialMonth(payrolls);
      start = cur ? new Date(cur.start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      end = cur ? new Date(cur.end) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    }

    const today = new Date();
    const effectiveEnd = end < today ? end : today;
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const periodExpenses = filteredTransactions
      .filter((t) => t.type === 'Expense')
      .reduce((sum, t) => sum + netExpenseOf(t), 0);
    const avgDailyBudget = periodExpenses > 0 ? periodExpenses / totalDays : 0;

    const days: { day: string; date: string; spent: number; cumulativeSpent: number; linearPace: number }[] = [];
    let runningSpend = 0;

    const curr = new Date(start);
    let dayIndex = 1;
    while (curr <= effectiveEnd && dayIndex <= 45) {
      const dayStart = new Date(curr);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(curr);
      dayEnd.setHours(23, 59, 59, 999);

      const daySpend = filteredTransactions
        .filter((t) => t.type === 'Expense')
        .filter((t) => {
          const d = new Date(t.createdAt);
          return d >= dayStart && d <= dayEnd;
        })
        .reduce((sum, t) => sum + netExpenseOf(t), 0);

      runningSpend += daySpend;
      days.push({
        day: format(curr, 'MMM d'),
        date: format(curr, 'yyyy-MM-dd'),
        spent: Math.round(daySpend),
        cumulativeSpent: Math.round(runningSpend),
        linearPace: Math.round(avgDailyBudget * dayIndex),
      });

      curr.setDate(curr.getDate() + 1);
      dayIndex++;
    }

    return days;
  }, [filteredTransactions, analyticsMonth, availableMonthRefs, payrolls]);

  // Merchant & Payee Intelligence
  const merchantData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const merchants: Record<string, { name: string; total: number; count: number; category: string }> = {};

    expenses.forEach((t) => {
      let name = (t.notes || '').trim();
      if (!name) name = normalizeCategory(t.category) || 'General Expense';
      name = name.split('-')[0].split('/')[0].trim();
      if (name.length > 28) name = name.substring(0, 28) + '...';

      if (!merchants[name]) {
        merchants[name] = {
          name,
          total: 0,
          count: 0,
          category: normalizeCategory(t.category) || 'Other',
        };
      }
      merchants[name].total += netExpenseOf(t);
      merchants[name].count += 1;
    });

    return Object.values(merchants)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredTransactions]);

  // Spending Spikes & Outlier Detector
  const spendingSpikes = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    if (!expenses.length) return [];
    const total = expenses.reduce((sum, t) => sum + netExpenseOf(t), 0);
    const avgTx = total / expenses.length;
    return expenses
      .filter((t) => netExpenseOf(t) >= Math.max(avgTx * 2.2, 350))
      .sort((a, b) => netExpenseOf(b) - netExpenseOf(a))
      .slice(0, 6);
  }, [filteredTransactions]);

  // Debt & Savings Momentum
  const debtAndSavingsMomentum = useMemo(() => {
    const debtRepayments = adjustedTrueSpendData.debtRepayments;
    const debtDrainRatio = totalIncome > 0 ? (debtRepayments / totalIncome) * 100 : 0;
    const activeDebtCount = debts.filter((d) => d.status === 'Pending').length;
    const totalPendingDebt = debts
      .filter((d) => d.status === 'Pending')
      .reduce((sum, d) => sum + parseFloat(d.remainingBalance || '0'), 0);

    const activeGoalsCount = goals.length;
    const totalGoalsSaved = goals.reduce((sum, g) => sum + parseFloat(g.currentAmount || '0'), 0);
    const totalGoalsTarget = goals.reduce((sum, g) => sum + parseFloat(g.targetAmount || '0'), 0);
    const overallGoalsProgress = totalGoalsTarget > 0 ? (totalGoalsSaved / totalGoalsTarget) * 100 : 0;

    return {
      debtRepayments,
      debtDrainRatio,
      activeDebtCount,
      totalPendingDebt,
      activeGoalsCount,
      totalGoalsSaved,
      totalGoalsTarget,
      overallGoalsProgress,
    };
  }, [adjustedTrueSpendData.debtRepayments, totalIncome, debts, goals]);

  // Outflow breakdown for Cash Flow Waterfall
  const cashFlowBreakdownChart = useMemo(() => {
    return [
      { name: 'Income Inflow', amount: Number(totalIncome.toFixed(2)), fill: '#10b981' },
      { name: 'Living Spend', amount: Number(adjustedTrueSpendData.adjustedTrueSpend.toFixed(2)), fill: '#3b82f6' },
      { name: 'Subscriptions', amount: Number(recurringAnalysis.monthlySubTotal.toFixed(2)), fill: '#8b5cf6' },
      { name: 'Debt Repaid', amount: Number(adjustedTrueSpendData.debtRepayments.toFixed(2)), fill: '#f59e0b' },
      { name: 'Net Saved', amount: Number(Math.max(0, netSavings).toFixed(2)), fill: '#06b6d4' },
    ];
  }, [totalIncome, adjustedTrueSpendData, recurringAnalysis, netSavings]);

  return (
    <div className="space-y-6">
      {/* Top Filter & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Financial Intelligence & Analytics
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Interconnected cash flow, budget variance, recurring burn, and payee intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Period:
          </span>
          <Select
            value={analyticsMonth}
            onChange={(e) => setAnalyticsMonth(e.target.value)}
            className="text-sm font-medium rounded-lg border-gray-200 dark:border-gray-700"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Sub-view Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200 dark:border-gray-800 text-sm">
        <button
          type="button"
          onClick={() => {
            setSubView('overview');
            setSelectedCategory(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
            subView === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Overview & Cash Flow</span>
        </button>

        <button
          type="button"
          onClick={() => setSubView('categories')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
            subView === 'categories'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          <span>Categories & Budget Variance</span>
          {budgetSummary.overBudgetCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
              {budgetSummary.overBudgetCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSubView('recurring');
            setSelectedCategory(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
            subView === 'recurring'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Repeat className="w-4 h-4" />
          <span>Recurring vs Discretionary</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
            {recurringAnalysis.activeSubs.length} subs
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubView('merchants');
            setSelectedCategory(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
            subView === 'merchants'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Payees & Spikes</span>
          {spendingSpikes.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
              {spendingSpikes.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSubView('debts_goals');
            setSelectedCategory(null);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
            subView === 'debts_goals'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Debt & Goals Velocity</span>
        </button>
      </div>

      {/* Macro Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Cashflow & Savings */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Net Money Saved
            </span>
            <span
              className={`p-1.5 rounded-lg ${
                netSavings >= 0
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'
              }`}
            >
              {netSavings >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-2">
            <p
              className={`text-2xl font-black ${
                netSavings >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {netSavings >= 0 ? '+' : ''}
              {netSavings.toFixed(2)} MAD
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Savings Rate:</span>
              <span
                className={`text-xs font-bold ${
                  savingsRate >= 20
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : savingsRate >= 0
                    ? 'text-gray-700 dark:text-gray-300'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Adjusted True Spend */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Adjusted True Spend
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {adjustedTrueSpendData.adjustedTrueSpend.toFixed(2)} MAD
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Living outflow (excl. debt moves & reimb.)
            </p>
          </div>
        </div>

        {/* Fixed Commitments Load */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Committed Fixed Load
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Repeat className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {recurringAnalysis.fixedOutflows.toFixed(2)} MAD
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {recurringAnalysis.fixedRatio.toFixed(0)}% of outflow locked in bills & subs
            </p>
          </div>
        </div>

        {/* Spending Momentum vs Previous */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Period Trend
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {totalExpense.toFixed(0)} MAD
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {spendingChange.percentage === null ? (
                <span className="text-gray-500">First logged period</span>
              ) : (
                <span
                  className={`font-bold flex items-center gap-0.5 ${
                    spendingChange.difference > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : spendingChange.difference < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-500'
                  }`}
                >
                  {spendingChange.percentage > 0 ? '+' : ''}
                  {spendingChange.percentage.toFixed(1)}% vs prev period
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ======================= SUB-VIEW 1: OVERVIEW & CASH FLOW ======================= */}
      {subView === 'overview' && (
        <div className="space-y-6">
          {/* Executive Digest Banner */}
          {digestData && (
            <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/20 via-white to-sky-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/20 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Executive Financial Digest: {digestData.month}
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Period cashflow surplus, debt resolution, and top spending drivers.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="h-3 w-3 text-indigo-500" /> Executive Digest
                </span>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Net Money Saved</p>
                    <p
                      className={`text-xl font-black mt-1 ${
                        digestData.moneySaved >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {digestData.moneySaved >= 0 ? '+' : ''}
                      {digestData.moneySaved.toFixed(2)} MAD
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Savings rate:{' '}
                      <strong
                        className={
                          digestData.savingsRate >= 20
                            ? 'text-emerald-500'
                            : 'text-gray-600 dark:text-gray-300'
                        }
                      >
                        {digestData.savingsRate.toFixed(1)}%
                      </strong>
                    </p>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Debts Created in Period
                    </p>
                    <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                      {digestData.debtStats.newDebts}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">New obligations logged</p>
                  </div>

                  <div className="p-3.5 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Debts Cleared in Period
                    </p>
                    <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                      {digestData.debtStats.settledDebts}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Debts settled & closed</p>
                  </div>
                </div>

                {digestData.topCategories.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                      <span>Top 5 Spending Categories ({digestData.month}):</span>
                      <span className="text-[11px] font-normal text-gray-400">
                        Total Outflow: {digestData.expense.toFixed(2)} MAD
                      </span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {digestData.topCategories.map((item, index) => (
                        <div
                          key={item.name}
                          className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/60 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                              {item.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100 shrink-0">
                            {item.value.toFixed(0)} MAD
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cumulative Trajectory Burn Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Day-by-Day Cumulative Spending Trajectory
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Track actual cumulative outflow against the linear expected pace throughout the period.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {cashFlowTrajectoryData.length > 0 ? (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlowTrajectoryData}>
                      <defs>
                        <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="day" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={11} />
                      <Tooltip
                        formatter={(val: any, name: string) => [
                          `${Number(val).toFixed(2)} MAD`,
                          name === 'cumulativeSpent' ? 'Cumulative Spent' : 'Ideal Linear Pace',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulativeSpent"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#spendGradient)"
                        name="cumulativeSpent"
                      />
                      <Area
                        type="monotone"
                        dataKey="linearPace"
                        stroke="#9ca3af"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        fillOpacity={0}
                        name="linearPace"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No daily spending trajectory data available for this range.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cash Flow Outflow Waterfall & Wallet Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Cash Flow Inflow & Outflow Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashFlowBreakdownChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={11} />
                      <Tooltip formatter={(value: any) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                        {cashFlowBreakdownChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spending by Wallet Source</CardTitle>
              </CardHeader>
              <CardContent>
                {walletData.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={walletData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          dataKey="value"
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {walletData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No wallet disbursement records found.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Adjusted True Spend Details */}
          <Card>
            <CardHeader>
              <CardTitle>Adjusted True Spend Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Net Expenses</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
                    {adjustedTrueSpendData.totalExpenses.toFixed(2)} MAD
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {adjustedTrueSpendData.reimbursements > 0
                      ? `Gross outflow: ${adjustedTrueSpendData.totalGrossExpenses.toFixed(2)} MAD`
                      : 'All outbound transactions'}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Debt Repayments</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
                    -{adjustedTrueSpendData.debtRepayments.toFixed(2)} MAD
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Money moved, not spent</p>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Reimbursements Deducted
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    -{adjustedTrueSpendData.reimbursements.toFixed(2)} MAD
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Settled or split for others</p>
                </div>

                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Adjusted True Spend</p>
                  <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {adjustedTrueSpendData.adjustedTrueSpend.toFixed(2)} MAD
                  </p>
                  <p className="mt-1 text-xs text-blue-600/80 dark:text-blue-400/80">
                    True living cost on yourself
                  </p>
                </div>
              </div>

              {adjustedTrueSpendData.investmentCapital > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-200">
                  <p>
                    🛡️ <strong>{adjustedTrueSpendData.investmentCapital.toFixed(2)} MAD</strong> allocated to
                    Investment Wallets / Assets is protected as capital conversions and strictly excluded from
                    living expenses.
                  </p>
                </div>
              )}
              {adjustedTrueSpendData.pendingReimbursable > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                  <p>
                    You also have{' '}
                    <strong>{adjustedTrueSpendData.pendingReimbursable.toFixed(2)} MAD</strong> in pending
                    reimbursable expenses this period.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spending Change vs Last Period */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Change vs Previous Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_2fr]">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Overall · {comparisonLabel}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {spendingChange.current.toFixed(2)} MAD
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    vs {spendingChange.previous.toFixed(2)} MAD last month
                  </p>
                  {spendingChange.percentage === null ? (
                    <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {spendingChange.current > 0
                        ? `+${spendingChange.current.toFixed(2)} MAD · No spending last month`
                        : 'No spending in either month'}
                    </p>
                  ) : (
                    <p
                      className={`mt-2 text-sm font-semibold ${
                        spendingChange.difference > 0
                          ? 'text-red-600 dark:text-red-400'
                          : spendingChange.difference < 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {spendingChange.percentage > 0 ? '+' : ''}
                      {spendingChange.percentage.toFixed(1)}% vs last month
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  {changeCategories.slice(0, 6).map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between gap-4 rounded-md border border-gray-100 dark:border-gray-800 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.category}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.current.toFixed(0)} → {item.previous.toFixed(0)} MAD
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          item.difference > 0
                            ? 'text-red-600 dark:text-red-400'
                            : item.difference < 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.percentage === null
                          ? item.current > 0
                            ? `+${item.current.toFixed(0)} MAD`
                            : '—'
                          : `${item.percentage > 0 ? '+' : ''}${item.percentage.toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                  {changeCategories.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No category spending to compare yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ======================= SUB-VIEW 2: CATEGORIES & BUDGET VARIANCE ======================= */}
      {subView === 'categories' && (
        <div className="space-y-6">
          {/* Budget Variance Summary Bar */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 dark:from-indigo-950/20 dark:via-gray-900 dark:to-purple-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Budget vs. Actual Variance Analysis
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Interconnected with your monthly category envelopes in Budgets.
                </p>
              </div>
              {setActiveTab && (
                <Button
                  onClick={() => setActiveTab('budgets')}
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5"
                >
                  <span>Manage Budgets</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Budget</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                    {budgetSummary.totalBudgeted.toFixed(0)} MAD
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Actual Spent</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                    {budgetSummary.totalSpentInBudgets.toFixed(0)} MAD
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Net Variance</p>
                  <p
                    className={`text-lg font-black mt-0.5 ${
                      budgetSummary.netVariance >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {budgetSummary.netVariance >= 0 ? '+' : ''}
                    {budgetSummary.netVariance.toFixed(0)} MAD
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status</p>
                  <div className="flex items-center justify-center gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {budgetSummary.onTrackCount} ok
                    </span>
                    {budgetSummary.overBudgetCount > 0 && (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        • {budgetSummary.overBudgetCount} over
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Variance Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgetVarianceData.map((item) => {
              const isOver = item.isOver;
              const hasBudget = item.budgeted > 0;
              const percent = Math.min(item.percentUsed, 100);

              return (
                <div
                  key={item.category}
                  onClick={() => setSelectedCategory(item.category)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    activeCategory === item.category
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                        {item.category}
                      </span>
                      {isOver && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          Over Budget
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                      {hasBudget
                        ? `${item.spent.toFixed(0)} / ${item.budgeted.toFixed(0)} MAD`
                        : `${item.spent.toFixed(0)} MAD (No target)`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {hasBudget ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isOver
                              ? 'bg-rose-500'
                              : item.percentUsed > 80
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                        <span>{item.percentUsed.toFixed(0)}% consumed</span>
                        <span className={item.remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {item.remaining >= 0
                            ? `${item.remaining.toFixed(0)} MAD remaining`
                            : `${Math.abs(item.remaining).toFixed(0)} MAD over`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400 italic">
                      Click to inspect transactions or set budget in Budgets tab.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Category Pie & Outflow Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Spending Share by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          outerRadius={95}
                          dataKey="value"
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {categoryData.map((_entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              className="cursor-pointer outline-none"
                              onClick={() => setSelectedCategory(categoryData[index].name)}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No expense data available for charts.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Income Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {incomeCategoryData.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      aria-pressed={activeCategory === item.name}
                      onClick={() => setSelectedCategory(item.name)}
                      className={`flex w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors border ${
                        activeCategory === item.name
                          ? 'bg-emerald-50/40 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800'
                          : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        +{item.value.toFixed(2)} MAD
                      </span>
                    </button>
                  ))}
                  {incomeCategoryData.length === 0 && (
                    <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                      No income records in this period.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ======================= SUB-VIEW 3: RECURRING VS DISCRETIONARY ======================= */}
      {subView === 'recurring' && (
        <div className="space-y-6">
          {/* Subscriptions & Fixed Costs Header */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/40 via-white to-purple-50/40 dark:from-indigo-950/20 dark:via-gray-900 dark:to-purple-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Fixed Recurring Overhead vs. Flexible Discretionary Spend
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Understand what portion of your monthly income is locked before you even step outside.
                </p>
              </div>
              {setActiveTab && (
                <Button
                  onClick={() => setActiveTab('subscriptions')}
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1.5"
                >
                  <span>Manage Subscriptions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Monthly Subs Burn</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {recurringAnalysis.monthlySubTotal.toFixed(0)} MAD
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Yearly Subs Cost</p>
                  <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                    {recurringAnalysis.yearlySubTotal.toFixed(0)} MAD
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Fixed Drain Ratio</p>
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {recurringAnalysis.fixedRatio.toFixed(1)}%
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Flexible Living</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {recurringAnalysis.discretionarySpend.toFixed(0)} MAD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Overhead Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {recurringAnalysis.breakdownChartData.length > 0 ? (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={recurringAnalysis.breakdownChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          dataKey="value"
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {recurringAnalysis.breakdownChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No recurring or discretionary spend data available.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Active Subscriptions Drivers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {recurringAnalysis.activeSubs.map((sub) => {
                    const amt = parseFloat(sub.amount || '0');
                    const w = wallets.find((w) => w.id === sub.walletId);
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/60"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <Repeat className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{sub.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {sub.category} • Billed {sub.billingCycle} • Wallet: {w ? w.name : 'Main'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {amt.toFixed(2)} MAD
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {(amt * (sub.billingCycle === 'yearly' ? 1 : 12)).toFixed(0)} MAD / yr
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {recurringAnalysis.activeSubs.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No active recurring subscriptions logged yet. Add your Netflix, Spotify, gym or internet in Subscriptions.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ======================= SUB-VIEW 4: MERCHANTS & SPIKES ======================= */}
      {subView === 'merchants' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Merchants Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Top Payees & Merchants
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Extracted from transaction memos, descriptions, and counterparty records.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {merchantData.map((m, idx) => (
                    <div
                      key={m.name}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{m.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {m.category} • {m.count} {m.count === 1 ? 'visit' : 'visits'} • avg{' '}
                            {(m.total / m.count).toFixed(0)} MAD
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900 dark:text-white">
                          {m.total.toFixed(2)} MAD
                        </p>
                      </div>
                    </div>
                  ))}
                  {merchantData.length === 0 && (
                    <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No payee or memo records found in this period.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Outlier & Spending Spikes */}
            <Card className="border-amber-100 dark:border-amber-900/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                  Outlier & Spending Spikes Detector
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Single transactions that drove unexpected budget surges or exceeded 2.2x normal transaction size.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {spendingSpikes.map((tx) => {
                    const amt = netExpenseOf(tx);
                    const w = wallets.find((w) => w.id === tx.walletId);
                    return (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {tx.notes || tx.category || 'Large Outflow'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Spike
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {format(new Date(tx.createdAt), 'MMM d, yyyy')} • {normalizeCategory(tx.category)} • {w ? w.name : tx.walletId}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-black text-rose-600 dark:text-rose-400">
                            -{amt.toFixed(2)} MAD
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {spendingSpikes.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <p className="font-semibold text-gray-800 dark:text-gray-200">No abnormal spending spikes detected</p>
                      <p className="text-xs text-gray-400 mt-1">Your expenses in this period are consistent and stable.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ======================= SUB-VIEW 5: DEBTS & GOALS VELOCITY ======================= */}
      {subView === 'debts_goals' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Debt Servicing Velocity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    Debt Payoff & Obligations Momentum
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Debt servicing drain ratio and settlement velocity.
                  </p>
                </div>
                {setActiveTab && (
                  <Button
                    onClick={() => setActiveTab('debts')}
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                  >
                    <span>Debts Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Servicing Outflow</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                      {debtAndSavingsMomentum.debtRepayments.toFixed(0)} MAD
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Income Drain</p>
                    <p className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {debtAndSavingsMomentum.debtDrainRatio.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Pending Obligations:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {debtAndSavingsMomentum.totalPendingDebt.toFixed(2)} MAD
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Open Debt Records:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {debtAndSavingsMomentum.activeDebtCount} debts
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Savings Goals Velocity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    Savings Goals Acceleration
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Funding velocity and goal milestone progress.
                  </p>
                </div>
                {setActiveTab && (
                  <Button
                    onClick={() => setActiveTab('goals')}
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                  >
                    <span>Goals Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Saved in Goals</p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {debtAndSavingsMomentum.totalGoalsSaved.toFixed(0)} MAD
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Milestone Progress</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {debtAndSavingsMomentum.overallGoalsProgress.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Target: {debtAndSavingsMomentum.totalGoalsTarget.toFixed(0)} MAD</span>
                    <span>{debtAndSavingsMomentum.activeGoalsCount} goals active</span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(debtAndSavingsMomentum.overallGoalsProgress, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                    Tip: Use the Smart Budget Surplus Soak in the Budgets or Goals tab to automatically sweep unspent month-end cash into your priority goal.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Drill-down Card when a Category is Selected */}
      {activeCategory && (
        <Card className="border-indigo-200 dark:border-indigo-850 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>{activeCategory}</span>
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  ({analyticsMonth})
                </span>
              </CardTitle>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Detailed transaction drill-down for this category.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close category details"
              onClick={() => setSelectedCategory(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {isIncomeCategory ? 'Total received' : 'Total spent'}
                </p>
                <p
                  className={`mt-1 text-lg font-bold ${
                    isIncomeCategory
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {isIncomeCategory ? '+' : ''}
                  {selectedCategoryTotal.toFixed(2)} MAD
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Transactions</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                  {selectedCategoryTransactions.length}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Average {isIncomeCategory ? 'amount' : 'purchase'}
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                  {(selectedCategoryTotal / (selectedCategoryTransactions.length || 1)).toFixed(2)} MAD
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-96 overflow-y-auto pr-1">
              {selectedCategoryTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {transaction.notes || activeCategory}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{format(new Date(transaction.createdAt), 'MMM d, yyyy')}</span>
                      <span className="flex items-center gap-1">
                        {(() => {
                          const w = wallets.find((w) => w.id === transaction.walletId);
                          const isBank = w
                            ? w.type === 'Bank' || w.type === 'Savings'
                            : transaction.walletId === 'Bank';
                          return isBank ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />;
                        })()}
                        {wallets.find((w) => w.id === transaction.walletId)?.name || transaction.walletId}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-semibold ${
                        transaction.type === 'Expense'
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {transaction.type === 'Expense' ? '-' : '+'}
                      {(transaction.type === 'Expense'
                        ? netExpenseOf(transaction)
                        : parseFloat(transaction.amount)
                      ).toFixed(2)}{' '}
                      MAD
                    </span>
                    {transaction.type === 'Expense' &&
                      transaction.linkedDebtType !== 'Payable' &&
                      transaction.category !== 'Debt Repayment' &&
                      transaction.reimbursableAmount &&
                      parseFloat(transaction.reimbursableAmount) > 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          gross {parseFloat(transaction.amount).toFixed(2)} • -
                          {parseFloat(transaction.reimbursableAmount).toFixed(2)} reimb.
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
