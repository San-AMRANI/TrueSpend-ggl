const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const analyticsDataRegex = /const categoryData = useMemo\(\(\) => \{[\s\S]*?\}, \[transactions\]\);/;

const newAnalyticsData = `
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
`;

code = code.replace(analyticsDataRegex, newAnalyticsData);

// Remove the old data memo blocks that depended on transactions directly (since we replaced categoryData but left the others in the prev run)
code = code.replace(/const dailySpendingData = useMemo\(\(\) => \{[\s\S]*?\}, \[transactions\]\);/, '');
code = code.replace(/const incomeVsExpenseData = useMemo\(\(\) => \{[\s\S]*?\}, \[transactions\]\);/, '');

const oldAnalyticsUI = `{activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">`;

const newAnalyticsUI = `{activeTab === 'analytics' && (
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">`;

code = code.replace(oldAnalyticsUI, newAnalyticsUI);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Patched Analytics UI.');
