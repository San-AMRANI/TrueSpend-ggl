import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';

export default function DebtForm({ onSuccess }: { onSuccess: () => void }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    contact: '',
    type: 'Receivable',
    due_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/debts', {
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
        })
      });
      if (res.ok) {
        onSuccess();
        setFormData({ amount: '', contact: '', type: 'Receivable', due_date: '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Log Standalone Debt</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-3">
          <div className="w-full sm:w-1/3">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Contact Name</label>
            <Input required value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="Who?" />
          </div>
          <div className="w-full sm:w-1/4">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Amount</label>
            <Input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
          </div>
          <div className="w-full sm:w-1/4">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Due Date</label>
            <Input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
          </div>
          <div className="w-full sm:w-1/4">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Type</label>
            <Select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="Receivable">They Owe Me (Receivable)</option>
              <option value="Payable">I Owe Them (Payable)</option>
            </Select>
          </div>
          <div className="w-full sm:w-auto">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '...' : 'Add Debt'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
