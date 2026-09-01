import fs from 'fs';
let code = fs.readFileSync('src/services/api/dashboardService.ts', 'utf8');

const importsMatch = code.match(/import {.*?} from '\.\.\/types';/);
if (importsMatch) {
  let newImports = importsMatch[0].replace("} from '../types';", ", Payroll } from '../types';");
  code = code.replace(importsMatch[0], newImports);
}

const target = `  getSettings:`;
const replacement = `  getPayrolls: (token: string | null) => apiClient.get<Payroll[]>('/api/payrolls', token),
  createPayroll: (payload: { date: string; amount: string }, token: string | null) => apiClient.post<Payroll>('/api/payrolls', payload, token),
  deletePayroll: (id: string, token: string | null) => apiClient.delete<{ success: boolean }>(\`/api/payrolls/\${id}\`, token),
  getSettings:`;
code = code.replace(target, replacement);

fs.writeFileSync('src/services/api/dashboardService.ts', code);
