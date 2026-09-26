import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Clock,
  Coins,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Target,
  Repeat,
  WalletCards,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  Zap,
  Info,
  Layers,
  ChevronRight,
  Award,
  ArrowUpRight,
  Briefcase,
  Car,
  Hourglass,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Transaction,
  KPI,
  Goal,
  Debt,
  CategoryBudget,
  DashboardTab,
  OpportunitySwap,
  LifeEnergyProfile,
} from '../../types';
import {
  ASSET_BENCHMARKS,
  calculateCompoundGrowth,
  computeRealHourlyWage,
  analyzeLedgerOpportunities,
  computeWealthVelocity,
  PRESET_WEALTH_SWAPS,
} from '../../lib/opportunityEngine';

interface OpportunityTabProps {
  transactions: Transaction[];
  kpis: KPI | null;
  payrolls: any[];
  debts: Debt[];
  goals: Goal[];
  budgets: CategoryBudget[];
  monthlySalary?: number;
  onNavigateToTab: (tab: DashboardTab) => void;
  onCreateGoal?: (payload: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    walletId?: string | null;
    autoSyncBalance?: boolean;
    deadline?: string | null;
    category?: string;
    notes?: string;
  }) => Promise<any>;
}

export const OpportunityTab: React.FC<OpportunityTabProps> = ({
  transactions,
  kpis,
  payrolls,
  debts,
  goals,
  budgets,
  monthlySalary,
  onNavigateToTab,
  onCreateGoal,
}) => {
  // Sub-navigation view
  const [activeView, setActiveView] = useState<'time-machine' | 'life-energy' | 'velocity' | 'swaps'>('time-machine');

  // Life Energy Profile state (persisted in local state, defaults to smart inference)
  const inferredSalary = monthlySalary || kpis?.salary || 12000;
  const [lifeProfile, setLifeProfile] = useState<LifeEnergyProfile>(() => {
    const saved = localStorage.getItem('truespend_life_energy_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      monthlyNetSalary: inferredSalary,
      weeklyWorkHours: 40,
      weeklyCommuteHours: 5,
      monthlyWorkDirectExpenses: 800,
    };
  });

  const [isEditingLifeProfile, setIsEditingLifeProfile] = useState(false);

  const wageMetrics = useMemo(() => {
    return computeRealHourlyWage(lifeProfile);
  }, [lifeProfile]);

  const saveLifeProfile = (updated: LifeEnergyProfile) => {
    setLifeProfile(updated);
    localStorage.setItem('truespend_life_energy_profile', JSON.stringify(updated));
    setIsEditingLifeProfile(false);
  };

  // Time Machine Configuration States
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>('sp500');
  const [reallocationAmount, setReallocationAmount] = useState<number>(800);
  const [horizonYears, setHorizonYears] = useState<number>(10);
  const [redirectionPercent, setRedirectionPercent] = useState<number>(50);
  const [selectedCategorySource, setSelectedCategorySource] = useState<string>('custom');

  // Active Asset Benchmark
  const activeBenchmark = useMemo(() => {
    return ASSET_BENCHMARKS.find((b) => b.id === selectedBenchmarkId) || ASSET_BENCHMARKS[0];
  }, [selectedBenchmarkId]);

  // Ledger Opportunities Analysis
  const ledgerAnalysis = useMemo(() => {
    return analyzeLedgerOpportunities(transactions, wageMetrics.realHourly, activeBenchmark.cagrPercent);
  }, [transactions, wageMetrics.realHourly, activeBenchmark.cagrPercent]);

  // Handle selecting category in Time Machine
  const handleSelectCategorySource = (catName: string) => {
    setSelectedCategorySource(catName);
    if (catName === 'custom') {
      // keep current amount
    } else {
      const match = ledgerAnalysis.categories.find((c) => c.category === catName);
      if (match) {
        setReallocationAmount(match.monthlySpend);
      }
    }
  };

  // Effective Monthly Contribution based on Redirection Percent
  const effectiveMonthlyInvestment = useMemo(() => {
    return Math.round((reallocationAmount * redirectionPercent) / 100);
  }, [reallocationAmount, redirectionPercent]);

  // Compound Simulation Result
  const compoundSim = useMemo(() => {
    return calculateCompoundGrowth(effectiveMonthlyInvestment, horizonYears, activeBenchmark.cagrPercent);
  }, [effectiveMonthlyInvestment, horizonYears, activeBenchmark]);

  // Wealth Velocity Audit
  const velocityAudit = useMemo(() => {
    return computeWealthVelocity(kpis, payrolls, debts, goals, ledgerAnalysis.totalDiscretionaryMonthly);
  }, [kpis, payrolls, debts, goals, ledgerAnalysis.totalDiscretionaryMonthly]);

  // Quick Price-Tag Life Energy Converter
  const [quickCalculatorPrice, setQuickCalculatorPrice] = useState<number>(650);
  const quickLifeHours = useMemo(() => {
    return parseFloat((quickCalculatorPrice / Math.max(1, wageMetrics.realHourly)).toFixed(1));
  }, [quickCalculatorPrice, wageMetrics.realHourly]);

  const quickTenYearCompound = useMemo(() => {
    // If one-off invested in S&P 500 for 10 years: FV = P * (1+r)^t
    const r = activeBenchmark.cagrPercent / 100;
    return Math.round(quickCalculatorPrice * Math.pow(1 + r, 10));
  }, [quickCalculatorPrice, activeBenchmark.cagrPercent]);

  // Active Wealth Swaps (Commitments)
  const [activeSwaps, setActiveSwaps] = useState<OpportunitySwap[]>(() => {
    const saved = localStorage.getItem('truespend_wealth_swaps');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return PRESET_WEALTH_SWAPS;
  });

  const [newSwapTitle, setNewSwapTitle] = useState('');
  const [newSwapCategory, setNewSwapCategory] = useState('');
  const [newSwapAmount, setNewSwapAmount] = useState('');
  const [newSwapDescription, setNewSwapDescription] = useState('');
  const [showNewSwapModal, setShowNewSwapModal] = useState(false);
  const [isCreatingGoalForSwap, setIsCreatingGoalForSwap] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const saveSwaps = (swaps: OpportunitySwap[]) => {
    setActiveSwaps(swaps);
    localStorage.setItem('truespend_wealth_swaps', JSON.stringify(swaps));
  };

  const handleIncrementStreak = (swapId: string) => {
    const updated = activeSwaps.map((s) => (s.id === swapId ? { ...s, streakWeeks: s.streakWeeks + 1 } : s));
    saveSwaps(updated);
    showToast('🔥 Streak extended! Keep building momentum.');
  };

  const handleDeleteSwap = (swapId: string) => {
    const updated = activeSwaps.filter((s) => s.id !== swapId);
    saveSwaps(updated);
    showToast('Swap removed.');
  };

  const handleAddCustomSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSwapTitle || !newSwapAmount) return;
    const amount = parseFloat(newSwapAmount) || 200;
    const newSwap: OpportunitySwap = {
      id: `swap-${Date.now()}`,
      title: newSwapTitle,
      category: newSwapCategory || 'Discretionary',
      monthlyAmountMAD: Math.round(amount),
      tradeoffDescription: newSwapDescription || `Redirecting ${amount} MAD monthly to wealth compounding.`,
      streakWeeks: 1,
      createdAt: new Date().toISOString(),
      isCustom: true,
    };
    saveSwaps([newSwap, ...activeSwaps]);
    setShowNewSwapModal(false);
    setNewSwapTitle('');
    setNewSwapCategory('');
    setNewSwapAmount('');
    setNewSwapDescription('');
    showToast('✨ New wealth swap activated!');
  };

  const handleConvertSwapToGoal = async (swap: OpportunitySwap) => {
    if (!onCreateGoal) {
      onNavigateToTab('goals');
      return;
    }
    setIsCreatingGoalForSwap(swap.id);
    try {
      const oneYearTarget = swap.monthlyAmountMAD * 12;
      await onCreateGoal({
        name: `${swap.title} Compounding Fund`,
        targetAmount: oneYearTarget,
        currentAmount: swap.monthlyAmountMAD * swap.streakWeeks * 0.25, // partial accrued
        category: 'Wealth & Opportunity',
        notes: `Automatically generated from Wealth Swap: "${swap.tradeoffDescription}". Monthly contribution: ${swap.monthlyAmountMAD} MAD.`,
      });
      showToast(`🎯 Goal "${swap.title} Compounding Fund" created!`);
    } catch (err) {
      showToast('Error creating goal. Opening goals tab...');
      onNavigateToTab('goals');
    } finally {
      setIsCreatingGoalForSwap(null);
    }
  };

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 4000);
  };

  const totalSwapsMonthlySaved = useMemo(() => {
    return activeSwaps.reduce((acc, s) => acc + s.monthlyAmountMAD, 0);
  }, [activeSwaps]);

  const totalSwapsTenYearCompounded = useMemo(() => {
    return calculateCompoundGrowth(totalSwapsMonthlySaved, 10, activeBenchmark.cagrPercent).futureValue;
  }, [totalSwapsMonthlySaved, activeBenchmark]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-3 text-sm font-medium shadow-2xl flex items-center gap-2 animate-bounce border border-gray-700">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Financial Life Matrix & Opportunity Engine
              </span>
              <span className="text-xs text-gray-400">· Real-Time Wage Math</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Wealth Time Machine & Opportunity Engine
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Every dirham spent is not just cash—it is <strong className="text-white">hours of your life worked</strong> and <strong className="text-white">exponential future compound wealth</strong> sacrificed. Explore the true cost of spending and reclaim your financial velocity.
            </p>
          </div>

          {/* Real Hourly Wage Callout */}
          <div className="shrink-0 bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-300">Your Real Net Hourly Wage</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">{wageMetrics.realHourly}</span>
                <span className="text-xs text-amber-300 font-bold">MAD / hr</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Nominal: {wageMetrics.nominalHourly} MAD/hr · {wageMetrics.monthlyWorkHours}h/mo
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActiveView('life-energy');
                setIsEditingLifeProfile(true);
              }}
              className="text-xs border-white/20 text-white hover:bg-white/10 ml-1 h-8 px-2.5"
            >
              Adjust
            </Button>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setActiveView('time-machine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'time-machine'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Compounding Time Machine
          </button>

          <button
            type="button"
            onClick={() => setActiveView('life-energy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'life-energy'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Clock className="h-4 w-4" />
            Life Energy & True Wage
          </button>

          <button
            type="button"
            onClick={() => setActiveView('velocity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'velocity'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Zap className="h-4 w-4" />
            Wealth Velocity Audit ({velocityAudit.score}/100)
          </button>

          <button
            type="button"
            onClick={() => setActiveView('swaps')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeView === 'swaps'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Coins className="h-4 w-4" />
            Wealth Swaps ({activeSwaps.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: COMPOUNDING TIME MACHINE */}
      {activeView === 'time-machine' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls & Simulator Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Col: Interactive Levers */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-indigo-500" />
                      Redirection Simulator
                    </CardTitle>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      Step 1 of 2
                    </span>
                  </div>
                  <CardDescription className="text-xs">
                    Choose a real discretionary habit or enter a custom amount to redirect into compounding assets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Category Source Selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Target Spending Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectCategorySource('custom')}
                        className={`text-xs p-2.5 rounded-lg border text-left font-medium transition-all ${
                          selectedCategorySource === 'custom'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        ✏️ Custom Entry
                      </button>
                      {ledgerAnalysis.categories.slice(0, 5).map((cat) => (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => handleSelectCategorySource(cat.category)}
                          className={`text-xs p-2.5 rounded-lg border text-left font-medium truncate transition-all ${
                            selectedCategorySource === cat.category
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <div className="truncate">{cat.category}</div>
                          <div className="text-[10px] text-gray-500 font-normal">
                            ~{cat.monthlySpend} MAD/mo
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Monthly Outflow Amount Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Monthly Outflow to Reclaim
                      </label>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {reallocationAmount.toLocaleString()} MAD / month
                      </span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={10000}
                      step={50}
                      value={reallocationAmount}
                      onChange={(e) => {
                        setSelectedCategorySource('custom');
                        setReallocationAmount(parseFloat(e.target.value) || 0);
                      }}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>100 MAD</span>
                      <span>2,500 MAD</span>
                      <span>5,000 MAD</span>
                      <span>10,000 MAD</span>
                    </div>
                  </div>

                  {/* Redirection Intensity % */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Sacrifice / Redirection Ratio
                      </label>
                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                        {redirectionPercent}% redirected ({effectiveMonthlyInvestment} MAD/mo)
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[15, 25, 50, 75, 100].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setRedirectionPercent(pct)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            redirectionPercent === pct
                              ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                              : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      Redirecting {redirectionPercent}% allows you to enjoy {100 - redirectionPercent}% guilt-free while saving{' '}
                      <strong>{effectiveMonthlyInvestment} MAD</strong> every month.
                    </p>
                  </div>

                  {/* Investment Horizon */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Time Horizon (Years)
                      </label>
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                        {horizonYears} Years
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {[1, 3, 5, 10, 20, 30].map((yrs) => (
                        <button
                          key={yrs}
                          type="button"
                          onClick={() => setHorizonYears(yrs)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                            horizonYears === yrs
                              ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-gray-900 shadow-sm'
                              : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {yrs}Y
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Benchmark Asset Selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                      Compounding Asset Class Vehicle
                    </label>
                    <div className="space-y-2">
                      {ASSET_BENCHMARKS.map((bench) => {
                        const isSelected = bench.id === selectedBenchmarkId;
                        return (
                          <div
                            key={bench.id}
                            onClick={() => setSelectedBenchmarkId(bench.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-sm ring-1 ring-indigo-500'
                                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    bench.category === 'Debt Payoff'
                                      ? 'bg-rose-500'
                                      : bench.category === 'Tech'
                                      ? 'bg-purple-500'
                                      : bench.category === 'Equities'
                                      ? 'bg-emerald-500'
                                      : 'bg-blue-500'
                                  }`}
                                />
                                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                  {bench.name}
                                </span>
                              </div>
                              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                +{bench.cagrPercent}% / yr
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                              {bench.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Compounding Results & Milestones */}
            <div className="lg:col-span-7 space-y-6">
              {/* Primary Future Value Hero */}
              <Card className="border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white overflow-hidden shadow-xl">
                <CardContent className="p-6 sm:p-7">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/60 pb-5">
                    <div>
                      <span className="text-xs font-semibold text-indigo-300 tracking-wider uppercase">
                        Projected Future Wealth in {horizonYears} Years
                      </span>
                      <div className="text-3xl sm:text-5xl font-black tracking-tight text-white mt-1">
                        {compoundSim.futureValue.toLocaleString()}{' '}
                        <span className="text-lg sm:text-2xl font-bold text-indigo-300">MAD</span>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-xs font-medium text-gray-300">Monthly Contribution</span>
                      <div className="text-xl font-bold text-emerald-400">
                        +{effectiveMonthlyInvestment.toLocaleString()} MAD
                      </div>
                      <span className="text-[11px] text-gray-400">
                        at {activeBenchmark.cagrPercent}% CAGR ({activeBenchmark.name})
                      </span>
                    </div>
                  </div>

                  {/* 3 Metric Breakdown */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6">
                    <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
                      <p className="text-[11px] font-medium text-gray-400">Out-of-Pocket Principal</p>
                      <p className="text-base sm:text-xl font-extrabold text-white mt-0.5">
                        {compoundSim.principalTotal.toLocaleString()} MAD
                      </p>
                      <p className="text-[10px] text-gray-400">Your actual savings</p>
                    </div>

                    <div className="bg-emerald-500/10 rounded-xl p-3.5 border border-emerald-500/20">
                      <p className="text-[11px] font-medium text-emerald-300">Free Compound Gain</p>
                      <p className="text-base sm:text-xl font-extrabold text-emerald-400 mt-0.5">
                        +{compoundSim.compoundInterestTotal.toLocaleString()} MAD
                      </p>
                      <p className="text-[10px] text-emerald-300">
                        {compoundSim.principalTotal > 0
                          ? `+${Math.round(
                              (compoundSim.compoundInterestTotal / compoundSim.principalTotal) * 100
                            )}% interest gain`
                          : '0%'}
                      </p>
                    </div>

                    <div className="bg-amber-500/10 rounded-xl p-3.5 border border-amber-500/20">
                      <p className="text-[11px] font-medium text-amber-300">Rule of 72 Doubling</p>
                      <p className="text-base sm:text-xl font-extrabold text-amber-400 mt-0.5">
                        {compoundSim.doublingYears} Yrs
                      </p>
                      <p className="text-[10px] text-amber-300">Per capital doubling</p>
                    </div>
                  </div>

                  {/* Visual Bar Comparison */}
                  <div className="mt-6 pt-5 border-t border-indigo-800/60">
                    <div className="flex justify-between text-xs font-semibold mb-2 text-gray-300">
                      <span>Capital Composition</span>
                      <span>
                        Principal: {Math.round((compoundSim.principalTotal / Math.max(1, compoundSim.futureValue)) * 100)}% · Growth:{' '}
                        {Math.round((compoundSim.compoundInterestTotal / Math.max(1, compoundSim.futureValue)) * 100)}%
                      </span>
                    </div>
                    <div className="h-4 rounded-full overflow-hidden flex bg-indigo-950 border border-white/10 p-0.5">
                      <div
                        style={{
                          width: `${(compoundSim.principalTotal / Math.max(1, compoundSim.futureValue)) * 100}%`,
                        }}
                        className="bg-indigo-400 rounded-l-full transition-all duration-500"
                        title="Principal"
                      />
                      <div
                        style={{
                          width: `${(compoundSim.compoundInterestTotal / Math.max(1, compoundSim.futureValue)) * 100}%`,
                        }}
                        className="bg-emerald-400 rounded-r-full transition-all duration-500"
                        title="Compound Interest"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Milestones & Wealth Horizons */}
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    Wealth Milestone Horizon
                  </CardTitle>
                  <CardDescription className="text-xs">
                    How long until this single spending redirection takes you across major net worth benchmarks:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">100k MAD Moat</span>
                        <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400">
                          Tier 1
                        </span>
                      </div>
                      <div className="text-xl font-black text-gray-900 dark:text-gray-100 mt-1">
                        {compoundSim.yearsTo100k !== null ? `${compoundSim.yearsTo100k} Yrs` : 'N/A'}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">Full financial emergency immunity</p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Half-Million</span>
                        <span className="text-[11px] font-extrabold text-purple-600 dark:text-purple-400">
                          Tier 2
                        </span>
                      </div>
                      <div className="text-xl font-black text-gray-900 dark:text-gray-100 mt-1">
                        {compoundSim.yearsTo500k !== null ? `${compoundSim.yearsTo500k} Yrs` : 'N/A'}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">Coast-FIRE baseline threshold</p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-300">1 Million MAD</span>
                        <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400">
                          Millionaire
                        </span>
                      </div>
                      <div className="text-xl font-black text-amber-900 dark:text-amber-200 mt-1">
                        {compoundSim.yearsTo1M !== null ? `${compoundSim.yearsTo1M} Yrs` : 'N/A'}
                      </div>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Generational self-sustaining wealth
                      </p>
                    </div>
                  </div>

                  {/* Year by Year Stepped Trajectory */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2.5">
                      Year-by-Year Growth Checkpoints
                    </p>
                    <div className="space-y-1.5">
                      {compoundSim.trajectory
                        .filter((p) => [1, 2, 3, 5, 10, 15, 20, 25, 30].includes(p.year) && p.year <= horizonYears)
                        .map((step) => {
                          const maxVal = compoundSim.futureValue || 1;
                          const widthPct = Math.max(6, Math.min(100, (step.total / maxVal) * 100));
                          return (
                            <div key={step.year} className="flex items-center gap-3 text-xs">
                              <span className="w-12 font-bold text-gray-500 shrink-0">Year {step.year}</span>
                              <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-6 rounded-md overflow-hidden flex items-center p-1">
                                <div
                                  style={{ width: `${widthPct}%` }}
                                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded transition-all duration-300"
                                />
                              </div>
                              <span className="font-extrabold text-gray-900 dark:text-gray-100 tabular-nums w-24 text-right">
                                {step.total.toLocaleString()} MAD
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Bridge: Convert to Goal or Budget */}
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">
                    🎯
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Lock in this {effectiveMonthlyInvestment} MAD/month allocation
                    </p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                      Create an automated TrueSpend Goal or cap this spending in your Monthly Budgets.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateToTab('budgets')}
                    className="text-xs"
                  >
                    Set Budget Cap
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (onCreateGoal) {
                        onCreateGoal({
                          name: `${activeBenchmark.name} Compounding Vault`,
                          targetAmount: compoundSim.futureValue,
                          currentAmount: 0,
                          category: 'Compounding Investment',
                          notes: `Targeting ${compoundSim.futureValue.toLocaleString()} MAD in ${horizonYears} years by redirecting ${effectiveMonthlyInvestment} MAD/mo.`,
                        });
                        showToast(`🎯 Goal "${activeBenchmark.name} Compounding Vault" created!`);
                      } else {
                        onNavigateToTab('goals');
                      }
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    Auto-Create Goal
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Retroactive Ledger Backtester */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Hourglass className="h-4 w-4 text-purple-500" />
                    Retroactive Opportunity Mirror: What If You Had Invested Instead?
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Audits your real historical transaction ledger and calculates the compounding value if that capital had gone into {activeBenchmark.name}.
                  </CardDescription>
                </div>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-lg">
                  {ledgerAnalysis.categories.length} Categories Audited
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {ledgerAnalysis.categories.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No expense transactions found. Log transactions to unlock retroactive opportunity auditing.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                        <th className="pb-3">Category</th>
                        <th className="pb-3">Monthly Drain</th>
                        <th className="pb-3">Life Work Hours</th>
                        <th className="pb-3">5-Yr Compounded</th>
                        <th className="pb-3">10-Yr Compounded</th>
                        <th className="pb-3 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {ledgerAnalysis.categories.slice(0, 7).map((cat) => (
                        <tr key={cat.category} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="py-3 font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span>{cat.isDiscretionary ? '⚡' : '📦'}</span>
                            <span>{cat.category}</span>
                            {cat.isDiscretionary && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold">
                                Discretionary
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-bold text-gray-800 dark:text-gray-200">
                            {cat.monthlySpend.toLocaleString()} MAD/mo
                          </td>
                          <td className="py-3 font-medium text-gray-600 dark:text-gray-400">
                            {cat.lifeHoursMonthly} hrs ({cat.workDaysMonthly} work-days)
                          </td>
                          <td className="py-3 font-extrabold text-indigo-600 dark:text-indigo-400">
                            {cat.fiveYearCompounded.toLocaleString()} MAD
                          </td>
                          <td className="py-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                            {cat.tenYearCompounded.toLocaleString()} MAD
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                handleSelectCategorySource(cat.category);
                                setReallocationAmount(cat.monthlySpend);
                                showToast(`Loaded ${cat.category} into simulator!`);
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-700 h-7 px-2"
                            >
                              Simulate Swap →
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 2: LIFE ENERGY & TRUE WAGE STUDIO */}
      {activeView === 'life-energy' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Real Wage Breakdown Card */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-500" />
                    Life Energy Economics: The Real Wage Formula
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Your nominal hourly rate is an illusion. When you account for commute time, preparation, and work-related costs, your actual earnings per hour of life drop significantly.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingLifeProfile(!isEditingLifeProfile)}
                  className="text-xs"
                >
                  {isEditingLifeProfile ? 'Close Parameters' : 'Edit Labor Parameters'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Parameter Editor Drawer */}
              {isEditingLifeProfile && (
                <div className="mb-6 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Monthly Take-Home Salary (MAD)
                    </label>
                    <Input
                      type="number"
                      value={lifeProfile.monthlyNetSalary}
                      onChange={(e) =>
                        setLifeProfile({
                          ...lifeProfile,
                          monthlyNetSalary: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Weekly Office / Job Hours
                    </label>
                    <Input
                      type="number"
                      value={lifeProfile.weeklyWorkHours}
                      onChange={(e) =>
                        setLifeProfile({
                          ...lifeProfile,
                          weeklyWorkHours: parseFloat(e.target.value) || 40,
                        })
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Weekly Commute & Prep Hours
                    </label>
                    <Input
                      type="number"
                      value={lifeProfile.weeklyCommuteHours}
                      onChange={(e) =>
                        setLifeProfile({
                          ...lifeProfile,
                          weeklyCommuteHours: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Monthly Direct Job Costs (MAD)
                    </label>
                    <Input
                      type="number"
                      value={lifeProfile.monthlyWorkDirectExpenses}
                      onChange={(e) =>
                        setLifeProfile({
                          ...lifeProfile,
                          monthlyWorkDirectExpenses: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => saveLifeProfile(lifeProfile)}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    >
                      Save & Apply Parameters
                    </Button>
                  </div>
                </div>
              )}

              {/* Wage Comparison Visual */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                  <span className="text-xs font-medium text-gray-500">1. Nominal Paper Wage</span>
                  <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
                    {wageMetrics.nominalHourly} <span className="text-xs font-bold text-gray-500">MAD / hr</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Based strictly on {lifeProfile.weeklyWorkHours} hrs/wk without commute or work tax.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20">
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">2. Time Drag & Overhead</span>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
                    -{lifeProfile.weeklyCommuteHours * 4.33} hrs/mo
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
                    {lifeProfile.weeklyCommuteHours}h/wk travel + {lifeProfile.monthlyWorkDirectExpenses} MAD/mo travel/clothes costs.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">3. Real Net Life Energy Wage</span>
                  <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {wageMetrics.realHourly} <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">MAD / hr</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1 font-semibold">
                    The true rate of exchange: 1 hour of your life = {wageMetrics.realHourly} MAD.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Price Tag Life Energy Converter */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <Card className="md:col-span-5 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-500" />
                  Instant Life-Cost Tag Converter
                </CardTitle>
                <CardDescription className="text-xs">
                  Eyeing a purchase? Enter the price to calculate how much of your mortal life energy it commands.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Item Price Tag (MAD)
                  </label>
                  <Input
                    type="number"
                    value={quickCalculatorPrice}
                    onChange={(e) => setQuickCalculatorPrice(parseFloat(e.target.value) || 0)}
                    className="text-base font-extrabold"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[120, 450, 1200, 4000, 15000].map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => setQuickCalculatorPrice(sample)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold"
                      >
                        {sample.toLocaleString()} MAD
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Life Hours Demanded:</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {quickLifeHours} Hours
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Full 8-Hour Work Days:</span>
                    <span className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                      {(quickLifeHours / 8).toFixed(1)} Days
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-indigo-200 dark:border-indigo-900/60">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">
                      Opportunity Cost in 10 Yrs ({activeBenchmark.name}):
                    </span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      {quickTenYearCompound.toLocaleString()} MAD
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => onNavigateToTab('impulse-shield')}
                  className="w-full text-xs bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white font-semibold"
                >
                  Send to Impulse Shield Vault →
                </Button>
              </CardContent>
            </Card>

            {/* Life Energy Matrix of Real Categories */}
            <Card className="md:col-span-7 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-purple-500" />
                  Your Life Energy Burn Ledger
                </CardTitle>
                <CardDescription className="text-xs">
                  How many working days and weeks per year you surrender to each spending category:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ledgerAnalysis.categories.slice(0, 6).map((cat) => (
                    <div
                      key={cat.category}
                      className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">
                            {cat.category}
                          </span>
                          <span className="text-[10px] text-gray-500 font-semibold">
                            {cat.monthlySpend.toLocaleString()} MAD/mo
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, (cat.lifeHoursMonthly / 40) * 100)}%`,
                            }}
                            className={`h-full rounded-full ${
                              cat.workDaysMonthly > 3 ? 'bg-rose-500' : cat.workDaysMonthly > 1 ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-gray-900 dark:text-gray-100">
                          {cat.lifeHoursMonthly} hrs / mo
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium">
                          {cat.workWeeksAnnual.toFixed(1)} full work weeks / yr
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* VIEW 3: WEALTH VELOCITY AUDIT */}
      {activeView === 'velocity' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Velocity Score Banner */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Wealth Velocity & Capital Formation Audit
                </CardTitle>
                <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 ${velocityAudit.statusColor}`}>
                  {velocityAudit.status}
                </span>
              </div>
              <CardDescription className="text-xs">
                Wealth Velocity measures the exact percentage of your monthly inflow that successfully solidifies into permanent net worth rather than evaporating into expenses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Score Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-br from-gray-900 to-slate-900 text-white">
                <div>
                  <span className="text-xs font-medium text-gray-400">Velocity Efficiency Score</span>
                  <div className="text-4xl sm:text-5xl font-black mt-1 flex items-baseline gap-2">
                    <span className={velocityAudit.statusColor}>{velocityAudit.score}</span>
                    <span className="text-lg text-gray-500">/ 100</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-2 max-w-md">{velocityAudit.insight}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 shrink-0 sm:text-right">
                  <div>
                    <span className="text-[11px] text-gray-400">Capital Formed / Mo</span>
                    <p className="text-xl font-black text-emerald-400">
                      {velocityAudit.monthlyCapitalFormed.toLocaleString()} MAD
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400">Velocity Rate</span>
                    <p className="text-xl font-black text-indigo-300">
                      {velocityAudit.velocityRatePercent}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Cash Flow Distribution Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  Where Every 100 MAD of Inflow Goes:
                </h4>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 1. Wealth & Capital Formation (Retained)
                      </span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {velocityAudit.velocityRatePercent}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        style={{ width: `${velocityAudit.velocityRatePercent}%` }}
                        className="h-full bg-emerald-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                        <Briefcase className="h-3.5 w-3.5" /> 2. Core Overhead & Survival (Fixed)
                      </span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                        {velocityAudit.fixedOverheadPercent}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        style={{ width: `${velocityAudit.fixedOverheadPercent}%` }}
                        className="h-full bg-indigo-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Flame className="h-3.5 w-3.5" /> 3. Discretionary Bleed & Consumption
                      </span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">
                        {velocityAudit.discretionaryBleedPercent}%
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        style={{ width: `${velocityAudit.discretionaryBleedPercent}%` }}
                        className="h-full bg-amber-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tactical Directives to Boost Velocity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                    Directive A
                  </span>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Sweep First, Spend Second
                  </p>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Automate transferring {Math.round(velocityAudit.monthlyInflow * 0.2)} MAD to your savings/goals wallet on payday morning.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    Directive B
                  </span>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Curb Lifestyle Creep
                  </p>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Whenever your income expands, lock at least 50% of the raise into automated investments before lifestyle inflation kicks in.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 space-y-1">
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">
                    Directive C
                  </span>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Revolving Debt Halt
                  </p>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Aggressively crush debts with APR &gt; 12%. Stopping interest drain provides a guaranteed, tax-free double-digit return.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 4: WEALTH SWAPS & HABIT COMMITMENTS */}
      {activeView === 'swaps' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Swaps Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-indigo-50/30 dark:bg-indigo-950/20">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Total Monthly Reclaimed
                </span>
                <div className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
                  {totalSwapsMonthlySaved.toLocaleString()} MAD / mo
                </div>
                <p className="text-[10px] text-gray-500">Across {activeSwaps.length} active wealth commitments</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-950/20">
              <CardContent className="p-4">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  10-Year Compounded Total
                </span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {totalSwapsTenYearCompounded.toLocaleString()} MAD
                </div>
                <p className="text-[10px] text-gray-500">If invested at {activeBenchmark.cagrPercent}% CAGR</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 flex items-center justify-between p-4">
              <div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Create New Wealth Swap
                </span>
                <p className="text-[11px] text-gray-500">Commit to a habit substitution</p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowNewSwapModal(true)}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Swap
              </Button>
            </Card>
          </div>

          {/* New Swap Modal */}
          {showNewSwapModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
              <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activate New Wealth Swap</CardTitle>
                  <CardDescription className="text-xs">
                    Define a high-friction habit and the monthly cash you will reclaim by substituting it.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCustomSwap} className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Swap Title (e.g. Brew Coffee at Home)
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="e.g. Cook Friday Dinner"
                        value={newSwapTitle}
                        onChange={(e) => setNewSwapTitle(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Category
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Dining, Entertainment, Subscriptions"
                        value={newSwapCategory}
                        onChange={(e) => setNewSwapCategory(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Estimated Monthly Savings (MAD)
                      </label>
                      <Input
                        type="number"
                        required
                        placeholder="e.g. 600"
                        value={newSwapAmount}
                        onChange={(e) => setNewSwapAmount(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                        Commitment Protocol / Rule
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Substitute restaurant dinner with batch cooking twice a week."
                        value={newSwapDescription}
                        onChange={(e) => setNewSwapDescription(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowNewSwapModal(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                      >
                        Activate Swap
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Active Swaps List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSwaps.map((swap) => {
              const fiveYearValue = calculateCompoundGrowth(swap.monthlyAmountMAD, 5, activeBenchmark.cagrPercent).futureValue;
              const tenYearValue = calculateCompoundGrowth(swap.monthlyAmountMAD, 10, activeBenchmark.cagrPercent).futureValue;

              return (
                <Card
                  key={swap.id}
                  className="border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                            {swap.category}
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            🔥 {swap.streakWeeks} Wk Streak
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 mt-1.5">
                          {swap.title}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                          {swap.tradeoffDescription}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSwap(swap.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors p-1"
                        title="Delete swap"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Financial Compounding Tag */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-center">
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium">Reclaimed / Mo</span>
                        <div className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-gray-100">
                          {swap.monthlyAmountMAD} MAD
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium">5-Yr Impact</span>
                        <div className="text-xs sm:text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                          {fiveYearValue.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium">10-Yr Impact</span>
                        <div className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {tenYearValue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleIncrementStreak(swap.id)}
                        className="text-xs h-8 text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800"
                      >
                        +1 Wk Kept 🔥
                      </Button>

                      <Button
                        size="sm"
                        disabled={isCreatingGoalForSwap === swap.id}
                        onClick={() => handleConvertSwapToGoal(swap)}
                        className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5"
                      >
                        <Target className="h-3.5 w-3.5" />
                        {isCreatingGoalForSwap === swap.id ? 'Creating...' : 'Convert to Goal'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tradeoff Realities Matrix */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Real-Life Tradeoff Equivalence Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Micro-habits translated into tangible life milestones:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
                  <span className="text-2xl">☕ ⇄ ✈️</span>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Daily Café Runs = European Flights
                  </p>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Spending 35 MAD/day on specialty coffee = 12,775 MAD/year. That is equal to 2 round-trip flights to southern Europe or fully funding an emergency liquidity buffer.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
                  <span className="text-2xl">🛵 ⇄ 💻</span>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Food Delivery Apps = Pro Workstation
                  </p>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Ordering takeout 3x a week (~240 MAD/wk) = 12,480 MAD/year. In 18 months, that equals a brand-new MacBook Pro M-series or a dedicated emergency cash moat.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
                  <span className="text-2xl">📱 ⇄ 📈</span>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Unused Subscriptions = Index Fund Moat
                  </p>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Retaining 280 MAD/mo in idle streaming and gym apps costs you 63,400 MAD in compounded S&P 500 returns over 10 years.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
