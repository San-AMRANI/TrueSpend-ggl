import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Plus,
  Flame,
  Snowflake,
  Target,
  Wallet as WalletIcon,
  HelpCircle,
  X,
  Zap,
  Tag,
  BarChart2,
  Heart,
  Smile,
  Frown,
  DollarSign,
  Award,
  ChevronRight,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ImpulseItem, ImpulseStats, Wallet, Goal } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';

interface ImpulseShieldTabProps {
  impulseItems: ImpulseItem[];
  impulseStats: ImpulseStats | null;
  wallets: Wallet[];
  goals: Goal[];
  monthlySalary?: number;
  safeToSpend?: number;
  emergencyBuffer?: number;
  onCreateImpulseItem: (payload: {
    name: string;
    amount: number;
    currency?: string;
    category?: string;
    notes?: string;
    url?: string;
    triggers?: string[];
    urgencyScore?: number;
    utilityScore?: number;
    coolingHours?: number;
  }) => Promise<any>;
  onUpdateImpulseItem: (id: string, payload: Partial<ImpulseItem>) => Promise<any>;
  onDeleteImpulseItem: (id: string) => Promise<any>;
  onResolveImpulseItem: (
    id: string,
    payload: { decision: 'resisted' | 'purchased' | 'dismissed'; notes?: string; goalId?: string; walletId?: string }
  ) => Promise<any>;
}

