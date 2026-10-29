import React, { useEffect, useMemo, useState } from 'react';
import { Transaction, Wallet, CategoryBudget, Subscription, Goal, Debt, Payroll, DashboardTab, InvestmentsData, StockOrder } from '../../types';
import { expenseCategories, incomeAndTransferCategories, normalizeCategory } from '../../lib/categories';
import { filterTransactions, TransactionFilters, getCategorySpending, netExpenseOf, isInvestmentTransaction } from '../../lib/finance';
import { getFinancialMonthRef } from '../../lib/financialMonth';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import TransactionForm from '../TransactionForm';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Edit2,
  Filter,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Tag,
  Copy,
  Download,
  Layers,
  List,
  Table as TableIcon,
  Eye,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Wallet as WalletIcon,
  ArrowRight,
  Clock,
  Sparkles,
  PieChart,
  Repeat,
  Users,
  Coins,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

interface TransactionsTabProps {
  transactions: Transaction[];
  wallets: { id: string; name: string; type?: string; balance?: number }[];
  contexts?: any[];
  budgets?: CategoryBudget[];
  subscriptions?: Subscription[];
  goals?: Goal[];
  debts?: Debt[];
  payrolls?: Payroll[];
  investmentsData?: InvestmentsData | null;
  setActiveTab?: (tab: DashboardTab) => void;
  handleDeleteTx: (id: string) => Promise<void> | void;
  fetchData: () => void;
  selectedTransactionId?: string | null;
  onSelectionHandled?: () => void;
}

const initialFilters: TransactionFilters = {
  datePreset: 'all',
  types: [],
  categories: [],
  wallets: [],
  reimbursable: 'all',
  debtRelationship: 'all',
  sort: 'newest',
};

