import fs from 'fs';
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "setSalary(settingsData.salary);",
  `// Compute salary dynamically from payrolls for current financial month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const thisMonthPayrolls = payrollData.filter(p => {
        const pd = new Date(p.date);
        return pd.getFullYear() === currentYear && pd.getMonth() === currentMonth;
      });
      const computedSalary = thisMonthPayrolls.reduce((sum, p) => sum + Number(p.amount), 0);
      setSalary(computedSalary);`
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
