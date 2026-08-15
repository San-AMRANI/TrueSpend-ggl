import React, { useState, useEffect } from 'react';
import { Debt } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { expenseCategories, incomeAndTransferCategories } from '../lib/categories';

interface SettleDebtModalProps {
  debt: Debt | null;
  onClose: () => void;
  onConfirm: (debtId: string, amount: number, category?: string) => Promise<void>;
}

export const SettleDebtModal: React.FC<SettleDebtModalProps> = ({ debt, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (debt) {
      setAmount(debt.remainingBalance);
      const defaultCat = debt.type === 'Receivable' ? 'Reimbursement' : 'Debt Repayment';
      setCategory(defaultCat);
      setError('');
    }
  }, [debt]);

  if (!debt) return null;

  const defaultCategoryLabel = debt.type === 'Receivable' ? 'Reimbursement' : 'Debt Repayment';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    const remaining = parseFloat(debt.remainingBalance);

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }
    if (numAmount > remaining + 0.001) {
      setError(`Settlement amount cannot exceed remaining balance (${remaining.toFixed(2)} MAD)`);
      return;
    }

    setLoading(true);
    try {
      await onConfirm(debt.id, numAmount, category || defaultCategoryLabel);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to settle debt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md bg-white shadow-xl">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-base font-semibold">
            Settle Debt: {debt.contactName}
          </CardTitle>
          <p className="text-xs text-gray-500">
            {debt.type === 'Receivable' ? 'Money owed to you' : 'Money you owe'} · Remaining: {parseFloat(debt.remainingBalance).toFixed(2)} MAD
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Settlement Amount (MAD)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={debt.remainingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">
                Transaction Category
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value={defaultCategoryLabel}>Default ({defaultCategoryLabel})</option>
                {debt.type === 'Payable' ? (
                  <>
                    <optgroup label="Expense Categories">
                      {expenseCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Income & Transfers">
                      {incomeAndTransferCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  <>
                    <optgroup label="Income & Transfers">
                      {incomeAndTransferCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Expense Categories">
                      {expenseCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                A transaction will be logged with this category for budget and report tracking.
              </p>
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? 'Settling...' : 'Confirm Settlement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
