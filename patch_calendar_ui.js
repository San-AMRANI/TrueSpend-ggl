import fs from 'fs';
let code = fs.readFileSync('src/components/dashboard/FinancialCalendarTab.tsx', 'utf8');

const importReplacement = `import { Button } from '../ui/Button';
import { ChevronLeft, ChevronRight, Landmark, WalletCards, Plus, Trash2 } from 'lucide-react';
`;
code = code.replace(/import \{ Button \} from '\.\.\/ui\/Button';\nimport \{ ChevronLeft, ChevronRight, Landmark, WalletCards \} from 'lucide-react';/, importReplacement);

const newSelectedContent = `<Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{new Date(\`\${selectedDate}T00:00:00Z\`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</CardTitle>
<div className="flex gap-2">
  {isAddingPayroll ? (
    <Button size="sm" variant="outline" onClick={() => setIsAddingPayroll(false)}>Cancel</Button>
  ) : (
    <Button size="sm" onClick={() => setIsAddingPayroll(true)}><Plus className="h-4 w-4 mr-1" /> Add Payroll</Button>
  )}
</div>
</CardHeader><CardContent>
{isAddingPayroll ? (
  <form onSubmit={(e) => { e.preventDefault(); onCreatePayroll(selectedDate, payrollAmount).then(() => { setIsAddingPayroll(false); setPayrollAmount(''); }); }} className="space-y-4 mb-4 p-4 border rounded-lg dark:border-gray-800">
    <div>
      <label className="text-sm font-medium">Payroll Amount (MAD)</label>
      <input type="number" required value={payrollAmount} onChange={e => setPayrollAmount(e.target.value)} className="w-full mt-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-700" placeholder="e.g. 5000" />
    </div>
    <Button type="submit" className="w-full">Save Payroll</Button>
  </form>
) : null}

{selected.length ? <div className="space-y-2">{selected.map((event) => <div key={event.id} className="flex w-full items-center justify-between gap-3 rounded-lg border dark:border-gray-800 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"><div className="min-w-0 flex-1 cursor-pointer" onClick={() => event.transactionId ? openTransaction(event.transactionId) : event.debtId ? setActiveTab('debts') : undefined}><p className="font-medium text-gray-900 dark:text-gray-100">{event.title}</p><p className="text-xs text-gray-500 dark:text-gray-400">{event.kind} · {event.status}</p></div>
<div className="flex items-center gap-3">
<span className={\`shrink-0 font-semibold \${event.kind === 'income' ? 'text-green-700 dark:text-green-400' : event.kind === 'expense' ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}\`}>{event.amount ? \`\${event.kind === 'income' ? '+' : event.kind === 'expense' ? '−' : ''}\${event.amount.toFixed(2)} MAD\` : 'Configured'}</span>
{event.kind === 'payday' && event.payrollId && <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => onDeletePayroll(event.payrollId!)}><Trash2 className="h-4 w-4" /></Button>}
</div>
</div>)}</div> : <p className="py-5 text-center text-sm text-gray-500 dark:text-gray-400">No financial activity.</p>}</CardContent></Card>`;

const oldSelectedContentRegex = /<Card><CardHeader><CardTitle>\{new Date\(`\$\{selectedDate\}T00:00:00Z`\)\.toLocaleDateString\([\s\S]*?<\/CardContent><\/Card>/;
code = code.replace(oldSelectedContentRegex, newSelectedContent);

code = code.replace(
  "  const [filter, setFilter] = useState<'all' | EventKind | 'upcoming' | 'completed' | 'overdue'>('all');",
  "  const [filter, setFilter] = useState<'all' | EventKind | 'upcoming' | 'completed' | 'overdue'>('all');\n  const [isAddingPayroll, setIsAddingPayroll] = useState(false);\n  const [payrollAmount, setPayrollAmount] = useState('');"
);

fs.writeFileSync('src/components/dashboard/FinancialCalendarTab.tsx', code);
