import React, { useState, useMemo } from 'react';
import { Goal, Wallet } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Target,
  Plus,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Calendar,
  ShieldCheck,
  Laptop,
  Plane,
  Car,
  Home,
  GraduationCap,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Edit3,
  Trash2,
  Clock,
  Wallet as WalletIcon,
  X,
  Compass,
  ArrowRightLeft,
  Check,
  PiggyBank,
  RefreshCw,
  Landmark,
  Layers,
  Link as LinkIcon,
  AlertCircle,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface GoalsTabProps {
  goals: Goal[];
  wallets: Wallet[];
  onCreateGoal: (payload: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    walletId?: string | null;
    autoSyncBalance?: boolean;
    deadline?: string | null;
    category?: string;
    notes?: string;
  }) => Promise<any>;
  onUpdateGoal: (
    id: string,
    payload: {
      name?: string;
      targetAmount?: number;
      currentAmount?: number;
      walletId?: string | null;
      autoSyncBalance?: boolean;
      deadline?: string | null;
      category?: string;
      notes?: string;
    },
  ) => Promise<any>;
  onContributeGoal: (
    id: string,
    payload: { amount: number; walletId?: string; destinationWalletId?: string; note?: string; date?: string },
  ) => Promise<any>;
  onWithdrawGoal: (
    id: string,
    payload: { amount: number; walletId?: string; destinationWalletId?: string; note?: string; date?: string },
  ) => Promise<any>;
  onDeleteGoal: (id: string) => Promise<any>;
  onCreateWallet?: (payload: {
    name: string;
    type: 'Bank' | 'Cash' | 'Savings';
    isMain?: boolean;
    initialBalance?: number;
  }) => Promise<any>;
}

const CATEGORY_THEMES: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; color: string; badge: string; border: string; bg: string }
> = {
  Emergency: {
    label: 'Emergency Fund',
    icon: ShieldCheck,
    color: 'text-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
  },
  Tech: {
    label: 'Tech & Gear',
    icon: Laptop,
    color: 'text-indigo-500',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/40',
    bg: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
  },
  Travel: {
    label: 'Travel & Vacations',
    icon: Plane,
    color: 'text-sky-500',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/40',
    bg: 'from-sky-500/10 via-sky-500/5 to-transparent',
  },
  Vehicle: {
    label: 'Vehicle & Transport',
    icon: Car,
    color: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/40',
    bg: 'from-amber-500/10 via-amber-500/5 to-transparent',
  },
  Housing: {
    label: 'Home & Living',
    icon: Home,
    color: 'text-rose-500',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/40',
    bg: 'from-rose-500/10 via-rose-500/5 to-transparent',
  },
  Education: {
    label: 'Education & Career',
    icon: GraduationCap,
    color: 'text-purple-500',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/40',
    bg: 'from-purple-500/10 via-purple-500/5 to-transparent',
  },
  General: {
    label: 'General Savings',
    icon: Target,
    color: 'text-teal-500',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800/40',
    bg: 'from-teal-500/10 via-teal-500/5 to-transparent',
  },
};

const TEMPLATE_PRESETS = [
  {
    name: '3-Month Emergency Buffer',
    category: 'Emergency',
    targetAmount: 15000,
    notes: 'Safety net reserved in liquid bank account for unforeseen expenses.',
    monthsAhead: 6,
  },
  {
    name: 'New Workstation / Laptop',
    category: 'Tech',
    targetAmount: 14000,
    notes: 'Upgrading primary machine for development and creative work.',
    monthsAhead: 4,
  },
  {
    name: 'Summer Holiday & Travel',
    category: 'Travel',
    targetAmount: 8000,
    notes: 'Flights, stay, and spending money for next summer trip.',
    monthsAhead: 8,
  },
  {
    name: 'Car Down Payment',
    category: 'Vehicle',
    targetAmount: 30000,
    notes: 'Capital saved towards vehicle acquisition.',
    monthsAhead: 12,
  },
  {
    name: 'Professional Certification',
    category: 'Education',
    targetAmount: 3500,
    notes: 'Exams, study materials, and certification courses.',
    monthsAhead: 3,
  },
];

