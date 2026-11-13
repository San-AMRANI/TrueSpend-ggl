import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Subscription,
  SubscriptionPlanChangePayload,
  SubscriptionPlanPaymentMode,
  DetectedSubscription,
  Wallet,
  Goal,
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from '../../types';
import {
  STANDARD_BILLING_CYCLES,
  getCycleMeta,
  getNormalizedMonthlyAmount,
  getNormalizedDailyAmount,
  shiftDateByCycle,
  computeTermProgress,
} from '../../lib/subscriptionCycles';
import {
  Repeat,
  Plus,
  Search,
  Sparkles,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  Zap,
  TrendingDown,
  TrendingUp,
  Clock,
  Sliders,
  Info,
  X,
  Play,
  Pause,
  Layers,
  PiggyBank,
  ArrowUpDown,
  ArrowRight,
  ChevronsUpDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  StaggerList,
  StaggerItem,
  AnimatedProgressBar,
  AnimatedMetricValue,
  MotionModal,
} from '../ui/MotionPrimitives';

interface SubscriptionsTabProps {
  subscriptions: Subscription[];
  wallets: Wallet[];
  goals: Goal[];
  monthlySalary?: number;
  avgDailySpend?: number;
  onCreateSubscription: (
    payload: Partial<Subscription> & { recordInitialPayment?: boolean; initialPaymentDate?: string }
  ) => Promise<any>;
  onUpdateSubscription: (id: string, payload: Partial<Subscription>) => Promise<any>;
  onDeleteSubscription: (id: string) => Promise<any>;
  onPaySubscription: (id: string, payload?: { walletId?: string; date?: string }) => Promise<any>;
  onChangeSubscriptionPlan?: (id: string, payload: SubscriptionPlanChangePayload) => Promise<any>;
  onDetectSubscriptions: () => Promise<DetectedSubscription[]>;
}

interface PresetItem {
  name: string;
  icon: string;
  category: string;
  defaultAmount: number;
  cycle: SubscriptionBillingCycle;
  defaultStatus?: SubscriptionStatus;
  badge?: string;
}

const PRESETS: PresetItem[] = [
  {
    name: 'Car / Auto Insurance (3 Months)',
    icon: '🛡️',
    category: 'Insurance',
    defaultAmount: 1150,
    cycle: 'every_3_months',
    badge: '3-Mo Pass',
  },
  {
    name: 'Gym / Fitness Membership (3 Months)',
    icon: '💪',
    category: 'Health & Fitness',
    defaultAmount: 900,
    cycle: 'every_3_months',
    defaultStatus: 'planned',
    badge: '3-Mo Pass',
  },
  {
    name: 'Health / Mutuelle Insurance',
    icon: '🏥',
    category: 'Insurance',
    defaultAmount: 750,
    cycle: 'every_3_months',
    badge: '3-Mo Pass',
  },
  {
    name: 'Fiber Internet',
    icon: '🌐',
    category: 'Bills & Utilities',
    defaultAmount: 349,
    cycle: 'monthly',
  },
  {
    name: 'Mobile Phone Plan',
    icon: '📱',
    category: 'Internet & Telecom',
    defaultAmount: 120,
    cycle: 'monthly',
  },
  {
    name: 'Netflix',
    icon: '🎬',
    category: 'Streaming & Media',
    defaultAmount: 95,
    cycle: 'monthly',
  },
  {
    name: 'Spotify',
    icon: '🎵',
    category: 'Streaming & Media',
    defaultAmount: 65,
    cycle: 'monthly',
  },
  {
    name: 'YouTube Premium',
    icon: '▶️',
    category: 'Streaming & Media',
    defaultAmount: 70,
    cycle: 'monthly',
  },
  {
    name: 'ChatGPT Plus',
    icon: '🤖',
    category: 'AI & Software',
    defaultAmount: 220,
    cycle: 'monthly',
  },
  {
    name: 'GitHub Pro',
    icon: '💻',
    category: 'Software & Dev',
    defaultAmount: 45,
    cycle: 'monthly',
  },
  {
    name: 'iCloud / Google One',
    icon: '☁️',
    category: 'Cloud Storage',
    defaultAmount: 30,
    cycle: 'monthly',
  },
  {
    name: 'Rent / Loyer',
    icon: '🏠',
    category: 'Housing & Rent',
    defaultAmount: 4000,
    cycle: 'monthly',
  },
];

const CATEGORIES = [
  'Insurance',
  'Health & Fitness',
  'Internet & Telecom',
  'Bills & Utilities',
  'Subscriptions & Streaming',
  'Streaming & Media',
  'Housing & Rent',
  'AI & Software',
  'Software & Dev',
  'Cloud Storage',
  'Education & Learning',
  'Other Subscriptions',
];

type CycleFilter = 'all' | '3_months' | 'monthly' | 'multi_month';
type SortOption = 'renewal_soon' | 'monthly_desc' | 'lump_desc' | 'name_asc';

