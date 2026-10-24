import React, { useState, useMemo } from 'react';
import { Debt, CategoryBudget, DashboardTab } from '../../types';
import DebtForm from '../DebtForm';
import { SettleDebtModal } from '../SettleDebtModal';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CheckCircle2, ArrowDownRight, ArrowUpRight, Edit2, Trash2, History, Plus, Zap, AlertTriangle, ExternalLink, X, Calculator } from 'lucide-react';
import { format } from 'date-fns';

interface DebtsTabProps {
  debts: Debt[];
  wallets?: { id: string; name: string }[];
  budgets?: CategoryBudget[];
  fetchData: () => void;
  handleSettle: (debtId: string, amount: number, category?: string, walletId?: string) => Promise<void> | void;
  handleEditDebt: (debtId: string, currentAmount: string, currentContact: string, currentType: string) => void;
  handleDeleteDebt: (debtId: string) => void;
  onSaveBudget?: (category: string, year: number, month: number, amount: number) => Promise<void>;
  setActiveTab?: (tab: DashboardTab) => void;
}

export const DebtsTab: React.FC<DebtsTabProps> = ({
  debts,
  wallets,
  budgets = [],
  fetchData,
  handleSettle,
  handleEditDebt,
  handleDeleteDebt,
  onSaveBudget,
  setActiveTab: setDashboardTab,
}) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editContact, setEditContact] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'Receivable' | 'Payable'>('Receivable');
  const [isUpdatingDebt, setIsUpdatingDebt] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable' | 'cleared' | 'all'>('receivable');
  const [showAddForm, setShowAddForm] = useState(false);
  const [reservingInBudget, setReservingInBudget] = useState(false);
  const [budgetSuccessMsg, setBudgetSuccessMsg] = useState<string | null>(null);

  const openEditModal = (debt: Debt) => {
    setEditingDebt(debt);
    setEditContact(debt.contactName);
    setEditAmount(debt.originalAmount);
    setEditType(debt.type);
  };

  const submitEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    setIsUpdatingDebt(true);
    try {
      await handleEditDebt(editingDebt.id, editAmount, editContact.trim(), editType);
      setEditingDebt(null);
    } finally {
      setIsUpdatingDebt(false);
    }
  };

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

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const currentDebtBudget = useMemo(() => {
    const b = (budgets || []).find(
      (item) => item.category === '💳 Debt & Obligations' && item.year === currentYear && item.month === currentMonth
    );
    return b ? parseFloat(b.amount) || 0 : 0;
  }, [budgets, currentYear, currentMonth]);

  const targetMonthlyDebtPayoff = useMemo(() => {
    if (totalPayable <= 0) return 0;
    if (totalPayable <= 1000) return totalPayable;
    return Math.min(totalPayable, Math.max(300, Math.round(totalPayable * 0.1)));
  }, [totalPayable]);

  const isBudgetReserved = totalPayable > 0 && currentDebtBudget >= targetMonthlyDebtPayoff;

  const handleQuickReserveInBudget = async () => {
    if (!onSaveBudget || targetMonthlyDebtPayoff <= 0) return;
    setReservingInBudget(true);
    try {
      await onSaveBudget('💳 Debt & Obligations', currentYear, currentMonth, targetMonthlyDebtPayoff);
      setBudgetSuccessMsg(`Reserved ${targetMonthlyDebtPayoff.toFixed(2)} MAD for debt repayment in this month's budget!`);
      setTimeout(() => setBudgetSuccessMsg(null), 4000);
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Failed to update budget');
    } finally {
      setReservingInBudget(false);
    }
  };

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

      {/* ── Interconnected Monthly Budget Sync & Protection ── */}
      {budgetSuccessMsg && (
        <div className="rounded-xl bg-emerald-600 text-white p-3 text-xs font-semibold flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{budgetSuccessMsg}</span>
        </div>
      )}

      {totalPayable > 0 && (
        <Card className={`border overflow-hidden shadow-xs transition-all ${
          isBudgetReserved
            ? 'border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/60 via-white to-white dark:from-emerald-950/20 dark:via-gray-900 dark:to-gray-900'
            : 'border-orange-200 dark:border-orange-900/50 bg-gradient-to-r from-orange-50/60 via-white to-white dark:from-orange-950/20 dark:via-gray-900 dark:to-gray-900'
        }`}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                  isBudgetReserved
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300'
                }`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      Monthly Budget Debt Reserve
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isBudgetReserved
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                    }`}>
                      {isBudgetReserved ? 'Fully Reserved' : 'Unreserved Gap'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
                    {isBudgetReserved ? (
                      <>Your monthly budget has safely reserved <strong>{currentDebtBudget.toFixed(2)} MAD</strong> this cycle for debt servicing. Your payoff strategy is protected.</>
                    ) : (
                      <>You owe <strong>{totalPayable.toFixed(2)} MAD</strong>, but your budget currently reserves <strong>{currentDebtBudget.toFixed(2)} MAD</strong> (target: <strong>{targetMonthlyDebtPayoff.toFixed(2)} MAD</strong>). Reserve cash in your budget to prevent overspending discretionary money.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                {!isBudgetReserved && onSaveBudget && (
                  <Button
                    size="sm"
                    disabled={reservingInBudget}
                    onClick={handleQuickReserveInBudget}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 shadow-xs flex items-center gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{reservingInBudget ? 'Reserving…' : `Reserve ${targetMonthlyDebtPayoff.toFixed(0)} MAD in Budget`}</span>
                  </Button>
                )}
                {setDashboardTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDashboardTab('budgets')}
                    className="text-xs h-8"
                  >
                    <span>Budget Planner</span>
                    <ExternalLink className="h-3 w-3 ml-1 text-gray-400" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                          onClick={() => openEditModal(debt)}
                          title="Edit Debt"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => setDeletingDebt(debt)}
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

      {/* Edit Debt Modal */}
      {editingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Edit Debt Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingDebt(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitEditDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact / Counterparty Name
                </label>
                <Input
                  type="text"
                  required
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Original Amount (MAD)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Debt Direction
                </label>
                <Select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as 'Receivable' | 'Payable')}
                >
                  <option value="Receivable">Owed to You (Receivable)</option>
                  <option value="Payable">You Owe (Payable)</option>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingDebt(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isUpdatingDebt}>
                  {isUpdatingDebt ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Debt Confirmation Modal */}
      {deletingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Delete Debt with {deletingDebt.contactName}?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This will remove the {parseFloat(deletingDebt.remainingBalance).toFixed(2)} MAD {deletingDebt.type.toLowerCase()} record.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingDebt(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  const id = deletingDebt.id;
                  setDeletingDebt(null);
                  await handleDeleteDebt(id);
                }}
              >
                Delete Record
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
