import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import TransactionForm from './TransactionForm';
import { useAuth } from '../context/AuthContext';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Wallet, Landmark, Banknote, UserPlus, FileText, ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2, Trash2, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function Dashboard() {
  const { token } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [payday, setPayday] = useState(25);
  const [emergencyBuffer, setEmergencyBuffer] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [analyticsMonth, setAnalyticsMonth] = useState('All Time');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'debts' | 'analytics' | 'settings' | 'digest'>('overview');
  const [whatIfAmount, setWhatIfAmount] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiRes, txRes, debtRes, settingsRes] = await Promise.all([
        fetch('/api/kpis', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/debts', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (debtRes.ok) setDebts(await debtRes.json());
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setPayday(settings.payday);
        setEmergencyBuffer(settings.emergencyBuffer);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleSettle = async (debtId: string, amount: number) => {
    try {
      const res = await fetch('/api/debts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ debt_id: debtId, amount })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTx = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      const res = await fetch(`/api/transactions/${txId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ payday, emergencyBuffer })
      });
      if (res.ok) {
        await fetchData();
        alert('Settings updated successfully!');
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const date = new Date(t.createdAt);
      months.add(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    });
    const sorted = Array.from(months).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return ['All Time', ...sorted];
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (analyticsMonth === 'All Time') return transactions;
    return transactions.filter(t => {
      const date = new Date(t.createdAt);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) === analyticsMonth;
    });
  }, [transactions, analyticsMonth]);

  const categoryData = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const dailySpendingData = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'Expense');
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
    const income = filteredTransactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = filteredTransactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return [
      { name: 'Income', amount: income },
      { name: 'Expense', amount: expense }
    ];
  }, [filteredTransactions]);

  const historicalAverages = useMemo(() => {
    // Calculate global averages
    const allMonths = new Set<string>();
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
      const date = new Date(t.createdAt);
      allMonths.add(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      
      if (t.type === 'Income') totalIncome += parseFloat(t.amount);
      if (t.type === 'Expense') totalExpense += parseFloat(t.amount);
    });

    const monthCount = allMonths.size > 0 ? allMonths.size : 1;
    return {
      avgIncome: totalIncome / monthCount,
      avgExpense: totalExpense / monthCount
    };
  }, [transactions]);

  const digestData = useMemo(() => {
    const lastMonth = subMonths(new Date(), 1);
    const start = startOfMonth(lastMonth);
    const end = endOfMonth(lastMonth);

    const lastMonthTxs = transactions.filter(t => {
        const txDate = new Date(t.createdAt);
        return txDate >= start && txDate <= end;
    });

    const income = lastMonthTxs.filter(t => t.type === 'Income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = lastMonthTxs.filter(t => t.type === 'Expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const moneySaved = income - expense;

    const topCategories = lastMonthTxs.filter(t => t.type === 'Expense').reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedCategories = Object.entries(topCategories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const lastMonthDebts = debts.filter(d => {
        const debtDate = new Date(d.createdAt);
        return debtDate >= start && debtDate <= end;
    });

    const settledDebts = lastMonthDebts.filter(d => d.status === 'Cleared').length;
    const newDebts = lastMonthDebts.length;

    return {
      month: format(lastMonth, 'MMMM yyyy'),
      moneySaved,
      topCategories: sortedCategories,
      debtStats: {
        settledDebts,
        newDebts,
      }
    }
  }, [transactions, debts]);

  if (loading && !kpis) {
    return <div className="py-12 text-center text-gray-500">Loading your financial data...</div>;
  }

  const activeReceivables = debts.filter(d => d.type === 'Receivable' && d.status === 'Pending').reduce((acc, d) => acc + parseFloat(d.remainingBalance), 0);
  const activePayables = debts.filter(d => d.type === 'Payable' && d.status === 'Pending').reduce((acc, d) => acc + parseFloat(d.remainingBalance), 0);
  const netPosition = (kpis?.totalLiquidity || 0) + activeReceivables - activePayables;

  const simulatedDailyAllowance = whatIfAmount > 0 
    ? ((kpis?.totalLiquidity || 0) - whatIfAmount - (kpis?.emergencyBuffer || 0)) / (kpis?.daysUntilPayday || 1)
    : kpis?.dailyAllowance;

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 pb-px gap-4 sm:gap-0">
        <div className="flex space-x-2 overflow-x-auto w-full sm:w-auto scrollbar-hide pb-2 sm:pb-0">
          <button onClick={() => setActiveTab('overview')} className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Overview</button>
          <button onClick={() => setActiveTab('transactions')} className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Transactions</button>
          <button onClick={() => setActiveTab('debts')} className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'debts' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Debts & Splits</button>
          <button onClick={() => setActiveTab('analytics')} className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Analytics</button>
          <button onClick={() => setActiveTab('digest')} className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'digest' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Digest</button>
          <button onClick={() => setActiveTab('settings')} className={`whitespace-nowrap px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'settings' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Settings</button>
        </div>
      </div>

      {activeTab === 'overview' && (
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
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('transactions')}>View All</Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tx.type === 'Income' ? 'bg-green-100 text-green-600' : tx.type === 'Transfer' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.type === 'Income' ? <ArrowDownRight className="h-5 w-5" /> : tx.type === 'Transfer' ? <RefreshCw className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{tx.category || tx.type}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{format(new Date(tx.createdAt), 'MMM d, yyyy')}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">{tx.sourceWallet === 'Bank' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />} {tx.sourceWallet}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`font-semibold ${tx.type === 'Income' ? 'text-green-600' : tx.type === 'Expense' ? 'text-gray-900' : 'text-gray-500'}`}>
                        {tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : ''}{parseFloat(tx.amount).toFixed(2)} MAD
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
                    value={whatIfAmount}
                    onChange={(e) => setWhatIfAmount(parseFloat(e.target.value))}
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
                  {debts.filter(d => d.type === 'Receivable' && d.status === 'Pending').slice(0, 3).map(debt => (
                    <div key={debt.id} className="flex items-center justify-between bg-white p-3 rounded-md shadow-sm border border-blue-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{debt.contactName}</p>
                        <p className="text-xs text-gray-500">Bal: {parseFloat(debt.remainingBalance).toFixed(2)} MAD</p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => handleSettle(debt.id, parseFloat(debt.remainingBalance))}>
                        Settle
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tx.type === 'Income' ? 'bg-green-100 text-green-600' : tx.type === 'Transfer' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.type === 'Income' ? <ArrowDownRight className="h-5 w-5" /> : tx.type === 'Transfer' ? <RefreshCw className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tx.category || tx.type} {tx.notes && <span className="ml-2 font-normal text-gray-500 text-sm">({tx.notes})</span>}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">{tx.sourceWallet === 'Bank' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />} {tx.sourceWallet}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-12 sm:pl-0">
                    <div className={`font-semibold ${tx.type === 'Income' ? 'text-green-600' : tx.type === 'Expense' ? 'text-gray-900' : 'text-gray-500'}`}>
                      {tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : ''}{parseFloat(tx.amount).toFixed(2)} MAD
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteTx(tx.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">No transactions yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'debts' && (
        <Card>
          <CardHeader>
            <CardTitle>Debts & Splits</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="space-y-4">
              {debts.map((debt) => (
                <div key={debt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${debt.status === 'Cleared' ? 'bg-gray-100 text-gray-400' : debt.type === 'Receivable' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                      {debt.status === 'Cleared' ? <CheckCircle2 className="h-5 w-5" /> : debt.type === 'Receivable' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{debt.contactName}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{format(new Date(debt.createdAt), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span>{debt.type === 'Receivable' ? 'Owes you' : 'You owe'}</span>
                        <span>•</span>
                        <span className={debt.status === 'Pending' ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>{debt.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-12 sm:pl-0">
                    <div className="text-right">
                      <div className={`font-semibold ${debt.status === 'Cleared' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {parseFloat(debt.remainingBalance).toFixed(2)} MAD
                      </div>
                      <div className="text-xs text-gray-500">
                        of {parseFloat(debt.originalAmount).toFixed(2)} MAD
                      </div>
                    </div>
                    {debt.status === 'Pending' && (
                      <Button size="sm" variant="outline" onClick={() => handleSettle(debt.id, parseFloat(debt.remainingBalance))}>
                        Settle Full
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {debts.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">No debts or splits recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Historical Reports</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">Period:</span>
              <Select value={analyticsMonth} onChange={(e) => setAnalyticsMonth(e.target.value)}>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
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
                   <p className={`text-sm font-semibold ${incomeVsExpenseData[1].amount > historicalAverages.avgExpense ? 'text-red-500' : 'text-green-500'}`}>
                     {((incomeVsExpenseData[1].amount - historicalAverages.avgExpense) / (historicalAverages.avgExpense || 1) * 100).toFixed(1)}%
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
                   <p className={`text-sm font-semibold ${incomeVsExpenseData[0].amount < historicalAverages.avgIncome ? 'text-red-500' : 'text-green-500'}`}>
                     {((incomeVsExpenseData[0].amount - historicalAverages.avgIncome) / (historicalAverages.avgIncome || 1) * 100).toFixed(1)}%
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
                          {categoryData.map((entry, index) => (
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
                        {
                          incomeVsExpenseData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Income' ? '#10b981' : '#ef4444'} />
                          ))
                        }
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
      )}

      {activeTab === 'digest' && (
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
      )}

            {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Emergency Liquidity Buffer</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Keep a safety cushion. This amount will be excluded from your daily allowance calculation.
                </p>
                <div className="flex items-center gap-3">
                  <input 
                    type="number"
                    value={emergencyBuffer}
                    onChange={(e) => setEmergencyBuffer(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Buffer amount"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Payroll Date (Payday)</h3>
                <p className="text-sm text-blue-600 mb-4">
                  Select the day of the month you usually get paid. This resets your monthly pacing KPIs.
                </p>
                <div className="flex items-center gap-3">
                  <Select value={payday.toString()} onChange={(e) => setPayday(parseInt(e.target.value))}>
                    {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  disabled={isSaving}
                  onClick={handleSaveSettings}
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
