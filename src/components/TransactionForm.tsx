import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';
import { expenseCategories, incomeAndTransferCategories } from '../lib/categories';

export default function TransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'Expense',
    source_wallet: 'Bank',
    category: '',
    notes: '',
  });
  const [isSplit, setIsSplit] = useState(false);
  const [splitData, setSplitData] = useState({
    reimbursable_amount: '',
    linked_contact_name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        reimbursable_amount: isSplit ? parseFloat(splitData.reimbursable_amount) : undefined,
        linked_contact_name: isSplit ? splitData.linked_contact_name : undefined
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        onSuccess();
        setFormData({ amount: '', type: 'Expense', source_wallet: 'Bank', category: '', notes: '' });
        setIsSplit(false);
        setSplitData({ reimbursable_amount: '', linked_contact_name: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="Expense">Expense</option>
                <option value="Income">Income</option>
                <option value="Transfer">Transfer (e.g. ATM)</option>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Wallet</label>
              <Select value={formData.source_wallet} onChange={e => setFormData({...formData, source_wallet: e.target.value})}>
                <option value="Bank">Bank / Card</option>
                <option value="Cash">Physical Cash</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="" disabled>Select category</option>
                <optgroup label="Expenses">
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'Other' ? 'Other Expense' : category}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Income & Transfers">
                  {incomeAndTransferCategories.map((category) => (
                    <option key={category} value={category}>
                      {category === 'Income' ? 'Income / Salary' : category}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Input value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Optional details" />
          </div>

          {formData.type === 'Expense' && (
            <div className="space-y-4 rounded-lg border p-4 bg-gray-50/50">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={isSplit} onChange={e => setIsSplit(e.target.checked)} className="rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
                <span className="text-sm font-medium">Split / Reimbursable (Fronting Money)</span>
              </label>
              
              {isSplit && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reimbursable Amount</label>
                    <Input required={isSplit} type="number" step="0.01" value={splitData.reimbursable_amount} onChange={e => setSplitData({...splitData, reimbursable_amount: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Who Owes You?</label>
                    <Input required={isSplit} value={splitData.linked_contact_name} onChange={e => setSplitData({...splitData, linked_contact_name: e.target.value})} placeholder="Contact name" />
                  </div>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save Transaction'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
