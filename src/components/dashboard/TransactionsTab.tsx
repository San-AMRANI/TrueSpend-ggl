import React, { useEffect, useMemo, useState } from 'react';
import { Transaction } from '../../types';
import { expenseCategories } from '../../lib/categories';
import { filterTransactions, TransactionFilters } from '../../lib/finance';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import TransactionForm from '../TransactionForm';
import { ArrowDownRight, ArrowUpRight, Banknote, Edit2, Filter, Landmark, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionsTabProps {
  transactions: Transaction[];
  handleDeleteTx: (id: string) => void;
  fetchData: () => void;
  selectedTransactionId?: string | null;
  onSelectionHandled?: () => void;
}

const initialFilters: TransactionFilters = { datePreset: 'all', types: [], categories: [], wallets: [], reimbursable: 'all', debtRelationship: 'all', sort: 'newest' };

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ transactions, handleDeleteTx, fetchData, selectedTransactionId, onSelectionHandled }) => {
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!selectedTransactionId) return;
    const transaction = transactions.find((item) => item.id === selectedTransactionId);
    if (transaction) { setEditingTransaction(transaction); setShowForm(false); }
    onSelectionHandled?.();
  }, [onSelectionHandled, selectedTransactionId, transactions]);

  const categories = useMemo(() => [...expenseCategories], []);
  const visibleTransactions = useMemo(() => filterTransactions(transactions, filters), [filters, transactions]);
  const activeFilterCount = [filters.datePreset !== 'all', Boolean(filters.types?.length), Boolean(filters.categories?.length), Boolean(filters.wallets?.length), filters.minAmount !== undefined, filters.maxAmount !== undefined, filters.reimbursable !== 'all', filters.debtRelationship !== 'all'].filter(Boolean).length;
  const update = (patch: Partial<TransactionFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const toggle = <T,>(values: T[] | undefined, value: T) => values?.includes(value) ? values.filter((item) => item !== value) : [...(values || []), value];
  const clearFilters = () => setFilters({ ...initialFilters, query: filters.query });
  const openEdit = (transaction: Transaction) => { setEditingTransaction(transaction); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const closeEditor = () => { setEditingTransaction(null); setShowForm(false); };

  return <div className="space-y-6">
    {(showForm || editingTransaction) && <TransactionForm transaction={editingTransaction} onSuccess={fetchData} onCancel={closeEditor} />}
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Transactions</CardTitle><p className="mt-1 text-sm font-normal text-gray-500">Find, filter, edit, or add transactions.</p></div><Button type="button" onClick={() => { setShowForm(true); setEditingTransaction(null); }}><Plus className="mr-2 h-4 w-4" /> Add transaction</Button></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input value={filters.query || ''} onChange={(event) => update({ query: event.target.value })} className="pl-9" placeholder="Search merchant, notes, category, or person…" /></div><Button type="button" variant="outline" onClick={() => setShowFilters((current) => !current)}><Filter className="mr-2 h-4 w-4" /> Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button></div>
        {showFilters && <div className="space-y-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">Filter transactions</h3><Button type="button" variant="ghost" size="sm" onClick={clearFilters}><X className="mr-1 h-3 w-3" /> Clear filters</Button></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><label className="space-y-1 text-sm font-medium text-gray-700">Date<Select value={filters.datePreset} onChange={(event) => update({ datePreset: event.target.value as TransactionFilters['datePreset'] })}><option value="all">All time</option><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="last-month">Last month</option><option value="custom">Custom range</option></Select></label><label className="space-y-1 text-sm font-medium text-gray-700">Reimbursable<Select value={filters.reimbursable} onChange={(event) => update({ reimbursable: event.target.value as TransactionFilters['reimbursable'] })}><option value="all">All</option><option value="reimbursable">Reimbursable</option><option value="non-reimbursable">Non-reimbursable</option></Select></label><label className="space-y-1 text-sm font-medium text-gray-700">Debt relationship<Select value={filters.debtRelationship} onChange={(event) => update({ debtRelationship: event.target.value as TransactionFilters['debtRelationship'] })}><option value="all">All</option><option value="debt-linked">Debt-linked</option><option value="not-debt-related">Not debt-related</option></Select></label><label className="space-y-1 text-sm font-medium text-gray-700">Sort<Select value={filters.sort} onChange={(event) => update({ sort: event.target.value as TransactionFilters['sort'] })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option></Select></label></div>
          {filters.datePreset === 'custom' && <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium text-gray-700">From<Input type="date" value={filters.startDate || ''} onChange={(event) => update({ startDate: event.target.value || undefined })} /></label><label className="space-y-1 text-sm font-medium text-gray-700">To<Input type="date" value={filters.endDate || ''} onChange={(event) => update({ endDate: event.target.value || undefined })} /></label></div>}
          <div className="grid gap-4 lg:grid-cols-3"><div><p className="mb-2 text-sm font-medium text-gray-700">Type</p><div className="flex flex-wrap gap-3">{(['Expense', 'Income', 'Transfer'] as Transaction['type'][]).map((type) => <label key={type} className="flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" checked={filters.types?.includes(type)} onChange={() => update({ types: toggle(filters.types, type) })} />{type}</label>)}</div></div><div><p className="mb-2 text-sm font-medium text-gray-700">Wallet</p><div className="flex gap-3">{(['Bank', 'Cash'] as Transaction['sourceWallet'][]).map((wallet) => <label key={wallet} className="flex items-center gap-1.5 text-sm text-gray-700"><input type="checkbox" checked={filters.wallets?.includes(wallet)} onChange={() => update({ wallets: toggle(filters.wallets, wallet) })} />{wallet}</label>)}</div></div><div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm font-medium text-gray-700">Min amount<Input min="0" type="number" value={filters.minAmount ?? ''} onChange={(event) => update({ minAmount: event.target.value === '' ? undefined : Number(event.target.value) })} /></label><label className="space-y-1 text-sm font-medium text-gray-700">Max amount<Input min="0" type="number" value={filters.maxAmount ?? ''} onChange={(event) => update({ maxAmount: event.target.value === '' ? undefined : Number(event.target.value) })} /></label></div></div>
          <div><p className="mb-2 text-sm font-medium text-gray-700">Categories <span className="font-normal text-gray-500">(select one or more)</span></p><div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => update({ categories: toggle(filters.categories, category) })} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filters.categories?.includes(category) ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>{category}</button>)}</div></div>
        </div>}
        <p className="text-sm text-gray-500">{visibleTransactions.length} transaction{visibleTransactions.length === 1 ? '' : 's'}</p>
        <div className="divide-y divide-gray-100">{visibleTransactions.map((transaction) => <div key={transaction.id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${transaction.type === 'Income' ? 'bg-green-100 text-green-600' : transaction.type === 'Transfer' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>{transaction.type === 'Income' ? <ArrowDownRight className="h-5 w-5" /> : transaction.type === 'Transfer' ? <RefreshCw className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}</div><div className="min-w-0"><p className="truncate font-medium text-gray-900">{transaction.notes || transaction.category || transaction.type}</p><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500"><span>{format(new Date(transaction.createdAt), 'MMM d, yyyy')}</span><span>•</span><span className="flex items-center gap-1">{transaction.sourceWallet === 'Bank' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}{transaction.sourceWallet}</span>{transaction.category && <><span>•</span><span>{transaction.category}</span></>}{transaction.linkedContactName && <><span>•</span><span>Debt: {transaction.linkedContactName}</span></>}</div></div></div><div className="flex items-center justify-between gap-3 pl-[52px] sm:pl-0"><span className={`font-semibold ${transaction.type === 'Income' ? 'text-green-600' : transaction.type === 'Expense' ? 'text-gray-900' : 'text-gray-500'}`}>{transaction.type === 'Expense' ? '-' : transaction.type === 'Income' ? '+' : ''}{Number.parseFloat(transaction.amount).toFixed(2)} MAD</span><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${transaction.category || transaction.type}`} className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => openEdit(transaction)}><Edit2 className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${transaction.category || transaction.type}`} className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => handleDeleteTx(transaction.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}{visibleTransactions.length === 0 && <div className="py-10 text-center"><p className="font-medium text-gray-700">No transactions found</p><p className="mt-1 text-sm text-gray-500">{activeFilterCount || filters.query ? 'Try changing or clearing your filters.' : 'Add your first transaction to start tracking.'}</p>{(activeFilterCount || filters.query) ? <Button type="button" variant="outline" className="mt-4" onClick={() => { clearFilters(); update({ query: '' }); }}>Clear filters</Button> : null}</div>}</div>
      </CardContent>
    </Card>
  </div>;
};