type ViewMode = 'grouped' | 'compact' | 'table';
type QuickPreset = 'all' | 'expense' | 'income' | 'transfer' | 'stocks' | 'split' | 'partial' | 'over_budget' | 'high_value';

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  wallets,
  contexts = [],
  budgets = [],
  subscriptions = [],
  goals = [],
  debts = [],
  payrolls = [],
  investmentsData = null,
  setActiveTab,
  handleDeleteTx,
  fetchData,
  selectedTransactionId,
  onSelectionHandled,
}) => {
  const { token } = useAuth();
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [quickPreset, setQuickPreset] = useState<QuickPreset>('all');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formInitialType, setFormInitialType] = useState<'Income' | 'Expense' | 'Transfer' | undefined>(undefined);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [duplicateTransaction, setDuplicateTransaction] = useState<Transaction | null>(null);

  // Inspector modal state
  const [inspectingTx, setInspectingTx] = useState<Transaction | null>(null);

  // Deletion modals
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Multi-selection & Batch actions
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [batchActionType, setBatchActionType] = useState<'category' | 'wallet' | 'delete' | null>(null);
  const [batchCategory, setBatchCategory] = useState<string>(expenseCategories[0]);
  const [batchWalletId, setBatchWalletId] = useState<string>(wallets[0]?.id || '');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Deep-link selection handling
  useEffect(() => {
    if (!selectedTransactionId) return;
    const transaction = transactions.find((item) => item.id === selectedTransactionId);
    if (transaction) {
      setInspectingTx(transaction);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    onSelectionHandled?.();
  }, [onSelectionHandled, selectedTransactionId, transactions]);

  // Helper to determine the financial year and month for a given transaction date
  const getTxPeriod = (txDateStr: string | Date) => {
    const d = new Date(txDateStr);
    if (payrolls && payrolls.length >= 2) {
      const ref = getFinancialMonthRef(d, payrolls);
      if (ref) return ref;
    }
    // Fallback to calendar year and 1-based month (UTC aligned to avoid timezone shift)
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
    };
  };

  // Precompute spending per category per financial month using canonical getCategorySpending:
  // "year-month-normalizedCategory" -> totalSpent
  const categorySpentMap = useMemo(() => {
    const map = new Map<string, number>();

    // Collect all unique year-month-category combinations needed from budgets and transactions
    const periodCatKeys = new Set<string>();

    for (const b of budgets) {
      if (b.category && b.year && b.month) {
        const normCat = normalizeCategory(b.category);
        periodCatKeys.add(`${b.year}-${b.month}-${normCat}`);
      }
    }

    for (const tx of transactions) {
      if ((tx.type === 'Expense' || tx.type === 'Transfer') && tx.category) {
        const period = getTxPeriod(tx.createdAt);
        let normCat = normalizeCategory(tx.category);
        if (tx.type === 'Transfer' && wallets && tx.destinationWalletId) {
          const dest = wallets.find((w) => w.id === tx.destinationWalletId);
          const destType = dest?.type?.toLowerCase();
          if (destType === 'investment') normCat = '📈 Investments';
          else if (destType === 'savings') normCat = '🛟 Emergency & goals Fund';
        }
        if (normCat) {
          periodCatKeys.add(`${period.year}-${period.month}-${normCat}`);
        }
      }
    }

    // Now calculate exact canonical category spending for each needed combination
    for (const key of periodCatKeys) {
      const [yStr, mStr, ...catParts] = key.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const normCat = catParts.join('-');

      const totalSpent = getCategorySpending(transactions, normCat, y, m, payrolls || [], wallets);
      map.set(key, totalSpent);
    }

    return map;
  }, [transactions, budgets, payrolls, wallets]);

  // Active subscriptions normalized lookup
  const activeSubs = useMemo(() => {
    return (subscriptions || []).filter((s) => s.status !== 'cancelled');
  }, [subscriptions]);

  // Match a transaction to a subscription
  const getMatchedSubscription = (tx: Transaction): Subscription | undefined => {
    if (tx.type !== 'Expense') return undefined;
    const notesLower = (tx.notes || '').toLowerCase().trim();
    const catLower = (tx.category || '').toLowerCase().trim();

    return activeSubs.find((sub) => {
      const subNameLower = sub.name.toLowerCase().trim();
      if (notesLower && (notesLower.includes(subNameLower) || subNameLower.includes(notesLower))) {
        return true;
      }
      if (catLower && catLower === sub.category.toLowerCase().trim()) {
        const txAmt = parseFloat(tx.amount) || 0;
        const subAmt = parseFloat(sub.amount) || 0;
        if (Math.abs(txAmt - subAmt) < 0.5) return true;
      }
      return false;
    });
  };

  // Match a transaction to a Stock Order (Buy / Sell / Dividend)
  const stockOrderByTxId = useMemo(() => {
    const map = new Map<string, StockOrder>();
    for (const order of investmentsData?.orders || []) {
      if (order.linkedTransactionId) {
        map.set(order.linkedTransactionId, order);
      }
    }
    return map;
  }, [investmentsData?.orders]);

  const getMatchedStockOrder = (tx: Transaction): StockOrder | undefined => {
    return stockOrderByTxId.get(tx.id);
  };

  // Check budget health for an expense transaction
  const getTransactionBudgetHealth = (tx: Transaction) => {
    if (tx.type !== 'Expense' || !tx.category) return null;
    const { year: y, month: m } = getTxPeriod(tx.createdAt);
    const normCat = normalizeCategory(tx.category);

    // Find the corresponding budget entry for this category and period
    const budget = budgets.find(
      (b) => b.year === y && b.month === m && normalizeCategory(b.category) === normCat
    );

    if (!budget) return null;
    const budgetLimit = parseFloat(budget.amount) || 0;
    const key = `${y}-${m}-${normCat}`;
    const totalSpent = categorySpentMap.has(key)
      ? (categorySpentMap.get(key) || 0)
      : getCategorySpending(transactions, normCat, y, m, payrolls || [], wallets);

    const usagePercent = budgetLimit > 0 ? (totalSpent / budgetLimit) * 100 : 0;
    const isOver = totalSpent > budgetLimit;
    const isWarning = usagePercent >= 80 && !isOver;

    return {
      budgetLimit,
      totalSpent,
      usagePercent,
      isOver,
      isWarning,
      category: budget.category,
      year: y,
      month: m,
    };
  };

  // Categories list
  const categories = useMemo(() => [...expenseCategories], []);

  // Filter transactions
  const visibleTransactions = useMemo(() => {
    let result = filterTransactions(transactions, filters);

    // Apply quick presets if active
    if (quickPreset === 'expense') {
      result = result.filter((tx) => tx.type === 'Expense');
    } else if (quickPreset === 'income') {
      result = result.filter((tx) => tx.type === 'Income');
    } else if (quickPreset === 'transfer') {
      result = result.filter((tx) => tx.type === 'Transfer');
    } else if (quickPreset === 'stocks') {
      result = result.filter(
        (tx) =>
          stockOrderByTxId.has(tx.id) ||
          isInvestmentTransaction(tx, wallets) ||
          normalizeCategory(tx.category) === '📈 Investments' ||
          normalizeCategory(tx.category) === '📈 Investment Returns / Dividends'
      );
    } else if (quickPreset === 'split') {
      result = result.filter(
        (tx) => (tx.splits && tx.splits.length > 0) || (parseFloat(tx.reimbursableAmount || '0') > 0)
      );
    } else if (quickPreset === 'partial') {
      result = result.filter(
        (tx) => Boolean(tx.isPartialPayment) || parseFloat(tx.unpaidAmount || '0') > 0
      );
    } else if (quickPreset === 'high_value') {
      result = result.filter((tx) => parseFloat(tx.amount) >= 500);
    } else if (quickPreset === 'over_budget') {
      result = result.filter((tx) => {
        const bh = getTransactionBudgetHealth(tx);
        return bh && bh.isOver;
      });
    }

    return result;
  }, [filters, transactions, quickPreset, budgets, categorySpentMap, stockOrderByTxId, wallets]);

  // Active filter count
  const activeFilterCount = [
    filters.datePreset !== 'all',
    Boolean(filters.types?.length),
    Boolean(filters.categories?.length),
    Boolean(filters.wallets?.length),
    filters.minAmount !== undefined,
    filters.maxAmount !== undefined,
    filters.reimbursable !== 'all',
    filters.debtRelationship !== 'all',
    quickPreset !== 'all',
  ].filter(Boolean).length;

  const update = (patch: Partial<TransactionFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const toggle = <T,>(values: T[] | undefined, value: T) =>
    values?.includes(value) ? values.filter((item) => item !== value) : [...(values || []), value];
  const clearFilters = () => {
    setFilters({ ...initialFilters, query: filters.query });
    setQuickPreset('all');
  };

  // Editor actions
  const openEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setDuplicateTransaction(null);
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDuplicate = (transaction: Transaction) => {
    setDuplicateTransaction(transaction);
    setEditingTransaction(null);
    setShowForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNewForm = (type?: 'Income' | 'Expense' | 'Transfer') => {
    setFormInitialType(type);
    setEditingTransaction(null);
    setDuplicateTransaction(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeEditor = () => {
    setEditingTransaction(null);
    setDuplicateTransaction(null);
    setShowForm(false);
    setFormInitialType(undefined);
  };

  // Single delete
  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await handleDeleteTx(transactionToDelete.id);
      if (inspectingTx?.id === transactionToDelete.id) {
        setInspectingTx(null);
      }
      setTransactionToDelete(null);
      selectedTxIds.delete(transactionToDelete.id);
      setSelectedTxIds(new Set(selectedTxIds));
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete transaction.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Multi-select management
  const toggleSelectTx = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTxIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedTxIds.size === visibleTransactions.length && visibleTransactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(visibleTransactions.map((tx) => tx.id)));
    }
  };

  // Batch actions
  const handleBatchRecategorize = async () => {
    if (selectedTxIds.size === 0 || !batchCategory) return;
    setIsBatchProcessing(true);
    setBatchError(null);
    try {
      await Promise.all(
        Array.from(selectedTxIds).map((id) =>
          dashboardService.updateTransaction(id, { category: batchCategory }, token)
        )
      );
      await fetchData();
      setSelectedTxIds(new Set());
      setBatchActionType(null);
    } catch (e: any) {
      setBatchError(e?.message || 'Failed to update transactions.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchMoveWallet = async () => {
    if (selectedTxIds.size === 0 || !batchWalletId) return;
    setIsBatchProcessing(true);
    setBatchError(null);
    try {
      await Promise.all(
        Array.from(selectedTxIds).map((id) =>
          dashboardService.updateTransaction(id, { walletId: batchWalletId }, token)
        )
      );
      await fetchData();
      setSelectedTxIds(new Set());
      setBatchActionType(null);
    } catch (e: any) {
      setBatchError(e?.message || 'Failed to change wallet for selected transactions.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTxIds.size === 0) return;
    setIsBatchProcessing(true);
    setBatchError(null);
    try {
      for (const id of Array.from(selectedTxIds)) {
        await handleDeleteTx(id);
      }
      setSelectedTxIds(new Set());
      setBatchActionType(null);
    } catch (e: any) {
      setBatchError(e?.message || 'Error occurred during bulk deletion.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // CSV Export
  const exportToCsv = (txList: Transaction[]) => {
    if (txList.length === 0) return;
    const headers = [
      'ID',
      'Date',
      'Type',
      'Category',
      'Amount (MAD)',
      'Source Wallet',
      'Destination Wallet',
      'Notes / Merchant',
      'Reimbursable Amount (MAD)',
      'Linked Contact / Splits',
      'Context',
    ];

    const rows = txList.map((tx) => {
      const srcWallet = wallets?.find((w) => w.id === tx.walletId)?.name || 'Unknown';
      const destWallet = tx.destinationWalletId
        ? wallets?.find((w) => w.id === tx.destinationWalletId)?.name || 'Unknown'
        : '';
      const ctxName = tx.contextId ? contexts?.find((c) => c.id === tx.contextId)?.name || '' : '';
      const splitsSummary =
        tx.splits && tx.splits.length > 0
          ? tx.splits.map((s) => `${s.linkedContactName || 'Anonymous'}: ${s.reimbursableAmount}`).join('; ')
          : tx.linkedContactName || '';

      return [
        tx.id,
        format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm'),
        tx.type,
        `"${(tx.category || '').replace(/"/g, '""')}"`,
        tx.amount,
        `"${srcWallet.replace(/"/g, '""')}"`,
        `"${destWallet.replace(/"/g, '""')}"`,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        tx.reimbursableAmount || '0',
        `"${splitsSummary.replace(/"/g, '""')}"`,
        `"${ctxName.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Group transactions by local date
  const dateGroups = useMemo(() => {
    const groups: { dateKey: string; label: string; date: Date; items: Transaction[]; netDay: number }[] = [];
    const groupMap = new Map<string, { label: string; date: Date; items: Transaction[]; netDay: number }>();

    for (const tx of visibleTransactions) {
      const d = new Date(tx.createdAt);
      const key = format(d, 'yyyy-MM-dd');
      let g = groupMap.get(key);
      if (!g) {
        let label = format(d, 'EEEE, MMM d, yyyy');
        if (isToday(d)) {
          label = `Today • ${format(d, 'MMM d, yyyy')}`;
        } else if (isYesterday(d)) {
          label = `Yesterday • ${format(d, 'MMM d, yyyy')}`;
        }
        g = { label, date: d, items: [], netDay: 0 };
        groupMap.set(key, g);
      }
      g.items.push(tx);
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'Income') g.netDay += amt;
      else if (tx.type === 'Expense') {
        const reimb = parseFloat(tx.reimbursableAmount || '0') || 0;
        g.netDay -= Math.max(0, amt - reimb);
      }
    }

    for (const [dateKey, g] of groupMap.entries()) {
      groups.push({ dateKey, ...g });
    }

    return groups;
  }, [visibleTransactions]);

  return (
    <div className="space-y-6">
      {/* Transaction Form (Create, Edit, Duplicate) */}
      {(showForm || editingTransaction || duplicateTransaction) && (
        <TransactionForm
          transaction={editingTransaction}
          duplicateFrom={duplicateTransaction}
          initialType={formInitialType}
          wallets={wallets}
          contexts={contexts}
          onSuccess={fetchData}
          onCancel={closeEditor}
          onDelete={handleDeleteTx}
        />
      )}

      {/* Transaction Inspector Slide-over/Modal */}
      {inspectingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Transaction Details</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    inspectingTx.type === 'Income'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : inspectingTx.type === 'Transfer'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                  }`}
                >
                  {inspectingTx.type}
                </span>
              </div>
              <button
                onClick={() => setInspectingTx(null)}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
              {/* Header Amount & Notes */}
              <div className="text-center pb-2">
                <div
                  className={`text-3xl font-extrabold tracking-tight ${
                    inspectingTx.type === 'Income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : inspectingTx.type === 'Expense'
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {inspectingTx.type === 'Expense' ? '-' : inspectingTx.type === 'Income' ? '+' : ''}
                  {Number.parseFloat(inspectingTx.amount).toFixed(2)} MAD
                </div>
                <h3 className="mt-1.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                  {inspectingTx.notes || inspectingTx.category || inspectingTx.type}
                </h3>
                <p className="mt-0.5 text-xs text-gray-400 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {format(new Date(inspectingTx.createdAt), 'EEEE, MMMM d, yyyy • h:mm a')}
                </p>
              </div>

              {/* Wallet Information Card */}
              <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-4 space-y-3">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Wallet & Routing
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Debited / Source Wallet</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mt-0.5">
                      <Landmark className="w-4 h-4 text-gray-400" />
                      {wallets.find((w) => w.id === inspectingTx.walletId)?.name || 'Default Wallet'}
                    </span>
                  </div>
                  {inspectingTx.type === 'Transfer' && inspectingTx.destinationWalletId && (
                    <div>
                      <span className="text-xs text-gray-400 block">Credited / Target Wallet</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5 mt-0.5">
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        {wallets.find((w) => w.id === inspectingTx.destinationWalletId)?.name || 'Destination Wallet'}
                      </span>
                    </div>
                  )}
                  {inspectingTx.category && (
                    <div>
                      <span className="text-xs text-gray-400 block">Category</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200 mt-0.5 block">
                        {inspectingTx.category}
                      </span>
                    </div>
                  )}
                  {inspectingTx.contextId && contexts.find((c) => c.id === inspectingTx.contextId) && (
                    <div>
                      <span className="text-xs text-gray-400 block">Financial Context</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5">
                        <Tag className="w-3.5 h-3.5" />
                        {contexts.find((c) => c.id === inspectingTx.contextId)?.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Budget Health Card */}
              {(() => {
                const bh = getTransactionBudgetHealth(inspectingTx);
                if (!bh) return null;
                return (
                  <div className="rounded-2xl border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                        <PieChart className="w-3.5 h-3.5" />
                        Connected Budget: {bh.category}
                      </span>
                      {setActiveTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingTx(null);
                            setActiveTab('budgets');
                          }}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          View Budgets <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Monthly Budget</span>
                        <p className="font-bold text-gray-900 dark:text-gray-100">{bh.budgetLimit.toFixed(2)} MAD</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Spent This Month</span>
                        <p className="font-bold text-gray-900 dark:text-gray-100">{bh.totalSpent.toFixed(2)} MAD</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Status</span>
                        <p className={`font-bold ${bh.isOver ? 'text-rose-600' : bh.isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {bh.isOver ? 'Over budget' : `${Math.round(bh.usagePercent)}% used`}
                        </p>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-emerald-200/50 dark:bg-emerald-900/40 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          bh.isOver ? 'bg-rose-500' : bh.isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, bh.usagePercent)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Connected Subscription Detection Card */}
              {(() => {
                const matchedSub = getMatchedSubscription(inspectingTx);
                if (!matchedSub) return null;
                return (
                  <div className="rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Repeat className="w-3.5 h-3.5" />
                        Recurring Subscription Match
                      </span>
                      {setActiveTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingTx(null);
                            setActiveTab('subscriptions');
                          }}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          View Subscriptions <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-950 dark:text-indigo-200 text-sm">
                        {matchedSub.name} ({matchedSub.billingCycle})
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {parseFloat(matchedSub.amount).toFixed(2)} MAD
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Matches your registered recurring bill in Subscriptions.
                    </p>
                  </div>
                );
              })()}

              {/* Connected Stock Order / Equity Trade Card */}
              {(() => {
                const matchedOrder = getMatchedStockOrder(inspectingTx);
                const isInvTransfer =
                  inspectingTx.type === 'Transfer' &&
                  inspectingTx.destinationWalletId &&
                  wallets.find((w) => w.id === inspectingTx.destinationWalletId)?.type === 'Investment';

                if (!matchedOrder && !isInvTransfer) return null;

                const matchedPosition = matchedOrder
                  ? investmentsData?.positions.find(
                      (p) => p.id === matchedOrder.positionId || p.ticker === matchedOrder.ticker
                    )
                  : undefined;

                return (
                  <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5" />
                        {matchedOrder
                          ? `Connected Stock Order: ${matchedOrder.action} ${matchedOrder.ticker || matchedPosition?.ticker || ''}`
                          : 'Brokerage Reserve Capital Funding'}
                      </span>
                      {setActiveTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingTx(null);
                            setActiveTab('investments');
                          }}
                          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          Open Stock Portfolio <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {matchedOrder ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Shares & Price</span>
                            <p className="font-bold text-gray-900 dark:text-gray-100">
                              {parseFloat(matchedOrder.shares).toFixed(2)} sh @ {parseFloat(matchedOrder.pricePerShare).toFixed(2)} {matchedOrder.currency || 'USD'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">MAD Settlement</span>
                            <p className="font-bold text-indigo-600 dark:text-indigo-400">
                              {parseFloat(matchedOrder.totalMadAmount).toFixed(2)} MAD
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Current Position</span>
                            <p className="font-bold text-gray-900 dark:text-gray-100">
                              {matchedPosition
                                ? `${matchedPosition.sharesNum.toFixed(2)} sh (${matchedPosition.unrealizedPnlPercent >= 0 ? '+' : ''}${matchedPosition.unrealizedPnlPercent.toFixed(1)}%)`
                                : matchedOrder.companyName || matchedOrder.ticker || 'Position'}
                            </p>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Protected under Financial Calculation Contract — treated as equity capital conversion, not living burn.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Moved liquid funds into your Brokerage Reserve (<code className="font-mono">Investment</code> wallet). Counts toward your <span className="font-semibold">📈 Investments</span> monthly target without inflating living expenses.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Uncompleted / Partial Payment Breakdown Card */}
              {inspectingTx.isPartialPayment && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/25 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Uncompleted / Partial Payment
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inspectingTx.unpaidStatus === 'Settled' ||
                          parseFloat(inspectingTx.unpaidRemainingBalance || '0') <= 0.009
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                        }`}
                      >
                        {inspectingTx.unpaidStatus === 'Settled' ||
                        parseFloat(inspectingTx.unpaidRemainingBalance || '0') <= 0.009
                          ? 'Completed / Settled'
                          : 'Partially Paid • Balance Owed'}
                      </span>
                      {setActiveTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setInspectingTx(null);
                            setActiveTab('debts');
                          }}
                          className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-0.5"
                        >
                          Manage Debt <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-white/80 dark:bg-gray-900/70 p-2.5 border border-amber-100 dark:border-amber-900/40">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Total Bill</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                        {parseFloat(
                          inspectingTx.totalBillAmount ||
                            String(
                              (parseFloat(inspectingTx.amount || '0') || 0) +
                                (parseFloat(inspectingTx.unpaidAmount || '0') || 0),
                            ),
                        ).toFixed(2)}{' '}
                        MAD
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/80 dark:bg-gray-900/70 p-2.5 border border-amber-100 dark:border-amber-900/40">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Paid From Wallet</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                        {parseFloat(inspectingTx.amount || '0').toFixed(2)} MAD
                      </span>
                    </div>
                    <div className="rounded-xl bg-white/80 dark:bg-gray-900/70 p-2.5 border border-amber-100 dark:border-amber-900/40">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Still Owed</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                        {parseFloat(
                          inspectingTx.unpaidRemainingBalance ?? inspectingTx.unpaidAmount ?? '0',
                        ).toFixed(2)}{' '}
                        MAD
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/50 dark:border-amber-900/40">
                    <span className="text-gray-600 dark:text-gray-300">
                      Creditor / Owed To:{' '}
                      <strong className="text-gray-900 dark:text-white">
                        {inspectingTx.unpaidContactName || 'Merchant / Counterparty'}
                      </strong>
                    </span>
                    <span className="text-[11px] text-amber-800 dark:text-amber-300 font-mono">
                      Initial unpaid part: {parseFloat(inspectingTx.unpaidAmount || '0').toFixed(2)} MAD
                    </span>
                  </div>
                </div>
              )}

              {/* Split & Debt Breakdown Card */}
              {((inspectingTx.splits && inspectingTx.splits.length > 0) ||
                parseFloat(inspectingTx.reimbursableAmount || '0') > 0 ||
                inspectingTx.linkedContactName) && (
                <div className="rounded-2xl border border-blue-100 dark:border-blue-950/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Split & Reimbursable Breakdown
                    </span>
                    {setActiveTab && (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectingTx(null);
                          setActiveTab('debts');
                        }}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        View Debts <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {inspectingTx.splits && inspectingTx.splits.length > 0 ? (
                    <div className="space-y-1.5 divide-y divide-blue-100/50 dark:divide-blue-900/30">
                      {inspectingTx.splits.map((s, idx) => (
                        <div key={s.id || idx} className="flex items-center justify-between pt-1.5 text-xs">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {s.linkedContactName || 'Unknown Contact'}
                          </span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            +{parseFloat(s.reimbursableAmount || '0').toFixed(2)} MAD owed
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {inspectingTx.linkedContactName || 'Pending Contact'}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        +{parseFloat(inspectingTx.reimbursableAmount || '0').toFixed(2)} MAD owed
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-6 py-3.5 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const tx = inspectingTx;
                  setInspectingTx(null);
                  openDuplicate(tx);
                }}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tx = inspectingTx;
                    setInspectingTx(null);
                    setTransactionToDelete(tx);
                  }}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const tx = inspectingTx;
                    setInspectingTx(null);
                    openEdit(tx);
                  }}
                  className="gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete Transaction?</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  This transaction will be permanently removed. Your wallet balance and cash flow metrics will be updated
                  immediately.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Date</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {format(new Date(transactionToDelete.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Amount</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {transactionToDelete.type === 'Expense' ? '-' : transactionToDelete.type === 'Income' ? '+' : ''}
                  {Number.parseFloat(transactionToDelete.amount).toFixed(2)} MAD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">Category / Type</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {transactionToDelete.category || transactionToDelete.type}
                </span>
              </div>
              {transactionToDelete.notes && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Notes</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                    {transactionToDelete.notes}
                  </span>
                </div>
              )}
            </div>

            {deleteError && <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => {
                  setTransactionToDelete(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Transaction'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {batchActionType === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Delete {selectedTxIds.size} Selected Transactions?
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete all {selectedTxIds.size} transactions? This cannot be undone.
                </p>
              </div>
            </div>

            {batchError && <p className="text-xs text-red-600 dark:text-red-400">{batchError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBatchProcessing}
                onClick={() => {
                  setBatchActionType(null);
                  setBatchError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isBatchProcessing}
                onClick={handleBatchDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isBatchProcessing ? 'Deleting All...' : `Delete ${selectedTxIds.size} Transactions`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Change Category Modal */}
      {batchActionType === 'category' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <Tag className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Batch Recategorize ({selectedTxIds.size} items)
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Select a new category to apply to all selected transactions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Choose New Category</label>
              <Select value={batchCategory} onChange={(e) => setBatchCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            {batchError && <p className="text-xs text-red-600 dark:text-red-400">{batchError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBatchProcessing}
                onClick={() => {
                  setBatchActionType(null);
                  setBatchError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={isBatchProcessing} onClick={handleBatchRecategorize}>
                {isBatchProcessing ? 'Updating...' : 'Apply Category'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Change Wallet Modal */}
      {batchActionType === 'wallet' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Reassign Wallet ({selectedTxIds.size} items)
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Select which wallet should fund or receive all selected transactions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Choose Target Wallet</label>
              <Select value={batchWalletId} onChange={(e) => setBatchWalletId(e.target.value)}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type || 'Bank'})
                  </option>
                ))}
              </Select>
            </div>

            {batchError && <p className="text-xs text-red-600 dark:text-red-400">{batchError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBatchProcessing}
                onClick={() => {
                  setBatchActionType(null);
                  setBatchError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="button" disabled={isBatchProcessing} onClick={handleBatchMoveWallet}>
                {isBatchProcessing ? 'Reassigning...' : 'Reassign Wallet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Transactions Card */}
      <Card>
        <CardHeader className="flex flex-col gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Transactions Ledger</CardTitle>
              <p className="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                Search, filter, batch-edit, export, and inspect interconnected financial records.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportToCsv(visibleTransactions)}
                className="gap-1.5"
                title="Export filtered transactions to CSV"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>

              {/* Fast entry button group */}
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5">
                <button
                  type="button"
                  onClick={() => openNewForm('Expense')}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="New Expense"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-rose-500" /> Expense
                </button>
                <button
                  type="button"
                  onClick={() => openNewForm('Income')}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="New Income"
                >
                  <ArrowDownRight className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Income
                </button>
                <button
                  type="button"
                  onClick={() => openNewForm('Transfer')}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  title="New Transfer"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1 text-blue-500" /> Transfer
                </button>
              </div>

              <Button type="button" size="sm" onClick={() => openNewForm()} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Transaction
              </Button>
            </div>
          </div>

          {/* Search, Filter Toggle, and View Mode Switcher */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={filters.query || ''}
                  onChange={(event) => update({ query: event.target.value })}
                  className="pl-9 pr-8"
                  placeholder="Search merchant, notes, category, contact, or context…"
                />
                {filters.query && (
                  <button
                    onClick={() => update({ query: '' })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant={showFilters || activeFilterCount > 0 ? 'default' : 'outline'}
                onClick={() => setShowFilters((curr) => !curr)}
                className="shrink-0 gap-1.5"
              >
                <Filter className="h-4 w-4" />
                Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
              </Button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center self-end sm:self-auto gap-1 rounded-xl border border-gray-200 dark:border-gray-800 p-1 bg-gray-50 dark:bg-gray-800/40">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'grouped'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Grouped by Date Timeline"
              >
                <Layers className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'compact'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Compact List Rows"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
                title="Spreadsheet / Table View"
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Preset Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setQuickPreset('all')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'all'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'expense' ? 'all' : 'expense')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'expense'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100'
              }`}
            >
              💸 Expenses Only
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'income' ? 'all' : 'income')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'income'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
              }`}
            >
              💰 Income Only
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'transfer' ? 'all' : 'transfer')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'transfer'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100'
              }`}
            >
              🔄 Transfers
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'stocks' ? 'all' : 'stocks')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'stocks'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100'
              }`}
            >
              📈 Stock Orders &amp; Reserve
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'split' ? 'all' : 'split')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'split'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              👥 Splits & Owed
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'partial' ? 'all' : 'partial')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'partial'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              ⏳ Uncompleted / Partial
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'over_budget' ? 'all' : 'over_budget')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'over_budget'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100'
              }`}
            >
              ⚠️ Over-Budget Spend
            </button>
            <button
              onClick={() => setQuickPreset(quickPreset === 'high_value' ? 'all' : 'high_value')}
              className={`rounded-full px-3 py-1 font-medium transition-all whitespace-nowrap ${
                quickPreset === 'high_value'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 hover:bg-purple-100'
              }`}
            >
              ⚡ High Value (&gt;500 MAD)
            </button>
          </div>

          {/* Advanced Filters Expandable Drawer */}
          {showFilters && (
            <div className="space-y-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-4 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-gray-500" /> Advanced Filters
                </h3>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                  <X className="mr-1 h-3 w-3" /> Clear filters
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Date Preset
                  <Select
                    value={filters.datePreset}
                    onChange={(event) => update({ datePreset: event.target.value as TransactionFilters['datePreset'] })}
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="last-month">Last month</option>
                    <option value="custom">Custom range</option>
                  </Select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Reimbursable
                  <Select
                    value={filters.reimbursable}
                    onChange={(event) => update({ reimbursable: event.target.value as TransactionFilters['reimbursable'] })}
                  >
                    <option value="all">All transactions</option>
                    <option value="reimbursable">Reimbursable / Split</option>
                    <option value="non-reimbursable">Non-reimbursable</option>
                  </Select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Debt Relationship
                  <Select
                    value={filters.debtRelationship}
                    onChange={(event) =>
                      update({ debtRelationship: event.target.value as TransactionFilters['debtRelationship'] })
                    }
                  >
                    <option value="all">All</option>
                    <option value="debt-linked">Debt-linked</option>
                    <option value="not-debt-related">Not debt-related</option>
                  </Select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Sort Order
                  <Select
                    value={filters.sort}
                    onChange={(event) => update({ sort: event.target.value as TransactionFilters['sort'] })}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest">Highest amount</option>
                    <option value="lowest">Lowest amount</option>
                  </Select>
                </label>
              </div>

              {filters.datePreset === 'custom' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    From
                    <Input
                      type="date"
                      value={filters.startDate || ''}
                      onChange={(event) => update({ startDate: event.target.value || undefined })}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    To
                    <Input
                      type="date"
                      value={filters.endDate || ''}
                      onChange={(event) => update({ endDate: event.target.value || undefined })}
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Type</p>
                  <div className="flex flex-wrap gap-3">
                    {(['Expense', 'Income', 'Transfer'] as Transaction['type'][]).map((type) => (
                      <label key={type} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={filters.types?.includes(type)}
                          onChange={() => update({ types: toggle(filters.types, type) })}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Wallet</p>
                  <div className="flex flex-wrap gap-3">
                    {(wallets || []).map((wallet) => (
                      <label key={wallet.id} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={filters.wallets?.includes(wallet.id)}
                          onChange={() => update({ wallets: toggle(filters.wallets, wallet.id) })}
                        />
                        {wallet.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Min amount
                    <Input
                      min="0"
                      type="number"
                      value={filters.minAmount ?? ''}
                      onChange={(event) =>
                        update({ minAmount: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                      placeholder="0"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Max amount
                    <Input
                      min="0"
                      type="number"
                      value={filters.maxAmount ?? ''}
                      onChange={(event) =>
                        update({ maxAmount: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                      placeholder="Any"
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Filter by Category <span className="font-normal text-gray-400">({filters.categories?.length || 0} selected)</span>
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => update({ categories: toggle(filters.categories, category) })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        filters.categories?.includes(category)
                          ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* List Metadata & Selection Toolbar */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTxIds.size === visibleTransactions.length && visibleTransactions.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-950"
                />
                <span>Select All ({visibleTransactions.length})</span>
              </label>

              {selectedTxIds.size > 0 && (
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {selectedTxIds.size} selected
                </span>
              )}
            </div>

            <span>
              Showing {visibleTransactions.length} of {transactions.length} record{transactions.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Floating/Sticky Batch Action Bar */}
          {selectedTxIds.size > 0 && (
            <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-4 py-3 shadow-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
                <span className="text-xs font-bold">
                  {selectedTxIds.size} transaction{selectedTxIds.size === 1 ? '' : 's'} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchActionType('category')}
                  className="h-7 text-xs bg-gray-800 border-gray-700 text-white dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900"
                >
                  Change Category
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchActionType('wallet')}
                  className="h-7 text-xs bg-gray-800 border-gray-700 text-white dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900"
                >
                  Move Wallet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const selectedList = visibleTransactions.filter((tx) => selectedTxIds.has(tx.id));
                    exportToCsv(selectedList);
                  }}
                  className="h-7 text-xs bg-gray-800 border-gray-700 text-white dark:bg-gray-200 dark:border-gray-300 dark:text-gray-900 gap-1"
                >
                  <Download className="w-3 h-3" /> Export Selected
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setBatchActionType('delete')}
                  className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white border-0"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
                <button
                  onClick={() => setSelectedTxIds(new Set())}
                  className="p-1 text-gray-400 hover:text-white dark:hover:text-gray-900 transition-colors"
                  title="Deselect all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* VIEW MODE 1: Grouped by Date (Default modern fintech layout) */}
          {viewMode === 'grouped' && (
            <div className="space-y-6">
              {dateGroups.map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  {/* Date Header with Daily Subtotal */}
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 py-2 backdrop-blur-sm">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{group.label}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{group.items.length} items</span>
                      <span
                        className={`font-semibold ${
                          group.netDay >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {group.netDay >= 0 ? '+' : ''}
                        {group.netDay.toFixed(2)} MAD
                      </span>
                    </div>
                  </div>

                  {/* Grouped items */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
                    {group.items.map((transaction) => {
                      const budgetHealth = getTransactionBudgetHealth(transaction);
                      const matchedSub = getMatchedSubscription(transaction);
                      const isSelected = selectedTxIds.has(transaction.id);

                      return (
                        <div
                          key={transaction.id}
                          className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-2 rounded-xl transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                              : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTx(transaction.id)}
                              className="rounded border-gray-300 text-gray-900 focus:ring-gray-950 shrink-0"
                            />

                            {/* Type Icon */}
                            <div
                              onClick={() => setInspectingTx(transaction)}
                              className={`cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                transaction.type === 'Income'
                                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : transaction.type === 'Transfer'
                                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                                  : 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                              }`}
                            >
                              {transaction.type === 'Income' ? (
                                <ArrowDownRight className="h-5 w-5" />
                              ) : transaction.type === 'Transfer' ? (
                                <RefreshCw className="h-4 w-4" />
                              ) : (
                                <ArrowUpRight className="h-5 w-5" />
                              )}
                            </div>

                            {/* Main Details */}
                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setInspectingTx(transaction)}>
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-sm text-gray-900 dark:text-gray-100">
                                  {transaction.notes || transaction.category || transaction.type}
                                </p>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1 font-medium">
                                  <Landmark className="h-3 w-3 text-gray-400" />
                                  {wallets?.find((w) => w.id === transaction.walletId)?.name || 'Default'}
                                  {transaction.type === 'Transfer' && transaction.destinationWalletId && (
                                    <> → {wallets?.find((w) => w.id === transaction.destinationWalletId)?.name || 'Default'}</>
                                  )}
                                </span>

                                {transaction.category && (
                                  <>
                                    <span>•</span>
                                    <span>{transaction.category}</span>
                                  </>
                                )}

                                {/* Interconnected Budget Health Badge */}
                                {budgetHealth && (
                                  <span
                                    title={`Category: ${budgetHealth.category} (${budgetHealth.year}-${String(budgetHealth.month).padStart(2, '0')}) • Spent: ${budgetHealth.totalSpent.toFixed(2)} MAD of ${budgetHealth.budgetLimit.toFixed(2)} MAD budget`}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-help ${
                                      budgetHealth.isOver
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                        : budgetHealth.isWarning
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    }`}
                                  >
                                    {budgetHealth.isOver
                                      ? `⚠️ Over budget (${Math.round(budgetHealth.usagePercent)}%)`
                                      : `${Math.round(budgetHealth.usagePercent)}% of budget`}
                                  </span>
                                )}

                                {/* Interconnected Subscription Badge */}
                                {matchedSub && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400">
                                    <Repeat className="w-2.5 h-2.5" /> Sub: {matchedSub.name}
                                  </span>
                                )}

                                {/* Interconnected Stock Order Badge */}
                                {(() => {
                                  const matchedOrder = getMatchedStockOrder(transaction);
                                  if (!matchedOrder) return null;
                                  return (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                                      📈 {matchedOrder.action} {parseFloat(matchedOrder.shares).toFixed(2)} {matchedOrder.ticker || ''} @ {parseFloat(matchedOrder.pricePerShare).toFixed(2)} {matchedOrder.currency || 'USD'}
                                    </span>
                                  );
                                })()}

                                {/* Interconnected Uncompleted / Partial Payment Badge */}
                                {transaction.isPartialPayment && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                      transaction.unpaidStatus === 'Settled' ||
                                      parseFloat(transaction.unpaidRemainingBalance || '0') <= 0.009
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                        : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
                                    }`}
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    {transaction.unpaidStatus === 'Settled' ||
                                    parseFloat(transaction.unpaidRemainingBalance || '0') <= 0.009
                                      ? `Partial Bill Completed (${parseFloat(transaction.totalBillAmount || transaction.amount).toFixed(0)} MAD)`
                                      : `Paid ${parseFloat(transaction.amount).toFixed(0)}/${parseFloat(
                                          transaction.totalBillAmount ||
                                            String(
                                              parseFloat(transaction.amount) +
                                                parseFloat(transaction.unpaidAmount || '0'),
                                            ),
                                        ).toFixed(0)} MAD • Owe ${parseFloat(
                                          transaction.unpaidRemainingBalance || transaction.unpaidAmount || '0',
                                        ).toFixed(0)} MAD${
                                          transaction.unpaidContactName ? ` to ${transaction.unpaidContactName}` : ''
                                        }`}
                                  </span>
                                )}

                                {/* Interconnected Split / Contact Badge */}
                                {transaction.splits && transaction.splits.length > 1 ? (
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    Split ({transaction.splits.length} people)
                                  </span>
                                ) : transaction.linkedContactName ? (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    Owed: {transaction.linkedContactName}
                                  </span>
                                ) : null}

                                {/* Context Badge */}
                                {transaction.contextId && contexts?.find((c) => c.id === transaction.contextId) && (
                                  <span className="flex items-center text-blue-600 dark:text-blue-400">
                                    <Tag className="w-2.5 h-2.5 mr-0.5" />
                                    {contexts.find((c) => c.id === transaction.contextId)?.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Amount & Quick Action Buttons */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                            <span
                              className={`font-semibold text-sm whitespace-nowrap ${
                                transaction.type === 'Income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : transaction.type === 'Expense'
                                  ? 'text-gray-900 dark:text-gray-100'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {transaction.type === 'Expense' ? '-' : transaction.type === 'Income' ? '+' : ''}
                              {Number.parseFloat(transaction.amount).toFixed(2)} MAD
                            </span>

                            <div className="flex items-center gap-0.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Inspect details"
                                className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                onClick={() => setInspectingTx(transaction)}
                                title="Inspect details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Duplicate"
                                className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                                onClick={() => openDuplicate(transaction)}
                                title="Duplicate transaction"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${transaction.category || transaction.type}`}
                                className="h-8 w-8 text-gray-400 hover:text-blue-600"
                                onClick={() => openEdit(transaction)}
                                title="Edit transaction"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${transaction.category || transaction.type}`}
                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                onClick={() => {
                                  setTransactionToDelete(transaction);
                                  setDeleteError(null);
                                }}
                                title="Delete transaction"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW MODE 2: Compact List Rows */}
          {viewMode === 'compact' && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {visibleTransactions.map((transaction) => {
                const isSelected = selectedTxIds.has(transaction.id);
                return (
                  <div
                    key={transaction.id}
                    className={`flex items-center justify-between gap-3 py-2.5 px-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectTx(transaction.id)}
                        className="rounded border-gray-300 text-gray-900 focus:ring-gray-950"
                      />
                      <span className="text-xs text-gray-400 font-mono w-20 shrink-0">
                        {format(new Date(transaction.createdAt), 'MMM d, yy')}
                      </span>
                      <span
                        className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                          transaction.type === 'Income'
                            ? 'bg-emerald-500'
                            : transaction.type === 'Transfer'
                            ? 'bg-blue-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span
                        onClick={() => setInspectingTx(transaction)}
                        className="truncate text-xs font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:underline"
                      >
                        {transaction.notes || transaction.category || transaction.type}
                      </span>
                      <span className="text-[11px] text-gray-400 hidden md:inline truncate">
                        • {wallets?.find((w) => w.id === transaction.walletId)?.name || 'Default'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-semibold text-xs ${
                          transaction.type === 'Income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : transaction.type === 'Expense'
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {transaction.type === 'Expense' ? '-' : transaction.type === 'Income' ? '+' : ''}
                        {Number.parseFloat(transaction.amount).toFixed(2)} MAD
                      </span>

                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-gray-600"
                          onClick={() => setInspectingTx(transaction)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-blue-600"
                          onClick={() => openEdit(transaction)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-red-600"
                          onClick={() => {
                            setTransactionToDelete(transaction);
                            setDeleteError(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE 3: Full Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase font-semibold border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedTxIds.size === visibleTransactions.length && visibleTransactions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-gray-900"
                      />
                    </th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description / Merchant</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Wallet</th>
                    <th className="p-3 text-right">Amount (MAD)</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {visibleTransactions.map((transaction) => {
                    const isSelected = selectedTxIds.has(transaction.id);
                    return (
                      <tr
                        key={transaction.id}
                        className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors ${
                          isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTx(transaction.id)}
                            className="rounded border-gray-300 text-gray-900"
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap font-mono text-gray-500">
                          {format(new Date(transaction.createdAt), 'yyyy-MM-dd')}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              transaction.type === 'Income'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : transaction.type === 'Transfer'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">
                          {transaction.notes || '—'}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {transaction.category || '—'}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {wallets?.find((w) => w.id === transaction.walletId)?.name || 'Default'}
                          {transaction.type === 'Transfer' && transaction.destinationWalletId && (
                            <> → {wallets?.find((w) => w.id === transaction.destinationWalletId)?.name}</>
                          )}
                        </td>
                        <td
                          className={`p-3 text-right font-semibold whitespace-nowrap ${
                            transaction.type === 'Income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : transaction.type === 'Expense'
                              ? 'text-gray-900 dark:text-gray-100'
                              : 'text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          {transaction.type === 'Expense' ? '-' : transaction.type === 'Income' ? '+' : ''}
                          {Number.parseFloat(transaction.amount).toFixed(2)}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-gray-600"
                              onClick={() => setInspectingTx(transaction)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-blue-600"
                              onClick={() => openEdit(transaction)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-red-600"
                              onClick={() => {
                                setTransactionToDelete(transaction);
                                setDeleteError(null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {visibleTransactions.length === 0 && (
            <div className="py-16 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mb-3">
                <Search className="h-6 w-6" />
              </div>
              <p className="font-semibold text-gray-800 dark:text-gray-200">No transactions match your criteria</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {activeFilterCount || filters.query
                  ? 'Try relaxing your search terms or clearing your filters to see more results.'
                  : 'Start tracking by recording your first income, expense, or wallet transfer.'}
              </p>
              {activeFilterCount || filters.query ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    clearFilters();
                    update({ query: '' });
                  }}
                >
                  Clear all filters
                </Button>
              ) : (
                <Button type="button" size="sm" className="mt-4" onClick={() => openNewForm()}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Transaction
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
