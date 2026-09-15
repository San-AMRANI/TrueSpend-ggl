import React, { useState, useMemo } from 'react';
import { Debt } from '../../types';
import DebtForm from '../DebtForm';
import { SettleDebtModal } from '../SettleDebtModal';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { CheckCircle2, ArrowDownRight, ArrowUpRight, Edit2, Trash2, History, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface DebtsTabProps {
  debts: Debt[];
  wallets?: { id: string; name: string }[];
  fetchData: () => void;
  handleSettle: (debtId: string, amount: number, category?: string, walletId?: string) => Promise<void> | void;
  handleEditDebt: (debtId: string, currentAmount: string, currentContact: string, currentType: string) => void;
  handleDeleteDebt: (debtId: string) => void;
}

export const DebtsTab: React.FC<DebtsTabProps> = ({
  debts,
  wallets,
  fetchData,
  handleSettle,
  handleEditDebt,
  handleDeleteDebt,
}) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable' | 'cleared' | 'all'>('receivable');
  const [showAddForm, setShowAddForm] = useState(false);

  const { totalReceivable, totalPayable, filteredDebts } = useMemo(() => {
    const pendingReceivables = debts.filter(d => d.type === 'Receivable' && d.status === 'Pending');
    const pendingPayables = debts.filter(d => d.type === 'Payable' && d.status === 'Pending');

    const totalReceivable = pendingReceivables.reduce((acc, curr) => acc + parseFloat(curr.remainingBalance), 0);
    const totalPayable = pendingPayables.reduce((acc, curr) => acc + parseFloat(curr.remainingBalance), 0);

    const filteredDebts = debts.filter(debt => {
      if (activeTab === 'all') return true;
      if (activeTab === 'receivable') return debt.type === 'Receivable' && debt.status === 'Pending';
      if (activeTab === 'payable') return debt.type === 'Payable' && debt.status === 'Pending';
      if (activeTab === 'cleared') return debt.status === 'Cleared';
      return true;
    });

    return { totalReceivable, totalPayable, filteredDebts };
  }, [debts, activeTab]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-10 pointer-events-none">
            <ArrowDownRight className="w-24 h-24 text-blue-600 dark:text-blue-400" />
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 mb-1">
              <ArrowDownRight className="h-4 w-4" />
              <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wide">Owed to you</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {totalReceivable.toFixed(2)} <span className="text-sm font-normal text-gray-500">MAD</span>
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-10 pointer-events-none">
            <ArrowUpRight className="w-24 h-24 text-orange-600 dark:text-orange-400" />
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 mb-1">
              <ArrowUpRight className="h-4 w-4" />
              <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wide">You owe</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {totalPayable.toFixed(2)} <span className="text-sm font-normal text-gray-500">MAD</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add New Debt Form / Button */}
      {!showAddForm ? (
        <Button onClick={() => setShowAddForm(true)} className="w-full sm:w-auto shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add New Debt or Split
        </Button>
      ) : (
        <div className="relative animate-in fade-in slide-in-from-top-4 duration-200">
          <DebtForm onSuccess={() => { fetchData(); setShowAddForm(false); }} />
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute top-4 right-4 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" 
            onClick={() => setShowAddForm(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Debts List */}
      <Card>
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Debts & IOUs</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your shared expenses and tracking</p>
            </div>
            
            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg w-full sm:w-auto overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setActiveTab('receivable')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                  activeTab === 'receivable' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Owed to You
              </button>
              <button
                onClick={() => setActiveTab('payable')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                  activeTab === 'payable' ? 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                You Owe
              </button>
              <button
                onClick={() => setActiveTab('cleared')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                  activeTab === 'cleared' ? 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Settled
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-all ${
                  activeTab === 'all' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {filteredDebts.length > 0 ? (
              filteredDebts.map((debt) => (
                <div key={debt.id} className="p-4 sm:p-5 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/20 group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          debt.status === 'Cleared'
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                            : debt.type === 'Receivable'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                            : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                        }`}
                      >
                        {debt.status === 'Cleared' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : debt.type === 'Receivable' ? (
                          <ArrowDownRight className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{debt.contactName}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span>{format(new Date(debt.createdAt), 'MMM d, yyyy')}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="font-medium text-gray-600 dark:text-gray-300">
                            {debt.type === 'Receivable' ? 'Owes you' : 'You owe'}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider ${
                            debt.status === 'Pending' 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' 
                              : 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                          }`}>
                            {debt.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-14 sm:pl-0">
                      <div className="text-right">
                        <div className={`font-semibold ${debt.status === 'Cleared' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                          {parseFloat(debt.remainingBalance).toFixed(2)} MAD
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          of {parseFloat(debt.originalAmount).toFixed(2)} MAD total
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {debt.status === 'Pending' && (
                          <Button size="sm" variant="outline" onClick={() => setSettlingDebt(debt)} className="h-8 shadow-sm text-gray-700 dark:text-gray-200">
                            Settle
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                          onClick={() => handleEditDebt(debt.id, debt.originalAmount, debt.contactName, debt.type)}
                          title="Edit Debt"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => handleDeleteDebt(debt.id)}
                          title="Delete Debt"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {debt.settlements && debt.settlements.length > 0 && (
                    <div className="mt-3 pl-14 sm:pl-14">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        <History className="h-3.5 w-3.5" /> 
                        Settlement History
                      </div>
                      <div className="space-y-1.5">
                        {debt.settlements.map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-[11px] sm:text-xs bg-gray-50 dark:bg-gray-800/40 px-3 py-1.5 rounded-md border border-gray-100 dark:border-gray-800/60">
                            <span className="text-gray-500 dark:text-gray-400">{format(new Date(s.createdAt), 'MMM d, yyyy - h:mm a')}</span>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{parseFloat(s.amount).toFixed(2)} MAD</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">No debts found</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px]">
                  {activeTab === 'all' 
                    ? "You don't have any debts or IOUs recorded." 
                    : activeTab === 'receivable' 
                    ? "Nobody owes you anything right now."
                    : activeTab === 'payable'
                    ? "You don't owe anyone anything right now."
                    : "You haven't settled any debts yet."}
                </p>
                {activeTab !== 'all' && (
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('all')} className="mt-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                    View all debts
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SettleDebtModal
        debt={settlingDebt}
        wallets={wallets}
        onClose={() => setSettlingDebt(null)}
        onConfirm={async (debtId, amount, category, walletId) => {
          await handleSettle(debtId, amount, category, walletId);
        }}
      />
    </div>
  );
};
