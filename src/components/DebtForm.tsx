import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { getApiUrl } from '../lib/capacitorBridge';

export default function DebtForm({ onSuccess }: { onSuccess: () => void }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    contact: '',
    type: 'Receivable',
    due_date: '',
    counterpartyType: 'person',
    interestRateApr: '0',
    rateType: 'zero',
    installmentAmount: '',
    installmentFrequency: 'one_time',
    lateFeeAmount: '0',
    earlySettlementFeePercent: '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apr = parseFloat(formData.interestRateApr) || 0;
      const instAmt = parseFloat(formData.installmentAmount);
      const res = await fetch(getApiUrl('/api/debts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          contact: formData.contact,
          type: formData.type,
          due_date: formData.due_date || undefined,
          counterpartyType: formData.counterpartyType,
          interestRateApr: apr,
          rateType: apr > 0 && formData.rateType === 'zero' ? 'fixed' : formData.rateType,
          installmentAmount: Number.isFinite(instAmt) && instAmt > 0 ? instAmt : undefined,
          installmentFrequency: formData.installmentFrequency,
          lateFeeAmount: parseFloat(formData.lateFeeAmount) || 0,
          earlySettlementFeePercent: parseFloat(formData.earlySettlementFeePercent) || 0,
        })
      });
      if (!res.ok) {
        if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add debt');
      }
      onSuccess();
      setFormData({
        amount: '',
        contact: '',
        type: 'Receivable',
        due_date: '',
        counterpartyType: 'person',
        interestRateApr: '0',
        rateType: 'zero',
        installmentAmount: '',
        installmentFrequency: 'one_time',
        lateFeeAmount: '0',
        earlySettlementFeePercent: '0',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Log Debt, Split, or Institutional Loan</CardTitle>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline mr-16"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>{showAdvanced ? 'Hide APR & Schedule Terms' : 'Add APR %, Installments & Terms'}</span>
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="w-full sm:w-1/3">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Contact / Institution Name</label>
              <Input required value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="Who or which institution?" />
            </div>
            <div className="w-full sm:w-1/4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Principal Amount (MAD)</label>
              <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
            </div>
            <div className="w-full sm:w-1/4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Next Due Date</label>
              <Input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
            </div>
            <div className="w-full sm:w-1/4">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Direction</label>
              <Select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="Receivable">They Owe Me (Receivable)</option>
                <option value="Payable">I Owe Them (Payable)</option>
              </Select>
            </div>
            <div className="w-full sm:w-auto shrink-0">
              <Button type="submit" disabled={loading} className="w-full whitespace-nowrap">
                {loading ? 'Saving...' : 'Add Debt'}
              </Button>
            </div>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 animate-in fade-in duration-150">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Counterparty Type</label>
                <Select value={formData.counterpartyType} onChange={e => setFormData({...formData, counterpartyType: e.target.value})}>
                  <option value="person">Person / Friend</option>
                  <option value="institution">Bank / Institution</option>
                  <option value="merchant">Merchant / BNPL</option>
                  <option value="employer">Employer Advance</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Annual APR (%)</label>
                <Input type="number" step="0.01" min="0" value={formData.interestRateApr} onChange={e => setFormData({...formData, interestRateApr: e.target.value})} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Rate Structure</label>
                <Select value={formData.rateType} onChange={e => setFormData({...formData, rateType: e.target.value})}>
                  <option value="zero">0% Interest-Free</option>
                  <option value="fixed">Fixed APR</option>
                  <option value="variable">Variable APR</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Installment (MAD)</label>
                <Input type="number" step="0.01" min="0" value={formData.installmentAmount} onChange={e => setFormData({...formData, installmentAmount: e.target.value})} placeholder="Optional" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Installment Frequency</label>
                <Select value={formData.installmentFrequency} onChange={e => setFormData({...formData, installmentFrequency: e.target.value})}>
                  <option value="one_time">One-Time / Flexible</option>
                  <option value="monthly">Monthly Amortized</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Early Payoff Fee (%)</label>
                <Input type="number" step="0.1" min="0" value={formData.earlySettlementFeePercent} onChange={e => setFormData({...formData, earlySettlementFeePercent: e.target.value})} placeholder="0.0" />
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

