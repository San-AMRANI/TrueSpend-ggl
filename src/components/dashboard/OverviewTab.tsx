import React from 'react';
import { KPI, Transaction, Debt, DashboardTab } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import TransactionForm from '../TransactionForm';
import { Landmark, Banknote, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface OverviewTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  whatIfAmount: number;
  setWhatIfAmount: (amount: number) => void;
  setActiveTab: (tab: DashboardTab) => void;
  fetchData: () => void;
  handleSettle: (debtId: string, amount: number) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  kpis,
  transactions,
  debts,
  whatIfAmount,
  setWhatIfAmount,
  setActiveTab,
  fetchData,
  handleSettle,
}) => {
  const activeReceivables = debts
    .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
    .reduce((acc, d) => acc + parseFloat(d.remainingBalance), 0);

  const simulatedDailyAllowance =
    whatIfAmount > 0
      ? ((kpis?.totalLiquidity || 0) - whatIfAmount - (kpis?.emergencyBuffer || 0)) / (kpis?.daysUntilPayday || 1)
      : kpis?.dailyAllowance;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Main KPIs Column */}
      <div className="space-y-6 lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="bg-gray-900 text-white border-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Liquidity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpis?.totalLiquidity?.toFixed(2) || '0.00'} MAD</div>
              <p className="mt-1 flex items-center text-xs text-gray-400">
                <Landmark className="mr-1 h-3 w-3" /> Bank: {kpis?.bankBalance?.toFixed(2) || '0.00'} MAD
                <span className="mx-2">•</span>
                <Banknote className="mr-1 h-3 w-3" /> Cash: {kpis?.cashOnHand?.toFixed(2) || '0.00'} MAD
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Adjusted True Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{kpis?.adjustedTrueSpend?.toFixed(2) || '0.00'} MAD</div>
              <p className="mt-1 text-xs text-gray-500">Actual consumption this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Daily Allowance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{simulatedDailyAllowance?.toFixed(2) || '0.00'} MAD</div>
              <p className="mt-1 text-xs text-gray-500">{kpis?.daysUntilPayday || 0} days until payday</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Recent Transactions</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('transactions')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        tx.type === 'Income'
                          ? 'bg-green-100 text-green-600'
                          : tx.type === 'Transfer'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {tx.type === 'Income' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : tx.type === 'Transfer' ? (
                        <RefreshCw className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tx.category || tx.type}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{format(new Date(tx.createdAt), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {tx.sourceWallet === 'Bank' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}{' '}
                          {tx.sourceWallet}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      tx.type === 'Income' ? 'text-green-600' : tx.type === 'Expense' ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : ''}
                    {parseFloat(tx.amount).toFixed(2)} MAD
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">No transactions yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Column */}
      <div className="space-y-6">
        <TransactionForm onSuccess={fetchData} />

        <Card className="bg-yellow-50/50 border-yellow-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-yellow-800">"What-If" Purchase Simulator</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-yellow-600 mb-4">See how a purchase impacts your daily allowance.</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={whatIfAmount || ''}
                onChange={(e) => setWhatIfAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-yellow-200 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Purchase amount"
              />
              <Button
                variant="outline"
                className="border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                onClick={() => setWhatIfAmount(0)}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-800">Pending Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{activeReceivables.toFixed(2)} MAD</div>
            <p className="text-xs text-blue-600 mb-4">Money owed to you from splits</p>

            <div className="space-y-3">
              {debts
                .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
                .slice(0, 3)
                .map((debt) => (
                  <div key={debt.id} className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm border border-blue-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{debt.contactName}</p>
                      <p className="text-xs text-gray-500">Bal: {parseFloat(debt.remainingBalance).toFixed(2)} MAD</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => handleSettle(debt.id, parseFloat(debt.remainingBalance))}
                    >
                      Settle
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
