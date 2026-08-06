const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const analyticsDataRegex = /const incomeVsExpenseData = useMemo\(\(\) => \{[\s\S]*?\}, \[filteredTransactions\]\);/;

const additionalAverages = `  const incomeVsExpenseData = useMemo(() => {
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
`;

code = code.replace(analyticsDataRegex, additionalAverages);

const uiAnchor = `          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Historical Reports</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">Period:</span>
              <Select value={analyticsMonth} onChange={(e) => setAnalyticsMonth(e.target.value)}>
                {availableMonths.map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </Select>
            </div>
          </div>`;

const uiReplacement = `          <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
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
                   <p className={\`text-sm font-semibold \${incomeVsExpenseData[1].amount > historicalAverages.avgExpense ? 'text-red-500' : 'text-green-500'}\`}>
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
                   <p className={\`text-sm font-semibold \${incomeVsExpenseData[0].amount < historicalAverages.avgIncome ? 'text-red-500' : 'text-green-500'}\`}>
                     {((incomeVsExpenseData[0].amount - historicalAverages.avgIncome) / (historicalAverages.avgIncome || 1) * 100).toFixed(1)}%
                   </p>
                 </div>
               </div>
            </div>
          )}`;

code = code.replace(uiAnchor, uiReplacement);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Patched Analytics averages.');