export const SubscriptionsTab: React.FC<SubscriptionsTabProps> = ({
  subscriptions,
  wallets,
  goals,
  monthlySalary = 0,
  onCreateSubscription,
  onUpdateSubscription,
  onDeleteSubscription,
  onPaySubscription,
  onChangeSubscriptionPlan,
  onDetectSubscriptions,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCycle, setFilterCycle] = useState<CycleFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('renewal_soon');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [payingSub, setPayingSub] = useState<Subscription | null>(null);
  const [selectedPayingWallet, setSelectedPayingWallet] = useState<string>('');
  const [paymentDateInput, setPaymentDateInput] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [detectedCandidates, setDetectedCandidates] = useState<DetectedSubscription[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Upgrade / Downgrade Plan Switcher Modal state
  const [switchingSub, setSwitchingSub] = useState<Subscription | null>(null);
  const [switchNewName, setSwitchNewName] = useState('');
  const [switchNewAmount, setSwitchNewAmount] = useState('');
  const [switchNewCurrency, setSwitchNewCurrency] = useState('MAD');
  const [switchNewCycle, setSwitchNewCycle] = useState<SubscriptionBillingCycle>('every_10_months');
  const [switchIsCustomCycle, setSwitchIsCustomCycle] = useState(false);
  const [switchCustomCount, setSwitchCustomCount] = useState('10');
  const [switchCustomUnit, setSwitchCustomUnit] = useState<'months' | 'days'>('months');
  const [switchEffectiveDate, setSwitchEffectiveDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [switchRecalculateExpiry, setSwitchRecalculateExpiry] = useState(true);
  const [switchNextBillingDate, setSwitchNextBillingDate] = useState('');
  const [switchPaymentMode, setSwitchPaymentMode] = useState<SubscriptionPlanPaymentMode>('none');
  const [switchPaymentAmount, setSwitchPaymentAmount] = useState('');
  const [switchWalletId, setSwitchWalletId] = useState('');
  const [switchStatus, setSwitchStatus] = useState<SubscriptionStatus>('active');
  const [switchNotes, setSwitchNotes] = useState('');
  const [isSubmittingSwitch, setIsSubmittingSwitch] = useState(false);

  // Pruning Simulator State
  const [prunedSubIds, setPrunedSubIds] = useState<Set<string>>(new Set());
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false);
  const [targetGoalId] = useState<string>(goals[0]?.id || '');

  // Custom interval state inside modal
  const [isCustomCycle, setIsCustomCycle] = useState(false);
  const [customIntervalCount, setCustomIntervalCount] = useState('3');
  const [customIntervalUnit, setCustomIntervalUnit] = useState<'months' | 'days'>('months');
  const [termStartDate, setTermStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [recordInitialPayment, setRecordInitialPayment] = useState(false);

  // Form State for modal
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    currency: 'MAD',
    billingCycle: 'every_3_months' as SubscriptionBillingCycle,
    category: 'Insurance',
    walletId: '',
    nextBillingDate: '',
    status: 'active' as SubscriptionStatus,
    icon: '🛡️',
    notes: '',
    websiteUrl: '',
  });

  // Active & Planned sets
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.status === 'active'), [subscriptions]);
  const plannedSubs = useMemo(() => subscriptions.filter((s) => s.status === 'planned'), [subscriptions]);

  const threeMonthSubs = useMemo(
    () =>
      activeSubs.filter((s) => {
        const meta = getCycleMeta(s.billingCycle);
        return meta.months === 3;
      }),
    [activeSubs]
  );

  const multiMonthSubs = useMemo(
    () =>
      activeSubs.filter((s) => {
        const meta = getCycleMeta(s.billingCycle);
        return meta.isMultiMonth;
      }),
    [activeSubs]
  );

  // Total Monthly Normalized Burn (Active)
  const totalMonthlyBurn = useMemo(() => {
    return activeSubs.reduce((acc, sub) => acc + getNormalizedMonthlyAmount(sub.amount, sub.billingCycle), 0);
  }, [activeSubs]);

  // Planned Monthly Burn addition (e.g. upcoming Gym 3-month pass)
  const plannedMonthlyAddition = useMemo(() => {
    return plannedSubs.reduce((acc, sub) => acc + getNormalizedMonthlyAmount(sub.amount, sub.billingCycle), 0);
  }, [plannedSubs]);

  const totalAnnualDrain = useMemo(() => totalMonthlyBurn * 12, [totalMonthlyBurn]);

  // Multi-Month Sinking Fund Metrics (How much to set aside monthly for 3-month / 6-month / yearly passes)
  const multiMonthSinkingFundMonthly = useMemo(() => {
    return multiMonthSubs.reduce((sum, s) => sum + getNormalizedMonthlyAmount(s.amount, s.billingCycle), 0);
  }, [multiMonthSubs]);

  const multiMonthRecommendedReserveNow = useMemo(() => {
    return multiMonthSubs.reduce((sum, s) => {
      const amt = parseFloat(s.amount) || 0;
      const progress = computeTermProgress(s.nextBillingDate, s.billingCycle);
      if (!progress.hasSchedule) return sum + amt * 0.5;
      return sum + (amt * progress.percentElapsed) / 100;
    }, 0);
  }, [multiMonthSubs]);

  // Life Energy Hours (Based on net salary assuming 160h/month work)
  const hourlyRate = useMemo(() => (monthlySalary > 0 ? monthlySalary / 160 : 0), [monthlySalary]);
  const lifeEnergyHours = useMemo(
    () => (hourlyRate > 0 ? totalMonthlyBurn / hourlyRate : 0),
    [totalMonthlyBurn, hourlyRate]
  );

  // Upcoming renewals in next 14 days
  const upcomingRenewals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return activeSubs
      .filter((s) => {
        if (!s.nextBillingDate) return false;
        const d = new Date(s.nextBillingDate);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
        return diffDays >= -3 && diffDays <= 14;
      })
      .sort((a, b) => new Date(a.nextBillingDate!).getTime() - new Date(b.nextBillingDate!).getTime());
  }, [activeSubs]);

  // 90-Day Cashflow Forecast (Month 0, Month 1, Month 2)
  const ninetyDayForecast = useMemo(() => {
    const now = new Date();
    const buckets = [0, 1, 2].map((offset) => {
      const targetMonthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = targetMonthDate.getFullYear();
      const month = targetMonthDate.getMonth();
      const label = targetMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      let totalCashDue = 0;
      const items: Array<{ id: string; name: string; icon: string; amount: number; isPlanned: boolean; cycleLabel: string }> = [];

      subscriptions
        .filter((s) => s.status === 'active' || s.status === 'planned')
        .forEach((sub) => {
          const amt = parseFloat(sub.amount) || 0;
          const meta = getCycleMeta(sub.billingCycle);
          const isPlanned = sub.status === 'planned';

          if (!sub.nextBillingDate) {
            if (!meta.isMultiMonth && !isPlanned) {
              totalCashDue += amt;
              items.push({
                id: sub.id,
                name: sub.name,
                icon: sub.icon || '📱',
                amount: amt,
                isPlanned,
                cycleLabel: meta.shortLabel,
              });
            }
            return;
          }

          const nextDate = new Date(sub.nextBillingDate);
          if (isNaN(nextDate.getTime())) return;

          const monthDiff = (year - nextDate.getFullYear()) * 12 + (month - nextDate.getMonth());
          const intervalMonths = Math.max(1, Math.round(meta.months));

          const hitsThisMonth =
            (year === nextDate.getFullYear() && month === nextDate.getMonth()) ||
            (!isPlanned && monthDiff > 0 && monthDiff % intervalMonths === 0);

          if (hitsThisMonth) {
            const occurrencesInMonth = sub.billingCycle === 'weekly' ? 4 : sub.billingCycle === 'biweekly' ? 2 : 1;
            const monthCharge = amt * occurrencesInMonth;
            totalCashDue += monthCharge;
            items.push({
              id: sub.id,
              name: sub.name,
              icon: sub.icon || '📱',
              amount: monthCharge,
              isPlanned,
              cycleLabel: meta.shortLabel,
            });
          }
        });

      return {
        label,
        totalCashDue,
        items,
      };
    });

    return buckets;
  }, [subscriptions]);

  // Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; monthly: number; count: number }>();
    activeSubs.forEach((s) => {
      const cat = s.category || 'Other Subscriptions';
      const m = getNormalizedMonthlyAmount(s.amount, s.billingCycle);
      const existing = map.get(cat) || { category: cat, monthly: 0, count: 0 };
      existing.monthly += m;
      existing.count += 1;
      map.set(cat, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.monthly - a.monthly);
  }, [activeSubs]);

  // Filtered & Sorted Subscriptions
  const filteredSubs = useMemo(() => {
    const list = subscriptions.filter((sub) => {
      if (filterStatus !== 'all' && sub.status !== filterStatus) return false;

      const meta = getCycleMeta(sub.billingCycle);
      if (filterCycle === '3_months' && meta.months !== 3) return false;
      if (filterCycle === 'monthly' && meta.months !== 1) return false;
      if (filterCycle === 'multi_month' && !meta.isMultiMonth) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          sub.name.toLowerCase().includes(q) ||
          sub.category.toLowerCase().includes(q) ||
          meta.label.toLowerCase().includes(q) ||
          (sub.notes && sub.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'monthly_desc') {
        return getNormalizedMonthlyAmount(b.amount, b.billingCycle) - getNormalizedMonthlyAmount(a.amount, a.billingCycle);
      }
      if (sortBy === 'lump_desc') {
        return (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0);
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      // Default: renewal_soon
      const aTime = a.nextBillingDate ? new Date(a.nextBillingDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.nextBillingDate ? new Date(b.nextBillingDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [subscriptions, filterStatus, filterCycle, searchQuery, sortBy]);

  // Pruning Simulator Calculations
  const simulatedMonthlySavings = useMemo(() => {
    return subscriptions
      .filter((s) => prunedSubIds.has(s.id))
      .reduce((sum, s) => sum + getNormalizedMonthlyAmount(s.amount, s.billingCycle), 0);
  }, [subscriptions, prunedSubIds]);

  const simulatedAnnualSavings = useMemo(() => simulatedMonthlySavings * 12, [simulatedMonthlySavings]);

  const selectedGoal = useMemo(() => {
    return goals.find((g) => g.id === targetGoalId) || goals[0] || null;
  }, [goals, targetGoalId]);

  const goalAcceleratedMonths = useMemo(() => {
    if (!selectedGoal || simulatedMonthlySavings <= 0) return 0;
    const target = parseFloat(selectedGoal.targetAmount) || 0;
    const current = parseFloat(selectedGoal.currentAmount) || 0;
    const remaining = Math.max(0, target - current);
    if (remaining <= 0) return 0;
    return Math.round((remaining / simulatedMonthlySavings) * 10) / 10;
  }, [selectedGoal, simulatedMonthlySavings]);

  // Auto-detect on first visit
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

  const applyStartDateAndCycle = (startIso: string, cycle: SubscriptionBillingCycle, status: SubscriptionStatus) => {
    setTermStartDate(startIso);
    const parsedStart = new Date(`${startIso}T00:00:00`);
    if (isNaN(parsedStart.getTime())) return;

    // If status is 'planned', nextBillingDate is when the planned pass starts!
    // If status is 'active', nextBillingDate is startDate + 1 cycle!
    const computedNext =
      status === 'planned' ? parsedStart : shiftDateByCycle(parsedStart, cycle, 1);
    const nextIso = computedNext.toISOString().slice(0, 10);
    setFormData((prev) => ({
      ...prev,
      billingCycle: cycle,
      status,
      nextBillingDate: nextIso,
    }));
  };

  const handleOpenCreateModal = (preset?: PresetItem) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const cycle = preset ? preset.cycle : ('every_3_months' as SubscriptionBillingCycle);
    const status = preset?.defaultStatus || 'active';
    const nextDate =
      status === 'planned'
        ? new Date(Date.now() + 7 * 86400000)
        : shiftDateByCycle(new Date(), cycle, 1);
    const nextDateStr = nextDate.toISOString().slice(0, 10);

    const bankWallet =
      wallets.find((w) => w.type === 'Bank' && w.isMain) ||
      wallets.find((w) => w.type === 'Bank') ||
      wallets[0];

    setIsCustomCycle(false);
    setTermStartDate(todayStr);
    setRecordInitialPayment(false);

    setFormData({
      name: preset ? preset.name : '',
      amount: preset ? String(preset.defaultAmount) : '',
      currency: 'MAD',
      billingCycle: cycle,
      category: preset ? preset.category : 'Insurance',
      walletId: bankWallet ? bankWallet.id : '',
      nextBillingDate: nextDateStr,
      status,
      icon: preset ? preset.icon : '🛡️',
      notes: '',
      websiteUrl: '',
    });
    setEditingSub(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (sub: Subscription) => {
    const normalizedCycle =
      sub.billingCycle === 'quarterly' ? ('every_3_months' as SubscriptionBillingCycle) : sub.billingCycle;
    const isStandard = STANDARD_BILLING_CYCLES.some((c) => c.id === normalizedCycle);
    setIsCustomCycle(!isStandard);

    const customMonthsMatch = String(normalizedCycle).match(/^every_(\d+)_months?$/);
    const customDaysMatch = String(normalizedCycle).match(/^every_(\d+)_days?$/);
    if (customMonthsMatch) {
      setCustomIntervalCount(customMonthsMatch[1]);
      setCustomIntervalUnit('months');
    } else if (customDaysMatch) {
      setCustomIntervalCount(customDaysMatch[1]);
      setCustomIntervalUnit('days');
    }

    const nextDateObj = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date();
    const inferredStart =
      sub.status === 'planned'
        ? nextDateObj
        : shiftDateByCycle(nextDateObj, normalizedCycle, -1);

    setTermStartDate(inferredStart.toISOString().slice(0, 10));
    setRecordInitialPayment(false);

    setFormData({
      name: sub.name,
      amount: sub.amount,
      currency: sub.currency || 'MAD',
      billingCycle: normalizedCycle,
      category: sub.category,
      walletId: sub.walletId || '',
      nextBillingDate: sub.nextBillingDate ? new Date(sub.nextBillingDate).toISOString().slice(0, 10) : '',
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

    const finalCycle: SubscriptionBillingCycle = isCustomCycle
      ? (`every_${Math.max(1, parseInt(customIntervalCount, 10) || 1)}_${customIntervalUnit}` as SubscriptionBillingCycle)
      : formData.billingCycle;

    try {
      if (editingSub) {
        await onUpdateSubscription(editingSub.id, {
          name: formData.name.trim(),
          amount: formData.amount,
          currency: formData.currency,
          billingCycle: finalCycle,
          category: formData.category,
          walletId: formData.walletId || null,
          nextBillingDate: formData.nextBillingDate ? new Date(formData.nextBillingDate).toISOString() : null,
          status: formData.status,
          icon: formData.icon,
          notes: formData.notes,
          websiteUrl: formData.websiteUrl,
        });
        showToast(`Updated "${formData.name}" (${getCycleMeta(finalCycle).shortLabel})`);
      } else {
        await onCreateSubscription({
          name: formData.name.trim(),
          amount: formData.amount,
          currency: formData.currency,
          billingCycle: finalCycle,
          category: formData.category,
          walletId: formData.walletId || null,
          nextBillingDate: formData.nextBillingDate ? new Date(formData.nextBillingDate).toISOString() : null,
          status: formData.status,
          icon: formData.icon,
          notes: formData.notes,
          websiteUrl: formData.websiteUrl,
          recordInitialPayment: formData.status === 'active' && recordInitialPayment,
          initialPaymentDate: termStartDate,
        });
        showToast(
          recordInitialPayment && formData.status === 'active'
            ? `Added "${formData.name}" and logged ${formData.amount} ${formData.currency} payment!`
            : `Added "${formData.name}" (${getCycleMeta(finalCycle).shortLabel}) to Subscriptions Radar`
        );
      }
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save subscription');
    }
  };

  const handleAddDetectedCandidate = async (candidate: DetectedSubscription) => {
    const nextDate = shiftDateByCycle(new Date(), candidate.suggestedCycle, 1);
    const bankWallet = wallets.find((w) => w.type === 'Bank' && w.isMain) || wallets[0];

    try {
      await onCreateSubscription({
        name: candidate.name,
        amount: String(candidate.suggestedAmount),
        currency: 'MAD',
        billingCycle: candidate.suggestedCycle,
        category: candidate.suggestedCategory,
        walletId: bankWallet ? bankWallet.id : null,
        nextBillingDate: nextDate.toISOString(),
        status: 'active',
        icon: (candidate as any).icon || '📱',
        notes: `Imported from recurring charges: ${candidate.sampleTransactionNotes || ''}`,
      });
      setDetectedCandidates((prev) => prev.filter((c) => c.name !== candidate.name));
      showToast(`Added "${candidate.name}" (${getCycleMeta(candidate.suggestedCycle).shortLabel})!`);
    } catch (err: any) {
      alert(err.message || 'Failed to import subscription');
    }
  };

  const handleExecutePayment = async () => {
    if (!payingSub) return;
    try {
      const wasPlanned = payingSub.status === 'planned';
      const meta = getCycleMeta(payingSub.billingCycle);
      await onPaySubscription(payingSub.id, {
        walletId: selectedPayingWallet || payingSub.walletId || undefined,
        date: paymentDateInput || new Date().toISOString().slice(0, 10),
      });
      showToast(
        wasPlanned
          ? `Activated "${payingSub.name}", recorded ${payingSub.amount} MAD, and set next renewal in ${meta.shortLabel}!`
          : `Recorded ${payingSub.amount} MAD for "${payingSub.name}" and rolled renewal forward by ${meta.shortLabel}!`
      );
      setPayingSub(null);
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const handleQuickStatusChange = async (sub: Subscription, newStatus: SubscriptionStatus) => {
    try {
      const updates: Partial<Subscription> = { status: newStatus };
      if (sub.status === 'planned' && newStatus === 'active') {
        const nextRenewal = shiftDateByCycle(new Date(), sub.billingCycle, 1);
        updates.nextBillingDate = nextRenewal.toISOString();
      }
      await onUpdateSubscription(sub.id, updates);
      showToast(`"${sub.name}" marked as ${newStatus}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
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

  const recomputeSwitchDatesAndDefaults = (
    sub: Subscription,
    effDate: string,
    targetCycle: SubscriptionBillingCycle,
    recalc: boolean,
    nextAmountStr: string,
    payMode: SubscriptionPlanPaymentMode
  ) => {
    if (recalc) {
      const parsedEff = new Date(`${effDate}T00:00:00`);
      if (!isNaN(parsedEff.getTime())) {
        setSwitchNextBillingDate(shiftDateByCycle(parsedEff, targetCycle, 1).toISOString().slice(0, 10));
      }
    }
    const oldAmt = parseFloat(sub.amount) || 0;
    const newAmt = parseFloat(nextAmountStr) || 0;
    if (payMode === 'full') {
      setSwitchPaymentAmount(newAmt > 0 ? newAmt.toFixed(2) : '');
    } else if (payMode === 'difference') {
      const diff = Math.max(0, newAmt - oldAmt);
      setSwitchPaymentAmount(diff > 0 ? diff.toFixed(2) : '0.00');
    }
  };

  const handleOpenSwitchPlanModal = (sub: Subscription) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const currentMeta = getCycleMeta(sub.billingCycle);
    // Suggest natural next duration step (e.g. 3 months -> 10 months, else yearly, or monthly if already yearly)
    const suggestedCycle: SubscriptionBillingCycle =
      currentMeta.months === 3
        ? 'every_10_months'
        : currentMeta.months >= 12
        ? 'every_3_months'
        : currentMeta.months === 1
        ? 'every_3_months'
        : 'yearly';

    const currentAmt = parseFloat(sub.amount) || 0;
    const bankWallet =
      wallets.find((w) => w.id === sub.walletId) ||
      wallets.find((w) => w.type === 'Bank' && w.isMain) ||
      wallets[0];

    setSwitchingSub(sub);
    setSwitchNewName(sub.name);
    setSwitchNewAmount(currentAmt > 0 ? currentAmt.toFixed(2) : '');
    setSwitchNewCurrency(sub.currency || 'MAD');
    setSwitchIsCustomCycle(false);
    setSwitchCustomCount(String(getCycleMeta(suggestedCycle).months || 10));
    setSwitchCustomUnit('months');
    setSwitchNewCycle(suggestedCycle);
    setSwitchEffectiveDate(todayIso);
    setSwitchRecalculateExpiry(true);
    setSwitchNextBillingDate(shiftDateByCycle(new Date(`${todayIso}T00:00:00`), suggestedCycle, 1).toISOString().slice(0, 10));
    setSwitchPaymentMode('none');
    setSwitchPaymentAmount(currentAmt > 0 ? currentAmt.toFixed(2) : '');
    setSwitchWalletId(bankWallet?.id || '');
    setSwitchStatus(sub.status === 'planned' ? 'active' : sub.status);
    setSwitchNotes('');
  };

  const activeSwitchCycle: SubscriptionBillingCycle = switchIsCustomCycle
    ? (`every_${Math.max(1, parseInt(switchCustomCount, 10) || 1)}_${switchCustomUnit}` as SubscriptionBillingCycle)
    : switchNewCycle;

  const switchPreview = useMemo(() => {
    if (!switchingSub) return null;
    const oldAmt = parseFloat(switchingSub.amount) || 0;
    const oldMeta = getCycleMeta(switchingSub.billingCycle);
    const oldMonthly = getNormalizedMonthlyAmount(oldAmt, switchingSub.billingCycle);

    const newAmt = parseFloat(switchNewAmount) || 0;
    const newMeta = getCycleMeta(activeSwitchCycle);
    const newMonthly = getNormalizedMonthlyAmount(newAmt, activeSwitchCycle);

    let direction: 'upgrade' | 'downgrade' | 'switch' = 'switch';
    if (newAmt > oldAmt && newMeta.months >= oldMeta.months) {
      direction = 'upgrade';
    } else if (newAmt < oldAmt && newMeta.months <= oldMeta.months) {
      direction = 'downgrade';
    } else if (Math.abs(newMonthly - oldMonthly) >= 0.01) {
      direction = newMonthly > oldMonthly ? 'upgrade' : 'downgrade';
    } else if (Math.abs(newAmt - oldAmt) >= 0.01) {
      direction = newAmt > oldAmt ? 'upgrade' : 'downgrade';
    }

    const monthlyDelta = newMonthly - oldMonthly;
    const annualizedDelta = monthlyDelta * 12;
    const monthlyPctChange = oldMonthly > 0 ? (monthlyDelta / oldMonthly) * 100 : 0;

    return {
      oldAmt,
      oldMeta,
      oldMonthly,
      newAmt,
      newMeta,
      newMonthly,
      direction,
      monthlyDelta,
      annualizedDelta,
      monthlyPctChange,
    };
  }, [switchingSub, switchNewAmount, activeSwitchCycle]);

  const handleConfirmSwitchPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!switchingSub) return;
    const parsedNewAmt = parseFloat(switchNewAmount);
    if (!Number.isFinite(parsedNewAmt) || parsedNewAmt <= 0) return;

    setIsSubmittingSwitch(true);
    try {
      const payload: SubscriptionPlanChangePayload = {
        newName: switchNewName.trim() || switchingSub.name,
        newAmount: parsedNewAmt,
        newCurrency: switchNewCurrency || switchingSub.currency || 'MAD',
        newBillingCycle: activeSwitchCycle,
        effectiveDate: switchEffectiveDate,
        recalculateNextDate: switchRecalculateExpiry,
        nextBillingDate: switchNextBillingDate ? new Date(`${switchNextBillingDate}T00:00:00`).toISOString() : null,
        walletId: switchWalletId || null,
        paymentMode: switchPaymentMode,
        paymentAmount:
          switchPaymentMode !== 'none' ? Math.max(0, parseFloat(switchPaymentAmount) || 0) : undefined,
        status: switchStatus,
        notes: switchNotes.trim() ? switchNotes.trim() : undefined,
      };

      if (onChangeSubscriptionPlan) {
        const res = await onChangeSubscriptionPlan(switchingSub.id, payload);
        const dirLabel =
          res?.summary?.direction === 'downgrade'
            ? 'Downgraded'
            : res?.summary?.direction === 'upgrade'
            ? 'Upgraded'
            : 'Updated plan for';
        showToast(
          `${dirLabel} "${payload.newName}" → ${parsedNewAmt.toFixed(0)} ${payload.newCurrency} / ${getCycleMeta(activeSwitchCycle).shortLabel}`
        );
      } else {
        await onUpdateSubscription(switchingSub.id, {
          name: payload.newName,
          amount: parsedNewAmt.toFixed(2),
          currency: payload.newCurrency,
          billingCycle: activeSwitchCycle,
          walletId: payload.walletId,
          nextBillingDate: payload.nextBillingDate,
          status: payload.status,
        });
        showToast(`Switched "${payload.newName}" to ${getCycleMeta(activeSwitchCycle).shortLabel}`);
      }
      setSwitchingSub(null);
    } catch (err: any) {
      alert(err.message || 'Failed to change subscription plan');
    } finally {
      setIsSubmittingSwitch(false);
    }
  };

  const activeModalCycle: SubscriptionBillingCycle = isCustomCycle
    ? (`every_${Math.max(1, parseInt(customIntervalCount, 10) || 1)}_${customIntervalUnit}` as SubscriptionBillingCycle)
    : formData.billingCycle;
  const activeModalCycleMeta = getCycleMeta(activeModalCycle);
  const modalMonthlyEq = getNormalizedMonthlyAmount(formData.amount || 0, activeModalCycle);
  const modalDailyEq = getNormalizedDailyAmount(formData.amount || 0, activeModalCycle);

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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs">
              <Repeat className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Subscriptions &amp; Multi-Month Term Passes
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Track 3-month passes (insurance, gym, mutuelle), monthly bills, term expiration progress, and sinking fund reserves.
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
            className="border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Sparkles className={`mr-1.5 h-4 w-4 ${isDetecting ? 'animate-spin' : ''}`} />
            {isDetecting ? 'Scanning History...' : 'Scan Recurring Charges'}
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreateModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Subscription / Pass
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <StaggerList className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Normalized Monthly Burn */}
        <StaggerItem>
          <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs h-full transition-colors hover:border-indigo-300/70 dark:hover:border-indigo-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Normalized Monthly Burn
                </span>
                <Repeat className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  <AnimatedMetricValue value={totalMonthlyBurn} decimals={2} />
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">MAD / mo</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {activeSubs.length} active ({threeMonthSubs.length} on 3-month terms)
                {plannedMonthlyAddition > 0 && (
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {' '}· +{plannedMonthlyAddition.toFixed(0)} MAD/mo planned
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Multi-Month Sinking Fund */}
        <StaggerItem>
          <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs h-full transition-colors hover:border-emerald-300/70 dark:hover:border-emerald-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Multi-Month Sinking Fund
                </span>
                <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  <AnimatedMetricValue value={multiMonthSinkingFundMonthly} decimals={2} />
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">MAD / mo set-aside</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {multiMonthSubs.length > 0
                  ? `Target accrued now: ${multiMonthRecommendedReserveNow.toFixed(0)} MAD across ${multiMonthSubs.length} pass${multiMonthSubs.length === 1 ? '' : 'es'}`
                  : 'For 3-month, 10-month & annual passes'}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Annualized Commitment */}
        <StaggerItem>
          <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs h-full transition-colors hover:border-amber-300/70 dark:hover:border-amber-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Annualized Total Cost
                </span>
                <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  <AnimatedMetricValue value={totalAnnualDrain} decimals={0} />
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">MAD / yr</span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {monthlySalary > 0
                  ? `${((totalAnnualDrain / (monthlySalary * 12)) * 100).toFixed(1)}% of annual income · ${lifeEnergyHours.toFixed(1)} work hrs/mo`
                  : `${(totalMonthlyBurn / 30).toFixed(1)} MAD/day baseline commitment`}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>

        {/* Upcoming Renewals (14 Days) & Planned */}
        <StaggerItem>
          <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs h-full transition-colors hover:border-purple-300/70 dark:hover:border-purple-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Due in 14 Days &amp; Planned
                </span>
                <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  <AnimatedMetricValue value={upcomingRenewals.length} decimals={0} />
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  upcoming · {plannedSubs.length} planned
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                {upcomingRenewals.length > 0
                  ? `Next: ${upcomingRenewals[0].name} (${parseFloat(upcomingRenewals[0].amount).toFixed(0)} MAD)`
                  : plannedSubs.length > 0
                  ? `Planned: ${plannedSubs.map((p) => p.name).join(', ')}`
                  : 'No renewals due in the next 14 days'}
              </p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerList>

      {/* 90-Day Renewal Cashflow Schedule & Category Allocation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 90-Day Renewal Cashflow Schedule */}
        <Card className="lg:col-span-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  90-Day Lump-Sum &amp; Renewal Cashflow Forecast
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Actual cash leaving your wallets each month, factoring in 3-month passes and planned memberships.
                </p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                Avg {totalMonthlyBurn.toFixed(0)} MAD/mo
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ninetyDayForecast.map((bucket, idx) => {
                const isHeavyMonth = bucket.totalCashDue > totalMonthlyBurn * 1.15;
                return (
                  <div
                    key={bucket.label}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {idx === 0 ? `This Month (${bucket.label})` : bucket.label}
                        </span>
                        {isHeavyMonth && (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            Lump-sum month
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {bucket.totalCashDue.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}{' '}
                        <span className="text-xs font-normal text-gray-500">MAD</span>
                      </p>

                      <div className="mt-2.5 space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {bucket.items.length === 0 ? (
                          <p className="text-[11px] text-gray-400">No scheduled charges</p>
                        ) : (
                          bucket.items.map((item) => (
                            <div
                              key={`${bucket.label}-${item.id}`}
                              className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300"
                            >
                              <span className="truncate max-w-[125px]">
                                {item.icon} {item.name}
                                {item.isPlanned ? ' (Planned)' : ''}
                              </span>
                              <span className="font-medium tabular-nums shrink-0 ml-1">
                                {item.amount.toFixed(0)} MAD
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Normalized Spend by Category
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Monthly equivalent cost across active categories.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryBreakdown.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                Add active subscriptions or 3-month passes to view category allocation.
              </p>
            ) : (
              categoryBreakdown.slice(0, 5).map((cat, idx) => {
                const pct = totalMonthlyBurn > 0 ? Math.round((cat.monthly / totalMonthlyBurn) * 100) : 0;
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                        {cat.category}{' '}
                        <span className="text-gray-400 font-normal">· {cat.count}</span>
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        {cat.monthly.toFixed(0)} MAD/mo ({pct}%)
                      </span>
                    </div>
                    <AnimatedProgressBar
                      percent={Math.max(4, pct)}
                      delay={idx * 0.04}
                      trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                      barClassName="bg-indigo-600 dark:bg-indigo-500"
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Discovered Recurring Charges Banner (Smart Leak Hunter) */}
      {detectedCandidates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Detected Recurring Payments ({detectedCandidates.length})
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Found repeating charges in your transaction history with inferred billing intervals.
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
            {detectedCandidates.map((c) => {
              const cMeta = getCycleMeta(c.suggestedCycle);
              return (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-xl">{(c as any).icon || '📱'}</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                        {c.suggestedAmount} MAD · {cMeta.shortLabel} · {c.frequencyCount}x seen
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddDetectedCandidate(c)}
                    className="h-7 text-xs shrink-0 ml-2"
                  >
                    <Plus className="mr-1 h-3 w-3" /> Track
                  </Button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Preset Quick-Add Templates (Highlighting 3-Month Passes) */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            Quick-Add Templates (3-Month Passes &amp; Monthly Subscriptions)
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Click any template to prefill its typical billing interval and category
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const meta = getCycleMeta(preset.cycle);
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleOpenCreateModal(preset)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all"
              >
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  · {preset.defaultAmount} MAD / {meta.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List Section */}
      <div className="space-y-4">
        {/* Controls: Status Filter, Cycle Filter, Search & Sort */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status segmented control */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1">
              {(
                [
                  { id: 'all', label: `All (${subscriptions.length})` },
                  { id: 'active', label: `Active (${activeSubs.length})` },
                  { id: 'planned', label: `Planned (${plannedSubs.length})` },
                  { id: 'reviewing', label: 'Reviewing' },
                  { id: 'paused', label: 'Paused' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`relative rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterStatus === tab.id
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {filterStatus === tab.id && (
                    <motion.span
                      layoutId="subStatusFilterPill"
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.34 }}
                      className="absolute inset-0 rounded-lg bg-white dark:bg-gray-900 shadow-2xs"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Billing Cycle Filter */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1">
              {(
                [
                  { id: 'all', label: 'All Cycles' },
                  { id: '3_months', label: `3-Month Passes (${threeMonthSubs.length})` },
                  { id: 'multi_month', label: 'Multi-Month' },
                  { id: 'monthly', label: 'Monthly' },
                ] as const
              ).map((cTab) => (
                <button
                  key={cTab.id}
                  type="button"
                  onClick={() => setFilterCycle(cTab.id)}
                  className={`relative rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterCycle === cTab.id
                      ? 'text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {filterCycle === cTab.id && (
                    <motion.span
                      layoutId="subCycleFilterPill"
                      transition={{ type: 'spring', bounce: 0.18, duration: 0.34 }}
                      className="absolute inset-0 rounded-lg bg-indigo-600 shadow-2xs"
                    />
                  )}
                  <span className="relative z-10">{cTab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, category, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-9 pr-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-xs text-gray-700 dark:text-gray-300"
              >
                <option value="renewal_soon">Sort: Soonest Renewal</option>
                <option value="monthly_desc">Sort: Highest Monthly Cost</option>
                <option value="lump_desc">Sort: Highest Lump-Sum Payment</option>
                <option value="name_asc">Sort: Name (A–Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Subscriptions Grid */}
        {filteredSubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3">
              <Repeat className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              No matching subscriptions or passes
            </h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              {searchQuery || filterStatus !== 'all' || filterCycle !== 'all'
                ? 'Try clearing your active filters or search query.'
                : 'Add your 3-month insurance, gym pass, internet, or streaming subscriptions to track term progress and monthly equivalents.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {(filterStatus !== 'all' || filterCycle !== 'all' || searchQuery) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterCycle('all');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => handleOpenCreateModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add Subscription / 3-Mo Pass
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
            {filteredSubs.map((sub, idx) => {
              const meta = getCycleMeta(sub.billingCycle);
              const term = computeTermProgress(sub.nextBillingDate, sub.billingCycle);
              const daysLeft = term.daysRemaining;
              const isUrgent = sub.status === 'active' && daysLeft !== null && daysLeft <= 5 && daysLeft >= 0;
              const isOverdue = sub.status === 'active' && daysLeft !== null && daysLeft < 0;
              const isPlanned = sub.status === 'planned';
              const isPrunedInSim = prunedSubIds.has(sub.id);

              const lumpAmount = parseFloat(sub.amount) || 0;
              const monthlyEq = getNormalizedMonthlyAmount(lumpAmount, sub.billingCycle);
              const dailyEq = getNormalizedDailyAmount(lumpAmount, sub.billingCycle);
              const accruedSinkingTarget = (lumpAmount * term.percentElapsed) / 100;

              const linkedWallet =
                wallets.find((w) => w.id === sub.walletId) ||
                (sub.walletName ? wallets.find((w) => w.name === sub.walletName) : wallets.find((w) => w.isMain));
              const isShortOnWallet = linkedWallet && linkedWallet.balance < lumpAmount;

              return (
                <motion.div
                  key={sub.id}
                  layout
                  initial={{ opacity: 0, y: 8, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.2), ease: [0.16, 1, 0.3, 1] }}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-colors ${
                    isPrunedInSim
                      ? 'border-dashed border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : isPlanned
                      ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/15 dark:bg-indigo-950/10'
                      : sub.status === 'reviewing'
                      ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300/70 dark:hover:border-indigo-800'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon, Title, Unboxed Metadata & Edit/Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-2xl">
                          {sub.icon || '📱'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                            {sub.name}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            <span className="truncate">{sub.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                              {meta.shortLabel}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`capitalize font-medium shrink-0 ${
                                sub.status === 'active'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : sub.status === 'planned'
                                  ? 'text-indigo-600 dark:text-indigo-400'
                                  : sub.status === 'reviewing'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-gray-500'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sub)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
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

                    {/* Price & Normalized Breakdown */}
                    <div className="mt-4 border-t border-gray-100 dark:border-gray-800/80 pt-3">
                      <div className="flex items-baseline justify-between">
                        <div className="tabular-nums">
                          <span className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                            {lumpAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="ml-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {sub.currency || 'MAD'}
                          </span>
                          <span className="ml-1 text-xs text-gray-400">/ {meta.shortLabel}</span>
                        </div>

                        <div className="text-right tabular-nums">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {monthlyEq.toFixed(0)} MAD/mo
                          </span>
                          <span className="block text-[10px] text-gray-400">
                            {dailyEq.toFixed(1)} MAD/day
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Term Progress Bar & Renewal Schedule */}
                    {term.hasSchedule && (
                      <div className="mt-3 space-y-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-500 dark:text-gray-400">
                            {isPlanned ? (
                              <>
                                Planned start:{' '}
                                <strong className="text-gray-800 dark:text-gray-200">
                                  {term.endDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </strong>
                              </>
                            ) : (
                              <>
                                {term.startDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                                <strong className="text-gray-800 dark:text-gray-200">
                                  {term.endDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </strong>
                              </>
                            )}
                          </span>

                          {daysLeft !== null && (
                            <span
                              className={`font-semibold tabular-nums ${
                                isUrgent
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isOverdue
                                  ? 'text-red-600 dark:text-red-400'
                                  : isPlanned
                                  ? 'text-indigo-600 dark:text-indigo-400'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {isPlanned
                                ? daysLeft <= 0
                                  ? 'Ready to start'
                                  : `Starts in ${daysLeft}d`
                                : daysLeft === 0
                                ? 'Renews Today'
                                : daysLeft === 1
                                ? '1 day left'
                                : isOverdue
                                ? `Expired ${Math.abs(daysLeft)}d ago`
                                : `${daysLeft}d left (${term.percentRemaining}%)`}
                            </span>
                          )}
                        </div>

                        {!isPlanned && (
                          <>
                            <AnimatedProgressBar
                              percent={term.percentElapsed}
                              trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                              barClassName={
                                isOverdue || isUrgent
                                  ? 'bg-rose-500'
                                  : meta.isMultiMonth
                                  ? 'bg-indigo-600 dark:bg-indigo-400'
                                  : 'bg-emerald-500'
                              }
                            />
                            {meta.isMultiMonth && (
                              <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-0.5 tabular-nums">
                                <span>
                                  Day {term.elapsedDays} of {term.totalDays}
                                </span>
                                <span>
                                  Reserve target: <strong>{accruedSinkingTarget.toFixed(0)} MAD</strong>
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Notes if present */}
                    {sub.notes && (
                      <p className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                        {sub.notes}
                      </p>
                    )}

                    {/* Linked Wallet & Balance verification */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-gray-400">Wallet:</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                          {linkedWallet?.name || sub.walletName || 'Main Account'}
                        </span>
                      </div>
                      {linkedWallet && (
                        <span
                          className={`font-semibold shrink-0 tabular-nums ${
                            isShortOnWallet
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isShortOnWallet
                            ? `Low balance (${linkedWallet.balance.toFixed(0)} MAD)`
                            : `${linkedWallet.balance.toFixed(0)} MAD avail`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Quick Actions */}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-800/80 pt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedPayingWallet(sub.walletId || (wallets[0]?.id ?? ''));
                        setPaymentDateInput(new Date().toISOString().slice(0, 10));
                        setPayingSub(sub);
                      }}
                      className={`flex-1 min-w-0 px-2.5 text-xs ${
                        isPlanned
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      }`}
                    >
                      <Zap className="mr-1 h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {isPlanned ? `Start (${meta.shortLabel})` : `Renew (${meta.shortLabel})`}
                      </span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleOpenSwitchPlanModal(sub)}
                      className="flex h-8 px-2 items-center justify-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      title="Upgrade or downgrade plan (price & duration)"
                    >
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
                      <span>Plan</span>
                    </button>

                    {sub.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(sub, 'paused')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                        title="Pause subscription"
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickStatusChange(sub, 'active')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                        title="Activate without logging payment"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => togglePruned(sub.id)}
                      className={`flex h-8 px-2 items-center justify-center rounded-lg border text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isPrunedInSim
                          ? 'border-emerald-500 bg-emerald-600 text-white'
                          : 'border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                      title={isPrunedInSim ? 'Remove from savings simulator' : 'Simulate cancelling'}
                    >
                      {isPrunedInSim ? 'Saved' : 'Prune'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Pruning & Savings Simulator */}
      <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Subscription Pruner &amp; Savings Simulator
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Click &ldquo;Prune&rdquo; on any card above or select below to see how much cash and work hours you reclaim.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSimulatorExpanded(!isSimulatorExpanded)}
              className="text-xs"
            >
              {isSimulatorExpanded ? 'Hide Simulator List' : 'Open Simulator List'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {prunedSubIds.size > 0 ? (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 tabular-nums">
                <div>
                  <span className="text-xs text-gray-500">Monthly Freed</span>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    +{simulatedMonthlySavings.toFixed(2)} MAD
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Annual Savings</span>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    +{simulatedAnnualSavings.toFixed(0)} MAD
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Work Hours Reclaimed</span>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {hourlyRate > 0 ? `+${(simulatedMonthlySavings / hourlyRate).toFixed(1)} hrs/mo` : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Goal Acceleration</span>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {selectedGoal && goalAcceleratedMonths > 0
                      ? `Funds "${selectedGoal.name}" in ${goalAcceleratedMonths} mos`
                      : `${prunedSubIds.size} commitment${prunedSubIds.size === 1 ? '' : 's'} selected`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-3 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-emerald-600" />
                <span>
                  No commitments selected in simulator. Toggle &ldquo;Prune&rdquo; on any subscription card to test cancelling.
                </span>
              </div>
            </div>
          )}

          {isSimulatorExpanded && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Select commitments to test cancelling:
                </span>
                {prunedSubIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrunedSubIds(new Set())}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Reset selection
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {subscriptions.map((sub) => {
                  const isChecked = prunedSubIds.has(sub.id);
                  const mCost = getNormalizedMonthlyAmount(sub.amount, sub.billingCycle);
                  const meta = getCycleMeta(sub.billingCycle);
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
                        <div className="min-w-0">
                          <span className="font-medium block truncate">{sub.name}</span>
                          <span className="text-[10px] text-gray-400">{meta.shortLabel}</span>
                        </div>
                      </div>
                      <span className="font-semibold shrink-0 ml-2 tabular-nums">
                        {isChecked ? `-${mCost.toFixed(0)} MAD/mo` : `${mCost.toFixed(0)} MAD/mo`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <MotionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        containerClassName="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto ts-scrollbar"
      >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {editingSub ? 'Edit Subscription / Term Pass' : 'Add Subscription or Multi-Month Pass'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configure 3-month or 10-month passes, annual plans, monthly bills, or upcoming memberships.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscription} className="mt-4 space-y-4">
              {/* Name & Icon */}
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-xl"
                    placeholder="🛡️"
                  />
                </div>

                <div className="col-span-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name / Membership *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Car Insurance (3 Months), Gym Pass, Fiber Internet"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Billing Cycle Quick Selector (Highlighting Every 3 Months) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Billing Duration / Cycle *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'every_3_months', title: 'Every 3 Months', sub: '3-Mo Pass (Gym/Ins)' },
                      { id: 'monthly', title: 'Every Month', sub: 'Standard Monthly' },
                      { id: 'every_6_months', title: 'Every 6 Months', sub: '6-Mo Pass' },
                      { id: 'every_10_months', title: 'Every 10 Months', sub: '10-Mo Extended Pass' },
                      { id: 'yearly', title: 'Yearly (12 Mo)', sub: 'Annual Plan' },
                    ] as const
                  ).map((opt) => {
                    const selected = !isCustomCycle && formData.billingCycle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setIsCustomCycle(false);
                          applyStartDateAndCycle(termStartDate, opt.id, formData.status);
                        }}
                        className={`rounded-xl border p-2.5 text-left transition-all ${
                          selected
                            ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.title}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Additional cycles & Custom N-Month/Day interval */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: 'every_2_months', label: 'Every 2 Months' },
                      { id: 'weekly', label: 'Weekly (7d)' },
                      { id: 'biweekly', label: 'Every 2 Weeks (14d)' },
                    ] as const
                  ).map((extra) => {
                    const selected = !isCustomCycle && formData.billingCycle === extra.id;
                    return (
                      <button
                        key={extra.id}
                        type="button"
                        onClick={() => {
                          setIsCustomCycle(false);
                          applyStartDateAndCycle(termStartDate, extra.id, formData.status);
                        }}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {extra.label}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setIsCustomCycle(true)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isCustomCycle
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Custom Interval...
                  </button>

                  {isCustomCycle && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs text-gray-500">Every</span>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={customIntervalCount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomIntervalCount(val);
                          const customId = `every_${Math.max(1, parseInt(val, 10) || 1)}_${customIntervalUnit}` as SubscriptionBillingCycle;
                          applyStartDateAndCycle(termStartDate, customId, formData.status);
                        }}
                        className="w-16 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-center font-semibold"
                      />
                      <select
                        value={customIntervalUnit}
                        onChange={(e) => {
                          const unit = e.target.value as 'months' | 'days';
                          setCustomIntervalUnit(unit);
                          const customId = `every_${Math.max(1, parseInt(customIntervalCount, 10) || 1)}_${unit}` as SubscriptionBillingCycle;
                          applyStartDateAndCycle(termStartDate, customId, formData.status);
                        }}
                        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                      >
                        <option value="months">Months</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount, Currency & Status (Active vs Planned) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount for {activeModalCycleMeta.shortLabel} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 900.00"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
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

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Commitment Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const st = e.target.value as SubscriptionStatus;
                      applyStartDateAndCycle(termStartDate, activeModalCycle, st);
                    }}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="active">Active (Already Paying / Covered)</option>
                    <option value="planned">Planned / Upcoming (e.g. Going to Gym Soon)</option>
                    <option value="reviewing">Reviewing (Considering Cancelling)</option>
                    <option value="paused">Paused</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Live Cost Breakdown Preview Banner */}
              {Number(formData.amount) > 0 && (
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      <strong>{Number(formData.amount).toFixed(2)} {formData.currency}</strong> every{' '}
                      <strong>{activeModalCycleMeta.shortLabel}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                    <span>
                      Monthly eq: <strong className="text-indigo-700 dark:text-indigo-300">{modalMonthlyEq.toFixed(2)} {formData.currency}/mo</strong>
                    </span>
                    <span>·</span>
                    <span>
                      Daily: <strong>{modalDailyEq.toFixed(2)} {formData.currency}/day</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Term Start Date & Auto-Calculated Renewal / Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3.5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.status === 'planned' ? 'Planned Start Date' : 'Term Start / Last Paid Date'}
                  </label>
                  <input
                    type="date"
                    value={termStartDate}
                    onChange={(e) => applyStartDateAndCycle(e.target.value, activeModalCycle, formData.status)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        applyStartDateAndCycle(new Date().toISOString().slice(0, 10), activeModalCycle, formData.status)
                      }
                      className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Today
                    </button>
                    <span className="text-[10px] text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - 1);
                        applyStartDateAndCycle(d.toISOString().slice(0, 10), activeModalCycle, formData.status);
                      }}
                      className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      1 Mo Ago
                    </button>
                    <span className="text-[10px] text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 7);
                        applyStartDateAndCycle(d.toISOString().slice(0, 10), activeModalCycle, formData.status);
                      }}
                      className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      In 7 Days
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.status === 'planned'
                      ? 'First Payment Due Date'
                      : `Next Renewal / Expiry Date (+${activeModalCycleMeta.shortLabel})`}
                  </label>
                  <input
                    type="date"
                    value={formData.nextBillingDate}
                    onChange={(e) => setFormData({ ...formData, nextBillingDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-1.5 text-[10px] text-gray-500">
                    Auto-calculated from start date ({activeModalCycleMeta.shortLabel}), or adjust manually.
                  </p>
                </div>
              </div>

              {/* Category & Linked Wallet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    Payment Wallet
                  </label>
                  <select
                    value={formData.walletId}
                    onChange={(e) => setFormData({ ...formData, walletId: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Default Main Wallet</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type}) — {w.balance.toFixed(0)} MAD
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional: Record initial payment right now when adding a new active subscription */}
              {!editingSub && formData.status === 'active' && (
                <label className="flex items-start gap-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordInitialPayment}
                    onChange={(e) => setRecordInitialPayment(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      Also log this initial payment as an Expense transaction now
                    </span>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Deducts {formData.amount || '0'} {formData.currency} from your selected wallet on {termStartDate} while keeping next renewal on {formData.nextBillingDate || 'schedule'}.
                    </p>
                  </div>
                </label>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Paid 3 months upfront, includes locker access, renew in February"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {editingSub
                    ? 'Save Changes'
                    : formData.status === 'planned'
                    ? 'Add Planned Pass'
                    : 'Add Subscription / Pass'}
                </Button>
              </div>
            </form>
      </MotionModal>

      {/* Upgrade / Downgrade Plan Switcher Modal */}
      <MotionModal
        isOpen={Boolean(switchingSub)}
        onClose={() => !isSubmittingSwitch && setSwitchingSub(null)}
        containerClassName="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl my-8 max-h-[92vh] overflow-y-auto ts-scrollbar"
      >
        {switchingSub && switchPreview && (
          <form onSubmit={handleConfirmSwitchPlan} className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-2xl">
                  {switchingSub.icon || '📱'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                      Upgrade or Downgrade Plan
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        switchPreview.direction === 'upgrade'
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300'
                          : switchPreview.direction === 'downgrade'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {switchPreview.direction === 'upgrade' ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : switchPreview.direction === 'downgrade' ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3" />
                      )}
                      <span>
                        {switchPreview.direction === 'upgrade'
                          ? 'Plan Upgrade'
                          : switchPreview.direction === 'downgrade'
                          ? 'Plan Downgrade'
                          : 'Plan Switch'}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate tabular-nums">
                    Current: {switchingSub.name} · {switchPreview.oldAmt.toFixed(2)} {switchingSub.currency || 'MAD'} /{' '}
                    {switchPreview.oldMeta.shortLabel} ({switchPreview.oldMonthly.toFixed(0)} MAD/mo)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingSwitch && setSwitchingSub(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* New Term / Billing Duration Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                New Plan Duration / Billing Period *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'monthly', title: 'Monthly', sub: '1-Month Cycle' },
                    { id: 'every_3_months', title: '3 Months', sub: 'Quarterly Pass' },
                    { id: 'every_6_months', title: '6 Months', sub: 'Half-Year Pass' },
                    { id: 'every_10_months', title: '10 Months', sub: '10-Month Pass' },
                    { id: 'yearly', title: '1 Year (12 Mo)', sub: 'Annual Plan' },
                    { id: 'every_2_months', title: '2 Months', sub: 'Bi-Monthly' },
                  ] as const
                ).map((opt) => {
                  const selected = !switchIsCustomCycle && switchNewCycle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSwitchIsCustomCycle(false);
                        setSwitchNewCycle(opt.id);
                        recomputeSwitchDatesAndDefaults(
                          switchingSub,
                          switchEffectiveDate,
                          opt.id,
                          switchRecalculateExpiry,
                          switchNewAmount,
                          switchPaymentMode
                        );
                      }}
                      className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.title}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{opt.sub}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSwitchIsCustomCycle(!switchIsCustomCycle)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    switchIsCustomCycle
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Custom Duration (N Months / Days)
                </button>
                {switchIsCustomCycle && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Every</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={switchCustomCount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSwitchCustomCount(val);
                        const customId = `every_${Math.max(1, parseInt(val, 10) || 1)}_${switchCustomUnit}` as SubscriptionBillingCycle;
                        recomputeSwitchDatesAndDefaults(
                          switchingSub,
                          switchEffectiveDate,
                          customId,
                          switchRecalculateExpiry,
                          switchNewAmount,
                          switchPaymentMode
                        );
                      }}
                      className="w-16 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-center font-semibold tabular-nums"
                    />
                    <select
                      value={switchCustomUnit}
                      onChange={(e) => {
                        const unit = e.target.value as 'months' | 'days';
                        setSwitchCustomUnit(unit);
                        const customId = `every_${Math.max(1, parseInt(switchCustomCount, 10) || 1)}_${unit}` as SubscriptionBillingCycle;
                        recomputeSwitchDatesAndDefaults(
                          switchingSub,
                          switchEffectiveDate,
                          customId,
                          switchRecalculateExpiry,
                          switchNewAmount,
                          switchPaymentMode
                        );
                      }}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                    >
                      <option value="months">Months</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* New Price, Name & Effective Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Plan Price ({switchPreview.newMeta.shortLabel}) *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={switchNewAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSwitchNewAmount(v);
                      recomputeSwitchDatesAndDefaults(
                        switchingSub,
                        switchEffectiveDate,
                        activeSwitchCycle,
                        false,
                        v,
                        switchPaymentMode
                      );
                    }}
                    placeholder="e.g. 1800.00"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={switchNewCurrency}
                    onChange={(e) => setSwitchNewCurrency(e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-xs text-gray-900 dark:text-gray-100"
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Updated Plan Title
                </label>
                <input
                  type="text"
                  value={switchNewName}
                  onChange={(e) => setSwitchNewName(e.target.value)}
                  placeholder={switchingSub.name}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Switch Effective Date
                </label>
                <input
                  type="date"
                  value={switchEffectiveDate}
                  onChange={(e) => {
                    const eff = e.target.value;
                    setSwitchEffectiveDate(eff);
                    recomputeSwitchDatesAndDefaults(
                      switchingSub,
                      eff,
                      activeSwitchCycle,
                      switchRecalculateExpiry,
                      switchNewAmount,
                      switchPaymentMode
                    );
                  }}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Side-by-Side Comparison Card */}
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center tabular-nums">
                <div className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Current Plan</span>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                    {switchPreview.oldAmt.toFixed(0)} {switchingSub.currency || 'MAD'}
                    <span className="text-xs font-normal text-gray-500"> / {switchPreview.oldMeta.shortLabel}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono">
                    {switchPreview.oldMonthly.toFixed(2)} MAD / mo
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <span>{switchPreview.oldMeta.shortLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{switchPreview.newMeta.shortLabel}</span>
                  </div>
                  <span
                    className={`mt-1 text-xs font-mono font-bold ${
                      switchPreview.monthlyDelta < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : switchPreview.monthlyDelta > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-gray-500'
                    }`}
                  >
                    {switchPreview.monthlyDelta >= 0 ? '+' : ''}
                    {switchPreview.monthlyDelta.toFixed(2)} MAD/mo
                    {Math.abs(switchPreview.monthlyPctChange) >= 0.5
                      ? ` (${switchPreview.monthlyDelta > 0 ? '+' : ''}${switchPreview.monthlyPctChange.toFixed(0)}%)`
                      : ''}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {switchPreview.annualizedDelta >= 0 ? '+' : ''}
                    {switchPreview.annualizedDelta.toFixed(0)} MAD / yr impact
                  </span>
                </div>

                <div className="rounded-lg bg-white dark:bg-gray-900 border border-indigo-300 dark:border-indigo-700 p-3">
                  <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">New Plan</span>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                    {switchPreview.newAmt.toFixed(0)} {switchNewCurrency}
                    <span className="text-xs font-normal text-gray-500"> / {switchPreview.newMeta.shortLabel}</span>
                  </div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-300 font-mono font-semibold">
                    {switchPreview.newMonthly.toFixed(2)} MAD / mo
                  </div>
                </div>
              </div>

              {/* Renewal / Expiry Date Recalculation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/50 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={switchRecalculateExpiry}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSwitchRecalculateExpiry(checked);
                      if (checked) {
                        recomputeSwitchDatesAndDefaults(
                          switchingSub,
                          switchEffectiveDate,
                          activeSwitchCycle,
                          true,
                          switchNewAmount,
                          switchPaymentMode
                        );
                      } else if (switchingSub.nextBillingDate) {
                        setSwitchNextBillingDate(new Date(switchingSub.nextBillingDate).toISOString().slice(0, 10));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Recalculate expiry / next renewal date (+{switchPreview.newMeta.shortLabel})</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-[11px]">Next renewal:</span>
                  <input
                    type="date"
                    value={switchNextBillingDate}
                    onChange={(e) => {
                      setSwitchRecalculateExpiry(false);
                      setSwitchNextBillingDate(e.target.value);
                    }}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-xs text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </div>

            {/* Transaction / Payment Handling */}
            <div className="space-y-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-3.5">
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                Payment &amp; Ledger Recording
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: 'none', title: 'Plan Update Only', desc: 'Switch price & term only (no tx today)' },
                    { id: 'difference', title: 'Pay Upgrade Diff', desc: 'Log prorated or price difference today' },
                    { id: 'full', title: 'Pay Full New Plan', desc: 'Deduct full new plan amount today' },
                  ] as const
                ).map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      setSwitchPaymentMode(pm.id);
                      recomputeSwitchDatesAndDefaults(
                        switchingSub,
                        switchEffectiveDate,
                        activeSwitchCycle,
                        false,
                        switchNewAmount,
                        pm.id
                      );
                    }}
                    className={`rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                      switchPaymentMode === pm.id
                        ? 'border-indigo-600 bg-white dark:bg-gray-900 ring-1 ring-indigo-600'
                        : 'border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/50 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{pm.title}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{pm.desc}</div>
                  </button>
                ))}
              </div>

              {switchPaymentMode !== 'none' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Charge Amount Today ({switchNewCurrency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={switchPaymentAmount}
                      onChange={(e) => setSwitchPaymentAmount(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-mono tabular-nums text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Charge Wallet
                    </label>
                    <select
                      value={switchWalletId}
                      onChange={(e) => setSwitchWalletId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.type}) — {w.balance.toFixed(0)} MAD
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingSwitch}
                onClick={() => setSwitchingSub(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingSwitch || !(parseFloat(switchNewAmount) > 0)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmittingSwitch
                  ? 'Applying Plan...'
                  : switchPreview.direction === 'downgrade'
                  ? 'Confirm Downgrade'
                  : switchPreview.direction === 'upgrade'
                  ? 'Confirm Upgrade'
                  : 'Confirm Plan Switch'}
              </Button>
            </div>
          </form>
        )}
      </MotionModal>

      {/* Log Payment / Activate Pass Modal */}
      <MotionModal
        isOpen={Boolean(payingSub)}
        onClose={() => setPayingSub(null)}
        containerClassName="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl"
      >
        {payingSub && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 text-2xl">
                {payingSub.icon || '📱'}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {payingSub.status === 'planned'
                    ? `Activate & Pay ${getCycleMeta(payingSub.billingCycle).shortLabel} Pass`
                    : `Log ${getCycleMeta(payingSub.billingCycle).shortLabel} Renewal`}
                </h3>
                <p className="text-xs text-gray-500">
                  Records an expense transaction and advances renewal by {getCycleMeta(payingSub.billingCycle).shortLabel}.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Service / Pass:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{payingSub.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cycle Amount:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {payingSub.amount} {payingSub.currency || 'MAD'} ({getCycleMeta(payingSub.billingCycle).shortLabel})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Normalized Equivalent:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300 tabular-nums">
                  {getNormalizedMonthlyAmount(payingSub.amount, payingSub.billingCycle).toFixed(2)} MAD / mo
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
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

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date:
                </label>
                <input
                  type="date"
                  value={paymentDateInput}
                  onChange={(e) => setPaymentDateInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPayingSub(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleExecutePayment} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Zap className="mr-1.5 h-4 w-4" />
                {payingSub.status === 'planned' ? 'Activate & Record Payment' : 'Confirm Payment & Extend Term'}
              </Button>
            </div>
          </>
        )}
      </MotionModal>
    </div>
  );
};
