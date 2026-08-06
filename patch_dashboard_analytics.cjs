const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const analyticsData = `
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

  const dailySpendingData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'Expense');
    const grouped = expenses.reduce((acc, curr) => {
      const date = new Date(curr.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      acc[date] = (acc[date] || 0) + parseFloat(curr.amount);
      return acc;
    }, {} as Record<string, number>);

    // Ensure we sort by date. 
    // We can do this simply by relying on createdAt parsing, but since it's already sorted by createdAt descending from DB,
    // let's just reverse the grouped keys (simplistic approach) or better, sort by actual date object.
    return Object.entries(grouped)
      .map(([date, value]) => ({ date, value: Number(value) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  const incomeVsExpenseData = useMemo(() => {
    const income = transactions.filter(t => t.type === 'Income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'Expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
    return [
      { name: 'Income', amount: income },
      { name: 'Expense', amount: expense }
    ];
  }, [transactions]);
`;

code = code.replace(/const categoryData = useMemo\(\(\) => \{[\s\S]*?\}, \[transactions\]\);/, analyticsData);

const newAnalyticsTab = `
      {activeTab === 'analytics' && (
        <div className="space-y-6">
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
                          label={({ name, percent }) => \`\${name} \${(percent * 100).toFixed(0)}%\`}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={\`cell-\${index}\`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [\`\${value.toFixed(2)} MAD\`, 'Amount']} />
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
                      <Tooltip formatter={(value: number) => [\`\${value.toFixed(2)} MAD\`, 'Amount']} />
                      <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {
                          incomeVsExpenseData.map((entry, index) => (
                            <Cell key={\`cell-\${index}\`} fill={entry.name === 'Income' ? '#10b981' : '#ef4444'} />
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
                      <Tooltip formatter={(value: number) => [\`\${value.toFixed(2)} MAD\`, 'Amount']} />
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
`;

code = code.replace(
  /\{activeTab === 'analytics' && \([\s\S]*?\}\)/,
  newAnalyticsTab.trim()
);

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Patched Analytics in Dashboard.tsx');
