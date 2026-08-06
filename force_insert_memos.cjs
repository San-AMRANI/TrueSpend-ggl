const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const regex = /  \}, \[filteredTransactions\]\);\s+if \(loading && !kpis\) \{/;

const insert = `  }, [filteredTransactions]);

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

  if (loading && !kpis) {`;

code = code.replace(regex, insert);
fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Force inserted memos.');