const TRIGGER_OPTIONS = [
  { id: 'fomo', label: '⚡ Flash Sale / FOMO', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'boredom', label: '🥱 Boredom & Casual Browsing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
  { id: 'stress', label: '💆 Stress Relief / Retail Therapy', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
  { id: 'late_night', label: '🌙 Late Night Shopping', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
  { id: 'social_media', label: '📱 Targeted Ad / Influencer', color: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300' },
  { id: 'peer_pressure', label: '👥 Peer Pressure / Trends', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300' },
  { id: 'treat', label: '🎁 "I Deserve a Treat"', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: 'need', label: '🎯 Genuine Need Under Review', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300' },
];

const PRESET_IMPULSES = [
  { name: 'Noise-Cancelling Headphones', amount: 2800, category: 'Tech & Gadgets', triggers: ['fomo', 'stress'] },
  { name: 'Latest Gaming Console / GPU', amount: 6500, category: 'Entertainment & Gaming', triggers: ['boredom', 'treat'] },
  { name: 'Designer Sneakers / Shoes', amount: 1600, category: 'Apparel & Fashion', triggers: ['social_media', 'peer_pressure'] },
  { name: 'Smart Home Gadget', amount: 850, category: 'Tech & Gadgets', triggers: ['social_media', 'boredom'] },
  { name: 'High-End Espresso Machine', amount: 4200, category: 'Home & Kitchen', triggers: ['treat', 'social_media'] },
  { name: 'Mechanical Custom Keyboard', amount: 1400, category: 'Tech & Gadgets', triggers: ['boredom', 'fomo'] },
];

export const ImpulseShieldTab: React.FC<ImpulseShieldTabProps> = ({
  impulseItems,
  impulseStats,
  wallets,
  goals,
  monthlySalary = 12000,
  safeToSpend = 3500,
  emergencyBuffer = 10000,
  onCreateImpulseItem,
  onUpdateImpulseItem,
  onDeleteImpulseItem,
  onResolveImpulseItem,
}) => {
  // Simulator State
  const [simName, setSimName] = useState<string>('PlayStation 5 Pro');
  const [simAmount, setSimAmount] = useState<number>(7500);
  const [simCategory, setSimCategory] = useState<string>('Entertainment & Gaming');

  // Vault Filtering
  const [filterTab, setFilterTab] = useState<'cooling' | 'resisted' | 'purchased' | 'all'>('cooling');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [victoryModalItem, setVictoryModalItem] = useState<ImpulseItem | null>(null);
  const [purchaseModalItem, setPurchaseModalItem] = useState<ImpulseItem | null>(null);

  // Add Modal Form State
  const [addName, setAddName] = useState<string>('');
  const [addAmount, setAddAmount] = useState<string>('');
  const [addCategory, setAddCategory] = useState<string>('Shopping & Gadgets');
  const [addNotes, setAddNotes] = useState<string>('');
  const [addUrl, setAddUrl] = useState<string>('');
  const [addTriggers, setAddTriggers] = useState<string[]>([]);
  const [addUrgency, setAddUrgency] = useState<number>(7);
  const [addUtility, setAddUtility] = useState<number>(5);
  const [addCoolingHours, setAddCoolingHours] = useState<number>(72);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Victory Resolution Form State
  const [victoryGoalId, setVictoryGoalId] = useState<string>('');
  const [victoryWalletId, setVictoryWalletId] = useState<string>('');
  const [victoryNotes, setVictoryNotes] = useState<string>('');

  // Purchase Resolution Form State
  const [purchaseWalletId, setPurchaseWalletId] = useState<string>('');
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Salary hourly wage: assume 176 monthly hours
  const hourlyWage = useMemo(() => {
    const sal = monthlySalary > 0 ? monthlySalary : 10000;
    return sal / 176;
  }, [monthlySalary]);

  // Simulator Calculations
  const simCalculations = useMemo(() => {
    const amt = Math.max(0, simAmount || 0);
    const lifeHours = hourlyWage > 0 ? (amt / hourlyWage).toFixed(1) : '0';
    const lifeDays = hourlyWage > 0 ? (amt / (hourlyWage * 8)).toFixed(1) : '0';

    // Compound growth at 8% CAGR
    const future1Yr = (amt * Math.pow(1 + 0.08, 1)).toFixed(0);
    const future5Yr = (amt * Math.pow(1 + 0.08, 5)).toFixed(0);
    const future10Yr = (amt * Math.pow(1 + 0.08, 10)).toFixed(0);
    const future20Yr = (amt * Math.pow(1 + 0.08, 20)).toFixed(0);

    // Goal delay: assume user typical monthly savings rate is 20% of salary
    const monthlySavingsPace = Math.max(500, (monthlySalary || 10000) * 0.2);
    const goalDelayDays = Math.round((amt / (monthlySavingsPace / 30)));

    // Affordability Verdict
    let verdict: 'safe' | 'caution' | 'danger' = 'safe';
    let verdictReason = 'Fits comfortably within your disposable margin.';

    if (amt > (safeToSpend || 0)) {
      verdict = 'danger';
      verdictReason = `Exceeds your safe disposable margin (${(safeToSpend || 0).toFixed(0)} MAD) and may eat into your emergency buffer!`;
    } else if (amt > (safeToSpend || 0) * 0.45) {
      verdict = 'caution';
      verdictReason = `Consumes over 45% of your remaining discretionary budget this month.`;
    }

    return {
      lifeHours,
      lifeDays,
      future1Yr,
      future5Yr,
      future10Yr,
      future20Yr,
      goalDelayDays,
      verdict,
      verdictReason,
    };
  }, [simAmount, hourlyWage, safeToSpend, monthlySalary]);

  // Filtered Vault Items
  const filteredItems = useMemo(() => {
    return impulseItems.filter((item) => {
      if (filterTab !== 'all' && item.status !== filterTab) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesCat = item.category.toLowerCase().includes(query);
        const matchesNotes = item.notes?.toLowerCase().includes(query);
        return matchesName || matchesCat || matchesNotes;
      }
      return true;
    });
  }, [impulseItems, filterTab, searchQuery]);

  // Overall Stats
  const coolingItems = useMemo(() => impulseItems.filter((i) => i.status === 'cooling'), [impulseItems]);
  const resistedItems = useMemo(() => impulseItems.filter((i) => i.status === 'resisted'), [impulseItems]);
  const purchasedItems = useMemo(() => impulseItems.filter((i) => i.status === 'purchased'), [impulseItems]);

  const totalCoolingMAD = useMemo(
    () => coolingItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    [coolingItems]
  );
  const totalResistedMAD = useMemo(
    () => resistedItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
    [resistedItems]
  );
  const totalReclaimedHours = useMemo(
    () => (hourlyWage > 0 ? (totalResistedMAD / hourlyWage).toFixed(1) : '0'),
    [totalResistedMAD, hourlyWage]
  );

  const decidedCount = resistedItems.length + purchasedItems.length;
  const resistanceRate = decidedCount > 0 ? Math.round((resistedItems.length / decidedCount) * 100) : 100;

  // Handle open add modal with preset or sim values
  const handleOpenAdd = (name = '', amount = 0, category = 'Shopping & Gadgets', triggers: string[] = []) => {
    setAddName(name || simName);
    setAddAmount(String(amount || simAmount || ''));
    setAddCategory(category || simCategory);
    setAddTriggers(triggers);
    setAddNotes('');
    setAddUrl('');
    setAddUrgency(7);
    setAddUtility(5);
    setAddCoolingHours(72);
    setIsAddModalOpen(true);
  };

  // Toggle trigger selection
  const toggleTrigger = (triggerId: string) => {
    setAddTriggers((prev) =>
      prev.includes(triggerId) ? prev.filter((t) => t !== triggerId) : [...prev, triggerId]
    );
  };

  // Create item
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(addAmount);
    if (!addName.trim()) {
      showToast('Please enter an item name');
      return;
    }
    if (!amt || amt <= 0) {
      showToast('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateImpulseItem({
        name: addName.trim(),
        amount: amt,
        currency: 'MAD',
        category: addCategory,
        notes: addNotes.trim() || undefined,
        url: addUrl.trim() || undefined,
        triggers: addTriggers,
        urgencyScore: addUrgency,
        utilityScore: addUtility,
        coolingHours: addCoolingHours,
      });
      showToast(`🧊 Frozen "${addName}" for ${addCoolingHours} hours in the Cooling Vault!`);
      setIsAddModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to freeze item');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Victory Modal
  const handleOpenVictory = (item: ImpulseItem) => {
    setVictoryModalItem(item);
    setVictoryGoalId(goals[0]?.id || '');
    setVictoryWalletId(wallets[0]?.id || '');
    setVictoryNotes('Resisted impulse after cooling off!');
  };

  // Confirm Victory
  const handleConfirmVictory = async () => {
    if (!victoryModalItem) return;
    setIsSubmitting(true);
    try {
      await onResolveImpulseItem(victoryModalItem.id, {
        decision: 'resisted',
        notes: victoryNotes,
        goalId: victoryGoalId || undefined,
        walletId: victoryWalletId || undefined,
      });
      const goal = goals.find((g) => g.id === victoryGoalId);
      const savedNotice = goal
        ? ` and swept ${victoryModalItem.amount} MAD into goal "${goal.name}"`
        : '';
      showToast(`🎉 Victory claimed! Saved ${victoryModalItem.amount} MAD${savedNotice}!`);
      setVictoryModalItem(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to record victory');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Purchase Modal
  const handleOpenPurchase = (item: ImpulseItem) => {
    setPurchaseModalItem(item);
    setPurchaseWalletId(wallets[0]?.id || '');
    setPurchaseNotes('Mindful purchase after cooling period.');
  };

  // Confirm Purchase
  const handleConfirmPurchase = async () => {
    if (!purchaseModalItem) return;
    setIsSubmitting(true);
    try {
      await onResolveImpulseItem(purchaseModalItem.id, {
        decision: 'purchased',
        notes: purchaseNotes,
        walletId: purchaseWalletId || undefined,
      });
      showToast(`🛍️ Recorded mindful purchase of ${purchaseModalItem.name} in transactions!`);
      setPurchaseModalItem(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to record purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from Impulse Shield?`)) return;
    try {
      await onDeleteImpulseItem(id);
      showToast(`Removed "${name}" from vault.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete');
    }
  };

  // Helper for cooling timer progress & label
  const getCoolingProgress = (coolsAtStr: string, coolingHours: number) => {
    const coolsAt = new Date(coolsAtStr).getTime();
    const totalMs = coolingHours * 60 * 60 * 1000;
    const now = Date.now();
    const remainingMs = coolsAt - now;

    if (remainingMs <= 0) {
      return {
        isComplete: true,
        percent: 100,
        label: 'Cooling Complete — Ready to Decide!',
      };
    }

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const elapsedMs = totalMs - remainingMs;
    const percent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

    return {
      isComplete: false,
      percent,
      label: `${hours}h ${minutes}m on ice`,
    };
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Toast */}
      {toastMsg && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-5 right-5 z-50 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white/95 dark:bg-gray-900/95 px-4 py-3 shadow-xl backdrop-blur text-sm font-medium text-indigo-900 dark:text-indigo-200 flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
          <span>{toastMsg}</span>
        </motion.div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/60 dark:from-indigo-950/40 dark:via-gray-900 dark:to-sky-950/30 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-100/60 dark:bg-indigo-900/40 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Impulse Firewall & TrueCost Matrix</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2.5">
              <span>Impulse Shield</span>
              <Snowflake className="h-6 w-6 text-sky-500 animate-spin" style={{ animationDuration: '15s' }} />
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
              Don't let quick dopamine leaks derail your freedom. Put tempting purchases in the 72-hour cooling vault, calculate your true life-energy cost, and sweep resisted money directly into your savings goals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => handleOpenAdd()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 font-semibold text-xs sm:text-sm flex items-center gap-2 h-10 px-4 rounded-xl"
            >
              <Snowflake className="h-4 w-4" />
              <span>Put Item on Ice</span>
            </Button>
          </div>
        </div>

        {/* 4 Hero KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          {/* Card 1: Money Resisted */}
          <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-semibold mb-1">
              <span>Total Cash Resisted</span>
              <Award className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-100">
              {totalResistedMAD.toLocaleString()} <span className="text-xs font-semibold">MAD</span>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 font-medium">
              {resistedItems.length} impulse{resistedItems.length === 1 ? '' : 's'} defeated
            </p>
          </div>

          {/* Card 2: Life Labor Saved */}
          <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-semibold mb-1">
              <span>Life Labor Reclaimed</span>
              <Clock className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-100">
              {totalReclaimedHours} <span className="text-xs font-semibold">Hours</span>
            </div>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80 mt-1 font-medium">
              ≈ {((parseFloat(totalReclaimedHours) || 0) / 8).toFixed(1)} workdays of freedom
            </p>
          </div>

          {/* Card 3: Currently Cooling */}
          <div className="rounded-xl border border-sky-200/80 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/30 p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-sky-700 dark:text-sky-300 font-semibold mb-1">
              <span>Currently On Ice</span>
              <Snowflake className="h-4 w-4 text-sky-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-900 dark:text-sky-100">
              {totalCoolingMAD.toLocaleString()} <span className="text-xs font-semibold">MAD</span>
            </div>
            <p className="text-[11px] text-sky-700/80 dark:text-sky-400/80 mt-1 font-medium">
              {coolingItems.length} item{coolingItems.length === 1 ? '' : 's'} in cooling-off vault
            </p>
          </div>

          {/* Card 4: Resistance Win Rate */}
          <div className="rounded-xl border border-purple-200/80 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/30 p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 font-semibold mb-1">
              <span>Resistance Win Rate</span>
              <Shield className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-900 dark:text-purple-100">
              {resistanceRate}%
            </div>
            <p className="text-[11px] text-purple-700/80 dark:text-purple-400/80 mt-1 font-medium">
              {resistedItems.length} resisted vs {purchasedItems.length} bought
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Interactive TrueCost Lab & Purchase Matrix */}
      <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-800/30 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <BarChart2 className="h-5 w-5 text-indigo-500" />
                <span>TrueCost Simulator & Purchase Matrix</span>
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Test any desired purchase before you swipe. Reveal the real hours of labor and compound future wealth foregone.
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 font-medium">Quick Presets:</span>
              {PRESET_IMPULSES.slice(0, 3).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setSimName(p.name);
                    setSimAmount(p.amount);
                    setSimCategory(p.category);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-indigo-200/70 dark:border-indigo-800/70 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                >
                  {p.name.split(' ')[0]} ({p.amount} MAD)
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Input Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
            <div className="sm:col-span-6 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                What are you tempted to buy?
              </label>
              <input
                type="text"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                placeholder="e.g., Ultra-wide Monitor, Leather Jacket"
                className="w-full h-10 px-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Price Tag (MAD)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={simAmount || ''}
                  onChange={(e) => setSimAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-10 pl-3.5 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">
                  MAD
                </span>
              </div>
            </div>

            <div className="sm:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Category
              </label>
              <select
                value={simCategory}
                onChange={(e) => setSimCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Tech & Gadgets">Tech & Gadgets</option>
                <option value="Entertainment & Gaming">Entertainment & Gaming</option>
                <option value="Apparel & Fashion">Apparel & Fashion</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Travel & Dining">Travel & Dining</option>
                <option value="Shopping & Gadgets">Shopping & Gadgets</option>
              </select>
            </div>
          </div>

          {/* Real Cost Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* 1. Life Energy Cost */}
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-gray-800 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                  <span>Life Energy Exchange</span>
                  <Clock className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-gray-900 dark:text-gray-100">
                    {simCalculations.lifeHours}
                  </span>
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    Hours of Labor
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Equals <strong className="text-gray-700 dark:text-gray-200">{simCalculations.lifeDays} full 8-hour workdays</strong> at your hourly net wage (~{hourlyWage.toFixed(1)} MAD/hr).
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-indigo-100/60 dark:border-indigo-900/40 text-[11px] text-gray-500">
                Ask yourself: <em>"Would I trade {simCalculations.lifeHours} hours at my desk for this?"</em>
              </div>
            </div>

            {/* 2. 10-Year Future Wealth Foregone */}
            <div className="rounded-xl border border-purple-100 dark:border-purple-900/50 bg-gradient-to-br from-purple-50/40 to-white dark:from-purple-950/20 dark:to-gray-800 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
                  <span>10-Year Opportunity Cost (8% CAGR)</span>
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-purple-900 dark:text-purple-100">
                    {Number(simCalculations.future10Yr).toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    MAD in 10 Yrs
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  In 20 years, invested in an index fund, this turns into <strong className="text-purple-700 dark:text-purple-300">{Number(simCalculations.future20Yr).toLocaleString()} MAD</strong>.
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-purple-100/60 dark:border-purple-900/40 text-[11px] text-gray-500">
                5-Yr: {Number(simCalculations.future5Yr).toLocaleString()} MAD · 1-Yr: {Number(simCalculations.future1Yr).toLocaleString()} MAD
              </div>
            </div>

            {/* 3. Affordability & Goal Impact */}
            <div className={`rounded-xl border p-4 flex flex-col justify-between ${
              simCalculations.verdict === 'danger'
                ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20'
                : simCalculations.verdict === 'caution'
                ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20'
                : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
            }`}>
              <div>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className={
                    simCalculations.verdict === 'danger'
                      ? 'text-red-700 dark:text-red-300'
                      : simCalculations.verdict === 'caution'
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-emerald-700 dark:text-emerald-300'
                  }>
                    Affordability Verdict
                  </span>
                  {simCalculations.verdict === 'danger' ? (
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                  ) : simCalculations.verdict === 'caution' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    simCalculations.verdict === 'danger'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200'
                      : simCalculations.verdict === 'caution'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                  }`}>
                    {simCalculations.verdict === 'danger' ? '🔴 High Risk' : simCalculations.verdict === 'caution' ? '🟡 Caution' : '🟢 Safe'}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 font-medium">
                  {simCalculations.verdictReason}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-700/60 text-[11px] text-gray-500">
                {goals.length > 0 ? (
                  <span>Delays your top goal by ≈ <strong>{simCalculations.goalDelayDays} days</strong> of savings.</span>
                ) : (
                  <span>Safe-to-spend balance: {safeToSpend?.toFixed(0)} MAD</span>
                )}
              </div>
            </div>
          </div>

          {/* Action CTA to freeze into Vault */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              💡 <em>Pro Tip: Over 74% of impulse desire evaporates within 72 hours.</em>
            </div>
            <Button
              onClick={() => handleOpenAdd(simName, simAmount, simCategory)}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 h-10 px-5 rounded-xl shadow-sm"
            >
              <Snowflake className="h-4 w-4" />
              <span>Freeze "{simName || 'This Purchase'}" in 72h Vault</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: The Cooling-Off Vault */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-sky-500" />
              <span>The Cooling-Off Vault</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {filteredItems.length}
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'cooling', label: `🧊 Cooling (${coolingItems.length})` },
              { id: 'resisted', label: `🎉 Resisted (${resistedItems.length})` },
              { id: 'purchased', label: `🛍️ Purchased (${purchasedItems.length})` },
              { id: 'all', label: `All (${impulseItems.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as any)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors ${
                  filterTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state or item list */}
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-8 sm:p-12 text-center bg-gray-50/50 dark:bg-gray-900/30">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 text-2xl">
              🧊
            </div>
            <h3 className="mt-3 text-base font-bold text-gray-900 dark:text-gray-100">
              {filterTab === 'cooling'
                ? 'Your Cooling Vault is clear!'
                : filterTab === 'resisted'
                ? 'No resisted impulses yet'
                : 'No items in this category'}
            </h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
              {filterTab === 'cooling'
                ? 'Whenever you feel an urge to make an unplanned purchase, put it on ice here. Most desires disappear after 72 hours!'
                : 'Start tracking impulse desires to celebrate money saved and life hours reclaimed.'}
            </p>
            <Button
              onClick={() => handleOpenAdd()}
              className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 h-9 rounded-xl"
            >
              + Put an Item on Ice
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const coolingInfo = getCoolingProgress(item.coolsAt, item.coolingHours);
              const amountNum = parseFloat(item.amount) || 0;
              const itemLifeHours = hourlyWage > 0 ? (amountNum / hourlyWage).toFixed(1) : '0';

              return (
                <Card
                  key={item.id}
                  className={`overflow-hidden border transition-all hover:shadow-md ${
                    item.status === 'cooling'
                      ? 'border-sky-200/80 dark:border-sky-900/50 bg-white dark:bg-gray-900'
                      : item.status === 'resisted'
                      ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                      : 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/40'
                  }`}
                >
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Header: Title + Price + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {item.category}
                          </span>
                          {item.status === 'cooling' && (
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              coolingInfo.isComplete
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                : 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200'
                            }`}>
                              {coolingInfo.isComplete ? '🔔 Ready to Decide' : `🧊 ${coolingInfo.label}`}
                            </span>
                          )}
                          {item.status === 'resisted' && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" /> Resisted & Saved!
                            </span>
                          )}
                          {item.status === 'purchased' && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              🛒 Mindful Purchase
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                          {item.name}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg sm:text-xl font-black text-gray-900 dark:text-gray-100">
                          {amountNum.toLocaleString()} <span className="text-xs font-bold text-gray-500">MAD</span>
                        </div>
                        <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          ≈ {itemLifeHours}h of labor
                        </div>
                      </div>
                    </div>

                    {/* Cooling Progress Bar (if in cooling status) */}
                    {item.status === 'cooling' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>Cooling Progress ({item.coolingHours}h rule)</span>
                          <span className="font-semibold">{Math.round(coolingInfo.percent)}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              coolingInfo.isComplete ? 'bg-amber-500' : 'bg-sky-500'
                            }`}
                            style={{ width: `${coolingInfo.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Trigger Badges & Ratings */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.triggers.map((t) => {
                        const opt = TRIGGER_OPTIONS.find((o) => o.id === t);
                        return (
                          <span
                            key={t}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              opt?.color || 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {opt?.label || t}
                          </span>
                        );
                      })}
                      {item.urgencyScore !== undefined && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          Urgency: <strong className="text-amber-600">{item.urgencyScore}/10</strong>
                        </span>
                      )}
                      {item.utilityScore !== undefined && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          Utility: <strong className="text-indigo-600">{item.utilityScore}/10</strong>
                        </span>
                      )}
                    </div>

                    {/* Notes & URL */}
                    {item.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50/70 dark:bg-gray-800/40 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                        {item.notes}
                      </p>
                    )}

                    {item.decisionNotes && (
                      <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{item.decisionNotes}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500"
                            title="View original link"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 text-gray-400"
                          title="Delete from vault"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {item.status === 'cooling' && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPurchase(item)}
                            className="text-xs border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                          >
                            Buy Mindfully
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenVictory(item)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>I Resisted! 🎉</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Behavioral Insights & Emotional Radar */}
      <Card className="border-gray-200 dark:border-gray-800 overflow-hidden">
        <CardHeader className="bg-gray-50/50 dark:bg-gray-800/30 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span>Behavioral Economics: The Mindful Spender's Laws</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 bg-gray-50/50 dark:bg-gray-800/40">
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-1">
                <span>🧊 The 72-Hour Golden Rule</span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Dopamine surges in your brain when anticipating a purchase, making it feel urgent. Waiting 72 hours allows rational System 2 thinking to regain control.
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 bg-gray-50/50 dark:bg-gray-800/40">
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-1">
                <span>⏳ The Life Energy Exchange</span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Money is nothing more than hours of your finite life exchanged for paper. Always ask: <em>"Is this item worth 3 full workdays of my existence?"</em>
              </p>
            </div>

            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 bg-gray-50/50 dark:bg-gray-800/40">
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 mb-1">
                <span>🎯 The Sweep-to-Goal Accelerator</span>
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                When you resist an impulse, don't leave the money in your checking account to be absorbed by minor expenses. Immediately sweep it into an active goal!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal 1: Put Item on Ice (Add Impulse) */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-600">
                    <Snowflake className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      Put Purchase on Ice
                    </h3>
                    <p className="text-xs text-gray-500">
                      Freeze this desire in the 72-hour cooling vault.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. Sony Wireless Headphones"
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Price (MAD) *
                    </label>
                    <input
                      type="number"
                      required
                      step="any"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-bold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Category
                    </label>
                    <select
                      value={addCategory}
                      onChange={(e) => setAddCategory(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Tech & Gadgets">Tech & Gadgets</option>
                      <option value="Entertainment & Gaming">Entertainment & Gaming</option>
                      <option value="Apparel & Fashion">Apparel & Fashion</option>
                      <option value="Home & Kitchen">Home & Kitchen</option>
                      <option value="Travel & Dining">Travel & Dining</option>
                      <option value="Shopping & Gadgets">Shopping & Gadgets</option>
                    </select>
                  </div>
                </div>

                {/* Cooling Hours Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Cooling-Off Duration
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { hours: 24, label: '24 Hours' },
                      { hours: 48, label: '48 Hours' },
                      { hours: 72, label: '72 Hours (Golden)' },
                      { hours: 168, label: '7 Days' },
                    ].map((c) => (
                      <button
                        key={c.hours}
                        type="button"
                        onClick={() => setAddCoolingHours(c.hours)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition-colors ${
                          addCoolingHours === c.hours
                            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emotional Trigger Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    What triggered this desire? (Select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {TRIGGER_OPTIONS.map((trig) => {
                      const isSelected = addTriggers.includes(trig.id);
                      return (
                        <button
                          key={trig.id}
                          type="button"
                          onClick={() => toggleTrigger(trig.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shadow-sm'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {trig.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Urgency & Utility Sliders */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Urgency</span>
                      <span className="font-bold text-amber-600">{addUrgency}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={addUrgency}
                      onChange={(e) => setAddUrgency(parseInt(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Low</span>
                      <span>Must Have Now</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">3-Month Utility</span>
                      <span className="font-bold text-indigo-600">{addUtility}/10</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={addUtility}
                      onChange={(e) => setAddUtility(parseInt(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Dust Collector</span>
                      <span>Daily Essential</span>
                    </div>
                  </div>
                </div>

                {/* Notes & URL */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Notes / Why do I want it?
                  </label>
                  <textarea
                    rows={2}
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="e.g. Saw an ad, looked nice, but do I really need another pair of sneakers?"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold"
                  >
                    {isSubmitting ? 'Freezing...' : 'Put on Ice 🧊'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Claim Victory Modal (Resisted & Sweep to Goal) */}
      <AnimatePresence>
        {victoryModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 text-3xl">
                  🎉
                </div>
                <h3 className="text-xl font-black text-gray-900 dark:text-gray-100">
                  Impulse Defeated!
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  You conquered the urge to buy <strong className="text-gray-900 dark:text-gray-100">"{victoryModalItem.name}"</strong>. You just protected <strong className="text-emerald-600">{parseFloat(victoryModalItem.amount).toLocaleString()} MAD</strong>!
                </p>
              </div>

              {/* Goal Sweep Action */}
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span>Lock In Your Win: Sweep into a Savings Goal</span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Reward your discipline! Immediately allocate this saved amount into one of your goals:
                </p>

                {goals.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={victoryGoalId}
                      onChange={(e) => setVictoryGoalId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Don't allocate to a goal, just log victory --</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          🎯 {g.name} (Target: {g.targetAmount} MAD)
                        </option>
                      ))}
                    </select>

                    {victoryGoalId && wallets.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-500">
                          Source Wallet to fund the goal transfer:
                        </label>
                        <select
                          value={victoryWalletId}
                          onChange={(e) => setVictoryWalletId(e.target.value)}
                          className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100"
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} (Balance: {w.balance} MAD)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    No active goals created yet. You can create goals in the Goals tab!
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Victory Notes (Optional)
                </label>
                <input
                  type="text"
                  value={victoryNotes}
                  onChange={(e) => setVictoryNotes(e.target.value)}
                  placeholder="e.g. Realized I didn't actually need it!"
                  className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setVictoryModalItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleConfirmVictory}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {isSubmitting ? 'Recording...' : 'Claim Victory & Save 🎉'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Conscious Purchase Modal */}
      <AnimatePresence>
        {purchaseModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 my-8"
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <span>🛍️ Record Mindful Purchase</span>
                </h3>
                <p className="text-xs text-gray-500">
                  You waited through the cooling period and decided you genuinely need "{purchaseModalItem.name}". We'll record this expense in your transactions.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Amount to Debit</span>
                  <span className="text-sm font-black text-gray-900 dark:text-gray-100">{purchaseModalItem.amount} MAD</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Wallet to pay from:
                  </label>
                  <select
                    value={purchaseWalletId}
                    onChange={(e) => setPurchaseWalletId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.balance} MAD)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Purchase Note
                  </label>
                  <input
                    type="text"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    placeholder="e.g. Bought after 72 hours of careful deliberation."
                    className="w-full h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPurchaseModalItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleConfirmPurchase}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isSubmitting ? 'Logging...' : 'Confirm Mindful Purchase'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
