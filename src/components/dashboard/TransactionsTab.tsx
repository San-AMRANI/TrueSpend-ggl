import React from 'react';
import { Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowDownRight, ArrowUpRight, RefreshCw, Landmark, Banknote, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionsTabProps {
  transactions: Transaction[];
  handleDeleteTx: (id: string) => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ transactions, handleDeleteTx }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 border-b border-gray-100 pb-4 sm:pb-3 pt-2 sm:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    tx.type === 'Income'
                      ? 'bg-green-100 text-green-600'
                      : tx.type === 'Transfer'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {tx.type === 'Income' ? (
                    <ArrowDownRight className="h-5 w-5" />
                  ) : tx.type === 'Transfer' ? (
                    <RefreshCw className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {tx.category || tx.type}{' '}
                    {tx.notes && <span className="ml-2 font-normal text-gray-500 text-sm">({tx.notes})</span>}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {tx.sourceWallet === 'Bank' ? <Landmark className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}{' '}
                      {tx.sourceWallet}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-12 sm:pl-0">
                <div
                  className={`font-semibold ${
                    tx.type === 'Income' ? 'text-green-600' : tx.type === 'Expense' ? 'text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {tx.type === 'Expense' ? '-' : tx.type === 'Income' ? '+' : ''}
                  {parseFloat(tx.amount).toFixed(2)} MAD
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-600"
                  onClick={() => handleDeleteTx(tx.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">No transactions yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
