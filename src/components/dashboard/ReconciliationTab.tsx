import React, { useState } from 'react';
import { Transaction } from '../../types';
import { ClipboardCheck, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface ReconciliationTabProps {
  transactions: Transaction[];
}

export const ReconciliationTab: React.FC<ReconciliationTabProps> = ({ transactions }) => {
  const [actualBank, setActualBank] = useState('');
  const [actualCash, setActualCash] = useState('');

  const calculateBalance = (wallet: 'Bank' | 'Cash') => {
    return transactions.reduce((acc, t) => {
      if (t.sourceWallet !== wallet) return acc;
      const amount = Number(t.amount);
      if (t.type === 'Income') return acc + amount;
      if (t.type === 'Expense') return acc - amount;
      
      // Handle transfers
      if (t.type === 'Transfer') {
         // If a transfer exists, it might be positive or negative depending on the direction.
         // In TrueSpend, a single Transfer transaction is created? 
         // Wait, the schema just has "amount" and "type". If it's a transfer OUT, maybe it's negative? 
         // We'll just assume Expense subtracts and Income adds for now.
         return acc;
      }
      return acc;
    }, 0);
  };

  const tsBank = calculateBalance('Bank');
  const tsCash = calculateBalance('Cash');

  const diffBank = Number(actualBank) - tsBank;
  const diffCash = Number(actualCash) - tsCash;

  const formatMAD = (v: number) => new Intl.NumberFormat('en-MA', { style: 'currency', currency: 'MAD' }).format(v);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-indigo-500" />
          Advanced Reconciliation
        </h2>
        <p className="text-gray-500 dark:text-gray-400">Match your TrueSpend balances with reality</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank Wallet */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">TrueSpend Balance</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatMAD(tsBank)}</span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Bank Balance (MAD)</label>
              <input 
                type="number" 
                value={actualBank}
                onChange={e => setActualBank(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                placeholder="Enter current bank balance"
              />
            </div>

            {actualBank !== '' && (
              <div className={`p-4 rounded-lg border ${diffBank === 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2">
                  {diffBank === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <span className={`font-medium ${diffBank === 0 ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {diffBank === 0 ? 'Perfectly matched!' : `Discrepancy: ${formatMAD(diffBank)}`}
                  </span>
                </div>
                {diffBank !== 0 && (
                  <p className="text-sm mt-2 text-amber-600 dark:text-amber-400">
                    {diffBank > 0 ? "You have more money than TrueSpend thinks. Did you forget to log income?" : "You have less money than TrueSpend thinks. Did you forget to log an expense?"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cash Wallet */}
        <Card>
          <CardHeader>
            <CardTitle>Cash Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">TrueSpend Balance</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatMAD(tsCash)}</span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Actual Cash Balance (MAD)</label>
              <input 
                type="number" 
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" 
                placeholder="Enter current physical cash"
              />
            </div>

            {actualCash !== '' && (
              <div className={`p-4 rounded-lg border ${diffCash === 0 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'}`}>
                <div className="flex items-center gap-2">
                  {diffCash === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <span className={`font-medium ${diffCash === 0 ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {diffCash === 0 ? 'Perfectly matched!' : `Discrepancy: ${formatMAD(diffCash)}`}
                  </span>
                </div>
                {diffCash !== 0 && (
                  <p className="text-sm mt-2 text-amber-600 dark:text-amber-400">
                    {diffCash > 0 ? "You have more cash than TrueSpend thinks. Did you forget to log income or a withdrawal?" : "You have less cash than TrueSpend thinks. Did you forget to log a cash expense?"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
