import fs from 'fs';
let code = fs.readFileSync('src/hooks/useDashboardData.ts', 'utf8');

code = code.replace(
  "import { CategoryBudget, KPI, Transaction, Debt, DashboardTab } from '../types';",
  "import { CategoryBudget, KPI, Transaction, Debt, DashboardTab, Payroll } from '../types';"
);

fs.writeFileSync('src/hooks/useDashboardData.ts', code);
