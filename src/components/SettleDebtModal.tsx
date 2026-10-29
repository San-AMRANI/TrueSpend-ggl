import React, { useState, useEffect } from 'react';
import { Debt } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { expenseCategories, incomeAndTransferCategories } from '../lib/categories';
import { Banknote, HeartHandshake, ShieldCheck } from 'lucide-react';

interface SettleDebtModalProps {
  debt: Debt | null;
  initialMode?: 'settle' | 'forgive';
  onClose: () => void;
  onConfirm: (debtId: string, amount: number, category?: string, walletId?: string) => Promise<void>;
  onForgive?: (debtId: string, amount: number, reason?: string, note?: string) => Promise<void>;
  wallets?: { id: string; name: string }[];
}

const FORGIVENESS_REASONS = [
  'Did me a favor / Mutual exchange',
  'Gave it up / Forgiven',
  'Gift / Treated them',
  'Offset against shared bill',
];

export const SettleDebtModal: React.FC<SettleDebtModalProps> = ({
  debt,
  initialMode = 'settle',
  onClose,
  onConfirm,
  onForgive,
  wallets,
}) => {
  const [mode, setMode] = useState<'settle' | 'forgive'>(initialMode);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [wallet, setWallet] = useState<string>(wallets?.[0]?.id || '');
  const [forgiveReason, setForgiveReason] = useState<string>(FORGIVENESS_REASONS[0]);
  const [forgiveNote, setForgiveNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (debt) {
      setMode(initialMode);
      setAmount(debt.remainingBalance);
      const defaultCat = debt.type === 'Receivable' ? 'Reimbursement' : 'Debt Repayment';
      setCategory(defaultCat);
      setWallet(wallets?.[0]?.id || '');
      setForgiveReason(FORGIVENESS_REASONS[0]);
      setForgiveNote('');
      setError('');
    }
  }, [debt, wallets, initialMode]);

  if (!debt) return null;

  const remaining = parseFloat(debt.remainingBalance) || 0;
  const defaultCategoryLabel = debt.type === 'Receivable' ? 'Reimbursement' : 'Debt Repayment';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Please enter an amount greater than 0');
      return;
    }
    if (numAmount > remaining + 0.001) {
      setError(`Amount cannot exceed remaining balance (${remaining.toFixed(2)} MAD)`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'forgive') {
        if (!onForgive) {
          throw new Error('Debt forgiveness handler is not available.');
        }
        await onForgive(debt.id, numAmount, forgiveReason, forgiveNote.trim() || undefined);
      } else {
        await onConfirm(debt.id, numAmount, category || defaultCategoryLabel, wallet);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || (mode === 'forgive' ? 'Failed to forgive debt.' : 'Failed to settle debt.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <Card className="w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
          <CardTitle className="text-base font-semibold">
            {mode === 'forgive' ? `Free / Forgive Debt: ${debt.contactName}` : `Settle Debt: ${debt.contactName}`}
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {debt.type === 'Receivable' ? 'Money owed to you' : 'Money you owe'} · Remaining:{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {remaining.toFixed(2)} MAD
            </span>
          </p>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Segmented Mode Selector: Cash Settlement vs Free Debt */}
          {onForgive && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => {
                  setMode('settle');
                  setError('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'settle'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Wallet Settlement</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgive');
                  setError('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  mode === 'forgive'
                    ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Free Debt (Waive)</span>
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount + Quick Full/Half Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {mode === 'forgive' ? 'Amount to Free / Waive (MAD)' : 'Settlement Amount (MAD)'}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAmount((remaining / 2).toFixed(2))}
                    className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    50% ({(remaining / 2).toFixed(0)} MAD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(remaining.toFixed(2))}
                    className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                  >
                    Full ({remaining.toFixed(0)} MAD)
                  </button>
                </div>
              </div>
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

            {mode === 'forgive' ? (
              <>
                <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>No Reimbursement or Wallet Impact</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                    {debt.type === 'Receivable'
                      ? `Freeing this debt clears ${parseFloat(amount || '0').toFixed(2)} MAD owed by ${debt.contactName} without logging fake Reimbursement income or changing your wallet balance.`
                      : `Freeing this debt clears ${parseFloat(amount || '0').toFixed(2)} MAD you owed to ${debt.contactName} without deducting any money from your wallets.`}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Reason for Freeing Debt
                  </label>
                  <Select value={forgiveReason} onChange={(e) => setForgiveReason(e.target.value)}>
                    {FORGIVENESS_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Optional Note
                  </label>
                  <Input
                    type="text"
                    value={forgiveNote}
                    onChange={(e) => setForgiveNote(e.target.value)}
                    placeholder="e.g. Did me a favor, covered dinner instead..."
                  />
                </div>
              </>
            ) : (
              <>
                {/* Wallet */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Wallet
                  </label>
                  <Select value={wallet} onChange={(e) => setWallet(e.target.value)}>
                    {(wallets || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {debt.type === 'Receivable'
                      ? 'Which wallet will receive this reimbursement?'
                      : 'Which wallet are you paying from?'}
                  </p>
                </div>

                {/* Category */}
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Transaction Category
                  </label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)}>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    A wallet transaction will be logged with this category.
                  </p>
                </div>
              </>
            )}

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className={
                  mode === 'forgive'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : ''
                }
              >
                {loading
                  ? mode === 'forgive'
                    ? 'Freeing Debt...'
                    : 'Settling...'
                  : mode === 'forgive'
                  ? 'Confirm Free Debt'
                  : 'Confirm Settlement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
