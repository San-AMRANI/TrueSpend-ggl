import React, { useMemo, useState } from 'react';
import { Debt, Payroll, Transaction, Wallet } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { normalizeCategory } from '../../lib/categories';
import { getSpendingChange, monthLabel, transactionMonth } from '../../lib/finance';
import { financialPeriodLabel, getFinancialMonthsFromTransactions, getCurrentFinancialMonth, getPreviousFinancialMonth } from '../../lib/financialMonth';
import { Banknote, Landmark, X } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

interface AnalyticsTabProps {
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  analyticsMonth: string;
  setAnalyticsMonth: (month: string) => void;
  wallets?: Wallet[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  transactions,
  payrolls,
  debts,
  analyticsMonth,
  setAnalyticsMonth,
  wallets = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const availableMonthRefs = useMemo(() => getFinancialMonthsFromTransactions(transactions, payrolls), [transactions, payrolls]);

  const availableMonths = useMemo(() => {
    return ['All Time', ...availableMonthRefs.map(financialPeriodLabel)];
  }, [availableMonthRefs]);

  const filteredTransactions = useMemo(() => {
    if (analyticsMonth === 'All Time') return transactions;
    const ref = availableMonthRefs.find(m => financialPeriodLabel(m) === analyticsMonth);
    if (!ref) return transactions;
    return transactions.filter((t) => new Date(t.createdAt) >= ref.start && new Date(t.createdAt) <= ref.end);
  }, [transactions, analyticsMonth, availableMonthRefs]);

  const categoryData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      const category = normalizeCategory(curr.category) || 'Uncategorized';
      acc[category] = (acc[category] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

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

  const activeCategory = [...categoryData, ...incomeCategoryData].some((category) => category.name === selectedCategory) ? selectedCategory : null;
  const isIncomeCategory = incomeCategoryData.some(c => c.name === activeCategory);

  const walletData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const walletSums: Record<string, number> = {};

    expenses.forEach((t) => {
      walletSums[t.walletId] = (walletSums[t.walletId] || 0) + parseFloat(t.amount);
    });

    return Object.entries(walletSums).map(([walletId, value]) => {
      const wallet = wallets.find(w => w.id === walletId);
      return {
        name: wallet ? wallet.name : walletId,
        value,
      };
    }).filter(w => w.value > 0);
  }, [filteredTransactions, wallets]);

  const comparisonMonth = useMemo(() => {
    if (analyticsMonth === 'All Time') {
      return getCurrentFinancialMonth(payrolls);
    }
    const ref = availableMonthRefs.find(m => financialPeriodLabel(m) === analyticsMonth);
    return ref || getCurrentFinancialMonth(payrolls);
  }, [analyticsMonth, availableMonthRefs, payrolls]);

  const spendingChange = useMemo(
    () => comparisonMonth ? getSpendingChange(transactions, comparisonMonth.year, comparisonMonth.month, undefined, payrolls) : { current: 0, previous: 0, difference: 0, percentage: null },
    [comparisonMonth, transactions, payrolls],
  );

