import React from 'react';
import { KPI } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { getWhatIfAllowance } from '../../lib/finance';
import { Calculator, Wallet } from 'lucide-react';

interface WhatIfTabProps {
  kpis: KPI | null;
  amount: number;
  setAmount: (amount: number) => void;
}

export const WhatIfTab: React.FC<WhatIfTabProps> = ({ kpis, amount, setAmount }) => {
  if (!kpis) return null;
  const result = getWhatIfAllowance(kpis, amount);
  const isCritical = result.dailyRemainingAfterPurchase < 0;
  const isWarning = !isCritical && result.dailyRemainingAfterPurchase <= result.recalculatedDailyAllowance * 0.2;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Calculator className="h-5 w-5" /> What-If Purchase Simulator</h2>
        <p className="mt-1 text-sm text-gray-500">Preview the effect of a purchase without adding a transaction.</p>
      </div>
      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader><CardTitle className="text-base text-yellow-900">Try a purchase</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="what-if-amount">Purchase amount</label>
            <input id="what-if-amount" min="0" type="number" step="0.01" value={amount || ''} onChange={(event) => setAmount(Math.max(0, Number.parseFloat(event.target.value) || 0))} className="w-full rounded-md border border-yellow-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Purchase amount in MAD" />
            <Button type="button" variant="outline" className="border-yellow-200 text-yellow-800 hover:bg-yellow-100" onClick={() => setAmount(0)}>Reset</Button>
          </div>
          {amount > 0 ? (
            <div className="space-y-4">
              <div className={`rounded-lg border p-4 ${isCritical ? 'border-red-200 bg-red-50' : isWarning ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-white'}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">After this purchase</p>
                <p className={`mt-1 text-3xl font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'}`}>{result.dailyRemainingAfterPurchase.toFixed(2)} MAD left today</p>
                <p className="mt-2 text-sm text-gray-600">{isCritical ? 'This would exceed today’s allowance.' : isWarning ? 'This would leave you close to today’s limit.' : 'This purchase stays within today’s allowance.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Liquidity after purchase</p><p className="mt-1 font-semibold text-gray-900">{result.liquidityAfterPurchase.toFixed(2)} MAD</p></div>
                <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Recalculated daily allowance</p><p className="mt-1 font-semibold text-gray-900">{result.recalculatedDailyAllowance.toFixed(2)} MAD</p></div>
                <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Today’s spending after purchase</p><p className="mt-1 font-semibold text-gray-900">{result.todaySpentAfterPurchase.toFixed(2)} MAD</p></div>
              </div>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-500"><Wallet className="mt-0.5 h-4 w-4 shrink-0" />The simulated allowance uses your new liquidity after this purchase, your emergency buffer, and the days remaining until payday. Nothing is saved.</p>
            </div>
          ) : <p className="text-sm text-yellow-800">Enter an amount to calculate a new allowance from the liquidity left after the purchase.</p>}
        </CardContent>
      </Card>
    </div>
  );
};
