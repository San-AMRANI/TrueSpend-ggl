import React, { useMemo } from 'react';
import { Transaction, Debt, Payroll } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { normalizeCategory } from '../../lib/categories';
import { financialPeriodLabel, getCurrentFinancialMonth, getPreviousFinancialMonth } from '../../lib/financialMonth';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface DigestTabProps {
  transactions: Transaction[];
  debts: Debt[];
  payrolls: Payroll[];
}

export const DigestTab: React.FC<DigestTabProps> = ({ transactions, debts, payrolls }) => {
  const digestData = useMemo(() => {
    const currentFm = getCurrentFinancialMonth(payrolls);
    const lastFm = currentFm ? getPreviousFinancialMonth(payrolls, currentFm) : null;
    if (!lastFm) return null;
    const { start, end } = lastFm;

    const lastMonthTxs = transactions.filter((t) => {
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate <= end;
    });

    const income = lastMonthTxs.filter((t) => t.type === 'Income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = lastMonthTxs.filter((t) => t.type === 'Expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const moneySaved = income - expense;

    const topCategoriesMap = lastMonthTxs
      .filter((t) => t.type === 'Expense')
      .reduce((acc, curr) => {
        const category = normalizeCategory(curr.category) || 'Uncategorized';
        acc[category] = (acc[category] || 0) + parseFloat(curr.amount);
        return acc;
      }, {} as Record<string, number>);

    const sortedCategories = Object.entries(topCategoriesMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const lastMonthDebts = debts.filter((d) => {
      const debtDate = new Date(d.createdAt);
      return debtDate >= start && debtDate <= end;
    });

    const settledDebts = lastMonthDebts.filter((d) => d.status === 'Cleared').length;
    const newDebts = lastMonthDebts.length;

    return {
      month: financialPeriodLabel(lastFm),
      moneySaved,
      topCategories: sortedCategories,
      debtStats: {
        settledDebts,
        newDebts,
      },
    };
  }, [transactions, debts, payrolls]);

  if (!digestData) return <Card><CardHeader><CardTitle>Monthly Digest</CardTitle></CardHeader><CardContent><p className="text-sm text-amber-700 dark:text-amber-300">Configure at least three consecutive payrolls in Financial Calendar to view a completed financial-period digest.</p></CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Digest: {digestData.month}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Money Saved</p>
            <p className={`text-2xl font-bold ${digestData.moneySaved >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {digestData.moneySaved.toFixed(2)} MAD
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">New Debts</p>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{digestData.debtStats.newDebts}</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Settled Debts</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{digestData.debtStats.settledDebts}</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Spending Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {digestData.topCategories.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.value.toFixed(2)} MAD</span>
                </div>
              ))}
              {digestData.topCategories.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No spending data for last month.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
