const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const anchor = `  }, [filteredTransactions]);

  if (loading && !kpis) {`;

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

  if (loading && !kpis) {`;

code = code.replace(anchor, insert);
fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Inserted memos.');
