import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Subscription,
  DetectedSubscription,
  Wallet,
  Goal,
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from '../../types';
import {
  Repeat,
  Plus,
  Search,
  Sparkles,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit2,
  ExternalLink,
  Zap,
  TrendingDown,
  Clock,
  ShieldAlert,
  Sliders,
  DollarSign,
  ChevronRight,
  Info,
  X,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

interface SubscriptionsTabProps {
  subscriptions: Subscription[];
  wallets: Wallet[];
  goals: Goal[];
  monthlySalary?: number;
  avgDailySpend?: number;
  onCreateSubscription: (payload: Partial<Subscription>) => Promise<any>;
  onUpdateSubscription: (id: string, payload: Partial<Subscription>) => Promise<any>;
  onDeleteSubscription: (id: string) => Promise<any>;
  onPaySubscription: (id: string, payload?: { walletId?: string; date?: string }) => Promise<any>;
  onDetectSubscriptions: () => Promise<DetectedSubscription[]>;
}

const PRESETS = [
  { name: 'Netflix', icon: '🎬', category: 'Streaming & Media', defaultAmount: 95, cycle: 'monthly' as const },
  { name: 'Spotify', icon: '🎵', category: 'Streaming & Media', defaultAmount: 65, cycle: 'monthly' as const },
  { name: 'YouTube Premium', icon: '▶️', category: 'Streaming & Media', defaultAmount: 70, cycle: 'monthly' as const },
  { name: 'Gym / Fitness Club', icon: '💪', category: 'Health & Fitness', defaultAmount: 350, cycle: 'monthly' as const },
  { name: 'Fiber Internet', icon: '🌐', category: 'Bills & Utilities', defaultAmount: 349, cycle: 'monthly' as const },
  { name: 'Mobile Phone Plan', icon: '📱', category: 'Internet & Telecom', defaultAmount: 120, cycle: 'monthly' as const },
  { name: 'Rent / Loyer', icon: '🏠', category: 'Housing & Rent', defaultAmount: 4000, cycle: 'monthly' as const },
  { name: 'iCloud Storage', icon: '☁️', category: 'Cloud Storage', defaultAmount: 30, cycle: 'monthly' as const },
  { name: 'ChatGPT Plus', icon: '🤖', category: 'AI & Software', defaultAmount: 220, cycle: 'monthly' as const },
  { name: 'GitHub Pro', icon: '💻', category: 'Software & Dev', defaultAmount: 45, cycle: 'monthly' as const },
  { name: 'Car Insurance', icon: '🚗', category: 'Insurance', defaultAmount: 3500, cycle: 'yearly' as const },
  { name: 'Amazon Prime', icon: '📦', category: 'Subscriptions & Streaming', defaultAmount: 49, cycle: 'monthly' as const },
];

const CATEGORIES = [
  'Subscriptions & Streaming',
  'Streaming & Media',
  'Internet & Telecom',
  'Bills & Utilities',
  'Housing & Rent',
  'Health & Fitness',
  'AI & Software',
  'Software & Dev',
  'Cloud Storage',
  'Insurance',
  'Education & Learning',
  'Other Subscriptions',
];

export const SubscriptionsTab: React.FC<SubscriptionsTabProps> = ({
  subscriptions,
  wallets,
  goals,
  monthlySalary = 0,
  avgDailySpend = 0,
  onCreateSubscription,
  onUpdateSubscription,
  onDeleteSubscription,
  onPaySubscription,
  onDetectSubscriptions,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [payingSub, setPayingSub] = useState<Subscription | null>(null);
  const [selectedPayingWallet, setSelectedPayingWallet] = useState<string>('');
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedSubscription[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Pruning Simulator State (keys are subscription IDs marked for cancellation)
  const [prunedSubIds, setPrunedSubIds] = useState<Set<string>>(new Set());
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false);
  const [targetGoalId, setTargetGoalId] = useState<string>(goals[0]?.id || '');

  // Form State for modal
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'MAD',
    billingCycle: 'monthly' as SubscriptionBillingCycle,
    category: 'Subscriptions & Streaming',
    walletId: '',
    nextBillingDate: '',
    status: 'active' as SubscriptionStatus,
    icon: '📱',
    notes: '',
    websiteUrl: '',
  });

  // Calculate annual/monthly normalized amount
  const getNormalizedMonthly = (amountStr: string | number, cycle: SubscriptionBillingCycle): number => {
    const amt = typeof amountStr === 'number' ? amountStr : parseFloat(amountStr) || 0;
    switch (cycle) {
      case 'yearly':
        return amt / 12;
      case 'quarterly':
        return amt / 3;
      case 'weekly':
        return (amt * 52) / 12;
      case 'monthly':
      default:
        return amt;
    }
  };

  const getNormalizedYearly = (amountStr: string | number, cycle: SubscriptionBillingCycle): number => {
    return getNormalizedMonthly(amountStr, cycle) * 12;
  };

  // Metrics
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.status === 'active'), [subscriptions]);

  const totalMonthlyBurn = useMemo(() => {
    return activeSubs.reduce((acc, sub) => acc + getNormalizedMonthly(sub.amount, sub.billingCycle), 0);
  }, [activeSubs]);

  const totalAnnualDrain = useMemo(() => {
    return totalMonthlyBurn * 12;
  }, [totalMonthlyBurn]);

  // Life Energy Hours (Based on net salary assuming standard 160h/month work)
  const hourlyRate = useMemo(() => {
    return monthlySalary > 0 ? monthlySalary / 160 : 0;
  }, [monthlySalary]);

  const lifeEnergyHours = useMemo(() => {
    return hourlyRate > 0 ? totalMonthlyBurn / hourlyRate : 0;
  }, [totalMonthlyBurn, hourlyRate]);

  // Upcoming renewals in next 7 days
  const now = useMemo(() => new Date(), []);
  const upcomingIn7Days = useMemo(() => {
    return activeSubs.filter((s) => {
      if (!s.nextBillingDate) return false;
      const d = new Date(s.nextBillingDate);
      const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
  }, [activeSubs, now]);

  // Filtered subscriptions
  const filteredSubs = useMemo(() => {
    return subscriptions.filter((sub) => {
      if (filterStatus !== 'all' && sub.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          sub.name.toLowerCase().includes(q) ||
          sub.category.toLowerCase().includes(q) ||
          (sub.notes && sub.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [subscriptions, filterStatus, searchQuery]);

  // Pruning Simulator Calculations
  const simulatedMonthlySavings = useMemo(() => {
    return subscriptions
      .filter((s) => prunedSubIds.has(s.id))
      .reduce((sum, s) => sum + getNormalizedMonthly(s.amount, s.billingCycle), 0);
  }, [subscriptions, prunedSubIds]);

  const simulatedAnnualSavings = useMemo(() => {
    return simulatedMonthlySavings * 12;
  }, [simulatedMonthlySavings]);

  const simulatedRunwayDaysGained = useMemo(() => {
    return avgDailySpend > 0 ? Math.round(simulatedAnnualSavings / (avgDailySpend * 365) * 365 / 12) : 0;
  }, [simulatedAnnualSavings, avgDailySpend]);

  const selectedGoal = useMemo(() => {
    return goals.find((g) => g.id === targetGoalId) || goals[0] || null;
  }, [goals, targetGoalId]);

  const goalAcceleratedMonths = useMemo(() => {
    if (!selectedGoal || simulatedMonthlySavings <= 0) return 0;
    const target = parseFloat(selectedGoal.targetAmount) || 0;
    const current = parseFloat(selectedGoal.currentAmount) || 0;
    const remaining = Math.max(0, target - current);
    if (remaining <= 0) return 0;
    const months = remaining / simulatedMonthlySavings;
    return Math.round(months * 10) / 10;
  }, [selectedGoal, simulatedMonthlySavings]);

  // Load auto-detection on first visit
  useEffect(() => {
    if (!hasScanned && subscriptions.length <= 4) {
      handleScanForRecurring();
    }
  }, [hasScanned, subscriptions.length]);

  const handleScanForRecurring = async () => {
    setIsDetecting(true);
    try {
      const detected = await onDetectSubscriptions();
      setDetectedCandidates(detected);
      setHasScanned(true);
    } catch (e) {
      console.error('Failed to scan for recurring charges', e);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleOpenCreateModal = (preset?: typeof PRESETS[0]) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const dateStr = defaultDate.toISOString().split('T')[0];

    const bankWallet = wallets.find((w) => w.type === 'Bank' && w.isMain) || wallets.find((w) => w.type === 'Bank') || wallets[0];

    setFormData({
      name: preset ? preset.name : '',
      amount: preset ? String(preset.defaultAmount) : '',
      currency: 'MAD',
      billingCycle: preset ? preset.cycle : 'monthly',
      category: preset ? preset.category : 'Subscriptions & Streaming',
      walletId: bankWallet ? bankWallet.id : '',
      nextBillingDate: dateStr,
      status: 'active',
      icon: preset ? preset.icon : '📱',
      notes: '',
      websiteUrl: '',
    });
    setEditingSub(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (sub: Subscription) => {
    setFormData({
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency || 'MAD',
      billingCycle: sub.billingCycle,
      category: sub.category,
      walletId: sub.walletId || '',
      nextBillingDate: sub.nextBillingDate ? new Date(sub.nextBillingDate).toISOString().split('T')[0] : '',
      status: sub.status,
      icon: sub.icon || '📱',
      notes: sub.notes || '',
      websiteUrl: sub.websiteUrl || '',
    });
    setEditingSub(sub);
    setIsCreateModalOpen(true);
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount || Number(formData.amount) <= 0) return;

    try {
      if (editingSub) {
        await onUpdateSubscription(editingSub.id, {
          name: formData.name.trim(),
          amount: formData.amount,
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          category: formData.category,
          walletId: formData.walletId || null,
          nextBillingDate: formData.nextBillingDate ? new Date(formData.nextBillingDate).toISOString() : null,
          status: formData.status,
          icon: formData.icon,
          notes: formData.notes,
          websiteUrl: formData.websiteUrl,
        });
        showToast(`Updated "${formData.name}" successfully`);
      } else {
        await onCreateSubscription({
          name: formData.name.trim(),
          amount: formData.amount,
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          category: formData.category,
          walletId: formData.walletId || null,
          nextBillingDate: formData.nextBillingDate ? new Date(formData.nextBillingDate).toISOString() : null,
          status: formData.status,
          icon: formData.icon,
          notes: formData.notes,
          websiteUrl: formData.websiteUrl,
        });
        showToast(`Added "${formData.name}" to Subscriptions Radar`);
      }
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save subscription');
    }
  };

  const handleAddDetectedCandidate = async (candidate: DetectedSubscription) => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 15);
    const bankWallet = wallets.find((w) => w.type === 'Bank' && w.isMain) || wallets[0];

    try {
      await onCreateSubscription({
        name: candidate.name,
        amount: String(candidate.suggestedAmount),
        currency: 'MAD',
        billingCycle: candidate.suggestedCycle,
        category: candidate.suggestedCategory,
        walletId: bankWallet ? bankWallet.id : null,
        nextBillingDate: defaultDate.toISOString(),
        status: 'active',
        icon: (candidate as any).icon || '📱',
        notes: `Imported from recurring charges: ${candidate.sampleTransactionNotes || ''}`,
      });
      setDetectedCandidates((prev) => prev.filter((c) => c.name !== candidate.name));
      showToast(`Added "${candidate.name}" to Subscriptions Radar!`);
    } catch (err: any) {
      alert(err.message || 'Failed to import subscription');
    }
  };

  const handleExecutePayment = async () => {
    if (!payingSub) return;
    try {
      await onPaySubscription(payingSub.id, {
        walletId: selectedPayingWallet || payingSub.walletId || undefined,
        date: new Date().toISOString().slice(0, 10),
      });
      showToast(`Recorded payment of ${payingSub.amount} MAD for "${payingSub.name}" and scheduled next renewal!`);
      setPayingSub(null);
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const togglePruned = (id: string) => {
    setPrunedSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 4500);
  };

  const getDaysUntilRenewal = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/90 px-4 py-3 text-sm font-medium text-emerald-900 dark:text-emerald-200 shadow-xl backdrop-blur"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>{actionSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <Repeat className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Subscriptions & Recurring Radar
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Audit monthly commitments, hunt hidden leaks, and simulate how much you save by pruning.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanForRecurring}
            disabled={isDetecting}
            className="border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
          >
            <Sparkles className={`mr-1.5 h-4 w-4 ${isDetecting ? 'animate-spin' : ''}`} />
            {isDetecting ? 'Scanning...' : 'Scan Leaks'}
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreateModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Subscription
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Monthly Burn */}
        <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-b from-white to-indigo-50/20 dark:from-gray-900 dark:to-indigo-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Monthly Recurring
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                <Repeat className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {totalMonthlyBurn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">MAD / mo</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {activeSubs.length} active recurring {activeSubs.length === 1 ? 'service' : 'services'}
            </p>
          </CardContent>
        </Card>

        {/* Annualized Drain */}
        <Card className="border-amber-100 dark:border-amber-900/40 bg-gradient-to-b from-white to-amber-50/20 dark:from-gray-900 dark:to-amber-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Annual True Drain
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-300">
                {totalAnnualDrain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">MAD / yr</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {monthlySalary > 0
                ? `${((totalAnnualDrain / (monthlySalary * 12)) * 100).toFixed(1)}% of annual salary`
                : 'Cumulative yearly commitment'}
            </p>
          </CardContent>
        </Card>

        {/* Life Energy Drain */}
        <Card className="border-rose-100 dark:border-rose-900/40 bg-gradient-to-b from-white to-rose-50/20 dark:from-gray-900 dark:to-rose-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Life Energy Drain
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-rose-900 dark:text-rose-300">
                {lifeEnergyHours > 0 ? `${lifeEnergyHours.toFixed(1)} hrs` : '—'}
              </span>
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">of labor / mo</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {hourlyRate > 0
                ? `Based on ${monthlySalary.toLocaleString()} MAD salary`
                : 'Set salary in Settings to enable'}
            </p>
          </CardContent>
        </Card>

        {/* Renewals in Next 7 Days */}
        <Card className="border-purple-100 dark:border-purple-900/40 bg-gradient-to-b from-white to-purple-50/20 dark:from-gray-900 dark:to-purple-950/20 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Renewals in 7 Days
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tracking-tight text-purple-900 dark:text-purple-300">
                {upcomingIn7Days.length}
              </span>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                {upcomingIn7Days.length === 1 ? 'charge due' : 'charges due'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
              {upcomingIn7Days.length > 0
                ? `${upcomingIn7Days.map((s) => s.name).slice(0, 2).join(', ')}${upcomingIn7Days.length > 2 ? '...' : ''}`
                : 'No urgent renewals upcoming'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discovered Recurring Charges Banner (Smart Leak Hunter) */}
      {detectedCandidates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-gray-900 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Smart Leak Hunter: {detectedCandidates.length} recurring charge{detectedCandidates.length === 1 ? '' : 's'} detected
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  We scanned your transaction history and found repeating payments not yet on your radar.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDetectedCandidates([])}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detectedCandidates.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-white dark:bg-gray-900/90 p-3 shadow-xs"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="text-xl">{(c as any).icon || '📱'}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      ~{c.suggestedAmount} MAD / {c.suggestedCycle} ({c.frequencyCount}x seen)
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddDetectedCandidate(c)}
                  className="h-7 text-xs border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 shrink-0 ml-2"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pruning & Freedom Simulator */}
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-white dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-gray-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-gray-100">
                  Subscription Pruner & Freedom Simulator
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select subscriptions below to simulate what you'd save by cancelling or renegotiating them.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
              className="text-xs border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400"
            >
              {isSimulatorExpanded ? 'Hide Checklist' : 'Test Subscriptions'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Simulated Results Banner */}
          {prunedSubIds.size > 0 ? (
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-gray-900 p-4 shadow-sm"
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <span className="text-[11px] font-medium uppercase text-gray-500">Monthly Freed</span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    +{simulatedMonthlySavings.toFixed(2)} MAD
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase text-gray-500">Annual Savings</span>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    +{simulatedAnnualSavings.toFixed(2)} MAD
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase text-gray-500">Life Hours Reclaimed</span>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {hourlyRate > 0 ? `+${(simulatedMonthlySavings / hourlyRate).toFixed(1)} hrs/mo` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-medium uppercase text-gray-500">Goal Boost</span>
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-1">
                    {selectedGoal && goalAcceleratedMonths > 0
                      ? `Reaches "${selectedGoal.name}" in ${goalAcceleratedMonths} mos`
                      : '+14% faster savings'}
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" />
                <span>
                  No subscriptions selected yet. Click "Test Subscriptions" or click the pruning toggle on any card below.
                </span>
              </div>
            </div>
          )}

          {/* Expanded Checklist */}
          {isSimulatorExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-3 pt-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Toggle subscriptions to test cancelling:
                </span>
                {prunedSubIds.size > 0 && (
                  <button
                    onClick={() => setPrunedSubIds(new Set())}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Reset all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {activeSubs.map((sub) => {
                  const isChecked = prunedSubIds.has(sub.id);
                  const mCost = getNormalizedMonthly(sub.amount, sub.billingCycle);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => togglePruned(sub.id)}
                      className={`flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition-all ${
                        isChecked
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">{sub.icon || '📱'}</span>
                        <span className="font-medium truncate">{sub.name}</span>
                      </div>
                      <span className="font-semibold shrink-0 ml-2">
                        {isChecked ? `-${mCost.toFixed(0)} MAD` : `${mCost.toFixed(0)} MAD`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Main List Section */}
      <div className="space-y-4">
        {/* Controls: Filter & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'active', 'reviewing', 'paused'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filterStatus === status
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {status} {status === 'all' ? `(${subscriptions.length})` : ''}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search subscriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-9 pr-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Subscriptions Grid */}
        {filteredSubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3">
              <Repeat className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">No subscriptions found</h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              {searchQuery
                ? 'Try tweaking your search query or filter.'
                : 'Start tracking your streaming, gym, internet, or software memberships to keep leak-free control of your recurring budget.'}
            </p>
            <Button
              size="sm"
              onClick={() => handleOpenCreateModal()}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add First Subscription
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubs.map((sub) => {
              const daysLeft = getDaysUntilRenewal(sub.nextBillingDate);
              const isUrgent = daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
              const isOverdue = daysLeft !== null && daysLeft < 0;
              const isPrunedInSim = prunedSubIds.has(sub.id);

              return (
                <motion.div
                  key={sub.id}
                  layout
                  className={`group relative flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all ${
                    isPrunedInSim
                      ? 'border-dashed border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : sub.status === 'reviewing'
                      ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon, Title, Status & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-2xl shadow-xs">
                          {sub.icon || '📱'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                            {sub.name}
                          </h4>
                          <span className="inline-block truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            {sub.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(sub)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete subscription "${sub.name}"?`)) {
                              await onDeleteSubscription(sub.id);
                              showToast(`Deleted "${sub.name}"`);
                            }
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Price & Billing Cycle */}
                    <div className="mt-4 flex items-baseline justify-between border-t border-gray-100 dark:border-gray-800/80 pt-3">
                      <div>
                        <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                          {parseFloat(sub.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="ml-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {sub.currency || 'MAD'}
                        </span>
                        <span className="ml-1 text-[11px] text-gray-400">/ {sub.billingCycle}</span>
                      </div>

                      {/* Status Pill */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          sub.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : sub.status === 'reviewing'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    {/* Next Renewal & Wallet */}
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>
                          {sub.nextBillingDate
                            ? new Date(sub.nextBillingDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'No renewal date'}
                        </span>
                      </div>

                      {/* Relative countdown */}
                      {daysLeft !== null && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isUrgent
                              ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 animate-pulse'
                              : isOverdue
                              ? 'bg-red-200 dark:bg-red-950 text-red-800 dark:text-red-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {daysLeft === 0
                            ? 'Due Today!'
                            : daysLeft === 1
                            ? 'Due Tomorrow'
                            : isOverdue
                            ? `Overdue by ${Math.abs(daysLeft)}d`
                            : `in ${daysLeft} days`}
                        </span>
                      )}
                    </div>

                    {/* Linked Wallet badge */}
                    {sub.walletName && (
                      <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                        Paid via: <span className="font-medium text-gray-600 dark:text-gray-300">{sub.walletName}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Quick Actions */}
                  <div className="mt-4 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800/80 pt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedPayingWallet(sub.walletId || (wallets[0]?.id ?? ''));
                        setPayingSub(sub);
                      }}
                      className="flex-1 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs border border-indigo-200 dark:border-indigo-800"
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5 text-indigo-500" /> Log Renewal
                    </Button>

                    <button
                      onClick={() => togglePruned(sub.id)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors ${
                        isPrunedInSim
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                      }`}
                      title={isPrunedInSim ? 'Uncheck from pruning simulation' : 'Test cancelling in simulator'}
                    >
                      ✂️
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preset Quick-Add Bar */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          ⚡ Quick-Add Popular Services
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleOpenCreateModal(preset)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all"
            >
              <span>{preset.icon}</span>
              <span>{preset.name}</span>
              <span className="text-[10px] text-gray-400">({preset.defaultAmount} MAD)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {editingSub ? 'Edit Subscription' : 'Add New Subscription'}
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="mt-4 space-y-4">
              {/* Name & Icon */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xl"
                    placeholder="📱"
                  />
                </div>

                <div className="col-span-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subscription Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Netflix, Gym, Fibre Telecom"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Amount, Currency & Cycle */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) =>
                      setFormData({ ...formData, billingCycle: e.target.value as SubscriptionBillingCycle })
                    }
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {/* Category & Linked Wallet */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Payment Wallet
                  </label>
                  <select
                    value={formData.walletId}
                    onChange={(e) => setFormData({ ...formData, walletId: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="">No default wallet</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Next Renewal Date & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Next Renewal Date
                  </label>
                  <input
                    type="date"
                    value={formData.nextBillingDate}
                    onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as SubscriptionStatus })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="active">Active (Currently Paying)</option>
                    <option value="reviewing">Reviewing / Considering Cancelling</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Shared with brother, cancel before summer promo ends"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {editingSub ? 'Save Changes' : 'Add to Radar'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Log Payment Modal */}
      {payingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 text-2xl">
                {payingSub.icon || '📱'}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Log Renewal Payment
                </h3>
                <p className="text-xs text-gray-500">
                  Record an expense transaction for {payingSub.name}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Service:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{payingSub.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {payingSub.amount} {payingSub.currency || 'MAD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{payingSub.category}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Charge From Wallet:
              </label>
              <select
                value={selectedPayingWallet}
                onChange={(e) => setSelectedPayingWallet(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.type}) — {w.balance.toLocaleString()} MAD
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPayingSub(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleExecutePayment} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Zap className="mr-1.5 h-4 w-4" /> Confirm Payment & Roll Date
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
