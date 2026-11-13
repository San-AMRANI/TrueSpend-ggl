import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Landmark,
  Banknote,
  Wallet as WalletIcon,
  Plus,
  Edit2,
  Trash2,
  Star,
  AlertCircle,
  X,
  TrendingUp,
  Repeat,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Scale,
  CheckCircle2,
  FileSpreadsheet,
  Inbox,
  BookOpen,
  Globe,
  CreditCard,
  RefreshCw,
  Users,
  Activity,
  GitMerge,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  Wallet,
  WalletAccountSubtype,
  Subscription,
  Debt,
  Transaction,
  InvestmentsData,
  WalletsWorkbenchSection,
} from '../../types';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { useReviewInbox } from '../../hooks/useReviewInbox';
import { useAccountAuditWorkbench } from '../../hooks/useAccountAuditWorkbench';
import { expenseCategories } from '../../lib/categories';

interface WalletsManagerProps {
  wallets: Wallet[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  transactions?: Transaction[];
  investmentsData?: InvestmentsData | null;
  initialSection?: WalletsWorkbenchSection;
  onSectionChange?: (section: WalletsWorkbenchSection) => void;
  onOpenInvestments?: () => void;
  onPaySubscription?: (id: string, payload?: { walletId?: string; date?: string }) => Promise<any>;
  onCreateWallet: (payload: any) => Promise<any>;
  onUpdateWallet: (id: string, payload: any) => Promise<any>;
  onDeleteWallet: (id: string, reassignToWalletId?: string) => Promise<any>;
  onRefresh?: () => Promise<void> | void;
  onClose?: () => void;
  isModal?: boolean;
}

export const WalletsManager: React.FC<WalletsManagerProps> = ({
  wallets,
  subscriptions = [],
  debts = [],
  transactions = [],
  investmentsData = null,
  initialSection = 'wallets',
  onSectionChange,
  onOpenInvestments,
  onPaySubscription,
  onCreateWallet,
  onUpdateWallet,
  onDeleteWallet,
  onRefresh,
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

  const [activeSection, setActiveSection] = useState<WalletsWorkbenchSection>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const selectSection = (section: WalletsWorkbenchSection) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const reviewInbox = useReviewInbox(token, onRefresh);
  const workbench = useAccountAuditWorkbench(token, onRefresh);

  // Statement import form state
  const [stmtWalletId, setStmtWalletId] = useState<string>('');
  const [stmtCsvText, setStmtCsvText] = useState<string>('');
  const [stmtFileName, setStmtFileName] = useState<string>('bank_statement.csv');
  const [stmtOpeningBal, setStmtOpeningBal] = useState<string>('');
  const [stmtClosingBal, setStmtClosingBal] = useState<string>('');
  const [stmtRowFilter, setStmtRowFilter] = useState<'all' | 'actionable' | 'matched' | 'resolved'>('all');
  const [stmtLinkSelection, setStmtLinkSelection] = useState<Record<string, string>>({});

  // Review Inbox inline edit & provenance state
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'pending' | 'all'>('pending');
  const [reviewEdits, setReviewEdits] = useState<
    Record<string, { description?: string; amount?: string; category?: string; walletId?: string; linkedTxId?: string }>
  >({});
  const [expandedProvenance, setExpandedProvenance] = useState<Record<string, boolean>>({});

  // External wealth form state
  const [wealthName, setWealthName] = useState('');
  const [wealthType, setWealthType] = useState<'Asset' | 'Liability'>('Asset');
  const [wealthCategory, setWealthCategory] = useState('Property');
  const [wealthAmountMad, setWealthAmountMad] = useState('');
  const [wealthCurrency, setWealthCurrency] = useState('MAD');
  const [wealthIsLiquid, setWealthIsLiquid] = useState(false);

  // Counterparty form & merge state
  const [cpName, setCpName] = useState('');
  const [cpType, setCpType] = useState<'merchant' | 'person' | 'employer' | 'financial_institution' | 'service_provider'>('merchant');
  const [cpAliases, setCpAliases] = useState('');
  const [cpDefaultCat, setCpDefaultCat] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  // FX Rate form state
  const [fxBaseCurrency, setFxBaseCurrency] = useState('USD');
  const [fxRateInput, setFxRateInput] = useState('10.00');

  // Form states for create/edit wallet
  const [formData, setFormData] = useState({
    name: '',
    type: 'Bank' as 'Bank' | 'Cash' | 'Savings' | 'Investment',
    accountSubtype: 'Checking' as WalletAccountSubtype,
    institutionName: '',
    currency: 'MAD',
    initialBalance: '',
    creditLimit: '',
    statementClosingDay: '',
    paymentDueDay: '',
    isMain: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkbenchData = useCallback(
    async (panel: WalletsWorkbenchSection) => {
      if (panel === 'wallets') return;
      if (panel === 'review_inbox') {
        await reviewInbox.refresh();
        return;
      }
      await workbench.loadSection(panel);
    },
    [reviewInbox.refresh, workbench.loadSection]
  );

  useEffect(() => {
    if (activeSection !== 'wallets') {
      loadWorkbenchData(activeSection);
    }
  }, [activeSection, loadWorkbenchData]);

  useEffect(() => {
    if (workbench.error) setError(workbench.error);
  }, [workbench.error]);

  useEffect(() => {
    if (reviewInbox.error) setError(reviewInbox.error);
  }, [reviewInbox.error]);

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
        await onUpdateWallet(reconcilingWallet.id, { initialBalance: nextInit, valuationStatus: 'exact' });
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
        await onUpdateWallet(reconcilingWallet.id, { name: reconcilingWallet.name, valuationStatus: 'exact' });
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
      accountSubtype: 'Checking',
      institutionName: '',
      currency: 'MAD',
      initialBalance: '0',
      creditLimit: '',
      statementClosingDay: '',
      paymentDueDay: '',
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
      accountSubtype: (wallet.accountSubtype as WalletAccountSubtype) || 'Checking',
      institutionName: wallet.institutionName || '',
      currency: wallet.currency || 'MAD',
      initialBalance: wallet.initialBalance || '0',
      creditLimit: wallet.creditLimit ? String(wallet.creditLimit) : '',
      statementClosingDay: wallet.statementClosingDay ? String(wallet.statementClosingDay) : '',
      paymentDueDay: wallet.paymentDueDay ? String(wallet.paymentDueDay) : '',
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
      const payload = {
        name: trimmedName,
        type: formData.type,
        accountSubtype: formData.accountSubtype,
        institutionName: formData.institutionName.trim() || null,
        currency: formData.currency || 'MAD',
        initialBalance: parseFloat(formData.initialBalance) || 0,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : null,
        statementClosingDay: formData.statementClosingDay ? parseInt(formData.statementClosingDay, 10) : null,
        paymentDueDay: formData.paymentDueDay ? parseInt(formData.paymentDueDay, 10) : null,
        isMain: formData.isMain,
      };
      if (editingWallet) {
        await onUpdateWallet(editingWallet.id, payload);
      } else {
        await onCreateWallet(payload);
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
    const prevMain = wallets.find((w) => w.isMain && w.id !== wallet.id);
    const wasSavingsSwap = wallet.type === 'Savings' && prevMain?.type === 'Bank';
    setLoading(true);
    setError(null);
    try {
      await onUpdateWallet(wallet.id, { isMain: true });
      if (wasSavingsSwap && prevMain) {
        setReconcileNotice(
          `Switched Primary Wallet to ${wallet.name} (promoted to Bank Account; ${prevMain.name} moved to Savings Vault & linked bills/goals synced).`
        );
      } else {
        setReconcileNotice(`Set ${wallet.name} as your Primary spending wallet.`);
      }
      setTimeout(() => setReconcileNotice(null), 6000);
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
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Account Subtype</label>
              <Select
                value={formData.accountSubtype}
                onChange={(e) => setFormData({ ...formData, accountSubtype: e.target.value as WalletAccountSubtype })}
                className="bg-white dark:bg-gray-800"
              >
                <option value="Checking">Checking / Current Account</option>
                <option value="Savings">Savings / Emergency Vault</option>
                <option value="Cash">Physical Cash</option>
                <option value="Brokerage">Brokerage / Crypto Account</option>
                <option value="CreditCard">Credit Card (Liability Account)</option>
                <option value="Overdraft">Overdraft Line (Liability Account)</option>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Institution &amp; Currency</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g. Attijariwafa, CIH, Wise"
                  value={formData.institutionName}
                  onChange={(e) => setFormData({ ...formData, institutionName: e.target.value })}
                  className="bg-white dark:bg-gray-800 flex-1"
                />
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="bg-white dark:bg-gray-800 w-24"
                >
                  <option value="MAD">MAD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {formData.accountSubtype === 'CreditCard' || formData.accountSubtype === 'Overdraft'
                  ? 'Initial Balance (Use negative for owed liability)'
                  : `Starting / Initial Balance (${formData.currency})`}
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
                {formData.accountSubtype === 'CreditCard' || formData.accountSubtype === 'Overdraft'
                  ? 'Credit limits are never counted as liquid cash.'
                  : 'The baseline balance before recorded transactions.'}
              </p>
            </div>

            {(formData.accountSubtype === 'CreditCard' || formData.accountSubtype === 'Overdraft') && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Credit Limit (MAD)</label>
                  <Input
                    type="number"
                    step="100"
                    placeholder="e.g. 20000"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    className="bg-white dark:bg-gray-800"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Closing Day (1-31)</label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="15"
                      value={formData.statementClosingDay}
                      onChange={(e) => setFormData({ ...formData, statementClosingDay: e.target.value })}
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Due Day (1-31)</label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="5"
                      value={formData.paymentDueDay}
                      onChange={(e) => setFormData({ ...formData, paymentDueDay: e.target.value })}
                      className="bg-white dark:bg-gray-800"
                    />
                  </div>
                </div>
              </>
            )}

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

      {/* Core Audit & Reconciliation Workbench Navigation */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
              Accounting &amp; Reconciliation Workbench
            </span>
            {activeSection !== 'wallets' && (
              <button
                type="button"
                onClick={() => selectSection('wallets')}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                ← Back to Accounts
              </button>
            )}
          </div>
          <div className="ts-scrollbar flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
            {(
              [
                { id: 'wallets', label: 'Accounts & Balances', icon: WalletIcon },
                { id: 'statement_import', label: 'Statement CSV Import', icon: FileSpreadsheet },
                { id: 'review_inbox', label: 'Review Inbox', icon: Inbox },
                { id: 'journal_audit', label: 'Double-Entry Ledger', icon: BookOpen },
                { id: 'external_wealth_fx', label: 'External Wealth & FX', icon: Globe },
                { id: 'counterparties', label: 'Counterparties', icon: Users },
                { id: 'integrity_diagnostics', label: 'Integrity Diagnostics', icon: Activity },
              ] as const
            ).map((btn) => {
              const Icon = btn.icon;
              const isActive = activeSection === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => selectSection(btn.id)}
                  className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="wallets-section-pill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-indigo-600 shadow-xs"
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5 shrink-0" />
                  <span className="relative z-10">{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. Statement Import & Transaction Matching */}
        {activeSection === 'statement_import' && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Statement CSV / TSV Import &amp; Transaction Matching
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Upload or paste statement rows (Date, Description, Amount, Currency). Duplicates are skipped via SHA-256 hash and unmatched rows route into the Review Inbox.
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setStmtFileName(f.name);
                  const txt = await f.text();
                  setStmtCsvText(txt);
                }}
                className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <Select
                value={stmtWalletId}
                onChange={(e) => setStmtWalletId(e.target.value)}
                className="text-xs"
              >
                <option value="">Target Wallet (Primary Default)</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency || 'MAD'})
                  </option>
                ))}
              </Select>
              <Input
                type="text"
                value={stmtFileName}
                onChange={(e) => setStmtFileName(e.target.value)}
                placeholder="Statement filename"
                className="text-xs"
              />
              <Input
                type="number"
                step="0.01"
                value={stmtOpeningBal}
                onChange={(e) => setStmtOpeningBal(e.target.value)}
                placeholder="Opening balance (opt)"
                className="text-xs font-mono"
              />
              <Input
                type="number"
                step="0.01"
                value={stmtClosingBal}
                onChange={(e) => setStmtClosingBal(e.target.value)}
                placeholder="Closing balance (opt)"
                className="text-xs font-mono"
              />
              <Button
                type="button"
                size="sm"
                disabled={workbench.loadingSection === 'statement_import' || !stmtCsvText.trim()}
                onClick={async () => {
                  const targetWalletId = stmtWalletId || wallets.find((w) => w.isMain)?.id || wallets[0]?.id;
                  if (!targetWalletId) {
                    setError('Please create a wallet before importing a statement.');
                    return;
                  }
                  const ext = stmtFileName.toLowerCase().endsWith('.tsv') ? 'TSV' : 'CSV';
                  const openNum = stmtOpeningBal.trim() !== '' ? Number(stmtOpeningBal) : undefined;
                  const closeNum = stmtClosingBal.trim() !== '' ? Number(stmtClosingBal) : undefined;
                  const res = await workbench.importStatement({
                    walletId: targetWalletId,
                    fileName: stmtFileName.trim() || 'statement.csv',
                    fileFormat: ext,
                    rawContent: stmtCsvText,
                    ...(Number.isFinite(openNum) ? { statementOpeningBalance: openNum } : {}),
                    ...(Number.isFinite(closeNum) ? { statementClosingBalance: closeNum } : {}),
                  });
                  if (res) {
                    setStmtCsvText('');
                    setStmtOpeningBal('');
                    setStmtClosingBal('');
                    const varianceStr =
                      res.batch.reconciledVariance && Math.abs(Number(res.batch.reconciledVariance)) >= 0.01
                        ? ` Variance vs closing: ${Number(res.batch.reconciledVariance).toFixed(2)}.`
                        : '';
                    setReconcileNotice(
                      `Statement imported: ${res.batch.matchedCount} matched, ${res.batch.unmatchedCount} unmatched, ${res.batch.ambiguousCount} ambiguous, ${res.batch.duplicateCount} duplicates.${varianceStr}`
                    );
                  }
                }}
                className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs whitespace-nowrap"
              >
                {workbench.loadingSection === 'statement_import' ? 'Importing...' : 'Match & Import'}
              </Button>
            </div>

            <textarea
              rows={3}
              value={stmtCsvText}
              onChange={(e) => setStmtCsvText(e.target.value)}
              placeholder={'Date,Description,Amount,Currency\n2025-03-10,Marjane Market,-420.50,MAD\n2025-03-12,Employer Salary,12000.00,MAD'}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-mono text-gray-900 dark:text-gray-100"
            />

            {workbench.statementBatches.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Imported Statement Batches ({workbench.statementBatches.length})
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    {(
                      [
                        { id: 'all', label: 'All Rows' },
                        { id: 'actionable', label: 'Needs Action' },
                        { id: 'matched', label: 'Auto-Matched' },
                        { id: 'resolved', label: 'Resolved' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStmtRowFilter(f.id)}
                        className={`px-2 py-0.5 rounded font-medium ${
                          stmtRowFilter === f.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {workbench.statementBatches.slice(0, 5).map((batch) => {
                    const filteredRows = batch.rows.filter((r) => {
                      if (stmtRowFilter === 'actionable') return r.matchStatus === 'unmatched' || r.matchStatus === 'ambiguous';
                      if (stmtRowFilter === 'matched') return r.matchStatus === 'matched';
                      if (stmtRowFilter === 'resolved')
                        return r.matchStatus === 'confirmed_linked' || r.matchStatus === 'confirmed_created' || r.matchStatus === 'ignored';
                      return true;
                    });
                    return (
                      <div key={batch.id} className="rounded-lg border border-gray-100 dark:border-gray-800 p-2.5 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                          <span>
                            {batch.fileName} ({batch.totalRows} rows)
                          </span>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-gray-500">
                            <span>Matched: {batch.matchedCount}</span>
                            <span>Unmatched: {batch.unmatchedCount}</span>
                            <span>Ambiguous: {batch.ambiguousCount}</span>
                            <span>Dup: {batch.duplicateCount}</span>
                            {batch.reconciledVariance && Math.abs(Number(batch.reconciledVariance)) >= 0.01 && (
                              <span className="text-amber-600 font-bold">
                                Variance: {Number(batch.reconciledVariance).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        {filteredRows.length === 0 ? (
                          <p className="text-[11px] text-gray-400 py-1">No rows matching filter.</p>
                        ) : (
                          filteredRows.slice(0, 15).map((row) => {
                            const signedAmt = Number(row.amount || 0);
                            const selectedLinkId = stmtLinkSelection[row.id] ?? row.suggestedTransactionId ?? '';
                            const canResolve = row.matchStatus === 'unmatched' || row.matchStatus === 'ambiguous' || row.matchStatus === 'matched';
                            return (
                              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-t border-gray-100 dark:border-gray-800/60">
                                <div className="min-w-0 flex-1">
                                  <span className="font-mono text-[11px] text-gray-500 mr-2">{row.rowDate}</span>
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{row.description}</span>
                                  {row.linkedTransactionId && (
                                    <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                                      Linked Tx: {row.linkedTransactionId.slice(0, 8)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  <span
                                    className={`font-mono font-bold tabular-nums ${
                                      signedAmt < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}
                                  >
                                    {signedAmt >= 0 ? '+' : ''}
                                    {signedAmt.toFixed(2)} {row.currency}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 capitalize">
                                    {row.matchStatus.replace(/_/g, ' ')}
                                  </span>
                                  {canResolve && (
                                    <>
                                      {transactions.length > 0 && (
                                        <select
                                          value={selectedLinkId}
                                          onChange={(e) => setStmtLinkSelection((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                          className="max-w-[140px] rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 py-0.5 text-[10px]"
                                        >
                                          <option value="">Link existing tx...</option>
                                          {transactions.slice(0, 30).map((t) => (
                                            <option key={t.id} value={t.id}>
                                              {t.createdAt.slice(0, 10)} · {(t.notes || t.category || t.type).slice(0, 18)} ({Number(t.amount).toFixed(0)})
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                      {selectedLinkId && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            workbench.resolveRow(row.id, {
                                              action: 'confirm_match',
                                              linkedTransactionId: selectedLinkId,
                                            })
                                          }
                                          className="text-[11px] font-semibold text-emerald-600 hover:underline"
                                        >
                                          Link Match
                                        </button>
                                      )}
                                      {(row.matchStatus === 'unmatched' || row.matchStatus === 'ambiguous') && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => workbench.resolveRow(row.id, { action: 'create_transaction' })}
                                            className="text-[11px] font-semibold text-indigo-600 hover:underline"
                                          >
                                            + Post Tx
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => workbench.resolveRow(row.id, { action: 'ignore' })}
                                            className="text-[11px] text-gray-500 hover:underline"
                                          >
                                            Ignore
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Persistent Financial Review Inbox */}
        {activeSection === 'review_inbox' && (() => {
          const displayedReviewItems = reviewInbox.items.filter((item) =>
            reviewStatusFilter === 'pending'
              ? item.status === 'Captured' || item.status === 'Needs Review'
              : true
          );
          return (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    Financial Review Inbox ({displayedReviewItems.length})
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Review captured OCR receipts, unmatched statement rows, and rule drafts. Edit fields, link existing transactions, or post cleanly to the journal.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('pending')}
                      className={`px-2.5 py-1 font-medium ${
                        reviewStatusFilter === 'pending'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewStatusFilter('all')}
                      className={`px-2.5 py-1 font-medium ${
                        reviewStatusFilter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      All History ({reviewInbox.items.length})
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reviewInbox.loading}
                    onClick={() => reviewInbox.refresh()}
                    className="text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${reviewInbox.loading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>
              </div>

              {displayedReviewItems.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">
                  {reviewStatusFilter === 'pending'
                    ? 'Inbox Zero! No items awaiting review.'
                    : 'No review inbox records found.'}
                </p>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {displayedReviewItems.map((item) => {
                    const edit = reviewEdits[item.id] || {};
                    const descVal = edit.description ?? item.parsedDescription;
                    const amtVal = edit.amount ?? String(item.parsedAmount ?? '0');
                    const catVal = edit.category ?? item.parsedCategory;
                    const walletVal = edit.walletId ?? item.walletId ?? wallets.find((w) => w.isMain)?.id ?? wallets[0]?.id ?? '';
                    const linkTxVal = edit.linkedTxId ?? item.linkedTransactionId ?? '';
                    const isPending = item.status === 'Captured' || item.status === 'Needs Review';
                    const isBusy = reviewInbox.busyId === item.id;
                    const isProvOpen = Boolean(expandedProvenance[item.id]);

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 p-3 text-xs space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              {item.parsedDescription}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                              {item.sourceType.replace(/_/g, ' ')}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                              {item.status}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              {item.parsedDate} · {(Number(item.confidenceScore || 0) * 100).toFixed(0)}% conf
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold tabular-nums text-sm text-gray-900 dark:text-white">
                              {Number(item.parsedAmount || 0).toFixed(2)} {item.parsedCurrency || 'MAD'}
                            </span>
                            {item.rawPayloadJson && (
                              <button
                                type="button"
                                onClick={() => setExpandedProvenance((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                {isProvOpen ? 'Hide Provenance' : 'Provenance'}
                              </button>
                            )}
                          </div>
                        </div>

                        {isProvOpen && item.rawPayloadJson && (
                          <pre className="rounded bg-gray-900 text-gray-100 p-2 text-[10px] font-mono overflow-x-auto max-h-28">
                            {item.rawPayloadJson}
                          </pre>
                        )}

                        {isPending ? (
                          <div className="space-y-2 pt-1 border-t border-gray-200/70 dark:border-gray-700/60">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <Input
                                type="text"
                                value={descVal}
                                onChange={(e) =>
                                  setReviewEdits((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], description: e.target.value },
                                  }))
                                }
                                placeholder="Description"
                                className="text-xs bg-white dark:bg-gray-900"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                value={amtVal}
                                onChange={(e) =>
                                  setReviewEdits((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], amount: e.target.value },
                                  }))
                                }
                                placeholder="Amount"
                                className="text-xs font-mono bg-white dark:bg-gray-900"
                              />
                              <Select
                                value={catVal}
                                onChange={(e) =>
                                  setReviewEdits((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], category: e.target.value },
                                  }))
                                }
                                className="text-xs bg-white dark:bg-gray-900"
                              >
                                {!expenseCategories.includes(catVal as any) && <option value={catVal}>{catVal}</option>}
                                {expenseCategories.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </Select>
                              <Select
                                value={walletVal}
                                onChange={(e) =>
                                  setReviewEdits((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], walletId: e.target.value },
                                  }))
                                }
                                className="text-xs bg-white dark:bg-gray-900"
                              >
                                {wallets.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name} ({w.currency || 'MAD'})
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={linkTxVal}
                                  onChange={(e) =>
                                    setReviewEdits((prev) => ({
                                      ...prev,
                                      [item.id]: { ...prev[item.id], linkedTxId: e.target.value },
                                    }))
                                  }
                                  className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-[11px] max-w-[200px]"
                                >
                                  <option value="">Link to existing transaction...</option>
                                  {transactions.slice(0, 40).map((tx) => (
                                    <option key={tx.id} value={tx.id}>
                                      {tx.createdAt.slice(0, 10)} · {(tx.notes || tx.category || tx.type).slice(0, 22)} ({Number(tx.amount).toFixed(0)} MAD)
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isBusy || !linkTxVal}
                                  onClick={async () => {
                                    await reviewInbox.decideItem(item.id, {
                                      action: 'link_existing',
                                      linkedTransactionId: linkTxVal,
                                    });
                                    setReconcileNotice(`Linked "${item.parsedDescription}" to existing transaction.`);
                                  }}
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Link Existing
                                </Button>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={async () => {
                                    await reviewInbox.decideItem(item.id, {
                                      action: 'post_transaction',
                                      walletId: walletVal,
                                      category: catVal,
                                      amount: Number(amtVal),
                                      description: descVal,
                                    });
                                    setReconcileNotice(`Posted "${descVal}" to ledger & journal.`);
                                  }}
                                  className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  {isBusy ? 'Posting...' : 'Confirm & Post'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() =>
                                    reviewInbox.decideItem(item.id, {
                                      action: 'mark_duplicate',
                                      decisionNotes: 'Marked duplicate from Review Inbox',
                                    })
                                  }
                                  className="h-7 px-2 text-[11px]"
                                >
                                  Duplicate
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isBusy}
                                  onClick={() =>
                                    reviewInbox.decideItem(item.id, {
                                      action: 'reject',
                                      decisionNotes: 'Rejected from Review Inbox',
                                    })
                                  }
                                  className="h-7 px-2 text-[11px] text-rose-600"
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          item.decisionNotes && (
                            <p className="text-[11px] text-gray-500 italic">Note: {item.decisionNotes}</p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. Double-Entry Accounting & Journal Audit */}
        {activeSection === 'journal_audit' && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Double-Entry Accounting Journal &amp; Balance Verification
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every financial event posts balanced Debit = Credit journal lines. Edits/deletions generate reversing entries.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={workbench.loadingSection === 'journal_audit'}
                onClick={async () => {
                  const res = await workbench.backfillJournal();
                  if (res) {
                    setReconcileNotice(
                      `Backfilled ${res.backfilledCount} historical transactions into balanced double-entry journal lines.`
                    );
                  }
                }}
                className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
              >
                {workbench.loadingSection === 'journal_audit' ? 'Backfilling...' : 'Backfill Historical Transactions'}
              </Button>
            </div>

            {workbench.journalSummary && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-500">Journal Entries</span>
                    <p className="text-base font-bold font-mono text-gray-900 dark:text-white">
                      {workbench.journalSummary.totalEntries} ({workbench.journalSummary.totalLines} lines)
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-500">Total Debits</span>
                    <p className="text-base font-bold font-mono text-gray-900 dark:text-white">
                      {workbench.journalSummary.totalDebitsMad.toFixed(2)} MAD
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-500">Total Credits</span>
                    <p className="text-base font-bold font-mono text-gray-900 dark:text-white">
                      {workbench.journalSummary.totalCreditsMad.toFixed(2)} MAD
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="text-gray-500">Trial Balance Integrity</span>
                    <p className={`text-base font-bold ${workbench.journalSummary.isSystemBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {workbench.journalSummary.isSystemBalanced ? '100% Balanced' : `${workbench.journalSummary.imbalancedEntriesCount} Imbalanced`}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {workbench.journalSummary.walletComparison.map((wc) => (
                    <div key={wc.walletId} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-gray-50/70 dark:bg-gray-800/40">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {wc.walletName} ({wc.accountSubtype})
                      </span>
                      <div className="flex items-center gap-3 font-mono">
                        <span>Legacy: {wc.legacyBalanceMad.toFixed(2)} MAD</span>
                        <span>Journal: {wc.journalComputedBalanceMad.toFixed(2)} MAD</span>
                        <span className={Math.abs(wc.discrepancyMad) < 0.01 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                          Δ {wc.discrepancyMad.toFixed(2)} MAD
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. External Wealth Items (Unified Net Worth) & Multi-Currency FX Rates */}
        {activeSection === 'external_wealth_fx' && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 border border-emerald-100 dark:border-emerald-900/40">
                <span className="text-gray-500 dark:text-gray-400">External Assets</span>
                <p className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  +{workbench.externalSummary.totalExternalAssetsMad.toLocaleString()} MAD
                </p>
              </div>
              <div className="rounded-lg bg-rose-50/60 dark:bg-rose-950/20 p-2.5 border border-rose-100 dark:border-rose-900/40">
                <span className="text-gray-500 dark:text-gray-400">External Liabilities</span>
                <p className="font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                  -{workbench.externalSummary.totalExternalLiabilitiesMad.toLocaleString()} MAD
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20 p-2.5 border border-indigo-100 dark:border-indigo-900/40">
                <span className="text-gray-500 dark:text-gray-400">Net External Wealth</span>
                <p className="font-mono font-bold text-sm text-indigo-700 dark:text-indigo-300">
                  {workbench.externalSummary.netExternalWealthMad >= 0 ? '+' : ''}
                  {workbench.externalSummary.netExternalWealthMad.toLocaleString()} MAD
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* External Assets & Liabilities */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  External Assets &amp; Liabilities (Real Estate, Vehicles, Metals, Loans)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Input
                    type="text"
                    placeholder="Item name (e.g. Apartment)"
                    value={wealthName}
                    onChange={(e) => setWealthName(e.target.value)}
                    className="text-xs col-span-2"
                  />
                  <Select value={wealthType} onChange={(e) => setWealthType(e.target.value as any)} className="text-xs">
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                  </Select>
                  <Select value={wealthCategory} onChange={(e) => setWealthCategory(e.target.value)} className="text-xs">
                    <option value="Property">Property</option>
                    <option value="Vehicle">Vehicle</option>
                    <option value="PreciousMetals">Precious Metals</option>
                    <option value="PrivateInvestment">Private Equity</option>
                    <option value="Mortgage">Mortgage</option>
                    <option value="ExternalLoan">External Loan</option>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Estimated Valuation"
                    value={wealthAmountMad}
                    onChange={(e) => setWealthAmountMad(e.target.value)}
                    className="text-xs flex-1 min-w-[120px]"
                  />
                  <Select value={wealthCurrency} onChange={(e) => setWealthCurrency(e.target.value)} className="text-xs w-20">
                    <option value="MAD">MAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </Select>
                  <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={wealthIsLiquid}
                      onChange={(e) => setWealthIsLiquid(e.target.checked)}
                    />
                    Liquid
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      if (!wealthName.trim() || !wealthAmountMad) return;
                      await dashboardService.upsertExternalWealthItem(
                        {
                          name: wealthName.trim(),
                          itemClass: wealthCategory,
                          isLiability: wealthType === 'Liability',
                          estimatedValue: parseFloat(wealthAmountMad) || 0,
                          currency: wealthCurrency,
                          isLiquid: wealthIsLiquid,
                          valuationSource: 'manual_estimate',
                          confidenceLevel: 'medium',
                        },
                        token
                      );
                      setWealthName('');
                      setWealthAmountMad('');
                      await workbench.loadSection('external_wealth_fx');
                    }}
                    className="bg-indigo-600 text-white text-xs"
                  >
                    + Add
                  </Button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {workbench.externalWealth.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-800">
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-gray-900 dark:text-white">{item.name}</span>{' '}
                        <span className="text-[11px] text-gray-500">
                          ({item.itemClass} · {item.isLiquid ? 'Liquid' : 'Illiquid'} · {item.valuationDate})
                        </span>
                        {item.isStaleEstimate && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-semibold">
                            Stale ({item.ageDays}d)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-mono font-bold ${!item.isLiability ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {!item.isLiability ? '+' : '-'}
                          {Number(item.valueMad ?? item.estimatedValue).toLocaleString()} MAD
                          {item.currency !== 'MAD' ? ` (${Number(item.estimatedValue).toLocaleString()} ${item.currency})` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await dashboardService.deleteExternalWealthItem(item.id, token);
                            await workbench.loadSection('external_wealth_fx');
                          }}
                          className="text-gray-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Exchange Rates */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Historical Multi-Currency FX Rates (to MAD)
                </h4>
                <div className="flex items-center gap-2">
                  <Select value={fxBaseCurrency} onChange={(e) => setFxBaseCurrency(e.target.value)} className="text-xs w-28">
                    <option value="USD">USD → MAD</option>
                    <option value="EUR">EUR → MAD</option>
                    <option value="GBP">GBP → MAD</option>
                  </Select>
                  <Input
                    type="number"
                    step="0.0001"
                    value={fxRateInput}
                    onChange={(e) => setFxRateInput(e.target.value)}
                    placeholder="Rate in MAD"
                    className="text-xs flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      await dashboardService.upsertExchangeRate(
                        {
                          baseCurrency: fxBaseCurrency,
                          quoteCurrency: 'MAD',
                          rate: parseFloat(fxRateInput) || 10,
                          source: 'manual_verified',
                        },
                        token
                      );
                      await workbench.loadSection('external_wealth_fx');
                    }}
                    className="bg-indigo-600 text-white text-xs"
                  >
                    Lock FX Rate
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {workbench.fxRates.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-50 dark:bg-gray-800">
                      <span className="font-mono font-semibold">
                        1 {r.baseCurrency} = {Number(r.rate).toFixed(4)} {r.quoteCurrency}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {r.effectiveDate} · {r.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Counterparty & Merchant Identity Layer */}
        {activeSection === 'counterparties' && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Merchant &amp; Counterparty Registry ({workbench.counterparties.length})
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Normalize noisy statement aliases to canonical entities with aggregated spend, receivables/payables, and non-destructive merge.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => workbench.loadSection('counterparties')}
                className="text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${workbench.loadingSection === 'counterparties' ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <Input
                type="text"
                placeholder="Canonical name (e.g. Marjane)"
                value={cpName}
                onChange={(e) => setCpName(e.target.value)}
                className="text-xs"
              />
              <Select value={cpType} onChange={(e) => setCpType(e.target.value as any)} className="text-xs">
                <option value="merchant">Merchant</option>
                <option value="person">Person</option>
                <option value="employer">Employer</option>
                <option value="financial_institution">Financial Institution</option>
                <option value="service_provider">Service Provider</option>
              </Select>
              <Input
                type="text"
                placeholder="Aliases (comma-separated)"
                value={cpAliases}
                onChange={(e) => setCpAliases(e.target.value)}
                className="text-xs"
              />
              <Input
                type="text"
                placeholder="Default category (optional)"
                value={cpDefaultCat}
                onChange={(e) => setCpDefaultCat(e.target.value)}
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  if (!cpName.trim()) return;
                  await dashboardService.upsertCounterparty(
                    {
                      canonicalName: cpName.trim(),
                      counterpartyType: cpType,
                      aliases: cpAliases.split(',').map((s) => s.trim()).filter(Boolean),
                      defaultCategory: cpDefaultCat.trim() || null,
                    },
                    token
                  );
                  setCpName('');
                  setCpAliases('');
                  setCpDefaultCat('');
                  await workbench.loadSection('counterparties');
                }}
                className="bg-indigo-600 text-white text-xs"
              >
                + Save Counterparty
              </Button>
            </div>

            {workbench.counterparties.length >= 2 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5 text-xs">
                <GitMerge className="h-3.5 w-3.5 text-indigo-500" />
                <span className="font-semibold">Merge Duplicate Counterparty:</span>
                <Select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} className="text-xs w-44">
                  <option value="">Source (to merge)</option>
                  {workbench.counterparties.map((c) => (
                    <option key={c.id} value={c.id}>{c.canonicalName}</option>
                  ))}
                </Select>
                <span>→</span>
                <Select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className="text-xs w-44">
                  <option value="">Target (canonical)</option>
                  {workbench.counterparties.map((c) => (
                    <option key={c.id} value={c.id}>{c.canonicalName}</option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                  onClick={async () => {
                    await dashboardService.mergeCounterparties(mergeSourceId, mergeTargetId, token);
                    setMergeSourceId('');
                    setMergeTargetId('');
                    setReconcileNotice('Merged counterparty aliases and re-linked history without modifying amounts or dates.');
                    await workbench.loadSection('counterparties');
                  }}
                  className="text-xs"
                >
                  Merge Safely
                </Button>
              </div>
            )}

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {workbench.counterparties.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">No counterparties registered yet.</p>
              ) : (
                workbench.counterparties.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 px-2.5 rounded border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">{cp.canonicalName}</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                          {cp.counterpartyType}
                        </span>
                        {cp.defaultCategory && (
                          <span className="text-[10px] text-gray-500">{cp.defaultCategory}</span>
                        )}
                      </div>
                      {cp.aliases.length > 0 && (
                        <p className="text-[11px] text-gray-500 truncate">Aliases: {cp.aliases.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] shrink-0">
                      <span>{cp.transactionCount} tx</span>
                      {cp.totalSpendMad > 0 && <span className="text-rose-600 font-bold">-{cp.totalSpendMad.toFixed(0)} MAD</span>}
                      {cp.totalIncomeMad > 0 && <span className="text-emerald-600 font-bold">+{cp.totalIncomeMad.toFixed(0)} MAD</span>}
                      {(cp.outstandingReceivablesMad > 0 || cp.outstandingPayablesMad > 0) && (
                        <span className="text-amber-600">
                          Debt: +{(cp.outstandingReceivablesMad - cp.outstandingPayablesMad).toFixed(0)} MAD
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6. Operational Diagnostics & Financial Integrity Report */}
        {activeSection === 'integrity_diagnostics' && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Operational Diagnostics &amp; Ledger Integrity Report
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Verifies unjournaled transactions, duplicate postings, unbalanced entries, orphaned reversals, unlinked commitments, goals &amp; stale valuations.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={workbench.loadingSection === 'integrity_diagnostics'}
                onClick={() => workbench.loadSection('integrity_diagnostics')}
                className="text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${workbench.loadingSection === 'integrity_diagnostics' ? 'animate-spin' : ''}`} /> Run Diagnostics
              </Button>
            </div>

            {workbench.integrityReport && (
              <div className="space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                      workbench.integrityReport.healthy
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}>
                      {workbench.integrityReport.healthy ? '✓ Healthy — 0 Exceptions' : `⚠ ${workbench.integrityReport.totalExceptions} Exception(s)`}
                    </span>
                    <span className="text-gray-500">
                      {workbench.integrityReport.walletCount} wallets · {workbench.integrityReport.transactionCount} transactions · {workbench.integrityReport.journalEntryCount} journal entries
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500">
                    Checked {new Date(workbench.integrityReport.checkedAt).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { label: 'Unjournaled Transactions', count: workbench.integrityReport.checks.unjournaledTransactions.length },
                    { label: 'Duplicate Postings', count: workbench.integrityReport.checks.duplicateJournalPostings.length },
                    { label: 'Unbalanced Journal Entries', count: workbench.integrityReport.checks.unbalancedJournalEntries.length },
                    { label: 'Orphaned Journal Lines', count: workbench.integrityReport.checks.orphanedJournalLines.length },
                    { label: 'Orphaned Reversals', count: workbench.integrityReport.checks.orphanedReversals.length },
                    { label: 'Completed Occurrences w/o Tx', count: workbench.integrityReport.checks.completedOccurrencesWithoutTx.length },
                    { label: 'Broken Statement Links', count: workbench.integrityReport.checks.brokenStatementLinks.length },
                    { label: 'Unreconciled Goals', count: workbench.integrityReport.checks.unreconciledGoals.length },
                    { label: 'Stale External Valuations', count: workbench.integrityReport.checks.staleExternalValuations.length },
                  ].map((chk) => (
                    <div
                      key={chk.label}
                      className="flex items-center justify-between rounded border border-gray-100 dark:border-gray-800 p-2 bg-gray-50/50 dark:bg-gray-800/30"
                    >
                      <span className="text-gray-700 dark:text-gray-300">{chk.label}</span>
                      <span className={`font-mono font-bold ${chk.count === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {chk.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {wallet.accountSubtype || wallet.type} {wallet.institutionName ? `· ${wallet.institutionName}` : ''}
                      </p>
                      {wallet.currency && wallet.currency !== 'MAD' && (
                        <span className="rounded bg-blue-100 dark:bg-blue-950/60 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300">
                          {wallet.currency}
                        </span>
                      )}
                      {(wallet.accountSubtype === 'CreditCard' || wallet.accountSubtype === 'Overdraft') && (
                        <span className="rounded bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-0.5">
                          <CreditCard className="h-2.5 w-2.5" /> Credit Liability
                        </span>
                      )}
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
                  const invSummary = investmentsData?.investmentWallets?.find((iw) => iw.walletId === wallet.id);
                  const isBinanceLinked =
                    invSummary?.isBinanceLinked ??
                    (wallet.name.toLowerCase().includes('binance') || isFirstInvWallet);

                  const linkedStocks = (investmentsData?.positions || []).filter(
                    (p) =>
                      !p.isWatchlistOnly &&
                      p.sharesNum > 0 &&
                      p.source !== 'binance' &&
                      (p.walletId === wallet.id || (!p.walletId && isFirstInvWallet))
                  );
                  const uninvestedCashMad = wallet.balance ?? 0;
                  const binanceCryptoMad = isBinanceLinked
                    ? investmentsData?.binance?.cryptoEquityMad ?? 0
                    : 0;
                  const linkedStockValueMad =
                    linkedStocks.reduce((sum, p) => sum + p.marketValueMad, 0) + binanceCryptoMad;
                  const totalBrokerageMad = uninvestedCashMad + linkedStockValueMad;

                  return (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {isBinanceLinked ? 'Protected Cash / Stablecoin Reserve' : 'Uninvested Brokerage Cash'}
                          </p>
                          <div className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                            {uninvestedCashMad.toFixed(2)}{' '}
                            <span className="text-xs font-medium text-gray-500">MAD</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            {isBinanceLinked ? 'Binance Spot & Equity' : 'Linked Stock Equity'}
                          </p>
                          <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {linkedStockValueMad.toFixed(2)}{' '}
                            <span className="text-[10px] font-medium text-gray-400">MAD</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50">
                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                          <TrendingUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Total Account Position:</span>
                        </div>
                        <span className="font-bold font-mono tabular-nums text-amber-900 dark:text-amber-200">
                          {totalBrokerageMad.toFixed(2)} MAD
                        </span>
                      </div>

                      {isBinanceLinked && investmentsData?.binance?.connected && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                            Binance Stablecoins: {(investmentsData.binance.stablecoinReserveMad || 0).toFixed(0)} MAD
                          </span>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={async () => {
                              setLoading(true);
                              setError(null);
                              try {
                                const res = await dashboardService.syncBinanceWallet(
                                  { walletId: wallet.id, mode: 'stablecoins_only' },
                                  token
                                );
                                await onUpdateWallet(wallet.id, { name: wallet.name });
                                setReconcileNotice(
                                  `Synced ${wallet.name} with Binance Spot Stablecoin Reserve (${res.syncedBalanceMad.toFixed(2)} MAD).`
                                );
                                setTimeout(() => setReconcileNotice(null), 5000);
                              } catch (err: any) {
                                setError(err?.message || 'Failed to sync with Binance Spot');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Sync Binance Cash
                          </button>
                        </div>
                      )}

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
                            Open Investments →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                const isCreditCard = wallet.accountSubtype === 'CreditCard' || wallet.accountSubtype === 'Overdraft';
                if (isCreditCard) {
                  const limit = parseFloat(String(wallet.creditLimit || '0')) || 0;
                  const rawBal = wallet.balance ?? 0;
                  const owedLiability = rawBal < 0 ? Math.abs(rawBal) : parseFloat(String(wallet.liabilityBalance || '0')) || 0;
                  const availableCredit = Math.max(0, limit - owedLiability);
                  const utilPct = limit > 0 ? Math.min(100, (owedLiability / limit) * 100) : 0;

                  return (
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Statement Liability Owed</p>
                          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                            {owedLiability.toFixed(2)} <span className="text-xs font-medium text-gray-500">{wallet.currency || 'MAD'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Available Credit</p>
                          <div className="text-base font-bold font-mono text-gray-900 dark:text-gray-100">
                            {availableCredit.toFixed(0)} / {limit.toFixed(0)} <span className="text-[10px] text-gray-400">MAD</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className={`h-full ${utilPct > 75 ? 'bg-rose-500' : utilPct > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                        <span>Utilization: {utilPct.toFixed(1)}% (Excluded from cash liquidity)</span>
                        {wallet.paymentDueDay && <span>Due: Day {wallet.paymentDueDay}</span>}
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
            {!wallet.isMain && wallet.type !== 'Investment' && (
              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleMakeMain(wallet)}
                  disabled={loading}
                  className="w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Star className="h-3 w-3" />
                  {wallet.type === 'Savings' ? 'Swap as Primary Bank' : 'Make Primary'}
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
