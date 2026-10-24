import React, { useState } from 'react';
import { Landmark, Banknote, Wallet as WalletIcon, Plus, Edit2, Trash2, Star, Check, AlertCircle, X, TrendingUp, Repeat, ShieldAlert, ChevronDown, ChevronUp, Zap, Scale, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Wallet, Subscription, Debt, InvestmentsData } from '../../types';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';

interface WalletsManagerProps {
  wallets: Wallet[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  investmentsData?: InvestmentsData | null;
  onOpenInvestments?: () => void;
  onPaySubscription?: (id: string, payload?: { walletId?: string; date?: string }) => Promise<any>;
  onCreateWallet: (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  onUpdateWallet: (id: string, payload: { name?: string; type?: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  onDeleteWallet: (id: string, reassignToWalletId?: string) => Promise<any>;
  onClose?: () => void;
  isModal?: boolean;
}

export const WalletsManager: React.FC<WalletsManagerProps> = ({
  wallets,
  subscriptions = [],
  debts = [],
  investmentsData = null,
  onOpenInvestments,
  onPaySubscription,
  onCreateWallet,
  onUpdateWallet,
  onDeleteWallet,
  onClose,
  isModal = false,
}) => {
  const { token } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [reconcilingWallet, setReconcilingWallet] = useState<Wallet | null>(null);
  const [actualStatementBalance, setActualStatementBalance] = useState<string>('');
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [expandedWalletBills, setExpandedWalletBills] = useState<Record<string, boolean>>({});
  const [payingSubId, setPayingSubId] = useState<string | null>(null);

  // Form states for create/edit
  const [formData, setFormData] = useState({
    name: '',
    type: 'Bank' as 'Bank' | 'Cash' | 'Savings' | 'Investment',
    initialBalance: '',
    isMain: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReconcileForm = (wallet: Wallet) => {
    setShowAddForm(false);
    setEditingWallet(null);
    setReconcilingWallet(wallet);
    setActualStatementBalance((wallet.balance ?? 0).toFixed(2));
    setError(null);
  };

  const handleResolveReconciliation = async (mode: 'adjust_baseline' | 'log_transaction') => {
    if (!reconcilingWallet) return;
    const actual = parseFloat(actualStatementBalance);
    if (!Number.isFinite(actual)) {
      setError('Please enter a valid actual balance.');
      return;
    }
    const recorded = reconcilingWallet.balance ?? 0;
    const diff = Number((actual - recorded).toFixed(2));
    if (Math.abs(diff) < 0.01) {
      setReconcilingWallet(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'adjust_baseline') {
        const currentInit = parseFloat(reconcilingWallet.initialBalance || '0') || 0;
        const nextInit = Number((currentInit + diff).toFixed(2));
        await onUpdateWallet(reconcilingWallet.id, { initialBalance: nextInit });
        setReconcileNotice(
          `Reconciled ${reconcilingWallet.name} to ${actual.toFixed(2)} MAD via baseline adjustment (${diff >= 0 ? '+' : ''}${diff.toFixed(2)} MAD).`
        );
      } else {
        await dashboardService.createTransaction(
          {
            amount: Math.abs(diff),
            type: diff > 0 ? 'Income' : 'Expense',
            walletId: reconcilingWallet.id,
            category: diff > 0 ? '📥 Income' : '⚠️ Unexpected',
            notes: `Account Reconciliation Adjustment (${reconcilingWallet.name})`,
            transaction_date: new Date().toISOString().slice(0, 10),
          },
          token
        );
        // Trigger parent refresh by touching wallet update with existing name
        await onUpdateWallet(reconcilingWallet.id, { name: reconcilingWallet.name });
        setReconcileNotice(
          `Logged ${Math.abs(diff).toFixed(2)} MAD ${diff > 0 ? 'Income' : 'Expense'} reconciliation adjustment for ${reconcilingWallet.name}.`
        );
      }
      setReconcilingWallet(null);
      setTimeout(() => setReconcileNotice(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile wallet balance');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingWallet(null);
    setFormData({
      name: '',
      type: 'Bank',
      initialBalance: '0',
      isMain: wallets.length === 0,
    });
    setError(null);
    setShowAddForm(true);
  };

  const openEditForm = (wallet: Wallet) => {
    setShowAddForm(false);
    setEditingWallet(wallet);
    setFormData({
      name: wallet.name,
      type: wallet.type,
      initialBalance: wallet.initialBalance || '0',
      isMain: wallet.isMain,
    });
    setError(null);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingWallet(null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setError('Please enter a wallet name');
      return;
    }

    setLoading(true);
    try {
      if (editingWallet) {
        await onUpdateWallet(editingWallet.id, {
          name: trimmedName,
          type: formData.type,
          initialBalance: parseFloat(formData.initialBalance) || 0,
          isMain: formData.isMain,
        });
      } else {
        await onCreateWallet({
          name: trimmedName,
          type: formData.type,
          initialBalance: parseFloat(formData.initialBalance) || 0,
          isMain: formData.isMain,
        });
      }
      closeForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeMain = async (wallet: Wallet) => {
    if (wallet.isMain) return;
    setLoading(true);
    try {
      await onUpdateWallet(wallet.id, { isMain: true });
    } catch (err: any) {
      setError(err.message || 'Failed to update primary wallet');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (wallet: Wallet) => {
    if (wallets.length <= 1) {
      setError('You must have at least one wallet. Cannot delete your only wallet.');
      return;
    }
    const otherWallets = wallets.filter(w => w.id !== wallet.id);
    setDeletingWallet(wallet);
    setReassignTargetId(otherWallets[0]?.id || '');
    setError(null);
  };

  const confirmDelete = async () => {
    if (!deletingWallet) return;
    setLoading(true);
    setError(null);
    try {
      await onDeleteWallet(deletingWallet.id, reassignTargetId);
      setDeletingWallet(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete wallet');
    } finally {
      setLoading(false);
    }
  };

  const getWalletIcon = (type: string) => {
    switch (type) {
      case 'Bank':
        return <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'Cash':
        return <Banknote className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'Savings':
        return <WalletIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      case 'Investment':
        return <TrendingUp className="h-5 w-5 text-amber-500 dark:text-amber-400" />;
      default:
        return <WalletIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <WalletIcon className="h-5 w-5 text-indigo-500" />
            Manage Wallets & Accounts
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and customize your bank accounts, physical cash reserves, and savings pockets.
          </p>
        </div>
        {!showAddForm && !editingWallet && (
          <Button
            type="button"
            onClick={openAddForm}
            className="flex items-center gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Wallet
          </Button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(showAddForm || editingWallet) && (
        <form onSubmit={handleSave} className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editingWallet ? `Edit Wallet: ${editingWallet.name}` : 'Create New Wallet'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Wallet Name</label>
              <Input
                required
                type="text"
                placeholder="e.g. BMCE Checking, Pocket Cash, Safe Box"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white dark:bg-gray-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Wallet Type</label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="bg-white dark:bg-gray-800"
              >
                <option value="Bank">Bank Account</option>
                <option value="Cash">Physical Cash</option>
                <option value="Savings">Savings / Emergency</option>
                <option value="Investment">Brokerage / Investment / Crypto</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Starting / Initial Balance (MAD)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.initialBalance}
                onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                className="bg-white dark:bg-gray-800"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                The baseline balance before recorded transactions.
              </p>
            </div>

            <div className="flex items-center sm:pt-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={formData.isMain}
                  onChange={(e) => setFormData({ ...formData, isMain: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">Set as primary default wallet</span>
              </label>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">
              {loading ? 'Saving...' : editingWallet ? 'Update Wallet' : 'Create Wallet'}
            </Button>
          </div>
        </form>
      )}

      {reconcileNotice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{reconcileNotice}</span>
          </div>
          <button type="button" onClick={() => setReconcileNotice(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Account Reconciliation Panel */}
      {reconcilingWallet && (() => {
        const recorded = reconcilingWallet.balance ?? 0;
        const actual = parseFloat(actualStatementBalance);
        const isValid = Number.isFinite(actual);
        const diff = isValid ? Number((actual - recorded).toFixed(2)) : 0;
        const isBalanced = isValid && Math.abs(diff) < 0.01;

        return (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 sm:p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Reconcile Balance: {reconcilingWallet.name}</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Compare your TrueSpend ledger against your real bank statement or physical cash count.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReconcilingWallet(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">TrueSpend Recorded Balance</p>
                <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-1">
                  {recorded.toFixed(2)} MAD
                </p>
              </div>

              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-3">
                <label className="block text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                  Actual Bank / Physical Balance (MAD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={actualStatementBalance}
                  onChange={(e) => setActualStatementBalance(e.target.value)}
                  className="mt-1 w-full bg-transparent text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white focus:outline-none border-b border-indigo-300 dark:border-indigo-700"
                />
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Unaccounted Discrepancy</p>
                <p
                  className={`text-lg font-bold font-mono tabular-nums mt-1 ${
                    isBalanced
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : diff > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isBalanced ? '0.00 MAD (Matched)' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)} MAD`}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isBalanced
                  ? 'Your recorded balance matches your actual statement exactly.'
                  : diff < 0
                  ? `You have ${Math.abs(diff).toFixed(2)} MAD less than recorded (unlogged expense or fee).`
                  : `You have ${diff.toFixed(2)} MAD more than recorded (unlogged inflow).`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReconcilingWallet(null)}
                >
                  Close
                </Button>
                {!isBalanced && isValid && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => handleResolveReconciliation('adjust_baseline')}
                      className="text-xs border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                    >
                      Adjust Baseline ({diff >= 0 ? '+' : ''}{diff.toFixed(2)} MAD)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading}
                      onClick={() => handleResolveReconciliation('log_transaction')}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Log {diff > 0 ? 'Income' : 'Expense'} Adjustment
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Wallets Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`relative rounded-xl border p-4 transition-all flex flex-col justify-between ${
              wallet.isMain
                ? 'border-indigo-200 dark:border-indigo-800/60 bg-gradient-to-br from-indigo-50/40 via-white to-white dark:from-indigo-950/20 dark:via-gray-900 dark:to-gray-900 shadow-sm'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                    {getWalletIcon(wallet.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
                        {wallet.name}
                      </h4>
                      {wallet.isMain && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                          <Star className="h-2.5 w-2.5 fill-current" /> Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {wallet.type} Account
                      </p>
                      {wallet.type === 'Savings' && (
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                          Goal Vault
                        </span>
                      )}
                      {wallet.type === 'Investment' && (
                        <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                          Brokerage Reserve
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openReconcileForm(wallet)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Reconcile Balance"
                  >
                    <Scale className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(wallet)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Edit Wallet"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={wallets.length <= 1}
                    onClick={() => openDeleteModal(wallet)}
                    className={`p-1.5 rounded-md transition-colors ${
                      wallets.length <= 1
                        ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                        : 'text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={wallets.length <= 1 ? 'Cannot delete the only wallet' : 'Delete Wallet'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Balance figures */}
              {(() => {
                if (wallet.type === 'Investment') {
                  const invWallets = wallets.filter((w) => w.type === 'Investment');
                  const isFirstInvWallet = invWallets[0]?.id === wallet.id;
                  const linkedStocks = (investmentsData?.positions || []).filter(
                    (p) => !p.isWatchlistOnly && p.sharesNum > 0 && (p.walletId === wallet.id || (!p.walletId && isFirstInvWallet))
                  );
                  const uninvestedCashMad = wallet.balance ?? 0;
                  const linkedStockValueMad = linkedStocks.reduce((sum, p) => sum + p.marketValueMad, 0);
                  const totalBrokerageMad = uninvestedCashMad + linkedStockValueMad;

                  return (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Uninvested Brokerage Cash</p>
                          <div className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                            {uninvestedCashMad.toFixed(2)}{' '}
                            <span className="text-xs font-medium text-gray-500">MAD</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Linked Stock Equity</p>
                          <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {linkedStockValueMad.toFixed(2)}{' '}
                            <span className="text-[10px] font-medium text-gray-400">MAD</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50">
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Total Brokerage Value:</span>
                        </div>
                        <span className="font-bold font-mono tabular-nums text-amber-900 dark:text-amber-200">
                          {totalBrokerageMad.toFixed(2)} MAD ({linkedStocks.length} stock{linkedStocks.length === 1 ? '' : 's'})
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-0.5">
                        <span>Protected Reserve (excluded from Safe-to-Spend)</span>
                        {onOpenInvestments && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose?.();
                              onOpenInvestments();
                            }}
                            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Manage Stocks →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                const assignedSubs = (subscriptions || []).filter(
                  (s) => s.status === 'active' && (s.walletId === wallet.id || (!s.walletId && wallet.isMain))
                );
                const committedBills = assignedSubs.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
                const safeToSpend = (wallet.balance ?? 0) - committedBills;
                const isOverdraftRisk = safeToSpend < 0;
                const isExpanded = Boolean(expandedWalletBills[wallet.id]);

                return (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Total Balance</p>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {(wallet.balance ?? 0).toFixed(2)}{' '}
                          <span className="text-xs font-medium text-gray-500">MAD</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Safe-to-Spend</p>
                        <div className={`text-base font-bold tabular-nums ${isOverdraftRisk ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {safeToSpend.toFixed(2)}{' '}
                          <span className="text-[10px] font-medium text-gray-400">MAD</span>
                        </div>
                      </div>
                    </div>

                    {/* Committed bills row */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                        <Repeat className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Committed Bills:</span>
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {committedBills.toFixed(2)} MAD ({assignedSubs.length} bill{assignedSubs.length === 1 ? '' : 's'})
                      </span>
                    </div>

                    {/* Overdraft risk alert */}
                    {isOverdraftRisk && (
                      <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-2 text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-start gap-1.5 animate-pulse">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                        <span>⚠️ Overdraft Alert: Upcoming bills exceed balance by {Math.abs(safeToSpend).toFixed(2)} MAD!</span>
                      </div>
                    )}

                    {/* Expandable assigned bills list */}
                    {assignedSubs.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedWalletBills(prev => ({ ...prev, [wallet.id]: !prev[wallet.id] }))}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 w-full justify-between py-1"
                        >
                          <span>Assigned Recurring Bills ({assignedSubs.length})</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-1 space-y-1.5 max-h-36 overflow-y-auto pr-0.5 animate-in fade-in">
                            {assignedSubs.map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between p-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-xs"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-sm">{sub.icon || '📱'}</span>
                                  <span className="font-medium truncate max-w-[100px] text-gray-800 dark:text-gray-200">{sub.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-bold text-gray-900 dark:text-gray-100">{parseFloat(sub.amount).toFixed(0)} MAD</span>
                                  {onPaySubscription && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      disabled={payingSubId === sub.id}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setPayingSubId(sub.id);
                                        try {
                                          await onPaySubscription(sub.id, { walletId: wallet.id });
                                        } finally {
                                          setPayingSubId(null);
                                        }
                                      }}
                                      className="h-6 px-1.5 text-[10px] text-purple-600 dark:text-purple-400 hover:bg-purple-50"
                                    >
                                      Pay
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Actions */}
            {!wallet.isMain && (
              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleMakeMain(wallet)}
                  disabled={loading}
                  className="w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Star className="h-3 w-3" /> Make Primary
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Delete Wallet: {deletingWallet.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Transactions linked to this wallet need to be safely transferred to another active wallet.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Reassign all existing transactions to:
              </label>
              <Select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full"
              >
                {wallets
                  .filter((w) => w.id !== deletingWallet.id)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </option>
                  ))}
              </Select>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingWallet(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDelete}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? 'Deleting...' : 'Delete & Reassign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 my-8 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-end pb-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {content}
      </CardContent>
    </Card>
  );
};
