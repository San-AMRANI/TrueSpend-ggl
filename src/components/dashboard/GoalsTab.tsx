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
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface GoalsTabProps {
  goals: Goal[];
  wallets: Wallet[];
  onCreateGoal: (payload: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
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
      deadline?: string | null;
      category?: string;
      notes?: string;
    },
  ) => Promise<any>;
  onContributeGoal: (
    id: string,
    payload: { amount: number; walletId?: string; note?: string; date?: string },
  ) => Promise<any>;
  onWithdrawGoal: (
    id: string,
    payload: { amount: number; walletId?: string; note?: string; date?: string },
  ) => Promise<any>;
  onDeleteGoal: (id: string) => Promise<any>;
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
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'progress' | 'target'>('deadline');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributeTarget, setContributeTarget] = useState<Goal | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<Goal | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState('Emergency');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Contribution / Withdrawal modal form state
  const [actionAmount, setActionAmount] = useState('');
  const [actionWalletId, setActionWalletId] = useState('');
  const [actionNote, setActionNote] = useState('');

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
      if (filter === 'active') return !isCompleted;
      if (filter === 'completed') return isCompleted;
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
  }, [goals, filter, sortBy]);

  // Open Create Modal
  const openCreateModal = () => {
    setName('');
    setTargetAmount('');
    setCurrentAmount('0');
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
      if (editingGoal) {
        await onUpdateGoal(editingGoal.id, {
          name: name.trim(),
          targetAmount: target,
          currentAmount: parseFloat(currentAmount) || 0,
          category,
          deadline: deadline || null,
          notes: notes.trim(),
        });
      } else {
        await onCreateGoal({
          name: name.trim(),
          targetAmount: target,
          currentAmount: parseFloat(currentAmount) || 0,
          category,
          deadline: deadline || null,
          notes: notes.trim(),
        });
      }
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Contribute
  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeTarget) return;
    const amt = parseFloat(actionAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsSubmitting(true);
    try {
      await onContributeGoal(contributeTarget.id, {
        amount: amt,
        walletId: actionWalletId || undefined,
        note: actionNote.trim() || undefined,
      });
      setContributeTarget(null);
      setActionAmount('');
      setActionWalletId('');
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
        walletId: actionWalletId || undefined,
        note: actionNote.trim() || undefined,
      });
      setWithdrawTarget(null);
      setActionAmount('');
      setActionWalletId('');
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
              Earmark your money for what matters most. Track milestones, compute exact monthly savings velocity, and
              stay disciplined towards your future.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              <span className="text-xs font-semibold text-amber-200">MAD/mo</span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="relative z-10 mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${metrics.overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Sorting Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1 text-xs font-medium shadow-sm">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'all'
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All Goals ({goals.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'active'
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            In Progress ({metrics.activeCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === 'completed'
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-semibold'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Completed ({metrics.completedCount})
          </button>
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

      {/* Goals Grid */}
      {displayedGoals.length === 0 ? (
        <Card className="border-dashed border-gray-300 dark:border-gray-800 py-12 text-center">
          <CardContent className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Compass className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">No savings goals found</h3>
              <p className="mx-auto max-w-md text-sm text-gray-500 dark:text-gray-400">
                {filter !== 'all'
                  ? `You don't have any ${filter} goals right now.`
                  : 'Start by creating your first savings target, or pick one of the recommended presets below.'}
              </p>
            </div>

            {filter === 'all' && (
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

            // Pacing & velocity calculations
            const today = new Date();
            let daysLeft = null;
            let requiredMonthly = 0;
            let requiredDaily = 0;
            let pacingStatus: 'completed' | 'on_track' | 'behind' | 'accelerated' = 'on_track';

            if (isCompleted) {
              pacingStatus = 'completed';
            } else if (goal.deadline) {
              const d = new Date(goal.deadline);
              daysLeft = differenceInDays(d, today);
              if (daysLeft <= 0) {
                pacingStatus = 'behind';
                requiredMonthly = remaining;
                requiredDaily = remaining;
              } else {
                const monthsLeft = Math.max(0.2, daysLeft / 30.4);
                requiredMonthly = remaining / monthsLeft;
                requiredDaily = remaining / daysLeft;

                // Check expected pace vs actual progress
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
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 ${theme.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                          {goal.name}
                        </CardTitle>
                        <span className={`inline-block mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold ${theme.badge}`}>
                          {goal.category || 'General'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
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
                      <span>{isCompleted ? 'Goal fully conquered! 🎉' : `Remaining: ${remaining.toLocaleString()} MAD`}</span>
                    </div>
                  </div>

                  {/* Progress Bar with Milestone Dots */}
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

                  {/* Deadline & Pacing Diagnostics */}
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-800/30 p-2.5 space-y-1.5 text-xs">
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
                      <span className="text-gray-500">Pacing Status:</span>
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
                      onClick={() => {
                        setContributeTarget(goal);
                        setActionAmount('');
                        setActionWalletId('');
                        setActionNote('');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>+ Deposit</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setWithdrawTarget(goal);
                        setActionAmount('');
                        setActionWalletId('');
                        setActionNote('');
                      }}
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
          <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {editingGoal ? 'Edit Savings Goal' : 'Create New Savings Goal'}
                  </h3>
                  <p className="text-xs text-gray-500">Define your target, category, and timeline</p>
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
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Already Saved (MAD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Deduct from Wallet (optional)
                </label>
                <select
                  value={actionWalletId}
                  onChange={(e) => setActionWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">No Wallet Deduction (Direct Adjustment)</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type}) - Balance: {Number(w.balance).toLocaleString()} MAD
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-400">
                  {actionWalletId
                    ? 'This will record a Savings expense in your selected wallet to keep balances synchronized.'
                    : 'Increases goal saved balance without creating a bank/cash transaction.'}
                </p>
              </div>

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

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Deposit to Wallet (optional)
                </label>
                <select
                  value={actionWalletId}
                  onChange={(e) => setActionWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">No Wallet Credit (Direct Adjustment)</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type}) - Balance: {Number(w.balance).toLocaleString()} MAD
                    </option>
                  ))}
                </select>
              </div>

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
