import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import TransactionForm from './TransactionForm';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { Wallet, Landmark, Banknote, UserPlus, FileText, ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2, Trash2, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function Dashboard() {
  const { token } = useAuth();
  const [kpis, setKpis] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'debts' | 'analytics'>('overview');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiRes, txRes, debtRes] = await Promise.all([
        fetch('/api/kpis', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/transactions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/debts', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (debtRes.ok) setDebts(await debtRes.json());
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

  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  if (loading && !kpis) {
    return <div className="py-12 text-center text-gray-500">Loading your financial data...</div>;
  }

  const activeReceivables = debts.filter(d => d.type === 'Receivable' && d.status === 'Pending').reduce((acc, d) => acc + parseFloat(d.remainingBalance), 0);
  const activePayables = debts.filter(d => d.type === 'Payable' && d.status === 'Pending').reduce((acc, d) => acc + parseFloat(d.remainingBalance), 0);
  const netPosition = (kpis?.totalLiquidity || 0) + activeReceivables - activePayables;

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-px">
        <div className="flex space-x-2">
          <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'overview' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Overview</button>
          <button onClick={() => setActiveTab('transactions')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'transactions' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Transactions</button>
          <button onClick={() => setActiveTab('debts')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'debts' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Debts & Splits</button>
          <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Analytics</button>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mb-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          onClick={async () => {
            if (confirm('Are you sure you want to truncate the database and seed the shared data?')) {
              setLoading(true);
              try {
                const res = await fetch('/api/seed', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  await fetchData();
                } else {
                  alert('Failed to seed data');
                }
              } catch (e) {
                console.error(e);
              } finally {
                setLoading(false);
              }
            }
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Truncate & Seed Shared Data
        </Button>
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
                  <div className="text-3xl font-bold text-blue-600">{kpis?.dailyAllowance?.toFixed(2) || '0.00'} MAD</div>
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
                    <div key={tx.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
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
                <div key={tx.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
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
                  <div className="flex items-center gap-4">
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
                <div key={debt.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
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
                  <div className="flex items-center gap-4">
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
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length > 0 ? (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value.toFixed(2)} MAD`, 'Amount']} />
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

    </div>
  );
}
