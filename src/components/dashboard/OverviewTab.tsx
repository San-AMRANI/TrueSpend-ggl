import React, { useState, useMemo } from 'react';
import { CategoryBudget, DashboardTab, Debt, KPI, Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { SettleDebtModal } from '../SettleDebtModal';
import { getLargestExpenses, getSpendingPace, isInMonth } from '../../lib/finance';
import { ArrowDownRight, ArrowUpRight, Banknote, BarChart3, Landmark, RefreshCw, WalletCards } from 'lucide-react';
import { format } from 'date-fns';

interface OverviewTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  setActiveTab: (tab: DashboardTab) => void;
  openTransaction: (transactionId: string) => void;
  handleSettle: (debtId: string, amount: number, category?: string) => Promise<void> | void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ kpis, transactions, debts, budgets, setActiveTab, openTransaction, handleSettle }) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const largestExpenses = useMemo(() => getLargestExpenses(transactions, year, month), [month, transactions, year]);
  const monthlyBudget = budgets.filter((budget) => budget.year === year && budget.month === month).reduce((sum, budget) => sum + Number.parseFloat(budget.amount), 0);
  const monthlyActual = transactions.filter((transaction) => transaction.type === 'Expense' && isInMonth(transaction, year, month)).reduce((sum, transaction) => sum + Number.parseFloat(transaction.amount), 0);
  const pace = getSpendingPace(monthlyActual, monthlyBudget, year, month);
  const activeReceivables = debts.filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending').reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0);
  const dailyStatusStyles = { on_track: 'text-blue-600', warning: 'text-amber-600', critical: 'text-red-600' };

  return <div className="min-w-0 overflow-x-hidden space-y-4 sm:space-y-6">
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      <Card className="col-span-2 min-w-0 border-transparent bg-gray-900 text-white xl:col-span-1"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-400">Total Liquidity</CardTitle></CardHeader><CardContent><div className="break-words text-2xl font-bold sm:text-3xl">{kpis?.totalLiquidity.toFixed(2) || '0.00'} MAD</div><p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400"><span className="flex items-center gap-1"><Landmark className="h-3 w-3" />Bank: {kpis?.bankBalance.toFixed(2) || '0.00'}</span><span className="flex items-center gap-1"><Banknote className="h-3 w-3" />Cash: {kpis?.cashOnHand.toFixed(2) || '0.00'}</span></p></CardContent></Card>
      <Card className="min-w-0"><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-gray-500 sm:text-sm">Adjusted True Spend</CardTitle></CardHeader><CardContent><div className="break-words text-xl font-bold text-gray-900 sm:text-3xl">{kpis?.adjustedTrueSpend.toFixed(2) || '0.00'} <span className="text-sm sm:text-base">MAD</span></div><p className="mt-1 text-xs text-gray-500">This month</p></CardContent></Card>
      <Card className="min-w-0"><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-gray-500 sm:text-sm">Daily Allowance</CardTitle></CardHeader><CardContent><div className={`break-words text-xl font-bold sm:text-3xl ${dailyStatusStyles[kpis?.dailyStatus || 'on_track']}`}>{kpis?.dailyRemaining.toFixed(2) || '0.00'} <span className="text-sm sm:text-base">MAD</span></div><p className="mt-1 text-xs text-gray-500">{kpis?.dailySpent.toFixed(2) || '0.00'} spent of {kpis?.dailyAllowance.toFixed(2) || '0.00'}</p><Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2 hidden sm:inline-flex" onClick={() => setActiveTab('what-if')}>Simulate a purchase</Button></CardContent></Card>
    </div>

    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
      <Card className="min-w-0 overflow-hidden lg:col-span-2"><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3"><div className="min-w-0"><CardTitle className="text-base sm:text-lg">Largest expenses this month</CardTitle><p className="mt-1 text-sm font-normal text-gray-500">Your top 5 expense transactions.</p></div><Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveTab('analytics')}>Analytics</Button></CardHeader><CardContent className="min-w-0 overflow-hidden"><div className="divide-y divide-gray-100">{largestExpenses.map((transaction, index) => <button key={transaction.id} type="button" onClick={() => openTransaction(transaction.id)} className="flex w-full min-w-0 items-center justify-between gap-2 py-3 text-left first:pt-0 hover:bg-gray-50"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-600">{index + 1}</span><div className="min-w-0"><p className="truncate font-medium text-gray-900">{transaction.notes || transaction.category || 'Expense'}</p><p className="truncate text-xs text-gray-500">{transaction.category} · {format(new Date(transaction.createdAt), 'MMM d')}</p></div></div><span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-gray-900 sm:text-base">{Number.parseFloat(transaction.amount).toFixed(2)} MAD</span></button>)}{largestExpenses.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No expenses this month yet.</p>}</div></CardContent></Card>
      <Card className="min-w-0 overflow-hidden"><CardHeader><CardTitle className="flex min-w-0 items-center gap-2 text-base"><BarChart3 className="h-5 w-5 shrink-0 text-blue-600" /> Spending pace</CardTitle></CardHeader><CardContent className="min-w-0 overflow-hidden">{monthlyBudget > 0 ? <><p className="break-words text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{monthlyActual.toFixed(0)} / {pace.ideal.toFixed(0)} MAD</p><p className={`mt-2 break-words text-sm font-medium ${pace.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>{Math.abs(pace.difference).toFixed(2)} MAD {pace.difference > 0 ? 'ahead of pace' : 'behind pace'}</p><p className="mt-1 break-words text-xs text-gray-500">Based on {monthlyBudget.toFixed(0)} MAD in category budgets.</p></> : <><p className="text-sm text-gray-500">Set monthly category budgets to measure your spending pace.</p><Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab('budgets')}>Set budgets</Button></>}</CardContent></Card>
    </div>

    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
      <Card className="min-w-0 overflow-hidden lg:col-span-2"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="min-w-0 text-base sm:text-lg">Recent Transactions</CardTitle><Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => setActiveTab('transactions')}>View all</Button></CardHeader><CardContent className="min-w-0 overflow-hidden"><div className="divide-y divide-gray-100">{transactions.slice(0, 5).map((transaction) => <button key={transaction.id} type="button" onClick={() => openTransaction(transaction.id)} className="flex w-full min-w-0 items-center justify-between gap-2 py-3 text-left first:pt-0 hover:bg-gray-50"><div className="flex min-w-0 items-center gap-2 sm:gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${transaction.type === 'Income' ? 'bg-green-100 text-green-600' : transaction.type === 'Transfer' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>{transaction.type === 'Income' ? <ArrowDownRight className="h-4 w-4" /> : transaction.type === 'Transfer' ? <RefreshCw className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate font-medium text-gray-900">{transaction.notes || transaction.category || transaction.type}</p><p className="truncate text-xs text-gray-500">{format(new Date(transaction.createdAt), 'MMM d, yyyy')} · {transaction.sourceWallet}</p></div></div><span className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${transaction.type === 'Income' ? 'text-green-600' : 'text-gray-900'}`}>{transaction.type === 'Expense' ? '-' : transaction.type === 'Income' ? '+' : ''}{Number.parseFloat(transaction.amount).toFixed(2)} MAD</span></button>)}{transactions.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No transactions yet.</p>}</div></CardContent></Card>
      <Card className="min-w-0 overflow-hidden border-blue-100 bg-blue-50/50"><CardHeader><CardTitle className="flex min-w-0 items-center gap-2 text-base text-blue-900"><WalletCards className="h-5 w-5 shrink-0" /> Pending receivables</CardTitle></CardHeader><CardContent><div className="break-words text-2xl font-bold text-blue-900">{activeReceivables.toFixed(2)} MAD</div><p className="mb-4 text-xs text-blue-700">Money owed to you from splits</p><div className="space-y-3">{debts.filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending').slice(0, 3).map((debt) => <div key={debt.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-blue-100 bg-white p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-900">{debt.contactName}</p><p className="text-xs text-gray-500">Bal: {Number.parseFloat(debt.remainingBalance).toFixed(2)} MAD</p></div><Button type="button" size="sm" variant="outline" className="shrink-0 border-blue-200 text-blue-700" onClick={() => setSettlingDebt(debt)}>Settle</Button></div>)}{activeReceivables === 0 && <p className="py-4 text-center text-sm text-blue-700">No pending receivables.</p>}</div></CardContent></Card>
    </div>

    <SettleDebtModal
      debt={settlingDebt}
      onClose={() => setSettlingDebt(null)}
      onConfirm={async (debtId, amount, category) => {
        await handleSettle(debtId, amount, category);
      }}
    />
  </div>;
};
