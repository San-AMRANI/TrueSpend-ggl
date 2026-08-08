import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

interface AnalyticsTabProps {
  transactions: Transaction[];
  analyticsMonth: string;
  setAnalyticsMonth: (month: string) => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  transactions,
  analyticsMonth,
  setAnalyticsMonth,
}) => {
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t) => {
      const date = new Date(t.createdAt);
      months.add(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    });
    const sorted = Array.from(months).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return ['All Time', ...sorted];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (analyticsMonth === 'All Time') return transactions;
    return transactions.filter((t) => {
      const date = new Date(t.createdAt);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) === analyticsMonth;
    });
  }, [transactions, analyticsMonth]);

  const categoryData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Historical Reports</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-medium">Period:</span>
          <Select value={analyticsMonth} onChange={(e) => setAnalyticsMonth(e.target.value)}>
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {analyticsMonth !== 'All Time' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Monthly Expense</p>
              <p className="text-xl font-bold text-gray-900">{incomeVsExpenseData[1].amount.toFixed(2)} MAD</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">vs All-Time Avg</p>
              <p
                className={`text-sm font-semibold ${
                  incomeVsExpenseData[1].amount > historicalAverages.avgExpense ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {(
                  ((incomeVsExpenseData[1].amount - historicalAverages.avgExpense) /
                    (historicalAverages.avgExpense || 1)) *
                  100
                ).toFixed(1)}
                %
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Monthly Income</p>
              <p className="text-xl font-bold text-gray-900">{incomeVsExpenseData[0].amount.toFixed(2)} MAD</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">vs All-Time Avg</p>
              <p
                className={`text-sm font-semibold ${
                  incomeVsExpenseData[0].amount < historicalAverages.avgIncome ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {(
                  ((incomeVsExpenseData[0].amount - historicalAverages.avgIncome) /
                    (historicalAverages.avgIncome || 1)) *
                  100
                ).toFixed(1)}
                %
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-500">No expense data available for charts.</p>
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} MAD`, 'Amount']} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-500">No spending data available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{item.value.toFixed(2)} MAD</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