  const changeCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.filter((transaction) => transaction.type === 'Expense').forEach((transaction) => {
      if (!comparisonMonth) return;
      const ref = transactionMonth(transaction, payrolls);
      const previous = getPreviousFinancialMonth(payrolls, comparisonMonth);
      if (ref && ((ref.year === comparisonMonth.year && ref.month === comparisonMonth.month) || (previous && ref.year === previous.year && ref.month === previous.month))) {
        categories.add(normalizeCategory(transaction.category) || 'Uncategorized');
      }
    });
    return Array.from(categories)
      .map((category) => ({ category, ...(comparisonMonth ? getSpendingChange(transactions, comparisonMonth.year, comparisonMonth.month, category, payrolls) : { current: 0, previous: 0, difference: 0, percentage: null }) }))
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  }, [comparisonMonth, transactions, payrolls]);

  const selectedCategoryTransactions = useMemo(() => {
    if (!activeCategory) return [];

    return filteredTransactions
      .filter((transaction) => (normalizeCategory(transaction.category) || 'Uncategorized') === activeCategory)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeCategory, filteredTransactions]);

  const selectedCategoryTotal = selectedCategoryTransactions.reduce(
    (total, transaction) => total + parseFloat(transaction.amount),
    0,
  );

  const dailySpendingData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      const date = new Date(curr.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acc[date] = (acc[date] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([date, value]) => ({ date, value: Number(value) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredTransactions]);

  const incomeVsExpenseData = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.type === 'Income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = filteredTransactions
      .filter((t) => t.type === 'Expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return [
      { name: 'Income', amount: income },
      { name: 'Expense', amount: expense },
    ];
  }, [filteredTransactions]);

  const historicalAverages = useMemo(() => {
    const allMonths = new Set<string>();
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((t) => {
      const date = new Date(t.createdAt);
      allMonths.add(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

      if (t.type === 'Income') totalIncome += parseFloat(t.amount);
      if (t.type === 'Expense') totalExpense += parseFloat(t.amount);
    });

    const monthCount = allMonths.size > 0 ? allMonths.size : 1;
    return {
      avgIncome: totalIncome / monthCount,
      avgExpense: totalExpense / monthCount,
    };
  }, [transactions]);

  const adjustedTrueSpendData = useMemo(() => {
    let totalExpenses = 0;
    let debtRepayments = 0;
    let reimbursements = 0;
    let pendingReimbursable = 0;

    filteredTransactions.forEach((tx) => {
      const amount = parseFloat(tx.amount);
      if (tx.type === 'Expense') {
        totalExpenses += amount;
      }
      
      if (tx.type === 'Expense' && ['💳 Debt & Obligations', 'Debt Repayment', 'Loan', '🔄 Transfer', 'Transfer'].includes(tx.category || '')) {
        debtRepayments += amount;
      }
      
      if (tx.type === 'Expense' && tx.reimbursableAmount && parseFloat(tx.reimbursableAmount) > 0) {
        reimbursements += parseFloat(tx.reimbursableAmount);
        
        if (tx.linkedContactId) {
          const linkedDebt = debts.find(d => d.id === tx.linkedContactId);
          if (linkedDebt && linkedDebt.status === 'Pending') {
            pendingReimbursable += parseFloat(linkedDebt.remainingBalance);
          }
        } else {
          // Fallback for legacy transactions without a linked debt
          pendingReimbursable += parseFloat(tx.reimbursableAmount);
        }
      }
    });

    return {
      totalExpenses,
      debtRepayments,
      reimbursements,
      pendingReimbursable,
      adjustedTrueSpend: totalExpenses - debtRepayments - reimbursements
    };
  }, [filteredTransactions, debts]);

  const savingsRate = useMemo(() => {
    const income = incomeVsExpenseData[0].amount;
    const expense = incomeVsExpenseData[1].amount;
    if (income === 0) return 0;
    return ((income - expense) / income) * 100;
  }, [incomeVsExpenseData]);

  const topExpense = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    if (expenses.length === 0) return null;
    return expenses.reduce((max, current) => (parseFloat(current.amount) > parseFloat(max.amount) ? current : max));
  }, [filteredTransactions]);

  const comparisonLabel = comparisonMonth ? financialPeriodLabel(comparisonMonth) : 'No configured financial period';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Historical Reports</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Period:</span>
          <Select value={analyticsMonth} onChange={(e) => setAnalyticsMonth(e.target.value)}>
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Spending Change</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_2fr]">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Overall · {comparisonLabel}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{spendingChange.current.toFixed(2)} MAD</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">vs {spendingChange.previous.toFixed(2)} MAD last month</p>
              {spendingChange.percentage === null ? (
                <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{spendingChange.current > 0 ? `+${spendingChange.current.toFixed(2)} MAD · No spending last month` : 'No spending in either month'}</p>
              ) : (
                <p className={`mt-2 text-sm font-semibold ${spendingChange.difference > 0 ? 'text-red-600 dark:text-red-400' : spendingChange.difference < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>{spendingChange.percentage > 0 ? '+' : ''}{spendingChange.percentage.toFixed(1)}% vs last month</p>
              )}
            </div>
            <div className="space-y-2">
              {changeCategories.slice(0, 6).map((item) => <div key={item.category} className="flex items-center justify-between gap-4 rounded-md border border-gray-100 dark:border-gray-800 px-3 py-2"><div><p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.category}</p><p className="text-xs text-gray-500 dark:text-gray-400">{item.current.toFixed(0)} → {item.previous.toFixed(0)} MAD</p></div><span className={`text-sm font-semibold ${item.difference > 0 ? 'text-red-600 dark:text-red-400' : item.difference < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>{item.percentage === null ? (item.current > 0 ? `+${item.current.toFixed(0)} MAD` : '—') : `${item.percentage > 0 ? '+' : ''}${item.percentage.toFixed(1)}%`}</span></div>)}
              {changeCategories.length === 0 && <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No category spending to compare yet.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {analyticsMonth !== 'All Time' && (
          <>
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Expense</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{incomeVsExpenseData[1].amount.toFixed(2)} MAD</p>
              </div>
              <div className="text-left mt-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">vs All-Time Avg</p>
                <p className={`text-sm font-semibold ${incomeVsExpenseData[1].amount > historicalAverages.avgExpense ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                  {(((incomeVsExpenseData[1].amount - historicalAverages.avgExpense) / (historicalAverages.avgExpense || 1)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Income</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{incomeVsExpenseData[0].amount.toFixed(2)} MAD</p>
              </div>
              <div className="text-left mt-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">vs All-Time Avg</p>
                <p className={`text-sm font-semibold ${incomeVsExpenseData[0].amount < historicalAverages.avgIncome ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                  {(((incomeVsExpenseData[0].amount - historicalAverages.avgIncome) / (historicalAverages.avgIncome || 1)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </>
        )}
        
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Savings Rate</p>
            <p className={`text-xl font-bold mt-1 ${savingsRate >= 20 ? 'text-green-600 dark:text-green-400' : savingsRate >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}`}>
              {savingsRate.toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Portion of income saved</p>
        </div>

        {topExpense && (
          <div className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Single Expense</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate mt-1">{topExpense.notes || normalizeCategory(topExpense.category) || 'Unknown'}</p>
            </div>
            <div className="mt-2">
              <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{parseFloat(topExpense.amount).toFixed(2)} MAD</p>
              <p className="text-xs text-gray-500 mt-0.5">{format(new Date(topExpense.createdAt), 'MMM d, yyyy')}</p>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjusted True Spend Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Expenses</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{adjustedTrueSpendData.totalExpenses.toFixed(2)} MAD</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">All outbound transactions</p>
            </div>
            
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Debt Repayments</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">-{adjustedTrueSpendData.debtRepayments.toFixed(2)} MAD</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Money moved, not spent</p>
            </div>

            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reimbursable Expenses</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">-{adjustedTrueSpendData.reimbursements.toFixed(2)} MAD</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Money you spent for others</p>
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4">
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Adjusted True Spend</p>
              <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-300">{adjustedTrueSpendData.adjustedTrueSpend.toFixed(2)} MAD</p>
              <p className="mt-1 text-xs text-blue-600/80 dark:text-blue-400/80">Money spent on yourself</p>
            </div>
          </div>
          {adjustedTrueSpendData.pendingReimbursable > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              <p>You also have <strong>{adjustedTrueSpendData.pendingReimbursable.toFixed(2)} MAD</strong> in pending reimbursable expenses this period.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No expense data available for charts.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bank vs Cash</CardTitle>
          </CardHeader>
          <CardContent>
            {walletData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={walletData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {walletData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Bank' ? '#3b82f6' : '#10b981'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No wallet data available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {incomeVsExpenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Spending Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {dailySpendingData.length > 0 ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySpendingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No spending data available.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryData.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={activeCategory === item.name}
                  onClick={() => setSelectedCategory(item.name)}
                  className={`flex w-full items-center justify-between rounded-md p-2 text-left transition-colors ${
                    activeCategory === item.name ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.value.toFixed(2)} MAD</span>
                </button>
              ))}
              {categoryData.length === 0 && <p className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">No expense categories yet.</p>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Income & Other Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {incomeCategoryData.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  aria-pressed={activeCategory === item.name}
                  onClick={() => setSelectedCategory(item.name)}
                  className={`flex w-full items-center justify-between rounded-md p-2 text-left transition-colors ${
                    activeCategory === item.name ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">+{item.value.toFixed(2)} MAD</span>
                </button>
              ))}
              {incomeCategoryData.length === 0 && <p className="py-2 text-center text-sm text-gray-500 dark:text-gray-400">No income categories yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {activeCategory && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{activeCategory} transactions</CardTitle>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{analyticsMonth}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Close category details" onClick={() => setSelectedCategory(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{isIncomeCategory ? 'Total received' : 'Total spent'}</p>
                <p className={`mt-1 text-lg font-bold ${isIncomeCategory ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {isIncomeCategory ? '+' : ''}{selectedCategoryTotal.toFixed(2)} MAD
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Transactions</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{selectedCategoryTransactions.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Average {isIncomeCategory ? 'amount' : 'purchase'}</p>
                <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                  {(selectedCategoryTotal / (selectedCategoryTransactions.length || 1)).toFixed(2)} MAD
                </p>
              </div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {selectedCategoryTransactions.map((transaction) => (
                <div key={transaction.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">{transaction.notes || activeCategory}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{format(new Date(transaction.createdAt), 'MMM d, yyyy')}</span>
                      <span className="flex items-center gap-1">
                        {(() => {
                          const w = wallets.find(w => w.id === transaction.walletId);
                          const isBank = w ? w.type === 'Bank' || w.type === 'Savings' : transaction.walletId === 'Bank';
                          return isBank ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />;
                        })()}
                        {wallets.find(w => w.id === transaction.walletId)?.name || transaction.walletId}
                      </span>
                    </div>
                  </div>
                  <span className={`font-semibold ${transaction.type === 'Expense' ? 'text-gray-900 dark:text-gray-100' : 'text-green-600 dark:text-green-400'}`}>
                    {transaction.type === 'Expense' ? '-' : '+'}{parseFloat(transaction.amount).toFixed(2)} MAD
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