export const GoalsTab: React.FC<GoalsTabProps> = ({
  goals,
  wallets,
  onCreateGoal,
  onUpdateGoal,
  onContributeGoal,
  onWithdrawGoal,
  onDeleteGoal,
  onCreateWallet,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'progress' | 'target'>('deadline');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributeTarget, setContributeTarget] = useState<Goal | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Goal | null>(null);
  const [showNewWalletModal, setShowNewWalletModal] = useState(false);

  // Goal Form state
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [autoSyncBalance, setAutoSyncBalance] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Emergency');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Wallet Creation state
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletInitialBalance, setNewWalletInitialBalance] = useState('0');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // Contribution / Withdrawal modal form state
  const [actionAmount, setActionAmount] = useState('');
  const [actionSourceWalletId, setActionSourceWalletId] = useState('');
  const [actionDestWalletId, setActionDestWalletId] = useState('');
  const [actionNote, setActionNote] = useState('');

  // Wallets mapping & helper lookups
  const walletMap = useMemo(() => {
    return new Map(wallets.map((w) => [w.id, w]));
  }, [wallets]);

  const savingsWallets = useMemo(() => {
    return wallets.filter((w) => w.type === 'Savings');
  }, [wallets]);

  const nonSavingsWallets = useMemo(() => {
    return wallets.filter((w) => w.type !== 'Savings');
  }, [wallets]);

  // Savings Wallets & Goal Allocation overview
  const savingsAllocation = useMemo(() => {
    const totalInSavingsWallets = savingsWallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
    const goalsLinkedToSavings = goals.filter((g) => {
      if (!g.walletId) return false;
      const w = walletMap.get(g.walletId);
      return w && w.type === 'Savings';
    });
    const totalAllocatedToSavingsGoals = goalsLinkedToSavings.reduce(
      (sum, g) => sum + (parseFloat(g.currentAmount) || 0),
      0,
    );
    const unallocatedSavings = Math.max(0, totalInSavingsWallets - totalAllocatedToSavingsGoals);

    return {
      totalInSavingsWallets,
      goalsLinkedToSavingsCount: goalsLinkedToSavings.length,
      totalAllocatedToSavingsGoals,
      unallocatedSavings,
    };
  }, [savingsWallets, goals, walletMap]);

  // Portfolio Totals & Metrics
  const metrics = useMemo(() => {
    let totalTarget = 0;
    let totalSaved = 0;
    let activeCount = 0;
    let completedCount = 0;
    let totalMonthlyNeeded = 0;

    const today = new Date();

    goals.forEach((g) => {
      const target = parseFloat(g.targetAmount) || 0;
      const current = parseFloat(g.currentAmount) || 0;
      totalTarget += target;
      totalSaved += current;

      if (current >= target && target > 0) {
        completedCount++;
      } else {
        activeCount++;
        if (g.deadline) {
          const d = new Date(g.deadline);
          const days = Math.max(1, differenceInDays(d, today));
          const months = Math.max(0.5, days / 30.4);
          const needed = Math.max(0, target - current);
          totalMonthlyNeeded += needed / months;
        }
      }
    });

    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

    return {
      totalTarget,
      totalSaved,
      activeCount,
      completedCount,
      overallProgress: Math.min(100, overallProgress),
      totalMonthlyNeeded,
    };
  }, [goals]);

  // Filtered & Sorted Goals
  const displayedGoals = useMemo(() => {
    const list = goals.filter((g) => {
      const target = parseFloat(g.targetAmount) || 0;
      const current = parseFloat(g.currentAmount) || 0;
      const isCompleted = current >= target && target > 0;

      if (filter === 'active' && isCompleted) return false;
      if (filter === 'completed' && !isCompleted) return false;

      if (walletFilter !== 'all') {
        if (walletFilter === 'linked_savings') {
          const w = g.walletId ? walletMap.get(g.walletId) : null;
          if (!w || w.type !== 'Savings') return false;
        } else if (walletFilter === 'unlinked') {
          if (g.walletId) return false;
        } else if (g.walletId !== walletFilter) {
          return false;
        }
      }

      return true;
    });

    return list.sort((a, b) => {
      const targetA = parseFloat(a.targetAmount) || 0;
      const targetB = parseFloat(b.targetAmount) || 0;
      const currentA = parseFloat(a.currentAmount) || 0;
      const currentB = parseFloat(b.currentAmount) || 0;
      const progressA = targetA > 0 ? currentA / targetA : 0;
      const progressB = targetB > 0 ? currentB / targetB : 0;

      if (sortBy === 'progress') {
        return progressB - progressA;
      }
      if (sortBy === 'target') {
        return targetB - targetA;
      }
      // default: deadline
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [goals, filter, walletFilter, sortBy, walletMap]);

  // Open Create Modal
  const openCreateModal = () => {
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
    // Pre-select first savings wallet if available
    setSelectedWalletId(savingsWallets.length > 0 ? savingsWallets[0].id : '');
    setAutoSyncBalance(false);
    setCategory('Emergency');
    setDeadline('');
    setNotes('');
    setEditingGoal(null);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (goal: Goal) => {
    setName(goal.name);
    setTargetAmount(goal.targetAmount);
    setCurrentAmount(goal.currentAmount);
    setSelectedWalletId(goal.walletId || '');
    setAutoSyncBalance(Boolean(goal.autoSyncBalance));
    setCategory(goal.category || 'General');
    setDeadline(goal.deadline ? new Date(goal.deadline).toISOString().slice(0, 10) : '');
    setNotes(goal.notes || '');
    setEditingGoal(goal);
    setShowCreateModal(true);
  };

  // Populate from preset
  const applyPreset = (preset: (typeof TEMPLATE_PRESETS)[0]) => {
    setName(preset.name);
    setCategory(preset.category);
    setTargetAmount(String(preset.targetAmount));
    setCurrentAmount('0');
    setSelectedWalletId(savingsWallets.length > 0 ? savingsWallets[0].id : '');
    setAutoSyncBalance(false);
    setNotes(preset.notes);
    const future = new Date();
    future.setMonth(future.getMonth() + preset.monthsAhead);
    setDeadline(future.toISOString().slice(0, 10));
  };

  // Save Goal
  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        targetAmount: target,
        currentAmount: parseFloat(currentAmount) || 0,
        walletId: selectedWalletId || null,
        autoSyncBalance: Boolean(autoSyncBalance && selectedWalletId),
        category,
        deadline: deadline || null,
        notes: notes.trim(),
      };

      if (editingGoal) {
        await onUpdateGoal(editingGoal.id, payload);
      } else {
        await onCreateGoal(payload);
      }
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Create Savings Wallet
  const handleQuickCreateSavingsWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim() || !onCreateWallet) return;

    setIsCreatingWallet(true);
    try {
      const created = await onCreateWallet({
        name: newWalletName.trim(),
        type: 'Savings',
        isMain: false,
        initialBalance: parseFloat(newWalletInitialBalance) || 0,
      });

      if (created && created.id) {
        setSelectedWalletId(created.id);
      }
      setShowNewWalletModal(false);
      setNewWalletName('');
      setNewWalletInitialBalance('0');
    } catch (err) {
      console.error('Failed to create savings wallet:', err);
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // Open Deposit Modal
  const openDepositModal = (goal: Goal) => {
    setContributeTarget(goal);
    setActionAmount('');
    setActionNote('');

    // If goal is linked to a wallet:
    if (goal.walletId) {
      setActionDestWalletId(goal.walletId);
      // Source wallet: pick a non-savings wallet (Bank or Cash) as primary source
      const defaultSource = nonSavingsWallets.find((w) => w.isMain) || nonSavingsWallets[0] || wallets[0];
      setActionSourceWalletId(defaultSource ? defaultSource.id : '');
    } else {
      setActionDestWalletId('');
      const defaultSource = wallets.find((w) => w.isMain) || wallets[0];
      setActionSourceWalletId(defaultSource ? defaultSource.id : '');
    }
  };

  // Open Withdraw Modal
  const openWithdrawModal = (goal: Goal) => {
    setWithdrawTarget(goal);
    setActionAmount('');
    setActionNote('');

    if (goal.walletId) {
      setActionSourceWalletId(goal.walletId);
      // Destination: pick checking account or cash
      const defaultTarget = nonSavingsWallets.find((w) => w.isMain) || nonSavingsWallets[0] || wallets[0];
      setActionDestWalletId(defaultTarget ? defaultTarget.id : '');
    } else {
      setActionSourceWalletId('');
      const defaultTarget = wallets.find((w) => w.isMain) || wallets[0];
      setActionDestWalletId(defaultTarget ? defaultTarget.id : '');
    }
  };

  // Handle Contribute (Deposit)
  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeTarget) return;
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    try {
      await onContributeGoal(contributeTarget.id, {
        amount: amt,
        walletId: actionSourceWalletId || undefined,
        destinationWalletId: actionDestWalletId || undefined,
        note: actionNote.trim() || undefined,
      });
      setContributeTarget(null);
      setActionAmount('');
      setActionSourceWalletId('');
      setActionDestWalletId('');
      setActionNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Withdraw
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawTarget) return;
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    try {
      await onWithdrawGoal(withdrawTarget.id, {
        amount: amt,
        walletId: actionDestWalletId || undefined, // destination account where cash goes
        destinationWalletId: actionDestWalletId || undefined,
        note: actionNote.trim() || undefined,
      });
      setWithdrawTarget(null);
      setActionAmount('');
      setActionSourceWalletId('');
      setActionDestWalletId('');
      setActionNote('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Portfolio Summary */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Target Wealth & Purposeful Savings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Financial Savings Goals</h1>
            <p className="max-w-xl text-sm text-indigo-200/80">
              Earmark your capital for what matters most. Connect dedicated <strong>Savings Wallets</strong> to individual
              goals to track progress directly from your real-life bank balances and account transfers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onCreateWallet && (
              <Button
                onClick={() => setShowNewWalletModal(true)}
                variant="outline"
                className="inline-flex items-center gap-2 rounded-xl border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md"
              >
                <Landmark className="h-3.5 w-3.5 text-emerald-400" />
                <span>+ New Savings Vault</span>
              </Button>
            )}

            <Button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-600 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>New Goal</span>
            </Button>
          </div>
        </div>

        {/* Portfolio Stats Bar */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-indigo-200/70">Total Target</div>
            <div className="mt-1 text-xl sm:text-2xl font-black">
              {metrics.totalTarget.toLocaleString()} <span className="text-xs font-semibold text-indigo-300">MAD</span>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-indigo-200/70">Total Saved</div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-400">
              {metrics.totalSaved.toLocaleString()} <span className="text-xs font-semibold text-emerald-300">MAD</span>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-indigo-200/70">Overall Progress</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-indigo-300">
                {metrics.overallProgress.toFixed(1)}%
              </span>
              <span className="text-xs text-indigo-200/60">
                ({metrics.completedCount} done, {metrics.activeCount} active)
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-indigo-200/70">Monthly Savings Pace</div>
            <div className="mt-1 text-xl sm:text-2xl font-black text-amber-300">
              {Math.round(metrics.totalMonthlyNeeded).toLocaleString()}{' '}
              <span className="text-xs font-semibold text-amber-200/80">MAD / mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* SAVINGS WALLETS & ALLOCATION HUB */}
      <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/30 via-white to-white dark:from-indigo-950/20 dark:via-gray-900 dark:to-gray-900">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Savings Accounts & Vault Allocation</span>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    {savingsWallets.length} {savingsWallets.length === 1 ? 'Savings Vault' : 'Savings Vaults'}
                  </span>
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Track real capital deposited across your dedicated Savings accounts vs active target goals
                </p>
              </div>
            </div>

            {onCreateWallet && (
              <Button
                onClick={() => setShowNewWalletModal(true)}
                size="sm"
                variant="outline"
                className="inline-flex items-center gap-1.5 rounded-xl border-dashed border-gray-300 dark:border-gray-700 text-xs font-semibold hover:border-emerald-500 hover:text-emerald-600 self-start sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Savings Wallet</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total in Savings Wallets</span>
                <Landmark className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-gray-900 dark:text-white">
                {savingsAllocation.totalInSavingsWallets.toLocaleString()}{' '}
                <span className="text-xs font-bold text-gray-400">MAD</span>
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">Across {savingsWallets.length} savings accounts</div>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Allocated to Goals</span>
                <Target className="h-4 w-4 text-indigo-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-indigo-600 dark:text-indigo-400">
                {savingsAllocation.totalAllocatedToSavingsGoals.toLocaleString()}{' '}
                <span className="text-xs font-bold text-gray-400">MAD</span>
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                {savingsAllocation.goalsLinkedToSavingsCount} linked savings goals
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Unallocated Capital</span>
                <Sparkles className="h-4 w-4 text-teal-500" />
              </div>
              <div className="mt-1.5 text-xl font-black text-teal-600 dark:text-teal-400">
                {savingsAllocation.unallocatedSavings.toLocaleString()}{' '}
                <span className="text-xs font-bold text-gray-400">MAD</span>
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">Available in savings, unassigned to goals</div>
            </div>
          </div>

          {/* Savings Wallets List / Pills */}
          {savingsWallets.length === 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-2 text-emerald-600 dark:text-emerald-300 shrink-0">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    Connect a Savings Wallet to your Goals
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 max-w-xl">
                    Create a dedicated wallet of type <strong>&ldquo;Savings&rdquo;</strong> (e.g. &ldquo;Attijari Tawfir&rdquo;,
                    &ldquo;Emergency Vault&rdquo;, or &ldquo;Travel Pot&rdquo;). You can link it to individual goals to
                    auto-sync live balances and transfer funds between your everyday checking and your savings vault!
                  </p>
                </div>
              </div>
              {onCreateWallet && (
                <Button
                  onClick={() => setShowNewWalletModal(true)}
                  className="rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create First Savings Wallet
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savingsWallets.map((sw) => {
                const balance = Number(sw.balance) || 0;
                const linkedGoals = goals.filter((g) => g.walletId === sw.id);
                const totalTargetForWallet = linkedGoals.reduce(
                  (sum, g) => sum + (parseFloat(g.targetAmount) || 0),
                  0,
                );
                const isFiltered = walletFilter === sw.id;

                return (
                  <div
                    key={sw.id}
                    className={`rounded-xl border p-3.5 transition-all ${
                      isFiltered
                        ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/60 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Landmark className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-bold text-gray-900 dark:text-white">{sw.name}</h4>
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Savings Wallet
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setWalletFilter(isFiltered ? 'all' : sw.id)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                          isFiltered
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                        title="Filter goals linked to this wallet"
                      >
                        {isFiltered ? 'Active Filter' : 'Filter Goals'}
                      </button>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between border-t border-gray-100 dark:border-gray-800 pt-2.5 text-xs">
                      <span className="text-gray-500">Live Balance:</span>
                      <span className="font-extrabold text-gray-900 dark:text-white">
                        {balance.toLocaleString()} MAD
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <span>Linked Goals:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {linkedGoals.length} {linkedGoals.length === 1 ? 'goal' : 'goals'}
                        {totalTargetForWallet > 0 && ` (${totalTargetForWallet.toLocaleString()} MAD target)`}
                      </span>
                    </div>

                    {linkedGoals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {linkedGoals.slice(0, 2).map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:text-gray-300"
                          >
                            <Target className="h-2.5 w-2.5 text-indigo-500" />
                            <span className="truncate max-w-[100px]">{g.name}</span>
                          </span>
                        ))}
                        {linkedGoals.length > 2 && (
                          <span className="rounded-md bg-gray-100 dark:bg-gray-700/60 px-1.5 py-0.5 text-[10px] text-gray-500">
                            +{linkedGoals.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FILTER & SORT BAR */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All ({goals.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                filter === 'active'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Active ({metrics.activeCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                filter === 'completed'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                  : 'hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Completed ({metrics.completedCount})
            </button>
          </div>

          {/* Wallet Filter Dropdown */}
          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Wallets & Vaults</option>
            <option value="linked_savings">🌟 Only Linked to Savings Accounts</option>
            <option value="unlinked">Unlinked (Manual Tracking)</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.type})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="deadline">Target Deadline (Soonest)</option>
            <option value="progress">Progress Percentage (%)</option>
            <option value="target">Target Amount (Highest)</option>
          </select>
        </div>
      </div>

      {/* GOALS GRID */}
      {displayedGoals.length === 0 ? (
        <Card className="border-dashed border-gray-300 dark:border-gray-800 py-12 text-center">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Compass className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No savings goals found</h3>
              <p className="mx-auto max-w-md text-sm text-gray-500 dark:text-gray-400">
                {filter !== 'all' || walletFilter !== 'all'
                  ? 'No goals match your current filter criteria.'
                  : 'Start by creating your first savings target, or pick one of the recommended presets below.'}
              </p>
            </div>

            {filter === 'all' && walletFilter === 'all' && (
              <div className="pt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Quick Start Templates
                </div>
                <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-2">
                  {TEMPLATE_PRESETS.map((p) => {
                    const theme = CATEGORY_THEMES[p.category] || CATEGORY_THEMES.General;
                    const Icon = theme.icon;
                    return (
                      <button
                        key={p.name}
                        onClick={() => {
                          applyPreset(p);
                          setShowCreateModal(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow transition-all"
                      >
                        <Icon className={`h-4 w-4 ${theme.color}`} />
                        <span>{p.name}</span>
                        <span className="text-gray-400 font-semibold">({p.targetAmount.toLocaleString()} MAD)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedGoals.map((goal) => {
            const target = parseFloat(goal.targetAmount) || 0;
            const current = parseFloat(goal.currentAmount) || 0;
            const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            const remaining = Math.max(0, target - current);
            const isCompleted = current >= target && target > 0;

            const theme = CATEGORY_THEMES[goal.category] || CATEGORY_THEMES.General;
            const Icon = theme.icon;

            const linkedWallet = goal.walletId ? walletMap.get(goal.walletId) : null;
            const isSavingsWallet = linkedWallet?.type === 'Savings';

            // Pacing & velocity calculations
            const today = new Date();
            let daysLeft = null;
            let requiredMonthly = 0;
            let pacingStatus: 'completed' | 'on_track' | 'behind' | 'accelerated' = 'on_track';

            if (isCompleted) {
              pacingStatus = 'completed';
            } else if (goal.deadline) {
              const d = new Date(goal.deadline);
              daysLeft = differenceInDays(d, today);
              if (daysLeft <= 0) {
                pacingStatus = 'behind';
                requiredMonthly = remaining;
              } else {
                const monthsLeft = Math.max(0.2, daysLeft / 30.4);
                requiredMonthly = remaining / monthsLeft;

                const created = new Date(goal.createdAt);
                const totalGoalDays = Math.max(1, differenceInDays(d, created));
                const elapsedDays = Math.max(0, differenceInDays(today, created));
                const expectedProgressPercent = (elapsedDays / totalGoalDays) * 100;

                if (progress >= expectedProgressPercent + 10) {
                  pacingStatus = 'accelerated';
                } else if (progress < expectedProgressPercent - 15) {
                  pacingStatus = 'behind';
                } else {
                  pacingStatus = 'on_track';
                }
              }
            }

            return (
              <Card
                key={goal.id}
                className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md ${
                  isCompleted ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/10' : ''
                }`}
              >
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${theme.bg}`} />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 ${theme.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-bold text-gray-900 dark:text-white truncate">
                          {goal.name}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${theme.badge}`}>
                            {goal.category || 'General'}
                          </span>

                          {/* Linked Wallet Pill */}
                          {linkedWallet ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                isSavingsWallet
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              }`}
                              title={`Linked to wallet: ${linkedWallet.name} (Balance: ${Number(linkedWallet.balance).toLocaleString()} MAD)`}
                            >
                              <Landmark className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[90px]">{linkedWallet.name}</span>
                              {goal.autoSyncBalance && (
                                <RefreshCw className="h-2.5 w-2.5 text-emerald-600 animate-spin-slow" />
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                              Manual tracking
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                      <button
                        onClick={() => openEditModal(goal)}
                        aria-label="Edit goal"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${goal.name}"?`)) {
                            onDeleteGoal(goal.id);
                          }
                        }}
                        aria-label="Delete goal"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Numbers */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {current.toLocaleString()}{' '}
                        <span className="text-xs font-semibold text-gray-400">/ {target.toLocaleString()} MAD</span>
                      </div>
                      <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                        {progress.toFixed(0)}%
                      </div>
                    </div>
                    <div className="mt-0.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {isCompleted ? 'Goal fully conquered! 🎉' : `Remaining: ${remaining.toLocaleString()} MAD`}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : progress >= 75
                            ? 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                            : progress >= 50
                            ? 'bg-gradient-to-r from-indigo-500 to-sky-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold text-gray-400 px-0.5">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Details & Diagnostics */}
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/30 p-2.5 space-y-1.5 text-xs">
                    {/* Linked Wallet Details */}
                    {linkedWallet && (
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <Landmark className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Vault Balance:</span>
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {Number(linkedWallet.balance).toLocaleString()} MAD
                          {goal.autoSyncBalance && (
                            <span className="ml-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              (Auto-Synced)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {goal.deadline ? (
                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Target Date:</span>
                        </span>
                        <span className="font-semibold">{format(new Date(goal.deadline), 'MMM d, yyyy')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>No deadline set</span>
                        </span>
                        <span className="text-[10px]">Open-ended</span>
                      </div>
                    )}

                    {!isCompleted && goal.deadline && daysLeft !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Required Pace:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {Math.round(requiredMonthly).toLocaleString()} MAD / mo
                        </span>
                      </div>
                    )}

                    {/* Status Pill */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200/40 dark:border-gray-700/40 text-[11px]">
                      <span className="text-gray-500">Status:</span>
                      {pacingStatus === 'completed' && (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Conquered
                        </span>
                      )}
                      {pacingStatus === 'accelerated' && (
                        <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400">
                          <Flame className="h-3 w-3" /> Ahead of Pace
                        </span>
                      )}
                      {pacingStatus === 'on_track' && (
                        <span className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400">
                          <TrendingUp className="h-3 w-3" /> On Track
                        </span>
                      )}
                      {pacingStatus === 'behind' && (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" /> Boost Needed
                        </span>
                      )}
                    </div>
                  </div>

                  {goal.notes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-1">
                      &ldquo;{goal.notes}&rdquo;
                    </p>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      onClick={() => openDepositModal(goal)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>+ Deposit</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => openWithdrawModal(goal)}
                      disabled={current <= 0}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-medium py-2 disabled:opacity-40"
                    >
                      <ArrowDownRight className="h-3.5 w-3.5" />
                      <span>- Withdraw</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT GOAL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {editingGoal ? 'Edit Savings Goal' : 'Create New Savings Goal'}
                  </h3>
                  <p className="text-xs text-gray-500">Define your target, linked savings wallet, and timeline</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Goal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 3-Month Emergency Fund, MacBook M3, Tokyo Trip"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* LINKED WALLET SELECTOR */}
              <div className="space-y-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 p-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <PiggyBank className="h-4 w-4 text-emerald-500" />
                    <span>Linked Savings Wallet / Vault</span>
                  </label>
                  {onCreateWallet && (
                    <button
                      type="button"
                      onClick={() => setShowNewWalletModal(true)}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>New Savings Wallet</span>
                    </button>
                  )}
                </div>

                <select
                  value={selectedWalletId}
                  onChange={(e) => {
                    const newWId = e.target.value;
                    setSelectedWalletId(newWId);
                    if (newWId && autoSyncBalance) {
                      const w = walletMap.get(newWId);
                      if (w) setCurrentAmount(String(w.balance));
                    }
                  }}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                >
                  <option value="">None (Manual Goal Tracking)</option>
                  {savingsWallets.length > 0 && (
                    <optgroup label="🌟 Dedicated Savings Accounts">
                      {savingsWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} (Savings) - Balance: {Number(w.balance).toLocaleString()} MAD
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {nonSavingsWallets.length > 0 && (
                    <optgroup label="Other Accounts (Bank & Cash)">
                      {nonSavingsWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.type}) - Balance: {Number(w.balance).toLocaleString()} MAD
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {selectedWalletId ? (
                  <div className="pt-2">
                    <label className="flex items-start gap-2 cursor-pointer text-xs text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={autoSyncBalance}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setAutoSyncBalance(isChecked);
                          if (isChecked && selectedWalletId) {
                            const w = walletMap.get(selectedWalletId);
                            if (w) setCurrentAmount(String(w.balance));
                          }
                        }}
                        className="mt-0.5 rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Auto-sync goal progress with live wallet balance
                        </span>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          When checked, this goal&apos;s saved amount will automatically equal this wallet&apos;s balance.
                          Any transfer or deposit into this wallet will instantly advance your goal.
                        </p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Tip: Linking a dedicated Savings wallet lets TrueSpend automatically execute bank-to-savings
                    transfers whenever you contribute!
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Target Amount (MAD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="15000"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Already Saved (MAD)
                    {autoSyncBalance && (
                      <span className="ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        (Synced from wallet)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={autoSyncBalance}
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {Object.keys(CATEGORY_THEMES).map((catKey) => (
                      <option key={catKey} value={catKey}>
                        {CATEGORY_THEMES[catKey].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Notes / Motivation (optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Why is this goal important? Any specific rules or target milestone notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  {isSubmitting ? 'Saving...' : editingGoal ? 'Update Goal' : 'Create Goal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK CREATE SAVINGS WALLET MODAL */}
      {showNewWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Create Savings Vault</h3>
                  <p className="text-xs text-gray-500">Dedicated account for earmarked goal capital</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewWalletModal(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickCreateSavingsWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Vault / Wallet Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency Savings Vault, CIH Tawfir, Travel Pot"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Starting Balance (MAD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={newWalletInitialBalance}
                  onChange={(e) => setNewWalletInitialBalance(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Initial money currently inside this bank account or savings vault.
                </p>
              </div>

              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>Wallet Type: Savings Account</span>
                </div>
                <p className="text-[11px] opacity-90">
                  This wallet will be tagged as &ldquo;Savings&rdquo; and immediately available to link with any goals.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewWalletModal(false)}
                  className="rounded-xl px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingWallet}
                  className="rounded-xl bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {isCreatingWallet ? 'Creating...' : 'Create Savings Vault'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTRIBUTE / DEPOSIT MODAL */}
      {contributeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Deposit to Goal</h3>
                  <p className="text-xs text-gray-500">{contributeTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setContributeTarget(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Deposit Amount (MAD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="500"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-base font-bold text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                {/* Quick Add Buttons */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[100, 250, 500, 1000, 2000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setActionAmount(String(preset))}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-500"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Account */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Source Account (Deduct from)
                </label>
                <select
                  value={actionSourceWalletId}
                  onChange={(e) => setActionSourceWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">No Wallet Deduction (Manual Goal Adjustment)</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type}) - Balance: {Number(w.balance).toLocaleString()} MAD
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Savings Wallet if linked or chosen */}
              {actionDestWalletId && actionSourceWalletId && actionSourceWalletId !== actionDestWalletId ? (
                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span>Account Transfer Execution:</span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300">
                    Deducts <strong>{actionAmount || '0'} MAD</strong> from{' '}
                    <strong>{walletMap.get(actionSourceWalletId)?.name || 'Source'}</strong> and deposits into{' '}
                    <strong>{walletMap.get(actionDestWalletId)?.name || 'Savings Vault'}</strong>, keeping both your
                    wallet balances and goal progress 100% synchronized!
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Note / Reference (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly salary savings contribution"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Live Preview */}
              {actionAmount && !isNaN(parseFloat(actionAmount)) && (
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 text-xs space-y-1">
                  <div className="text-gray-500 dark:text-gray-400">Preview after deposit:</div>
                  <div className="font-bold text-indigo-700 dark:text-indigo-300">
                    {(parseFloat(contributeTarget.currentAmount) + parseFloat(actionAmount)).toLocaleString()} MAD /{' '}
                    {parseFloat(contributeTarget.targetAmount).toLocaleString()} MAD (
                    {(
                      ((parseFloat(contributeTarget.currentAmount) + parseFloat(actionAmount)) /
                        parseFloat(contributeTarget.targetAmount)) *
                      100
                    ).toFixed(1)}
                    %)
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContributeTarget(null)}
                  className="rounded-xl px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  {isSubmitting ? 'Depositing...' : 'Confirm Deposit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {withdrawTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Withdraw from Goal</h3>
                  <p className="text-xs text-gray-500">{withdrawTarget.name}</p>
                </div>
              </div>
              <button
                onClick={() => setWithdrawTarget(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Withdrawal Amount (MAD) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={parseFloat(withdrawTarget.currentAmount)}
                  required
                  placeholder="500"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-base font-bold text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Available in this goal:{' '}
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {parseFloat(withdrawTarget.currentAmount).toLocaleString()} MAD
                  </span>
                </p>
              </div>

              {/* Destination Account */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Deposit / Transfer into Account
                </label>
                <select
                  value={actionDestWalletId}
                  onChange={(e) => setActionDestWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">No Wallet Credit (Manual Goal Adjustment)</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type}) - Balance: {Number(w.balance).toLocaleString()} MAD
                    </option>
                  ))}
                </select>
              </div>

              {withdrawTarget.walletId && actionDestWalletId && withdrawTarget.walletId !== actionDestWalletId ? (
                <div className="rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span>Reverse Transfer:</span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300">
                    Transfers funds from your savings vault back into{' '}
                    <strong>{walletMap.get(actionDestWalletId)?.name || 'Selected Account'}</strong> for everyday
                    spending.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Note / Reason (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Purchased laptop parts, holiday flight booking"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWithdrawTarget(null)}
                  className="rounded-xl px-4 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-amber-600 px-5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {isSubmitting ? 'Withdrawing...' : 'Confirm Withdrawal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
