import React, { useMemo, useState } from 'react';
import { FinancialContext, Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import { ArrowLeft, Pencil, Trash, Tag, Landmark, Banknote, Sparkles, Link2, Check } from 'lucide-react';
import { netExpenseOf } from '../../lib/finance';

interface ContextDetailProps {
  context: FinancialContext;
  transactions: Transaction[];
  allTransactions?: Transaction[];
  onBack: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onLinkTransactions?: (transactionIds: string[], contextId: string) => Promise<any>;
}

export const ContextDetail: React.FC<ContextDetailProps> = ({
  context,
  transactions,
  allTransactions = [],
  onBack,
  onEdit,
  onDelete,
  onLinkTransactions,
}) => {
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkingAll, setLinkingAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const matchingUnlinked = useMemo(() => {
    if (!allTransactions?.length || (!context.startDate && !context.endDate)) return [];
    const startStr = context.startDate ? format(new Date(context.startDate), 'yyyy-MM-dd') : null;
    const endStr = context.endDate ? format(new Date(context.endDate), 'yyyy-MM-dd') : null;

    return allTransactions.filter(t => {
      if (t.contextId || dismissedIds.has(t.id)) return false;
      const txDateStr = format(new Date(t.createdAt), 'yyyy-MM-dd');
      if (startStr && endStr) {
        return txDateStr >= startStr && txDateStr <= endStr;
      } else if (startStr) {
        return txDateStr === startStr;
      } else if (endStr) {
        return txDateStr === endStr;
      }
      return false;
    });
  }, [allTransactions, context.startDate, context.endDate, dismissedIds]);

  const handleLinkSingle = async (txId: string) => {
    if (!onLinkTransactions) return;
    setLinkingId(txId);
    try {
      await onLinkTransactions([txId], context.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLinkingId(null);
    }
  };

  const handleLinkAll = async () => {
    if (!onLinkTransactions || matchingUnlinked.length === 0) return;
    setLinkingAll(true);
    try {
      await onLinkTransactions(matchingUnlinked.map(t => t.id), context.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLinkingAll(false);
    }
  };
  const expenses = transactions.filter(t => t.type === 'Expense');
  const refunds = transactions.filter(t => t.type === 'Income');
  
  const spent = expenses.reduce((sum, t) => sum + netExpenseOf(t), 0);
  const refunded = refunds.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netCost = spent - refunded;
  const budget = context.budget ? parseFloat(context.budget) : 0;
  
  const progressPercent = budget > 0 ? Math.min(Math.max((netCost / budget) * 100, 0), 100) : 0;

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach(t => {
      cats[t.category] = (cats[t.category] || 0) + netExpenseOf(t);
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const timeline = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={onBack} className="p-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{context.name}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                context.status === 'Active' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400' :
                context.status === 'Planned' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' :
                'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
              }`}>
                {context.status}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {context.startDate && format(new Date(context.startDate), 'MMM d, yyyy')}
              {context.endDate && ` → ${format(new Date(context.endDate), 'MMM d, yyyy')}`}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={onDelete}>
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Spent</p>
                <p className="text-2xl font-bold">{spent.toLocaleString()} MAD</p>
              </div>
              {refunded > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Refunds</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">+{refunded.toLocaleString()} MAD</p>
                </div>
              )}
            </div>

            {budget > 0 && (
              <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Cost vs Budget</p>
                    <p className="text-xl font-bold">{netCost.toLocaleString()} / <span className="text-gray-500 font-semibold">{budget.toLocaleString()} MAD</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Remaining</p>
                    <p className={`text-lg font-bold ${netCost > budget ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {(budget - netCost).toLocaleString()} MAD
                    </p>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${netCost > budget ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-right text-gray-500 dark:text-gray-400">
                  {((netCost / budget) * 100).toFixed(1)}% used
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-4">
                {categoryBreakdown.map(([cat, amount]) => (
                  <div key={cat} className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{cat}</span>
                    </div>
                    <span className="text-sm font-semibold">{amount.toLocaleString()} MAD</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No expenses yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {matchingUnlinked.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base text-blue-900 dark:text-blue-200">
                  Earlier Transactions Detected ({matchingUnlinked.length})
                </CardTitle>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={linkingAll || Boolean(linkingId)}
                onClick={handleLinkAll}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                {linkingAll ? 'Linking...' : `Link All (${matchingUnlinked.length}) to this Context`}
              </Button>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              These transactions occurred between {context.startDate ? format(new Date(context.startDate), 'MMM d, yyyy') : ''} and {context.endDate ? format(new Date(context.endDate), 'MMM d, yyyy') : ''}. You can link them directly with 1 click without editing manually.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {matchingUnlinked.map(tx => (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/30 gap-3"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${tx.type === 'Expense' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                    {tx.type === 'Expense' ? <Tag className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{tx.notes || tx.category}</p>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-2 mt-0.5">
                      <span>{format(new Date(tx.createdAt), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>{tx.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end space-x-3">
                  <span className={`font-semibold text-sm ${tx.type === 'Expense' ? 'text-gray-900 dark:text-gray-100' : 'text-green-600 dark:text-green-400'}`}>
                    {tx.type === 'Expense' ? '-' : '+'}{parseFloat(tx.amount).toLocaleString()} MAD
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      disabled={linkingId === tx.id || linkingAll}
                      onClick={() => handleLinkSingle(tx.id)}
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      {linkingId === tx.id ? 'Linking...' : 'Link'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={() => setDismissedIds(prev => new Set(prev).add(tx.id))}
                      title="Dismiss suggestion"
                    >
                      Ignore
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length > 0 ? (
            <div className="space-y-4">
              {timeline.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${tx.type === 'Expense' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}>
                      {tx.type === 'Expense' ? <Tag className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.notes || tx.category}</p>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-2 mt-0.5">
                        <span>{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</span>
                        <span>•</span>
                        <span>{tx.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${tx.type === 'Expense' ? 'text-gray-900 dark:text-gray-100' : 'text-green-600 dark:text-green-400'}`}>
                      {tx.type === 'Expense' ? '-' : '+'}{(tx.type === 'Expense' ? netExpenseOf(tx) : parseFloat(tx.amount)).toLocaleString()} MAD
                    </div>
                    {tx.type === 'Expense' && tx.reimbursableAmount && parseFloat(tx.reimbursableAmount) > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        gross {parseFloat(tx.amount).toLocaleString()} • -{parseFloat(tx.reimbursableAmount).toLocaleString()} reimb.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No transactions in this context</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
