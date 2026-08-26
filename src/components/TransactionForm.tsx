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
  type: 'Income' | 'Expense' | 'Transfer' | 'Loan Received';
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
  const [loanContactName, setLoanContactName] = useState('');
  const isPayroll = Boolean(transaction?.payrollId);

  useEffect(() => {
    if (!transaction) {
      setFormData(emptyForm());
      setIsSplit(false);
      setSplitData({ reimbursable_amount: '', linked_contact_name: '' });
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
    setLoanContactName(transaction.linkedDebtType === 'Payable' ? transaction.linkedContactName || '' : '');
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
    if (formData.type === 'Loan Received' && !loanContactName.trim()) {
      setError('Enter the person you need to repay.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        amount,
        type: formData.type === 'Loan Received' ? 'Income' : formData.type,
        category: formData.type === 'Loan Received' ? '🤝 Loan Received' : formData.category,
        ...(formData.type === 'Loan Received' ? { loan_contact_name: loanContactName.trim() } : {}),
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
                <div className="space-y-2"><label className="text-sm font-medium">Wallet</label><Select disabled={!isEditable || isPayroll} value={formData.source_wallet} onChange={(event) => setFormData({ ...formData, source_wallet: event.target.value as FormData['source_wallet'] })}><option value="Bank">Bank / Card</option><option value="Cash">Physical Cash</option></Select></div>
                <div className="space-y-2"><label className="text-sm font-medium">Category</label><Select required disabled={!isEditable || isPayroll || isLoanReceived} value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}><option value="" disabled>Select category</option>{hasLegacyCategory && <option value={formData.category}>Legacy category: {formData.category}</option>}<optgroup label="Expenses">{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup><optgroup label="Income & Transfers">{incomeAndTransferCategories.map((category) => <option key={category} value={category}>{category}</option>)}</optgroup></Select>{hasLegacyCategory && <p className="text-xs text-amber-600 dark:text-amber-400">This is a legacy category. Choose one of the fixed categories when you are ready to recategorize it.</p>}</div>
              </div>
              {isLoanReceived && <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20"><label className="text-sm font-medium">Who did you borrow from?</label><Input required disabled={!isEditable} value={loanContactName} onChange={(event) => setLoanContactName(event.target.value)} placeholder="Person or lender name" /><p className="text-xs text-amber-800 dark:text-amber-200">This records the money in your balance and creates a payable debt to settle later.</p></div>}
              <div className="space-y-2"><label className="text-sm font-medium">Notes</label><Input disabled={!isEditable || isPayroll} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Optional details" /></div>
              {formData.type === 'Expense' && (
                <div className="space-y-4 rounded-lg border dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50/50 dark:bg-gray-900/50 p-4">
                  <label className="flex items-center gap-2"><input disabled={!isEditable} type="checkbox" checked={isSplit} onChange={(event) => setIsSplit(event.target.checked)} className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100" /><span className="text-sm font-medium">Split / Reimbursable (Fronting Money)</span></label>
                  {isSplit && <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2"><div className="space-y-2"><label className="text-sm font-medium">Reimbursable Amount</label><Input required type="number" min="0.01" max={formData.amount || undefined} step="0.01" disabled={!isEditable} value={splitData.reimbursable_amount} onChange={(event) => setSplitData({ ...splitData, reimbursable_amount: event.target.value })} placeholder="0.00" /></div><div className="space-y-2"><label className="text-sm font-medium">Who Owes You?</label><Input required disabled={!isEditable} value={splitData.linked_contact_name} onChange={(event) => setSplitData({ ...splitData, linked_contact_name: event.target.value })} placeholder="Contact name" /></div></div>}
                </div>
              )}
              {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || !isEditable}>{loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Transaction'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

