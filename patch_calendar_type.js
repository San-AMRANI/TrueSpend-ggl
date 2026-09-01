import fs from 'fs';
let code = fs.readFileSync('src/components/dashboard/FinancialCalendarTab.tsx', 'utf8');

code = code.replace(
  "<{ transactions: Transaction[]; debts: Debt[]; payday: number; openTransaction: (id: string) => void; setActiveTab: (tab: DashboardTab) => void }>",
  "<{ transactions: Transaction[]; debts: Debt[]; payday?: number; payrolls: Payroll[]; onCreatePayroll: (date: string, amount: string) => Promise<void>; onDeletePayroll: (id: string) => Promise<void>; openTransaction: (id: string) => void; setActiveTab: (tab: DashboardTab) => void }>"
);

code = code.replace(
  "({ transactions, debts, payday, openTransaction, setActiveTab })",
  "({ transactions, debts, payday, payrolls, onCreatePayroll, onDeletePayroll, openTransaction, setActiveTab })"
);

fs.writeFileSync('src/components/dashboard/FinancialCalendarTab.tsx', code);
