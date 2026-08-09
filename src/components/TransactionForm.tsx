import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { expenseCategories, incomeAndTransferCategories } from '../lib/categories';

type FormData = {
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer';
  source_wallet: 'Bank' | 'Cash';
  category: string;
  notes: string;
  transaction_date: string;
};

const emptyForm = (): FormData => ({
  amount: '',
  type: 'Expense',
  source_wallet: 'Bank',
  category: '',
  notes: '',
  transaction_date: new Date().toISOString().slice(0, 10),
});

interface TransactionFormProps {
  onSuccess: () => void;
  transaction?: Transaction | null;
  onCancel?: () => void;
}

export default function TransactionForm({ onSuccess, transaction, onCancel }: TransactionFormProps) {
  const { token } = useAuth();
  const isEditing = Boolean(transaction);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>(emptyForm());
  const [isSplit, setIsSplit] = useState(false);
  const [splitData, setSplitData] = useState({ reimbursable_amount: '', linked_contact_name: '' });

  useEffect(() => {
    if (!transaction) {
      setFormData(emptyForm());
      setIsSplit(false);
      setSplitData({ reimbursable_amount: '', linked_contact_name: '' });
      return;
    }
    if (transaction.type === 'Debt Repayment') {
      setError('Debt repayments are managed from the linked debt to protect settlement history.');
      return;
    }
    setError('');
    setFormData({
      amount: transaction.amount,
      type: transaction.type,
      source_wallet: transaction.sourceWallet,
      category: transaction.category || '',
      notes: transaction.notes || '',
      transaction_date: new Date(transaction.createdAt).toISOString().slice(0, 10),
    });
    setIsSplit(Boolean(transaction.reimbursableAmount && Number.parseFloat(transaction.reimbursableAmount) > 0));
    setSplitData({
      reimbursable_amount: transaction.reimbursableAmount || '',
      linked_contact_name: transaction.linkedContactName || '',
    });
  }, [transaction]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const amount = Number.parseFloat(formData.amount);
    const reimbursableAmount = isSplit ? Number.parseFloat(splitData.reimbursable_amount) : 0;
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (isSplit && (!Number.isFinite(reimbursableAmount) || reimbursableAmount <= 0 || reimbursableAmount > amount)) {
      setError('The reimbursable amount must be greater than zero and cannot exceed the expense.');
      return;
    }
    if (isSplit && !splitData.linked_contact_name.trim()) {
      setError('Enter the person who owes you.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        amount,
        ...(formData.type === 'Expense' ? {
          reimbursable_amount: reimbursableAmount,
          linked_contact_name: isSplit ? splitData.linked_contact_name.trim() : undefined,
        } : {}),
      };
      const response = await fetch(isEditing ? `/api/transactions/${transaction!.id}` : '/api/transactions', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to save the transaction.');

      onSuccess();
      if (isEditing) onCancel?.();
      else {
        setFormData(emptyForm());
        setIsSplit(false);
        setSplitData({ reimbursable_amount: '', linked_contact_name: '' });
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to save the transaction.');
    } finally {
      setLoading(false);
    }
  };

  const isEditable = transaction?.type !== 'Debt Repayment';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{isEditing ? 'Edit Transaction' : 'Log Transaction'}</CardTitle>
        {isEditing && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing && <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">Transaction type is fixed to keep wallet and debt records consistent. Create a new transaction if the type needs to change.</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Amount</label><Input required disabled={!isEditable} min="0.01" type="number" step="0.01" value={formData.amount} onChange={(event) => setFormData({ ...formData, amount: event.target.value })} placeholder="0.00" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Type</label><Select disabled={isEditing || !isEditable} value={formData.type} onChange={(event) => setFormData({ ...formData, type: event.target.value as FormData['type'] })}><option value="Expense">Expense</option><option value="Income">Income</option><option value="Transfer">Transfer (e.g. ATM)</option></Select></div>
          </div>
          <div className="space-y-2"><label className="text-sm font-medium">Transaction Date</label><Input required disabled={!isEditable} type="date" value={formData.transaction_date} onChange={(event) => setFormData({ ...formData, transaction_date: event.target.value })} /><p className="text-xs text-gray-500">This date controls your reports, budgets, and trends.</p></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2"><label className="text-sm font-medium">Wallet</label><Select disabled={!isEditable} value={formData.source_wallet} onChange={(event) => setFormData({ ...formData, source_wallet: event.target.value as FormData['source_wallet'] })}><option value="Bank">Bank / Card</option><option value="Cash">Physical Cash</option></Select></div>
            <div className="space-y-2"><label className="text-sm font-medium">Category</label><Select required disabled={!isEditable} value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}><option value="" disabled>Select category</option><optgroup label="Expenses">{expenseCategories.map((category) => <option key={category} value={category}>{category === 'Other' ? 'Other Expense' : category}</option>)}</optgroup><optgroup label="Income & Transfers">{incomeAndTransferCategories.map((category) => <option key={category} value={category}>{category === 'Income' ? 'Income / Salary' : category}</option>)}</optgroup></Select></div>
          </div>
          <div className="space-y-2"><label className="text-sm font-medium">Notes</label><Input disabled={!isEditable} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Optional details" /></div>
          {formData.type === 'Expense' && (
            <div className="space-y-4 rounded-lg border bg-gray-50/50 p-4">
              <label className="flex items-center gap-2"><input disabled={!isEditable} type="checkbox" checked={isSplit} onChange={(event) => setIsSplit(event.target.checked)} className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" /><span className="text-sm font-medium">Split / Reimbursable (Fronting Money)</span></label>
              {isSplit && <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">Reimbursable Amount</label><Input required type="number" min="0.01" max={formData.amount || undefined} step="0.01" disabled={!isEditable} value={splitData.reimbursable_amount} onChange={(event) => setSplitData({ ...splitData, reimbursable_amount: event.target.value })} placeholder="0.00" /></div><div className="space-y-2"><label className="text-sm font-medium">Who Owes You?</label><Input required disabled={!isEditable} value={splitData.linked_contact_name} onChange={(event) => setSplitData({ ...splitData, linked_contact_name: event.target.value })} placeholder="Contact name" /></div></div>}
            </div>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !isEditable}>{loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Transaction'}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
