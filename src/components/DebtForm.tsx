import React, { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  X,
} from 'lucide-react';
import { getApiUrl } from '../lib/capacitorBridge';

export type DebtFormMode = 'lend' | 'borrow' | 'iou';

export interface DebtFormWalletOption {
  id: string;
  name: string;
  type?: string;
  balance?: number;
  isMain?: boolean;
}

interface DebtFormProps {
  onSuccess: () => void;
  onCancel?: () => void;
  wallets?: DebtFormWalletOption[];
  initialMode?: DebtFormMode;
}

const pickDefaultWalletId = (wallets?: DebtFormWalletOption[]) => {
  if (!wallets || wallets.length === 0) return '';
  return (
    wallets.find((w) => w.isMain)?.id ||
    wallets.find((w) => w.type === 'Cash')?.id ||
    wallets.find((w) => w.type === 'Bank')?.id ||
    wallets[0].id
  );
};

export default function DebtForm({
  onSuccess,
  onCancel,
  wallets = [],
  initialMode = 'lend',
}: DebtFormProps) {
  const { token } = useAuth();
  const [mode, setMode] = useState<DebtFormMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    contact: '',
    type: (initialMode === 'borrow' ? 'Payable' : 'Receivable') as 'Receivable' | 'Payable',
    walletId: pickDefaultWalletId(wallets),
    loanDate: new Date().toISOString().slice(0, 10),
    due_date: '',
    note: '',
    counterpartyType: 'person',
    interestRateApr: '0',
    rateType: 'zero',
    installmentAmount: '',
    installmentFrequency: 'one_time',
    lateFeeAmount: '0',
    earlySettlementFeePercent: '0',
  });

  useEffect(() => {
    setMode(initialMode);
    setFormData((prev) => ({
      ...prev,
      type: initialMode === 'borrow' ? 'Payable' : 'Receivable',
      walletId: prev.walletId || pickDefaultWalletId(wallets),
    }));
  }, [initialMode, wallets]);

  const handleModeChange = (nextMode: DebtFormMode) => {
    setMode(nextMode);
    setError('');
    setFormData((prev) => ({
      ...prev,
      type: nextMode === 'borrow' ? 'Payable' : nextMode === 'lend' ? 'Receivable' : prev.type,
      walletId: prev.walletId || pickDefaultWalletId(wallets),
    }));
  };

  const recordWalletMovement = mode === 'lend' || mode === 'borrow';
  const effectiveType: 'Receivable' | 'Payable' =
    mode === 'lend' ? 'Receivable' : mode === 'borrow' ? 'Payable' : formData.type;

  const selectedWallet = wallets.find((w) => w.id === formData.walletId);
  const amountNum = Number.parseFloat(formData.amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!formData.contact.trim()) {
      setError('Enter the person or institution name.');
      return;
    }
    if (recordWalletMovement && !formData.walletId) {
      setError('Select the wallet where this money left or entered.');
      return;
    }

    setLoading(true);
    try {
      const apr = Number.parseFloat(formData.interestRateApr) || 0;
      const instAmt = Number.parseFloat(formData.installmentAmount);
      const res = await fetch(getApiUrl('/api/debts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountNum,
          contact: formData.contact.trim(),
          type: effectiveType,
          recordWalletMovement,
          walletId: recordWalletMovement ? formData.walletId : undefined,
          loanDate: formData.loanDate || undefined,
          due_date: formData.due_date || undefined,
          note: formData.note.trim() || undefined,
          counterpartyType: formData.counterpartyType,
          interestRateApr: apr,
          rateType: apr > 0 && formData.rateType === 'zero' ? 'fixed' : formData.rateType,
          installmentAmount: Number.isFinite(instAmt) && instAmt > 0 ? instAmt : undefined,
          installmentFrequency: formData.installmentFrequency,
          feesAmount: Number.parseFloat(formData.lateFeeAmount) || 0,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to record loan or debt');
      }

      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message:
              mode === 'lend'
                ? `Lent ${amountNum.toFixed(2)} MAD to ${formData.contact.trim()} — wallet & receivable updated.`
                : mode === 'borrow'
                ? `Borrowed ${amountNum.toFixed(2)} MAD from ${formData.contact.trim()} — wallet & payable updated.`
                : `Recorded ${amountNum.toFixed(2)} MAD ${effectiveType.toLowerCase()} with ${formData.contact.trim()}.`,
            type: 'success',
          },
        })
      );

      onSuccess();
      setFormData({
        amount: '',
        contact: '',
        type: mode === 'borrow' ? 'Payable' : 'Receivable',
        walletId: pickDefaultWalletId(wallets),
        loanDate: new Date().toISOString().slice(0, 10),
        due_date: '',
        note: '',
        counterpartyType: 'person',
        interestRateApr: '0',
        rateType: 'zero',
        installmentAmount: '',
        installmentFrequency: 'one_time',
        lateFeeAmount: '0',
        earlySettlementFeePercent: '0',
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to save record. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6 border-gray-200 dark:border-gray-800">
      <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'lend'
              ? 'Lend Money (Loan Given)'
              : mode === 'borrow'
              ? 'Borrow Money (Loan Received)'
              : 'Track Existing Balance / IOU'}
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {mode === 'lend'
              ? 'Deducts cash from your selected wallet and tracks what they owe you — without counting as spending.'
              : mode === 'borrow'
              ? 'Adds borrowed money into your selected wallet and creates a payable balance to repay.'
              : 'Logs an existing debt or IOU balance without changing your current wallet cash.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{showAdvanced ? 'Hide Terms' : 'APR & Terms'}</span>
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 px-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-900 p-1">
            {([
              {
                id: 'lend' as const,
                label: 'Lend Money',
                icon: ArrowUpRight,
                activeClass:
                  'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-xs',
              },
              {
                id: 'borrow' as const,
                label: 'Borrow Money',
                icon: ArrowDownLeft,
                activeClass:
                  'bg-white dark:bg-gray-800 text-orange-700 dark:text-orange-400 shadow-xs',
              },
              {
                id: 'iou' as const,
                label: 'Existing IOU',
                icon: FileText,
                activeClass:
                  'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs',
              },
            ]).map((item) => {
              const Icon = item.icon;
              const isActive = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModeChange(item.id)}
                  className={`flex items-center justify-center gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? item.activeClass
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Core Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                {mode === 'lend'
                  ? 'Who did you lend to?'
                  : mode === 'borrow'
                  ? 'Who did you borrow from?'
                  : 'Contact / Institution Name'}
              </label>
              <Input
                required
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder={mode === 'lend' ? 'e.g. Brother, Youssef' : 'Person or institution'}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                Amount (MAD)
              </label>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                className="font-mono tabular-nums"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="200.00"
              />
            </div>

            {recordWalletMovement ? (
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  {mode === 'lend' ? 'Deduct From Wallet' : 'Deposit Into Wallet'}
                </label>
                <Select
                  required
                  value={formData.walletId}
                  onChange={(e) => setFormData({ ...formData, walletId: e.target.value })}
                >
                  <option value="" disabled>
                    Select wallet
                  </option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {typeof w.balance === 'number' ? ` (${w.balance.toFixed(0)} MAD)` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                  Direction
                </label>
                <Select
                  required
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as 'Receivable' | 'Payable',
                    })
                  }
                >
                  <option value="Receivable">They Owe Me (Receivable)</option>
                  <option value="Payable">I Owe Them (Payable)</option>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                Expected Repayment Date
              </label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Secondary Row: Loan Date, Note, and Submit */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                {mode === 'lend' ? 'Date Given' : mode === 'borrow' ? 'Date Received' : 'Date'}
              </label>
              <Input
                type="date"
                value={formData.loanDate}
                onChange={(e) => setFormData({ ...formData, loanDate: e.target.value })}
              />
            </div>
            <div className="sm:col-span-6">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
                Note / Reason <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <Input
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder={
                  mode === 'lend'
                    ? 'e.g. Personal loan for brother'
                    : 'e.g. Short-term cash advance'
                }
              />
            </div>
            <div className="sm:col-span-3">
              <Button
                type="submit"
                disabled={loading}
                className={`w-full whitespace-nowrap min-h-[40px] ${
                  mode === 'lend'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : mode === 'borrow'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : ''
                }`}
              >
                {loading
                  ? 'Saving…'
                  : mode === 'lend'
                  ? 'Record Loan Given'
                  : mode === 'borrow'
                  ? 'Record Loan Received'
                  : 'Add Debt Record'}
              </Button>
            </div>
          </div>

          {/* Live Inline Accounting Impact Preview */}
          {amountNum > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
              {mode === 'lend' ? (
                <span>
                  Deducts{' '}
                  <strong className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                    -{amountNum.toFixed(2)} MAD
                  </strong>{' '}
                  from <strong>{selectedWallet?.name || 'selected wallet'}</strong> · Tracks{' '}
                  <strong className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
                    +{amountNum.toFixed(2)} MAD
                  </strong>{' '}
                  owed by <strong>{formData.contact.trim() || 'contact'}</strong> ·{' '}
                  <span className="font-mono tabular-nums">0.00 MAD</span> counted as personal spending
                </span>
              ) : mode === 'borrow' ? (
                <span>
                  Adds{' '}
                  <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    +{amountNum.toFixed(2)} MAD
                  </strong>{' '}
                  to <strong>{selectedWallet?.name || 'selected wallet'}</strong> · Tracks{' '}
                  <strong className="font-mono tabular-nums text-orange-700 dark:text-orange-400">
                    {amountNum.toFixed(2)} MAD
                  </strong>{' '}
                  owed to <strong>{formData.contact.trim() || 'lender'}</strong>
                </span>
              ) : (
                <span>
                  Logs{' '}
                  <strong className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                    {amountNum.toFixed(2)} MAD
                  </strong>{' '}
                  ({effectiveType === 'Receivable' ? 'owed to you' : 'you owe'}) without changing wallet balances.
                </span>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-150">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Counterparty Type
                </label>
                <Select
                  value={formData.counterpartyType}
                  onChange={(e) => setFormData({ ...formData, counterpartyType: e.target.value })}
                >
                  <option value="person">Person / Family</option>
                  <option value="institution">Bank / Institution</option>
                  <option value="merchant">Merchant / BNPL</option>
                  <option value="employer">Employer Advance</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Annual APR (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.interestRateApr}
                  onChange={(e) => setFormData({ ...formData, interestRateApr: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Rate Structure
                </label>
                <Select
                  value={formData.rateType}
                  onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
                >
                  <option value="zero">0% Interest-Free</option>
                  <option value="fixed">Fixed APR</option>
                  <option value="variable">Variable APR</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Installment (MAD)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.installmentAmount}
                  onChange={(e) => setFormData({ ...formData, installmentAmount: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Installment Frequency
                </label>
                <Select
                  value={formData.installmentFrequency}
                  onChange={(e) =>
                    setFormData({ ...formData, installmentFrequency: e.target.value })
                  }
                >
                  <option value="one_time">One-Time / Flexible</option>
                  <option value="monthly">Monthly Amortized</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  Fees (MAD)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.lateFeeAmount}
                  onChange={(e) => setFormData({ ...formData, lateFeeAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
