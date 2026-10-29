import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { expenseCategories, incomeAndTransferCategories } from '../lib/categories';
import { Trash2, AlertCircle, Plus, Users, Clock, Percent } from 'lucide-react';

type FormData = {
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Loan Received' | 'Debt Repayment';
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

const emptyForm = (wallets?: { id: string; name: string; type?: string }[]): FormData => ({
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
  duplicateFrom?: Transaction | null;
  initialType?: 'Income' | 'Expense' | 'Transfer';
  onCancel?: () => void;
  wallets?: { id: string; name: string; type?: string }[];
  contexts?: any[];
  onDelete?: (id: string) => Promise<void> | void;
}

export default function TransactionForm({
  onSuccess,
  transaction,
  duplicateFrom,
  initialType,
  onCancel,
  wallets,
  contexts = [],
  onDelete,
}: TransactionFormProps) {
  const { token } = useAuth();
  const isEditing = Boolean(transaction);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<FormData>(() => {
    const base = emptyForm(wallets);
    if (initialType) base.type = initialType;
    return base;
  });

  // Split / Reimbursable (Fronting money for others -> Receivable debt)
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<FormSplit[]>([
    { reimbursable_amount: '', linked_contact_name: '' },
  ]);

  // Uncompleted / Partial Payment (Paid part now, still owe the rest -> Payable debt)
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [totalBillInput, setTotalBillInput] = useState('');
  const [unpaidAmountInput, setUnpaidAmountInput] = useState('');
  const [unpaidContactName, setUnpaidContactName] = useState('');
  const [unpaidDueDate, setUnpaidDueDate] = useState('');

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
    const sourceTx = transaction || duplicateFrom;
    if (!sourceTx) {
      const base = emptyForm(wallets);
      if (initialType) base.type = initialType;
      setFormData(base);
      setIsSplit(false);
      setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
      setIsPartialPayment(false);
      setTotalBillInput('');
      setUnpaidAmountInput('');
      setUnpaidContactName('');
      setUnpaidDueDate('');
      setLoanContactName('');
      return;
    }
    if (transaction && transaction.type === 'Debt Repayment') {
      setError('Debt repayments are managed from the linked debt to protect settlement history.');
      return;
    }
    setError('');
    setFormData({
      amount: sourceTx.amount,
      type:
        sourceTx.category === '🤝 Loan Received' && sourceTx.linkedDebtType === 'Payable'
          ? 'Loan Received'
          : sourceTx.type,
      walletId: sourceTx.walletId || wallets?.[0]?.id || '',
      toWalletId:
        sourceTx.destinationWalletId || (sourceTx as any).toWalletId || wallets?.[1]?.id || '',
      category: sourceTx.category || '',
      notes: duplicateFrom ? `${sourceTx.notes || ''} (Copy)` : sourceTx.notes || '',
      transaction_date: duplicateFrom
        ? new Date().toISOString().slice(0, 10)
        : new Date(sourceTx.createdAt).toISOString().slice(0, 10),
      contextId: sourceTx.contextId || null,
    });

    // Populate Receivable Splits
    if (sourceTx.splits && sourceTx.splits.length > 0) {
      const receivableSplits = sourceTx.splits
        .filter((s) => s.linkedDebtType !== 'Payable')
        .map((s) => ({
          id: duplicateFrom ? undefined : s.id,
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
    } else if (sourceTx.reimbursableAmount && Number.parseFloat(sourceTx.reimbursableAmount) > 0) {
      setIsSplit(true);
      setSplits([
        {
          id: duplicateFrom ? undefined : sourceTx.linkedContactId || undefined,
          reimbursable_amount: sourceTx.reimbursableAmount || '',
          linked_contact_name: sourceTx.linkedContactName || '',
        },
      ]);
    } else {
      setIsSplit(false);
      setSplits([{ reimbursable_amount: '', linked_contact_name: '' }]);
    }

    // Populate Uncompleted / Partial Payment (Payable split on Expense)
    if (sourceTx.type === 'Expense' && sourceTx.isPartialPayment && sourceTx.unpaidAmount) {
      const paidNow = Number.parseFloat(sourceTx.amount) || 0;
      const unpaidOrig = Number.parseFloat(sourceTx.unpaidAmount) || 0;
      setIsPartialPayment(true);
      setUnpaidAmountInput(unpaidOrig.toFixed(2));
      setTotalBillInput((paidNow + unpaidOrig).toFixed(2));
      setUnpaidContactName(sourceTx.unpaidContactName || '');
      setUnpaidDueDate('');
    } else {
      setIsPartialPayment(false);
      setTotalBillInput('');
      setUnpaidAmountInput('');
      setUnpaidContactName('');
      setUnpaidDueDate('');
    }

    setLoanContactName(
      sourceTx.type === 'Income' && sourceTx.linkedDebtType === 'Payable'
        ? sourceTx.linkedContactName || ''
        : ''
    );
  }, [transaction, duplicateFrom, initialType]);

  useEffect(() => {
    if (!isEditing && contexts.length > 0 && formData.transaction_date && !formData.contextId) {
      const txDate = new Date(formData.transaction_date).getTime();
      const matchingContext = contexts.find((c) => {
        if (!c.startDate || !c.endDate || c.status === 'Planned') return false;
        const start = new Date(c.startDate).getTime();
        const end = new Date(c.endDate).getTime();
        return txDate >= start && txDate <= end;
      });
      if (matchingContext) {
        setFormData((prev) => ({ ...prev, contextId: matchingContext.id }));
      }
    }
  }, [formData.transaction_date, isEditing, contexts]);

  const addSplit = () => {
    setSplits((prev) => [...prev, { reimbursable_amount: '', linked_contact_name: '' }]);
  };

  const updateSplit = (
    index: number,
    field: 'reimbursable_amount' | 'linked_contact_name',
    value: string
  ) => {
    setSplits((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeSplit = (index: number) => {
    setSplits((prev) => {
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
    setSplits((prev) => prev.map((s) => ({ ...s, reimbursable_amount: share })));
  };

  // Partial payment helpers
  const handleTogglePartialPayment = (checked: boolean) => {
    setIsPartialPayment(checked);
    if (checked) {
      const currentAmt = Number.parseFloat(formData.amount) || 0;
      if (currentAmt > 0 && !unpaidAmountInput) {
        // Default: treat current amount as total bill and split 50% paid now / 50% still owed
        const half = (currentAmt / 2).toFixed(2);
        setTotalBillInput(currentAmt.toFixed(2));
        setFormData((prev) => ({ ...prev, amount: half }));
        setUnpaidAmountInput(half);
      }
      if (!unpaidContactName && formData.notes.trim()) {
        setUnpaidContactName(formData.notes.trim());
      }
    }
  };

  const handleTotalBillChange = (val: string) => {
    setTotalBillInput(val);
    const total = Number.parseFloat(val);
    const paid = Number.parseFloat(formData.amount) || 0;
    if (Number.isFinite(total) && total > paid) {
      setUnpaidAmountInput((total - paid).toFixed(2));
    } else if (Number.isFinite(total) && total > 0 && paid === 0) {
      const half = (total / 2).toFixed(2);
      setFormData((prev) => ({ ...prev, amount: half }));
      setUnpaidAmountInput(half);
    }
  };

  const handlePaidNowChange = (val: string) => {
    setFormData((prev) => ({ ...prev, amount: val }));
    if (isPartialPayment) {
      const paid = Number.parseFloat(val) || 0;
      const total = Number.parseFloat(totalBillInput) || 0;
      const unpaid = Number.parseFloat(unpaidAmountInput) || 0;
      if (total > paid) {
        setUnpaidAmountInput((total - paid).toFixed(2));
      } else if (unpaid > 0) {
        setTotalBillInput((paid + unpaid).toFixed(2));
      }
    }
  };

  const handleUnpaidAmountChange = (val: string) => {
    setUnpaidAmountInput(val);
    const unpaid = Number.parseFloat(val) || 0;
    const paid = Number.parseFloat(formData.amount) || 0;
    if (paid > 0 || unpaid > 0) {
      setTotalBillInput((paid + unpaid).toFixed(2));
    }
  };

  const applyPartialPreset = (paidRatio: number) => {
    const baseTotal =
      Number.parseFloat(totalBillInput) ||
      (Number.parseFloat(formData.amount) || 0) + (Number.parseFloat(unpaidAmountInput) || 0);
    if (!Number.isFinite(baseTotal) || baseTotal <= 0) return;
    const nextPaid = Number((baseTotal * paidRatio).toFixed(2));
    const nextUnpaid = Number((baseTotal - nextPaid).toFixed(2));
    setTotalBillInput(baseTotal.toFixed(2));
    setFormData((prev) => ({ ...prev, amount: nextPaid.toFixed(2) }));
    setUnpaidAmountInput(nextUnpaid.toFixed(2));
  };

  const totalExpenseAmount = Number.parseFloat(formData.amount) || 0;
  const totalReimbursable = isSplit
    ? splits.reduce((sum, s) => sum + (Number.parseFloat(s.reimbursable_amount) || 0), 0)
    : 0;
  const myNetExpense = Math.max(0, totalExpenseAmount - totalReimbursable);

  const unpaidNumeric = isPartialPayment ? Number.parseFloat(unpaidAmountInput) || 0 : 0;
  const computedTotalBill = totalExpenseAmount + unpaidNumeric;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const amount = Number.parseFloat(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter the amount paid now (must be greater than zero).');
      return;
    }
    if (
      formData.type === 'Transfer' &&
      formData.toWalletId &&
      formData.walletId === formData.toWalletId
    ) {
      setError('Source and destination wallets must be different.');
      return;
    }

    if (isSplit) {
      const validSplits = splits.filter(
        (s) => s.linked_contact_name.trim() || Number.parseFloat(s.reimbursable_amount) > 0
      );
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
          setError(
            `Reimbursable amount for ${s.linked_contact_name || `split #${i + 1}`} must be greater than zero.`
          );
          return;
        }
      }
      if (totalReimbursable > amount) {
        setError(
          `Total reimbursable amount (${totalReimbursable.toFixed(2)} MAD) cannot exceed the amount paid now (${amount.toFixed(2)} MAD).`
        );
        return;
      }
    }

    if (formData.type === 'Expense' && isPartialPayment) {
      const unpaid = Number.parseFloat(unpaidAmountInput);
      if (!Number.isFinite(unpaid) || unpaid <= 0) {
        setError('Please enter the remaining unpaid amount you still owe.');
        return;
      }
      if (!unpaidContactName.trim()) {
        setError('Please enter who you still owe for the remaining unpaid balance.');
        return;
      }
    }

    if (formData.type === 'Loan Received' && !loanContactName.trim()) {
      setError('Enter the person you need to repay.');
      return;
    }

    setLoading(true);
    try {
      const destWallet = (wallets || []).find((w) => w.id === formData.toWalletId);
      const destType = destWallet?.type?.toLowerCase();
      let assignedCategory = formData.category;
      if (formData.type === 'Loan Received') {
        assignedCategory = '🤝 Loan Received';
      } else if (formData.type === 'Transfer') {
        if (destType === 'investment') {
          assignedCategory = '📈 Investments';
        } else if (destType === 'savings') {
          assignedCategory = '🛟 Emergency & goals Fund';
        } else if (
          !assignedCategory ||
          assignedCategory === '📈 Investments' ||
          assignedCategory === '🛟 Emergency & goals Fund'
        ) {
          assignedCategory = '🔄 Transfer';
        }
      }

      const payload = {
        amount,
        type: formData.type === 'Loan Received' ? 'Income' : formData.type,
        walletId: formData.walletId,
        destinationWalletId: formData.type === 'Transfer' ? formData.toWalletId : undefined,
        category: assignedCategory,
        notes: formData.notes,
        transaction_date: formData.transaction_date,
        contextId: formData.contextId || null,
        ...(formData.type === 'Loan Received'
          ? { loan_contact_name: loanContactName.trim() }
          : {}),
        ...(formData.type === 'Expense' && isSplit
          ? {
              splits: splits
                .filter(
                  (s) =>
                    s.linked_contact_name.trim() && Number.parseFloat(s.reimbursable_amount) > 0
                )
                .map((s) => ({
                  id: s.id,
                  reimbursable_amount: Number.parseFloat(s.reimbursable_amount),
                  linked_contact_name: s.linked_contact_name.trim(),
                })),
              reimbursable_amount: totalReimbursable,
              linked_contact_name: splits
                .map((s) => s.linked_contact_name.trim())
                .filter(Boolean)
                .join(', '),
            }
          : formData.type === 'Expense' && !isSplit
          ? {
              splits: [],
              reimbursable_amount: 0,
            }
          : {}),
        ...(formData.type === 'Expense'
          ? {
              unpaid_amount: isPartialPayment ? Number.parseFloat(unpaidAmountInput) || 0 : 0,
              unpaid_contact_name: isPartialPayment ? unpaidContactName.trim() : '',
              unpaid_due_date: isPartialPayment && unpaidDueDate ? unpaidDueDate : undefined,
            }
          : {}),
      };
      const response = await fetch(
        isEditing ? `/api/transactions/${transaction!.id}` : '/api/transactions',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        }
      );
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
        setIsPartialPayment(false);
        setTotalBillInput('');
        setUnpaidAmountInput('');
        setUnpaidContactName('');
        setUnpaidDueDate('');
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
  const activeCategories =
    formData.type === 'Expense' ? expenseCategories : incomeAndTransferCategories;
  const hasLegacyCategory =
    Boolean(formData.category) &&
    !(activeCategories as readonly string[]).includes(formData.category);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg m-auto animate-in zoom-in-95 duration-200">
        <Card className="shadow-2xl border-gray-200 dark:border-gray-700">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <CardTitle>{isEditing ? 'Edit Transaction' : 'Log Transaction'}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel || onSuccess}
              className="h-8 px-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              ✕ Close
            </Button>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {isPayroll ? (
                <p className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 text-xs text-blue-700 dark:text-blue-300">
                  This is a posted payroll. Changing its amount or date also updates the matching
                  payroll entry on the calendar.
                </p>
              ) : (
                isEditing && (
                  <p className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 text-xs text-blue-700 dark:text-blue-300">
                    Transaction type is fixed to keep wallet and debt records consistent. Create a
                    new transaction if the type needs to change.
                  </p>
                )
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {formData.type === 'Expense' && isPartialPayment
                      ? 'Amount Paid Now (MAD)'
                      : 'Amount (MAD)'}
                  </label>
                  <Input
                    required
                    disabled={!isEditable}
                    min="0.01"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(event) => handlePaidNowChange(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    disabled={isEditing || !isEditable}
                    value={formData.type}
                    onChange={(event) => {
                      const type = event.target.value as FormData['type'];
                      setFormData({
                        ...formData,
                        type,
                        category: type === 'Loan Received' ? '🤝 Loan Received' : formData.category,
                      });
                    }}
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                    <option value="Loan Received">Loan received (to repay)</option>
                    <option value="Transfer">Transfer (e.g. ATM)</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Date</label>
                <Input
                  required
                  disabled={!isEditable}
                  type="date"
                  value={formData.transaction_date}
                  onChange={(event) =>
                    setFormData({ ...formData, transaction_date: event.target.value })
                  }
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This date controls your reports, budgets, and trends.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {formData.type === 'Transfer' ? 'From Wallet' : 'Wallet'}
                  </label>
                  <Select
                    disabled={!isEditable || isPayroll}
                    value={formData.walletId}
                    onChange={(event) => {
                      const walletId = event.target.value as FormData['walletId'];
                      setFormData({ ...formData, walletId });
                    }}
                  >
                    <option value="" disabled>
                      Select wallet
                    </option>
                    {(wallets || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {formData.type === 'Transfer' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">To Wallet</label>
                    <Select
                      disabled={!isEditable || isPayroll}
                      value={formData.toWalletId}
                      onChange={(event) => {
                        const nextToId = event.target.value;
                        const dest = (wallets || []).find((w) => w.id === nextToId);
                        const destType = dest?.type?.toLowerCase();
                        let autoCat = '🔄 Transfer';
                        if (destType === 'investment') autoCat = '📈 Investments';
                        else if (destType === 'savings') autoCat = '🛟 Emergency & goals Fund';
                        setFormData({ ...formData, toWalletId: nextToId, category: autoCat });
                      }}
                    >
                      <option value="" disabled>
                        Select destination wallet
                      </option>
                      {(wallets || []).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} {w.type ? `(${w.type})` : ''}
                        </option>
                      ))}
                    </Select>
                    {(() => {
                      const dest = (wallets || []).find((w) => w.id === formData.toWalletId);
                      const destType = dest?.type?.toLowerCase();
                      if (destType === 'investment') {
                        return (
                          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-2 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5 border border-blue-200/60 dark:border-blue-800/40">
                            <span>
                              📈 Auto-categorized as <strong>Investments</strong> (updates your
                              Investments budget &amp; tracking)
                            </span>
                          </div>
                        );
                      }
                      if (destType === 'savings') {
                        return (
                          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-200/60 dark:border-emerald-800/40">
                            <span>
                              🛟 Auto-categorized as <strong>Emergency &amp; goals Fund</strong>{' '}
                              (updates your Savings/Emergency budget)
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select
                      required
                      disabled={!isEditable || isPayroll || isLoanReceived}
                      value={formData.category}
                      onChange={(event) =>
                        setFormData({ ...formData, category: event.target.value })
                      }
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {hasLegacyCategory && (
                        <option value={formData.category}>
                          Legacy category: {formData.category}
                        </option>
                      )}
                      <optgroup label="Expenses">
                        {expenseCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Income & Transfers">
                        {incomeAndTransferCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </optgroup>
                    </Select>
                    {hasLegacyCategory && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        This is a legacy category. Choose one of the fixed categories when you are
                        ready to recategorize it.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {isLoanReceived && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
                  <label className="text-sm font-medium">Who did you borrow from?</label>
                  <Input
                    required
                    disabled={!isEditable}
                    value={loanContactName}
                    onChange={(event) => setLoanContactName(event.target.value)}
                    placeholder="Person or lender name"
                  />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    This records the money in your balance and creates a payable debt to settle
                    later.
                  </p>
                </div>
              )}
              {contexts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Financial Context <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <Select
                    disabled={!isEditable || isPayroll}
                    value={formData.contextId || ''}
                    onChange={(event) =>
                      setFormData({ ...formData, contextId: event.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    {contexts
                      .filter(
                        (c) =>
                          c.status === 'Active' ||
                          c.status === 'Planned' ||
                          formData.contextId === c.id
                      )
                      .map((ctx) => (
                        <option key={ctx.id} value={ctx.id}>
                          {ctx.name} {ctx.status === 'Completed' ? '(Completed)' : ''}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes / Merchant</label>
                <Input
                  disabled={!isEditable || isPayroll}
                  value={formData.notes}
                  onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                  placeholder="Optional details or merchant name"
                />
              </div>

              {formData.type === 'Expense' && (
                <div className="space-y-3">
                  {/* 1. Split / Reimbursable (Others Owe You) */}
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
                          Split / Reimbursable (Others Owe You)
                        </span>
                      </label>
                      {isSplit && (
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          {splits.length} {splits.length === 1 ? 'person' : 'people'}
                        </span>
                      )}
                    </div>

                    {isSplit && (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2.5">
                          {splits.map((split, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-xs"
                            >
                              <div className="flex-1 space-y-1">
                                <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                  Who owes you? (Person #{index + 1})
                                </label>
                                <Input
                                  required
                                  disabled={!isEditable}
                                  value={split.linked_contact_name}
                                  onChange={(e) =>
                                    updateSplit(index, 'linked_contact_name', e.target.value)
                                  }
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
                                  onChange={(e) =>
                                    updateSplit(index, 'reimbursable_amount', e.target.value)
                                  }
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
                            <span>Paid from Wallet:</span>
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
                            <span className="text-gray-800 dark:text-gray-200">
                              Your Share (Net Cost):
                            </span>
                            <span
                              className={
                                totalReimbursable > totalExpenseAmount
                                  ? 'text-red-600'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              {myNetExpense.toFixed(2)} MAD
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Uncompleted / Partial Payment (Paid Part Now — I Still Owe Remainder) */}
                  <div className="space-y-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          disabled={!isEditable}
                          type="checkbox"
                          checked={isPartialPayment}
                          onChange={(event) => handleTogglePartialPayment(event.target.checked)}
                          className="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-amber-600 focus:ring-amber-500 h-4 w-4"
                        />
                        <div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 block leading-tight">
                            Uncompleted / Partial Payment (I Still Owe Part)
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                            Paid half or part now, and still owe the remaining balance
                          </span>
                        </div>
                      </label>
                      {isPartialPayment && (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                    </div>

                    {isPartialPayment && (
                      <div className="space-y-3 pt-1">
                        {/* Quick Split Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
                            <Percent className="w-3 h-3" /> Quick Split:
                          </span>
                          <button
                            type="button"
                            onClick={() => applyPartialPreset(0.5)}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100/60 transition-colors"
                          >
                            Paid 50% (Half) / Owe 50%
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPartialPreset(0.25)}
                            className="text-[11px] font-medium px-2 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors"
                          >
                            Paid 25% / Owe 75%
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPartialPreset(0.75)}
                            className="text-[11px] font-medium px-2 py-1 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 transition-colors"
                          >
                            Paid 75% / Owe 25%
                          </button>
                        </div>

                        {/* Total Bill, Paid Now, Still Owed */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                              Total Bill / Full Cost
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              disabled={!isEditable}
                              value={totalBillInput}
                              onChange={(e) => handleTotalBillChange(e.target.value)}
                              placeholder="0.00"
                              className="h-9 text-sm font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              Paid Now (From Wallet)
                            </label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              disabled={!isEditable}
                              value={formData.amount}
                              onChange={(e) => handlePaidNowChange(e.target.value)}
                              placeholder="0.00"
                              className="h-9 text-sm font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              Still Owed (You Owe)
                            </label>
                            <Input
                              required
                              type="number"
                              step="0.01"
                              min="0.01"
                              disabled={!isEditable}
                              value={unpaidAmountInput}
                              onChange={(e) => handleUnpaidAmountChange(e.target.value)}
                              placeholder="0.00"
                              className="h-9 text-sm font-semibold"
                            />
                          </div>
                        </div>

                        {/* Creditor Name & Optional Due Date */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                              Who do you still owe?
                            </label>
                            <Input
                              required
                              disabled={!isEditable}
                              value={unpaidContactName}
                              onChange={(e) => setUnpaidContactName(e.target.value)}
                              placeholder="Person, merchant, or shop name"
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                              Due Date for Remainder (Optional)
                            </label>
                            <Input
                              type="date"
                              disabled={!isEditable}
                              value={unpaidDueDate}
                              onChange={(e) => setUnpaidDueDate(e.target.value)}
                              className="h-9 text-sm"
                            />
                          </div>
                        </div>

                        {/* Partial Payment Summary Card */}
                        <div className="rounded-lg bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 p-3 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                            <span>Full Purchase / Bill Total:</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {computedTotalBill.toFixed(2)} MAD
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                            <span>Paid Now (Deducted from Wallet):</span>
                            <span className="font-semibold">
                              -{totalExpenseAmount.toFixed(2)} MAD
                            </span>
                          </div>
                          <div className="border-t border-amber-200/70 dark:border-amber-800/50 pt-1.5 flex items-center justify-between font-semibold text-amber-800 dark:text-amber-300">
                            <span>Remaining Balance You Still Owe:</span>
                            <span>
                              {unpaidNumeric.toFixed(2)} MAD
                              {unpaidContactName.trim() ? ` → ${unpaidContactName.trim()}` : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 pt-0.5">
                            Only <strong>{totalExpenseAmount.toFixed(2)} MAD</strong> is deducted from
                            your wallet today, and a <strong>{unpaidNumeric.toFixed(2)} MAD</strong>{' '}
                            Payable debt is automatically tracked in <strong>Debts (You Owe)</strong>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

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
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || isDeleting || !isEditable}
                >
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
