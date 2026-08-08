import React, { useMemo } from 'react';
import { Transaction, Debt } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { subMonths, startOfMonth, endOfMonth, format } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface DigestTabProps {
  transactions: Transaction[];
  debts: Debt[];
}

export const DigestTab: React.FC<DigestTabProps> = ({ transactions, debts }) => {
  const digestData = useMemo(() => {
    const lastMonth = subMonths(new Date(), 1);
    const start = startOfMonth(lastMonth);
    const end = endOfMonth(lastMonth);

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
        acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
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
      month: format(lastMonth, 'MMMM yyyy'),
      moneySaved,
      topCategories: sortedCategories,
      debtStats: {
        settledDebts,
        newDebts,
      },
    };
  }, [transactions, debts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Digest: {digestData.month}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500">Money Saved</p>
            <p className={`text-2xl font-bold ${digestData.moneySaved >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {digestData.moneySaved.toFixed(2)} MAD
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500">New Debts</p>
            <p className="text-2xl font-bold text-orange-600">{digestData.debtStats.newDebts}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-500">Settled Debts</p>
            <p className="text-2xl font-bold text-blue-600">{digestData.debtStats.settledDebts}</p>
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
                    <span className="text-sm font-medium text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{item.value.toFixed(2)} MAD</span>
                </div>
              ))}
              {digestData.topCategories.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">No spending data for last month.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};
