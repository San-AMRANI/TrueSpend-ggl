import React, { useMemo, useState } from 'react';
import { CategoryBudget, Transaction } from '../../types';
import { expenseCategories } from '../../lib/categories';
import { budgetFor, getBudgetStatus, getCategorySpending, getSpendingPace, monthLabel } from '../../lib/finance';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react';

interface BudgetsTabProps {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  onSaveBudget: (category: string, year: number, month: number, amount: number) => Promise<void>;
  onCopyPrevious: (year: number, month: number) => Promise<number>;
}

const statusStyles = {
  normal: 'bg-blue-500',
  warning: 'bg-amber-500',
  over_budget: 'bg-orange-500',
  critical: 'bg-red-500',
  not_set: 'bg-gray-300',
};

export const BudgetsTab: React.FC<BudgetsTabProps> = ({ budgets, transactions, onSaveBudget, onCopyPrevious }) => {
  const today = new Date();
  const [monthRef, setMonthRef] = useState({ year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 });
  const [newCategory, setNewCategory] = useState(expenseCategories[0]);
  const [newAmount, setNewAmount] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const navigate = (direction: -1 | 1) => setMonthRef((current) => {
    const date = new Date(Date.UTC(current.year, current.month - 1 + direction, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  });
  const resetToCurrent = () => setMonthRef({ year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 });
  const budgetRows = useMemo(() => {
    const activeCategories = new Set<string>();
    budgets.filter((budget) => budget.year === monthRef.year && budget.month === monthRef.month).forEach((budget) => activeCategories.add(budget.category));
    transactions.filter((transaction) => transaction.type === 'Expense').forEach((transaction) => {
      const date = new Date(transaction.createdAt);
      if (date.getUTCFullYear() === monthRef.year && date.getUTCMonth() + 1 === monthRef.month) activeCategories.add(transaction.category || 'Uncategorized');
    });
    return Array.from(activeCategories).sort((a, b) => a.localeCompare(b));
  }, [budgets, monthRef, transactions]);

  const save = async (category: string, rawAmount: string) => {
    const amount = Number.parseFloat(rawAmount);
    if (!Number.isFinite(amount) || amount < 0) { setMessage('Enter a budget amount of zero or more.'); return; }
    setSaving(category); setMessage('');
    try { await onSaveBudget(category, monthRef.year, monthRef.month, amount); setDrafts((current) => ({ ...current, [category]: String(amount) })); setMessage(`${category} budget saved.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save the budget.'); }
    finally { setSaving(null); }
  };

  const handleAdd = async (event: React.FormEvent) => { event.preventDefault(); await save(newCategory, newAmount); setNewAmount(''); };
  const copyPrevious = async () => { setSaving('__copy'); setMessage(''); try { const copied = await onCopyPrevious(monthRef.year, monthRef.month); setMessage(copied ? `${copied} budget${copied === 1 ? '' : 's'} copied from the previous month.` : 'No new budgets to copy from the previous month.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to copy budgets.'); } finally { setSaving(null); } };
  const totalBudget = budgets.filter((budget) => budget.year === monthRef.year && budget.month === monthRef.month).reduce((sum, budget) => sum + Number.parseFloat(budget.amount), 0);
  const totalSpent = budgetRows.reduce((sum, category) => sum + getCategorySpending(transactions, category, monthRef.year, monthRef.month), 0);
  const pace = getSpendingPace(totalSpent, totalBudget, monthRef.year, monthRef.month);

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div><h2 className="text-lg font-semibold text-gray-900">Monthly Category Budgets</h2><p className="text-sm text-gray-500">Budgets and spending are tied to the transaction’s selected date.</p></div>
      <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Previous month" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="outline" onClick={resetToCurrent}>{monthLabel(monthRef.year, monthRef.month)}</Button><Button type="button" variant="outline" size="icon" aria-label="Next month" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle>Add or change a category budget</CardTitle></CardHeader><CardContent><form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]"><Select value={newCategory} onChange={(event) => setNewCategory(event.target.value as any)}>{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</Select><Input required min="0" step="0.01" type="number" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} placeholder="Budget MAD" /><Button disabled={saving !== null} type="submit"><Plus className="mr-1 h-4 w-4" /> Save</Button></form>{message && <p className="mt-3 text-sm text-gray-600" role="status">{message}</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Monthly pace</CardTitle></CardHeader><CardContent>{totalBudget > 0 ? <><p className="text-2xl font-bold text-gray-900">{totalSpent.toFixed(2)} / {pace.ideal.toFixed(2)} MAD</p><p className={`mt-1 text-sm font-medium ${pace.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>{Math.abs(pace.difference).toFixed(2)} MAD {pace.difference > 0 ? 'ahead of pace' : 'behind pace'}</p></> : <p className="text-sm text-gray-500">Set category budgets to see your overall spending pace.</p>}</CardContent></Card>
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" disabled={saving !== null} onClick={copyPrevious}><Copy className="mr-2 h-4 w-4" />{saving === '__copy' ? 'Copying...' : "Copy previous month’s budgets"}</Button></div>
    {budgetRows.length > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{budgetRows.map((category) => {
      const budget = budgetFor(budgets, category, monthRef.year, monthRef.month);
      const amount = budget ? Number.parseFloat(budget.amount) : undefined;
      const spent = getCategorySpending(transactions, category, monthRef.year, monthRef.month);
      const status = getBudgetStatus(amount, spent);
      const categoryPace = amount === undefined ? null : getSpendingPace(spent, amount, monthRef.year, monthRef.month);
      const draft = drafts[category] ?? (budget?.amount || '');
      return <Card key={category}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{category}</CardTitle><span className={`rounded-full px-2 py-1 text-xs font-medium ${status.status === 'critical' ? 'bg-red-100 text-red-700' : status.status === 'over_budget' ? 'bg-orange-100 text-orange-700' : status.status === 'warning' ? 'bg-amber-100 text-amber-700' : status.status === 'not_set' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{status.status === 'not_set' ? 'No budget' : `${status.usagePercentage.toFixed(0)}% used`}</span></div></CardHeader><CardContent className="space-y-3">{amount === undefined ? <p className="text-sm text-gray-500">{spent.toFixed(2)} MAD spent · Set a budget to track it.</p> : <><p className="font-semibold text-gray-900">{spent.toFixed(2)} / {amount.toFixed(2)} MAD</p><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${statusStyles[status.status]}`} style={{ width: `${Math.min(100, status.usagePercentage)}%` }} /></div><p className={`text-sm ${status.remaining < 0 ? 'font-medium text-red-600' : 'text-gray-500'}`}>{status.remaining < 0 ? `${Math.abs(status.remaining).toFixed(2)} MAD over budget` : `${status.remaining.toFixed(2)} MAD remaining`}</p>{categoryPace && <p className={`text-xs ${categoryPace.difference > 0 ? 'text-red-600' : 'text-green-600'}`}>{Math.abs(categoryPace.difference).toFixed(2)} MAD {categoryPace.difference > 0 ? 'ahead of pace' : 'behind pace'}</p>}</>}<div className="flex gap-2"><Input aria-label={`${category} budget amount`} min="0" step="0.01" type="number" value={draft} onChange={(event) => setDrafts((current) => ({ ...current, [category]: event.target.value }))} placeholder="Budget MAD" /><Button type="button" variant="outline" disabled={saving !== null} onClick={() => save(category, draft)}>{saving === category ? 'Saving...' : 'Save'}</Button></div></CardContent></Card>;
    })}</div> : <Card><CardContent><p className="py-8 text-center text-sm text-gray-500">No spending or budgets for this month yet. Add a category budget above to get started.</p></CardContent></Card>}
  </div>;
};
