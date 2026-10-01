import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { expenseCategories, incomeAndTransferCategories } from '../lib/categories';
import { Trash2, AlertCircle, Plus, Users } from 'lucide-react';

type FormData = {
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Loan Received';
  walletId: string;
  toWalletId?: string;
  category: string;
  notes: string;
  transaction_date: string;
  contextId?: string | null;
};

type FormSplit = {
  id?: string;
  reimbursable_amount: string;
  linked_contact_name: string;
};

const emptyForm = (wallets?: { id: string; name: string }[]): FormData => ({
  amount: '',
  type: 'Expense',
  walletId: wallets?.[0]?.id || '',
  toWalletId: wallets?.[1]?.id || wallets?.[0]?.id || '',
  category: '',
  notes: '',
  transaction_date: new Date().toISOString().slice(0, 10),
  contextId: null,
});

interface TransactionFormProps {
  onSuccess: () => void;
  transaction?: Transaction | null;
  onCancel?: () => void;
  wallets?: { id: string; name: string }[];
  contexts?: any[];
  onDelete?: (id: string) => Promise<void> | void;
}

export default function TransactionForm({ onSuccess, transaction, onCancel, wallets, contexts = [], onDelete }: TransactionFormProps) {
  const { token } = useAuth();
  const isEditing = Boolean(transaction);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>(emptyForm(wallets));
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<FormSplit[]>([{ reimbursable_amount: '', linked_contact_name: '' }]);
  const [loanContactName, setLoanContactName] = useState('');
  const isPayroll = Boolean(transaction?.payrollId);

  const handleDelete = async () => {
    if (!transaction || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(transaction.id);
      onCancel?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete transaction');
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    if (!transaction) {
      setFormData(emptyForm(wallets));
      setIsSplit(false);
      setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
      setLoanContactName('');
      return;
    }
    if (transaction.type === 'Debt Repayment') {
      setError('Debt repayments are managed from the linked debt to protect settlement history.');
      return;
    }
    setError('');
    setFormData({
      amount: transaction.amount,
      type: transaction.category === '🤝 Loan Received' && transaction.linkedDebtType === 'Payable' ? 'Loan Received' : transaction.type,
      walletId: transaction.walletId || wallets?.[0]?.id || '',
      toWalletId: transaction.destinationWalletId || (transaction as any).toWalletId || wallets?.[1]?.id || '',
      category: transaction.category || '',
      notes: transaction.notes || '',
      transaction_date: new Date(transaction.createdAt).toISOString().slice(0, 10),
      contextId: transaction.contextId || null,
    });

    if (transaction.splits && transaction.splits.length > 0) {
      const receivableSplits = transaction.splits
        .filter((s) => s.linkedDebtType !== 'Payable')
        .map((s) => ({
          id: s.id,
          reimbursable_amount: s.reimbursableAmount || '',
          linked_contact_name: s.linkedContactName || '',
        }));
      if (receivableSplits.length > 0) {
        setIsSplit(true);
        setSplits(receivableSplits);
      } else {
        setIsSplit(false);
        setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
      }
    } else if (transaction.reimbursableAmount && Number.parseFloat(transaction.reimbursableAmount) > 0) {
      setIsSplit(true);
      setSplits([{
        id: transaction.linkedContactId || undefined,
        reimbursable_amount: transaction.reimbursableAmount || '',
        linked_contact_name: transaction.linkedContactName || '',
      }]);
    } else {
      setIsSplit(false);
      setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
    }

    setLoanContactName(transaction.linkedDebtType === 'Payable' ? transaction.linkedContactName || '' : '');
  }, [transaction]);

  useEffect(() => {
    // Only auto-suggest context for NEW transactions when date changes
    if (!isEditing && contexts.length > 0 && formData.transaction_date && !formData.contextId) {
      const txDate = new Date(formData.transaction_date).getTime();
      const matchingContext = contexts.find(c => {
        if (!c.startDate || !c.endDate || c.status === 'Planned') return false;
        const start = new Date(c.startDate).getTime();
        const end = new Date(c.endDate).getTime();
        return txDate >= start && txDate <= end;
      });
      if (matchingContext) {
        setFormData(prev => ({ ...prev, contextId: matchingContext.id }));
      }
    }
  }, [formData.transaction_date, isEditing, contexts]);

  const addSplit = () => {
    setSplits(prev => [...prev, { reimbursable_amount: '', linked_contact_name: '' }]);
  };

  const updateSplit = (index: number, field: 'reimbursable_amount' | 'linked_contact_name', value: string) => {
    setSplits(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeSplit = (index: number) => {
    setSplits(prev => {
      if (prev.length <= 1) {
        return [{ reimbursable_amount: '', linked_contact_name: '' }];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const splitEqually = () => {
    const amount = Number.parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0 || splits.length === 0) return;
    const totalPeople = splits.length + 1; // user + each split contact
    const share = (amount / totalPeople).toFixed(2);
    setSplits(prev => prev.map(s => ({ ...s, reimbursable_amount: share })));
  };

  const totalExpenseAmount = Number.parseFloat(formData.amount) || 0;
  const totalReimbursable = isSplit
    ? splits.reduce((sum, s) => sum + (Number.parseFloat(s.reimbursable_amount) || 0), 0)
    : 0;
  const myNetExpense = Math.max(0, totalExpenseAmount - totalReimbursable);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const amount = Number.parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (formData.type === 'Transfer' && formData.toWalletId && formData.walletId === formData.toWalletId) {
      setError('Source and destination wallets must be different.');
      return;
    }

    if (isSplit) {
      const validSplits = splits.filter(s => s.linked_contact_name.trim() || Number.parseFloat(s.reimbursable_amount) > 0);
      if (validSplits.length === 0) {
        setError('Please specify at least one person and their reimbursable amount.');
        return;
      }
      for (let i = 0; i < validSplits.length; i++) {
        const s = validSplits[i];
        const amt = Number.parseFloat(s.reimbursable_amount);
        if (!s.linked_contact_name.trim()) {
          setError(`Please enter the name for split #${i + 1}.`);
          return;
        }
        if (!Number.isFinite(amt) || amt <= 0) {
          setError(`Reimbursable amount for ${s.linked_contact_name || `split #${i + 1}`} must be greater than zero.`);
          return;
        }
      }
      if (totalReimbursable > amount) {
        setError(`Total reimbursable amount (${totalReimbursable.toFixed(2)} MAD) cannot exceed the expense (${amount.toFixed(2)} MAD).`);
        return;
      }
    }

    if (formData.type === 'Loan Received' && !loanContactName.trim()) {
      setError('Enter the person you need to repay.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount,
        type: formData.type === 'Loan Received' ? 'Income' : formData.type,
        walletId: formData.walletId,
        destinationWalletId: formData.type === 'Transfer' ? formData.toWalletId : undefined,
        category: formData.type === 'Loan Received' ? '🤝 Loan Received' : (formData.type === 'Transfer' && !formData.category ? '🔄 Transfer' : formData.category),
        notes: formData.notes,
        transaction_date: formData.transaction_date,
        contextId: formData.contextId || null,
        ...(formData.type === 'Loan Received' ? { loan_contact_name: loanContactName.trim() } : {}),
        ...(formData.type === 'Expense' && isSplit ? {
          splits: splits
            .filter(s => s.linked_contact_name.trim() && Number.parseFloat(s.reimbursable_amount) > 0)
            .map(s => ({
              id: s.id,
              reimbursable_amount: Number.parseFloat(s.reimbursable_amount),
              linked_contact_name: s.linked_contact_name.trim(),
            })),
          reimbursable_amount: totalReimbursable,
          linked_contact_name: splits.map(s => s.linked_contact_name.trim()).filter(Boolean).join(', '),
        } : formData.type === 'Expense' && !isSplit ? {
          splits: [],
          reimbursable_amount: 0,
        } : {}),
      };
      const response = await fetch(isEditing ? `/api/transactions/${transaction!.id}` : '/api/transactions', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
        throw new Error(data.error || 'Unable to save the transaction.');
      }

      onSuccess();
      if (isEditing) onCancel?.();
      else {
        setFormData(emptyForm(wallets));
        setIsSplit(false);
        setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
        setLoanContactName('');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to save the transaction.');
    } finally {
      setLoading(false);
    }
  };

  const isEditable = transaction?.type !== 'Debt Repayment';
  const isLoanReceived = formData.type === 'Loan Received';
  const activeCategories = formData.type === 'Expense' ? expenseCategories : incomeAndTransferCategories;
  const hasLegacyCategory = Boolean(formData.category) && !(activeCategories as readonly string[]).includes(formData.category);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg m-auto animate-in zoom-in-95 duration-200">
        <Card className="shadow-2xl border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle>{isEditing ? 'Edit Transaction' : 'Log Transaction'}</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel || onSuccess} className="h-8 px-2 text-gray-500 hover:text-gray-900 dark:hover:text-white">✕ Close</Button>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isPayroll ? (
                <p className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 text-xs text-blue-700 dark:text-blue-300">This is a posted payroll. Changing its amount or date also updates the matching payroll entry on the calendar.</p>
              ) : isEditing && <p className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 text-xs text-blue-700 dark:text-blue-300">Transaction type is fixed to keep wallet and debt records consistent. Create a new transaction if the type needs to change.</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2"><label className="text-sm font-medium">Amount</label><Input required disabled={!isEditable} min="0.01" type="number" step="0.01" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} placeholder="0.00" /></div>
                <div className="space-y-2"><label className="text-sm font-medium">Type</label><Select disabled={isEditing || !isEditable} value={formData.type} onChange={(event) => { const type = event.target.value as FormData['type']; setFormData({ ...formData, type, category: type === 'Loan Received' ? '🤝 Loan Received' : formData.category }); }}><option value="Expense">Expense</option><option value="Income">Income</option><option value="Loan Received">Loan received (to repay)</option><option value="Transfer">Transfer (e.g. ATM)</option></Select></div>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Transaction Date</label><Input required disabled={!isEditable} type="date" value={formData.transaction_date} onChange={(event) => setFormData({ ...formData, transaction_date: event.target.value })} /><p className="text-xs text-gray-500 dark:text-gray-400">This date controls your reports, budgets, and trends.</p></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2"><label className="text-sm font-medium">{formData.type === 'Transfer' ? 'From Wallet' : 'Wallet'}</label><Select disabled={!isEditable || isPayroll} value={formData.walletId} onChange={(event) => { const walletId = event.target.value as FormData['walletId']; setFormData({ ...formData, walletId }); }}><option value="" disabled>Select wallet</option>{(wallets || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></div>
                {formData.type === 'Transfer' ? (
                  <div className="space-y-2"><label className="text-sm font-medium">To Wallet</label><Select disabled={!isEditable || isPayroll} value={formData.toWalletId} onChange={(event) => setFormData({ ...formData, toWalletId: event.target.value })}><option value="" disabled>Select destination wallet</option>{(wallets || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></div>
                ) : (
                  <div className="space-y-2"><label className="text-sm font-medium">Category</label><Select required disabled={!isEditable || isPayroll || isLoanReceived} value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}><option value="" disabled>Select category</option>{hasLegacyCategory && <option value={formData.category}>Legacy category: {formData.category}</option>}<optgroup label="Expenses">{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup><optgroup label="Income & Transfers">{incomeAndTransferCategories.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup></Select>{hasLegacyCategory && <p className="text-xs text-amber-600 dark:text-amber-400">This is a legacy category. Choose one of the fixed categories when you are ready to recategorize it.</p>}</div>
                )}
              </div>
              {isLoanReceived && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20"><label className="text-sm font-medium">Who did you borrow from?</label><Input required disabled={!isEditable} value={loanContactName} onChange={(event) => setLoanContactName(event.target.value)} placeholder="Person or lender name" /><p className="text-xs text-amber-800 dark:text-amber-200">This records the money in your balance and creates a payable debt to settle later.</p></div>}
              {contexts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Financial Context <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <Select disabled={!isEditable || isPayroll} value={formData.contextId || ''} onChange={(event) => setFormData({ ...formData, contextId: event.target.value || null })}>
                    <option value="">None</option>
                    {contexts.filter(c => c.status === 'Active' || c.status === 'Planned' || formData.contextId === c.id).map(ctx => (
                      <option key={ctx.id} value={ctx.id}>{ctx.name} {ctx.status === 'Completed' ? '(Completed)' : ''}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2"><label className="text-sm font-medium">Notes</label><Input disabled={!isEditable || isPayroll} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Optional details" /></div>
              {formData.type === 'Expense' && (
                <div className="space-y-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 p-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        disabled={!isEditable}
                        type="checkbox"
                        checked={isSplit}
                        onChange={(event) => {
                          setIsSplit(event.target.checked);
                          if (event.target.checked && splits.length === 0) {
                            setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
                          }
                        }}
                        className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Split / Reimbursable (Fronting Money)
                      </span>
                    </label>
                    {isSplit && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        {splits.length} {splits.length === 1 ? 'person' : 'people'}
                      </span>
                    )}
                  </div>

                  {isSplit && (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-2.5">
                        {splits.map((split, index) => (
                          <div key={index} className="flex items-start gap-2 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
                            <div className="flex-1 space-y-1">
                              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                Who owes you? (Person #{index + 1})
                              </label>
                              <Input
                                required
                                disabled={!isEditable}
                                value={split.linked_contact_name}
                                onChange={(e) => updateSplit(index, 'linked_contact_name', e.target.value)}
                                placeholder="Contact name (e.g. Omar, Sarah)"
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="w-32 sm:w-36 space-y-1">
                              <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                Amount (MAD)
                              </label>
                              <Input
                                required
                                type="number"
                                min="0.01"
                                max={formData.amount || undefined}
                                step="0.01"
                                disabled={!isEditable}
                                value={split.reimbursable_amount}
                                onChange={(e) => updateSplit(index, 'reimbursable_amount', e.target.value)}
                                placeholder="0.00"
                                className="h-9 text-sm font-medium"
                              />
                            </div>
                            {splits.length > 1 && (
                              <button
                                type="button"
                                disabled={!isEditable}
                                onClick={() => removeSplit(index)}
                                className="mt-6 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                title="Remove split"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!isEditable}
                          onClick={addSplit}
                          className="text-xs h-8 bg-white dark:bg-gray-900 border-dashed hover:border-solid shadow-xs"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Person
                        </Button>

                        {formData.amount && Number.parseFloat(formData.amount) > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!isEditable}
                            onClick={splitEqually}
                            className="text-xs h-8 text-blue-600 dark:text-blue-400 hover:bg-blue-100/50 dark:hover:bg-blue-900/30"
                            title={`Split equally among ${splits.length + 1} people (you + ${splits.length} other${splits.length === 1 ? '' : 's'})`}
                          >
                            <Users className="h-3.5 w-3.5 mr-1" /> Split Equally
                          </Button>
                        )}
                      </div>

                      {/* Summary Calculation Bar */}
                      <div className="rounded-lg bg-gray-100/80 dark:bg-gray-800/80 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                          <span>Total Expense:</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {totalExpenseAmount.toFixed(2)} MAD
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                          <span>Total Reimbursable (Owed to You):</span>
                          <span className="font-semibold">
                            -{totalReimbursable.toFixed(2)} MAD
                          </span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 flex items-center justify-between font-semibold">
                          <span className="text-gray-800 dark:text-gray-200">Your Share (Net Cost):</span>
                          <span className={totalReimbursable > totalExpenseAmount ? 'text-red-600' : 'text-emerald-600 dark:text-emerald-400'}>
                            {myNetExpense.toFixed(2)} MAD
                          </span>
                        </div>
                        {totalReimbursable > totalExpenseAmount && (
                          <p className="text-xs text-red-600 font-medium pt-1">
                            Warning: Reimbursable total exceeds the total expense amount!
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
              
              {confirmDelete && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 p-3.5 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                    Permanently delete this transaction? This will update your wallet balance.
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isDeleting}
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium"
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {isEditing && !isPayroll && onDelete && !confirmDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading || isDeleting || !isEditable}
                    onClick={() => setConfirmDelete(true)}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-950/20"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={loading || isDeleting || !isEditable}>
                  {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Transaction'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
