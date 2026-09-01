import fs from 'fs';
let code = fs.readFileSync('src/components/dashboard/FinancialCalendarTab.tsx', 'utf8');

code = code.replace(
  "import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';",
  "import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';\nimport { Payroll } from '../../types';"
);

code = code.replace(
  "  payday: number;",
  "  payday?: number;\n  payrolls: Payroll[];\n  onCreatePayroll: (date: string, amount: string) => Promise<void>;\n  onDeletePayroll: (id: string) => Promise<void>;"
);

code = code.replace(
  "  setActiveTab: (tab: DashboardTab) => void;",
  "  setActiveTab: (tab: DashboardTab) => void;\n  payrolls: Payroll[];\n  onCreatePayroll: (date: string, amount: string) => Promise<void>;\n  onDeletePayroll: (id: string) => Promise<void>;"
);

code = code.replace(
  "  payday,",
  "  payday,\n  payrolls,\n  onCreatePayroll,\n  onDeletePayroll,"
);

code = code.replace(
  "const paydayDate = new Date(Date.UTC(ref.year, ref.month, Math.min(payday, new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate())));",
  "// removed legacy payday logic"
);

code = code.replace(
  "result.push({ id: `payday-${ref.year}-${ref.month}`, date: dateKey(paydayDate), kind: 'payday', title: 'Payday', status: paydayDate > new Date(`${today}T00:00:00.000Z`) ? 'Upcoming' : 'Completed' });",
  `payrolls.forEach((p) => {
      const pDate = dateKey(new Date(p.date));
      result.push({
        id: \`payroll-\${p.id}\`,
        date: pDate,
        kind: 'payday',
        title: 'Payroll',
        amount: Number.parseFloat(p.amount),
        status: new Date(p.date) > new Date(\`\${today}T00:00:00.000Z\`) ? 'Upcoming' : 'Completed',
        payrollId: p.id
      });
    });`
);

code = code.replace(
  "  }, [debts, payday, ref, today, transactions]);",
  "  }, [debts, payrolls, ref, today, transactions]);"
);

// Add payrollId to CalendarEvent interface
code = code.replace(
  "  debtId?: string;",
  "  debtId?: string;\n  payrollId?: string;"
);

fs.writeFileSync('src/components/dashboard/FinancialCalendarTab.tsx', code);
