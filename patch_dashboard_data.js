import fs from 'fs';
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "const [budgets, setBudgets] = useState<CategoryBudget[]>([]);",
  "const [budgets, setBudgets] = useState<CategoryBudget[]>([]);\n  const [payrolls, setPayrolls] = useState<Payroll[]>([]);"
);

code = code.replace(
  "dashboardService.getCategoryBudgets(token),",
  "dashboardService.getCategoryBudgets(token),\n        dashboardService.getPayrolls(token),"
);

code = code.replace(
  "const [kpiData, txData, debtData, settingsData, budgetData] = await Promise.all([",
  "const [kpiData, txData, debtData, settingsData, budgetData, payrollData] = await Promise.all(["
);

code = code.replace(
  "setBudgets(budgetData);",
  "setBudgets(budgetData);\n      setPayrolls(payrollData);"
);

code = code.replace(
  "return {",
  `  const handleCreatePayroll = async (date: string, amount: string) => {
    try {
      await dashboardService.createPayroll({ date, amount }, token);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    try {
      await dashboardService.deletePayroll(id, token);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return {`
);

code = code.replace(
  "setEmergencyBuffer,",
  "setEmergencyBuffer,\n    payrolls,\n    handleCreatePayroll,\n    handleDeletePayroll,"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
