import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  ShieldCheck,
  TrendingUp,
  Target,
  Compass,
  Sparkles,
  CheckCircle2,
  Clock,
  Coins,
  ArrowUpRight,
  SlidersHorizontal,
  Save,
  Palmtree,
  Coffee,
  Gem,
  Rocket,
  Zap,
  ChevronRight,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { KPI, Goal, Debt, Wallet, FireProfile } from '../../types';

function formatCurrency(val: number): string {
  return `${Math.round(val || 0).toLocaleString()} MAD`;
}

interface FreedomTabProps {
  kpis: KPI | null;
  wallets: Wallet[];
  goals: Goal[];
  debts: Debt[];
  monthlySalary?: number;
  fireProfile: FireProfile | null;
  onUpdateFireProfile: (payload: Partial<FireProfile>) => Promise<any>;
  onNavigateToTab?: (tab: any) => void;
}

export const FreedomTab: React.FC<FreedomTabProps> = ({
  kpis,
  wallets,
  goals,
  debts,
  monthlySalary = 0,
  fireProfile,
  onUpdateFireProfile,
  onNavigateToTab,
}) => {
  // Lever States initialized from saved profile or intelligent defaults
  const [currentAge, setCurrentAge] = useState<number>(fireProfile?.currentAge ?? 28);
  const [targetAge, setTargetAge] = useState<number>(fireProfile?.targetAge ?? 55);
  const [expectedReturn, setExpectedReturn] = useState<number>(fireProfile?.expectedReturn ?? 7.5);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(fireProfile?.safeWithdrawalRate ?? 4.0);
  const [monthlySavingsBoost, setMonthlySavingsBoost] = useState<number>(fireProfile?.monthlySavingsBoost ?? 0);
  const [expenseTrimPercent, setExpenseTrimPercent] = useState<number>(fireProfile?.expenseTrimPercent ?? 0);
  const [customMonthlyExpense, setCustomMonthlyExpense] = useState<string>(
    fireProfile?.customMonthlyExpense !== null && fireProfile?.customMonthlyExpense !== undefined
      ? String(fireProfile.customMonthlyExpense)
      : ''
  );
  const [useCustomExpense, setUseCustomExpense] = useState<boolean>(
    Boolean(fireProfile?.customMonthlyExpense !== null && fireProfile?.customMonthlyExpense !== undefined)
  );

  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sync state if fireProfile updates from remote
  useEffect(() => {
    if (fireProfile) {
      setCurrentAge(fireProfile.currentAge ?? 28);
      setTargetAge(fireProfile.targetAge ?? 55);
      setExpectedReturn(fireProfile.expectedReturn ?? 7.5);
      setSafeWithdrawalRate(fireProfile.safeWithdrawalRate ?? 4.0);
      setMonthlySavingsBoost(fireProfile.monthlySavingsBoost ?? 0);
      setExpenseTrimPercent(fireProfile.expenseTrimPercent ?? 0);
      if (fireProfile.customMonthlyExpense !== null && fireProfile.customMonthlyExpense !== undefined) {
        setCustomMonthlyExpense(String(fireProfile.customMonthlyExpense));
        setUseCustomExpense(true);
      }
    }
  }, [fireProfile]);

  // 1. Calculate Real Net Worth
  const { liquidAssets, goalSavings, totalDebts, netWorth } = useMemo(() => {
    const liquid = wallets.reduce((acc, w) => acc + (w.balance > 0 ? Number(w.balance) : 0), 0);
    const inGoals = goals.reduce((acc, g) => acc + Number(g.currentAmount || 0), 0);
    const activeDebts = debts
      .filter((d) => d.type === 'Payable' && d.status === 'Pending')
      .reduce((acc, d) => acc + Number(d.remainingBalance || 0), 0);

    const total = liquid + inGoals - activeDebts;
    return {
      liquidAssets: liquid,
      goalSavings: inGoals,
      totalDebts: activeDebts,
      netWorth: Math.max(0, total),
    };
  }, [wallets, goals, debts]);

  // 2. Calculate Effective Monthly Burn & Income
  const { baselineMonthlyExpense, effectiveMonthlyExpense, monthlyIncome, baselineSavings, leverSavings, savingsRate } = useMemo(() => {
    // Determine baseline expense
    let base = 5000;
    if (useCustomExpense && customMonthlyExpense && Number(customMonthlyExpense) > 0) {
      base = Number(customMonthlyExpense);
    } else if (kpis?.monthlyExpenses && kpis.monthlyExpenses > 0) {
      base = kpis.monthlyExpenses;
    } else if (kpis?.adjustedTrueSpend && kpis.adjustedTrueSpend > 0) {
      base = kpis.adjustedTrueSpend;
    }

    const trimmedExpense = Math.max(1000, base * (1 - expenseTrimPercent / 100));

    // Income
    const inc = monthlySalary > 0 ? monthlySalary : (kpis?.monthlyIncome && kpis.monthlyIncome > 0 ? kpis.monthlyIncome : 10000);

    const baseSav = Math.max(0, inc - base);
    const levSav = Math.max(0, inc - trimmedExpense) + monthlySavingsBoost;
    const rate = inc > 0 ? Math.min(100, Math.round((levSav / inc) * 100)) : 0;

    return {
      baselineMonthlyExpense: base,
      effectiveMonthlyExpense: trimmedExpense,
      monthlyIncome: inc,
      baselineSavings: baseSav,
      leverSavings: levSav,
      savingsRate: rate,
    };
  }, [useCustomExpense, customMonthlyExpense, kpis, expenseTrimPercent, monthlySalary, monthlySavingsBoost]);

  // 3. Calculate The 4 Freedom Numbers
  const { leanFire, standardFire, fatFire, baristaFire, coastFire, isCoastUnlocked, coastGap } = useMemo(() => {
    const annualSpend = effectiveMonthlyExpense * 12;
    const swrFactor = safeWithdrawalRate > 0 ? 100 / safeWithdrawalRate : 25;

    const lean = annualSpend * 0.7 * swrFactor;
    const standard = annualSpend * swrFactor;
    const fat = annualSpend * 1.5 * swrFactor;
    const barista = annualSpend * 0.5 * swrFactor;

    // Coast FIRE Calculation:
    // Future value required at targetAge = standardFire
    // Years to compound:
    const yearsToCompound = Math.max(1, targetAge - currentAge);
    const r = Math.max(0.01, expectedReturn / 100);
    // Coast FIRE = Standard FIRE / (1 + r)^n
    const coast = standard / Math.pow(1 + r, yearsToCompound);

    const coastUnlocked = netWorth >= coast;
    const gap = Math.max(0, coast - netWorth);

    return {
      leanFire: Math.round(lean),
      standardFire: Math.round(standard),
      fatFire: Math.round(fat),
      baristaFire: Math.round(barista),
      coastFire: Math.round(coast),
      isCoastUnlocked: coastUnlocked,
      coastGap: Math.round(gap),
    };
  }, [effectiveMonthlyExpense, safeWithdrawalRate, targetAge, currentAge, expectedReturn, netWorth]);

  // 4. Calculate Time to Freedom (Baseline vs Lever-Adjusted)
  const projection = useMemo(() => {
    const r = Math.max(0.01, expectedReturn / 100);
    const monthlyRate = r / 12;

    const simulateMonths = (startBalance: number, monthlyDeposit: number, targetAmount: number): number => {
      if (startBalance >= targetAmount) return 0;
      if (monthlyDeposit <= 0 && startBalance * monthlyRate <= 0) return 600; // max 50 yrs

      let balance = startBalance;
      let months = 0;
      const maxMonths = 600; // 50 years cap

      while (balance < targetAmount && months < maxMonths) {
        balance = balance * (1 + monthlyRate) + monthlyDeposit;
        months++;
      }
      return months;
    };

    // Baseline calculation (without boost or trim)
    const baseAnnual = baselineMonthlyExpense * 12;
    const baseTarget = baseAnnual * (safeWithdrawalRate > 0 ? 100 / safeWithdrawalRate : 25);
    const baselineMonths = simulateMonths(netWorth, baselineSavings, baseTarget);

    // Lever-adjusted calculation
    const leverMonths = simulateMonths(netWorth, leverSavings, standardFire);

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + leverMonths, 1);
    const baseTargetDate = new Date(now.getFullYear(), now.getMonth() + baselineMonths, 1);

    const monthsGained = Math.max(0, baselineMonths - leverMonths);
    const yearsGained = (monthsGained / 12).toFixed(1);

    const freedomAge = currentAge + Math.floor(leverMonths / 12);

    // Days of Freedom earned per month worked
    const daysEarnedPerMonth = effectiveMonthlyExpense > 0
      ? Math.min(30, Math.round((leverSavings / effectiveMonthlyExpense) * 30))
      : 0;

    // Cross-over date (when passive monthly return surpasses monthly living cost)
    // Monthly Passive Return = Balance * (r/12)
    // Needs Balance = effectiveMonthlyExpense / (r/12)
    const crossOverTarget = effectiveMonthlyExpense / monthlyRate;
    const crossOverMonths = simulateMonths(netWorth, leverSavings, crossOverTarget);
    const crossOverYear = now.getFullYear() + Math.floor(crossOverMonths / 12);

    return {
      baselineMonths,
      leverMonths,
      yearsRemaining: Math.floor(leverMonths / 12),
      monthsRemainingRemainder: leverMonths % 12,
      targetDate,
      baseTargetDate,
      monthsGained,
      yearsGained,
      freedomAge,
      daysEarnedPerMonth,
      crossOverYear,
    };
  }, [
    expectedReturn,
    baselineMonthlyExpense,
    safeWithdrawalRate,
    netWorth,
    baselineSavings,
    leverSavings,
    standardFire,
    currentAge,
    effectiveMonthlyExpense,
  ]);

  // 5. Autonomy Milestone Levels (The 7 Levels of Autonomy)
  const autonomyLevels = useMemo(() => {
    const threeMonthEmergency = effectiveMonthlyExpense * 3;
    const oneYearRunway = effectiveMonthlyExpense * 12;

    const levels = [
      {
        level: 1,
        title: 'Level 1: Financial Solvency',
        description: 'Cash flow positive; income consistently exceeds monthly bills without incurring high-cost debt.',
        target: effectiveMonthlyExpense,
        current: netWorth,
        unlocked: netWorth >= effectiveMonthlyExpense && debts.filter((d) => d.type === 'Payable' && d.status === 'Pending').length === 0,
        icon: ShieldCheck,
        actionAdvice: 'Maintain a positive monthly ledger and eliminate overdraft risk.',
      },
      {
        level: 2,
        title: 'Level 2: Fortress Cushion (3 Months)',
        description: 'A 3-month survival moat completely protecting you from sudden life interruptions.',
        target: threeMonthEmergency,
        current: netWorth,
        unlocked: netWorth >= threeMonthEmergency,
        icon: Coins,
        actionAdvice: 'Hold this buffer in high-liquidity bank or savings accounts.',
      },
      {
        level: 3,
        title: 'Level 3: Zero Consumer Debt',
        description: 'All pending short-term debts and borrowed liabilities completely eliminated.',
        target: totalDebts === 0 ? 1 : totalDebts,
        current: totalDebts === 0 ? 1 : 0,
        unlocked: totalDebts === 0,
        icon: CheckCircle2,
        actionAdvice: totalDebts > 0 ? `Prioritize settling the remaining ${formatCurrency(totalDebts)} in pending debts.` : 'Consumer debt is zero. Fantastic job!',
      },
      {
        level: 4,
        title: 'Level 4: One-Year Freedom Runway',
        description: '12 full months of baseline survival expenses in reserves. The "F-You" runway.',
        target: oneYearRunway,
        current: netWorth,
        unlocked: netWorth >= oneYearRunway,
        icon: Clock,
        actionAdvice: 'Having 1 full year of freedom grants the autonomy to pivot careers or start ventures.',
      },
      {
        level: 5,
        title: 'Level 5: Coast FIRE Achieved',
        description: `Your portfolio reaches ${formatCurrency(coastFire)}, meaning compound growth alone will fund full retirement at age ${targetAge}.`,
        target: coastFire,
        current: netWorth,
        unlocked: isCoastUnlocked,
        icon: Palmtree,
        actionAdvice: isCoastUnlocked
          ? 'You can now downshift to part-time or low-stress work that only covers immediate expenses!'
          : `Grow your liquid net worth by another ${formatCurrency(coastGap)} to unlock Coast FIRE.`,
      },
      {
        level: 6,
        title: 'Level 6: True Financial Independence',
        description: `Safe withdrawal rate (${safeWithdrawalRate}%) covers 100% of all ongoing living expenses indefinitely.`,
        target: standardFire,
        current: netWorth,
        unlocked: netWorth >= standardFire,
        icon: Flame,
        actionAdvice: 'Work becomes entirely optional. 100% of your calendar is owned by you.',
      },
      {
        level: 7,
        title: 'Level 7: Abundant Fat FIRE',
        description: '150%+ of current lifestyle funded passively, providing multi-generational wealth and philanthropy.',
        target: fatFire,
        current: netWorth,
        unlocked: netWorth >= fatFire,
        icon: Gem,
        actionAdvice: 'Build legacy endowments, sponsor creators, or fund venture philanthropy.',
      },
    ];

    return levels;
  }, [effectiveMonthlyExpense, netWorth, debts, totalDebts, coastFire, isCoastUnlocked, targetAge, coastGap, safeWithdrawalRate, standardFire, fatFire]);

  // Determine current active level
  const currentLevelIndex = autonomyLevels.findIndex((lvl) => !lvl.unlocked);
  const currentActiveLevel = currentLevelIndex === -1 ? autonomyLevels[autonomyLevels.length - 1] : autonomyLevels[currentLevelIndex];

  // 6. Multi-Horizon Wealth Projections (5, 10, 15, 20, 25, 30 Years)
  const compoundCurve = useMemo(() => {
    const horizons = [5, 10, 15, 20, 25, 30];
    const r = Math.max(0.01, expectedReturn / 100);
    const monthlyReturn = r / 12;
    const monthlyDeposit = leverSavings;

    return horizons.map((years) => {
      const totalMonths = years * 12;

      // 1. Cash (0% real growth)
      const cashOnly = netWorth + monthlyDeposit * totalMonths;

      // 2. Conservative / Bonds (3.0% real growth)
      const safeRate = 0.03 / 12;
      let safeBalance = netWorth;
      for (let m = 0; m < totalMonths; m++) {
        safeBalance = safeBalance * (1 + safeRate) + monthlyDeposit;
      }

      // 3. Equity / Chosen Return
      let equityBalance = netWorth;
      for (let m = 0; m < totalMonths; m++) {
        equityBalance = equityBalance * (1 + monthlyReturn) + monthlyDeposit;
      }

      const totalContributed = netWorth + monthlyDeposit * totalMonths;
      const compoundGain = Math.max(0, equityBalance - totalContributed);

      return {
        years,
        cashOnly: Math.round(cashOnly),
        safeBalance: Math.round(safeBalance),
        equityBalance: Math.round(equityBalance),
        totalContributed: Math.round(totalContributed),
        compoundGain: Math.round(compoundGain),
        crossesStandardFire: equityBalance >= standardFire,
      };
    });
  }, [expectedReturn, leverSavings, netWorth, standardFire]);

  // Save Lever Settings to backend
  const handleSaveStrategy = async () => {
    setIsSavingProfile(true);
    setSaveSuccessMessage(null);
    try {
      await onUpdateFireProfile({
        currentAge,
        targetAge,
        expectedReturn,
        safeWithdrawalRate,
        monthlySavingsBoost,
        expenseTrimPercent,
        customMonthlyExpense: useCustomExpense && customMonthlyExpense ? Number(customMonthlyExpense) : null,
      });
      setSaveSuccessMessage('Freedom strategy saved to profile!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (e) {
      console.error('Error saving FIRE profile:', e);
      alert('Failed to save freedom profile settings.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const progressToStandardFire = standardFire > 0 ? Math.min(100, Math.round((netWorth / standardFire) * 100)) : 0;
  const progressToCoastFire = coastFire > 0 ? Math.min(100, Math.round((netWorth / coastFire) * 100)) : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 h-48 w-48 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xl shadow-inner">
                🔥
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Freedom Studio & F.I.R.E. Lab
              </h1>
              <span className="rounded-full bg-gradient-to-r from-amber-500/30 to-orange-500/30 px-3 py-1 text-xs font-bold text-amber-300 border border-amber-500/30 shadow-sm">
                WEALTH ACCELERATOR
              </span>
            </div>
            <p className="text-sm text-indigo-200/90 max-w-2xl leading-relaxed">
              Model your exact <strong className="text-white">Freedom Number</strong>, track the 7 Milestones of Autonomy, and simulate live levers to buy back your life energy years ahead of schedule.
            </p>
          </div>

          {/* Quick Snapshot Card */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-3.5 shadow-inner">
            <div className="px-3 py-1 border-r border-white/10">
              <span className="block text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Current Autonomy</span>
              <span className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                <currentActiveLevel.icon className="h-4 w-4 text-amber-400" />
                {currentActiveLevel.title.split(':')[0]}
              </span>
            </div>
            <div className="px-3 py-1 border-r border-white/10">
              <span className="block text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">True Net Worth</span>
              <span className="text-sm font-bold text-emerald-400 mt-0.5">{formatCurrency(netWorth)}</span>
            </div>
            <div className="px-3 py-1">
              <span className="block text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">Freedom Pace</span>
              <span className="text-sm font-bold text-indigo-300 mt-0.5">+{projection.daysEarnedPerMonth}d / mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccessMessage && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-4 text-emerald-800 dark:text-emerald-300 text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Hero Freedom Countdown & Cross-Over Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Card 1: Estimated Freedom Date */}
        <Card className="border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/20 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Freedom Target Date
              </span>
              <span className="text-[11px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 text-indigo-700 dark:text-indigo-300">
                Age {projection.freedomAge}
              </span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
              {projection.targetDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              In <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{projection.yearsRemaining} years and {projection.monthsRemainingRemainder} months</strong>, your passive investment returns will cover 100% of your living expenses forever.
            </p>
            {Number(projection.yearsGained) > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Rocket className="h-3.5 w-3.5 shrink-0" />
                <span>Acceleration: <strong>+{projection.yearsGained} years</strong> earlier than baseline!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: The Freedom Rate (Days of life bought) */}
        <Card className="border-amber-100 dark:border-amber-900/30 bg-gradient-to-br from-amber-50/30 via-white to-orange-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-amber-950/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> Freedom Velocity
              </span>
              <span className="text-[11px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-amber-800 dark:text-amber-300">
                {savingsRate}% Savings Rate
              </span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
              {projection.daysEarnedPerMonth} Days / Mo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              For every single month you work and save <strong className="text-gray-900 dark:text-white font-semibold">{formatCurrency(leverSavings)}</strong>, you permanently purchase <strong className="text-amber-600 dark:text-amber-400 font-bold">{projection.daysEarnedPerMonth} full days of retirement freedom</strong>.
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (projection.daysEarnedPerMonth / 30) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: The Cross-Over Point */}
        <Card className="border-emerald-100 dark:border-emerald-900/30 bg-gradient-to-br from-emerald-50/30 via-white to-teal-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950/20 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Cross-Over Point
              </span>
              <span className="text-[11px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-emerald-800 dark:text-emerald-300">
                Tipping Point
              </span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mt-1">
              Est. {projection.crossOverYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              The moment your compounding investments produce more monthly cash flow than your entire monthly living burn (<strong className="text-gray-900 dark:text-white font-semibold">{formatCurrency(effectiveMonthlyExpense)}</strong>).
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Compounding assumes {expectedReturn}% annual real return</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* The 4 Freedom Milestones Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            The 4 Freedom Milestones
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Based on {formatCurrency(effectiveMonthlyExpense)}/mo baseline spend & {safeWithdrawalRate}% SWR
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coast FIRE */}
          <div className={`rounded-2xl border p-4 transition-all ${
            isCoastUnlocked
              ? 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-700/60'
              : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                  <Palmtree className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-gray-900 dark:text-white">Coast FIRE</span>
              </div>
              {isCoastUnlocked ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  UNLOCKED 🏖️
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500">{progressToCoastFire}%</span>
              )}
            </div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
              {formatCurrency(coastFire)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Invest this today, and compounding alone funds standard retirement at age {targetAge} without saving another dirham!
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressToCoastFire}%` }}
              />
            </div>
          </div>

          {/* Lean FIRE */}
          <div className="rounded-2xl border bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                  <Coffee className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-gray-900 dark:text-white">Lean FIRE</span>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {Math.min(100, Math.round((netWorth / leanFire) * 100))}%
              </span>
            </div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
              {formatCurrency(leanFire)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Covers 70% of current living spend ({formatCurrency(effectiveMonthlyExpense * 0.7)}/mo) for simple, frugal independence.
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-sky-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (netWorth / leanFire) * 100)}%` }}
              />
            </div>
          </div>

          {/* Standard FIRE */}
          <div className="rounded-2xl border-2 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-gray-800/80 border-indigo-500 dark:border-indigo-500/80 p-4 shadow-sm relative">
            <div className="absolute -top-2.5 right-4 bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full">
              CORE FREEDOM
            </div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  <Flame className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-indigo-950 dark:text-indigo-200">Standard FIRE</span>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {progressToStandardFire}%
              </span>
            </div>
            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mb-1">
              {formatCurrency(standardFire)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
              100% lifestyle replacement. Covers your current {formatCurrency(effectiveMonthlyExpense)}/mo with 0 labor required.
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressToStandardFire}%` }}
              />
            </div>
          </div>

          {/* Fat FIRE */}
          <div className="rounded-2xl border bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                  <Gem className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm text-gray-900 dark:text-white">Fat FIRE</span>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {Math.min(100, Math.round((netWorth / fatFire) * 100))}%
              </span>
            </div>
            <div className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
              {formatCurrency(fatFire)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              150% lifestyle abundance ({formatCurrency(effectiveMonthlyExpense * 1.5)}/mo) for luxury, world travel, and legacy gifting.
            </p>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (netWorth / fatFire) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* The Live Freedom Acceleration Levers (Interactive Simulator) */}
      <Card className="border-indigo-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                  Freedom Levers: What Moves the Needle?
                </CardTitle>
              </div>
              <CardDescription className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Slide the controls to simulate how trimming expenses or boosting monthly investments radically accelerates your retirement year.
              </CardDescription>
            </div>

            <Button
              size="sm"
              disabled={isSavingProfile}
              onClick={handleSaveStrategy}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 h-9 px-4 rounded-xl shadow-sm self-start sm:self-auto"
            >
              {isSavingProfile ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save Strategy</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sliders Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Lever 1: Current Age & Target Age */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Current Age</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{currentAge} yrs</span>
              </div>
              <input
                type="range"
                min="18"
                max="75"
                step="1"
                value={currentAge}
                onChange={(e) => setCurrentAge(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>18</span>
                <span>45</span>
                <span>75</span>
              </div>
            </div>

            {/* Lever 2: Target Retirement Age */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Target Full Retirement Age</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{targetAge} yrs</span>
              </div>
              <input
                type="range"
                min={Math.max(currentAge + 1, 30)}
                max="80"
                step="1"
                value={targetAge}
                onChange={(e) => setTargetAge(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>{currentAge + 1}</span>
                <span>55</span>
                <span>80</span>
              </div>
            </div>

            {/* Lever 3: Monthly Savings Boost */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                  <Rocket className="h-3.5 w-3.5 text-indigo-600" /> Monthly Savings Boost
                </span>
                <span className="text-indigo-700 dark:text-indigo-300 font-bold">
                  +{formatCurrency(monthlySavingsBoost)}/mo
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="250"
                value={monthlySavingsBoost}
                onChange={(e) => setMonthlySavingsBoost(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>+0</span>
                <span>+5,000</span>
                <span>+10,000 MAD</span>
              </div>
            </div>

            {/* Lever 4: Expense Trimming Lever */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Expense Trimming</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">-{expenseTrimPercent}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="2"
                value={expenseTrimPercent}
                onChange={(e) => setExpenseTrimPercent(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0% (No cut)</span>
                <span>-15%</span>
                <span>-30% (Lean)</span>
              </div>
            </div>

            {/* Lever 5: Expected Real Investment Return (CAGR) */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Expected Annual Real Return</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{expectedReturn}%</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="12.0"
                step="0.5"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>3.0% (Bonds)</span>
                <span>7.5% (Global Equities)</span>
                <span>12.0%</span>
              </div>
            </div>

            {/* Lever 6: Safe Withdrawal Rate (SWR) */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Safe Withdrawal Rate (SWR)</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{safeWithdrawalRate}%</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="5.0"
                step="0.25"
                value={safeWithdrawalRate}
                onChange={(e) => setSafeWithdrawalRate(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>3.0% (Conservative)</span>
                <span>4.0% (Trinity Rule)</span>
                <span>5.0%</span>
              </div>
            </div>
          </div>

          {/* Custom Expense Toggle Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-xs">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="custom-expense-toggle"
                checked={useCustomExpense}
                onChange={(e) => setUseCustomExpense(e.target.checked)}
                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="custom-expense-toggle" className="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                Override baseline monthly expense with custom target
              </label>
            </div>

            {useCustomExpense && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Custom Monthly Spend:</span>
                <input
                  type="number"
                  min="500"
                  step="250"
                  value={customMonthlyExpense}
                  onChange={(e) => setCustomMonthlyExpense(e.target.value)}
                  placeholder="e.g. 6000"
                  className="w-28 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-900 dark:text-white"
                />
                <span className="font-semibold text-gray-500">MAD</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* The 7 Milestones of Autonomy (Roadmap) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                The 7 Milestones of Autonomy
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Track your financial evolution from day-to-day solvency to complete generational freedom.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {autonomyLevels.map((lvl) => {
            const Icon = lvl.icon;
            const isCompleted = lvl.unlocked;
            const isActiveFocus = !isCompleted && lvl.level === currentActiveLevel.level;
            const progress = lvl.target > 0 ? Math.min(100, Math.round((lvl.current / lvl.target) * 100)) : 100;

            return (
              <div
                key={lvl.level}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
                  isCompleted
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                    : isActiveFocus
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700/60 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-75'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`p-2.5 rounded-2xl shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                      : isActiveFocus
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {lvl.title}
                      </span>
                      {isCompleted ? (
                        <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/80 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> UNLOCKED
                        </span>
                      ) : isActiveFocus ? (
                        <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white animate-pulse">
                          CURRENT QUEST 🎯
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                          LOCKED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {lvl.description}
                    </p>
                    <div className="text-xs text-indigo-700 dark:text-indigo-300 font-medium mt-1">
                      💡 {lvl.actionAdvice}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-56 shrink-0 space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : isActiveFocus
                          ? 'bg-indigo-600'
                          : 'bg-gray-400 dark:bg-gray-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{formatCurrency(lvl.current)}</span>
                    <span>Target: {formatCurrency(lvl.target)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Multi-Horizon Compound Growth Curve */}
      <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                The Compound Growth Curve: Time In The Market
              </CardTitle>
              <CardDescription className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Comparing your contributions against the compound growth engine over 5 to 30 years at {expectedReturn}% CAGR.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Horizon</th>
                  <th className="py-3 px-3">Your Deposits</th>
                  <th className="py-3 px-3">Cash In Mattress (0%)</th>
                  <th className="py-3 px-3">Conservative (3%)</th>
                  <th className="py-3 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                    Equities ({expectedReturn}%)
                  </th>
                  <th className="py-3 px-3 font-bold text-indigo-600 dark:text-indigo-400">Compound Bonus</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {compoundCurve.map((row) => (
                  <tr
                    key={row.years}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                      row.crossesStandardFire ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-3 font-bold text-gray-900 dark:text-white">
                      {row.years} Years (Age {currentAge + row.years})
                    </td>
                    <td className="py-3.5 px-3 font-medium text-gray-600 dark:text-gray-300">
                      {formatCurrency(row.totalContributed)}
                    </td>
                    <td className="py-3.5 px-3 text-gray-400">
                      {formatCurrency(row.cashOnly)}
                    </td>
                    <td className="py-3.5 px-3 text-gray-500 dark:text-gray-400">
                      {formatCurrency(row.safeBalance)}
                    </td>
                    <td className="py-3.5 px-3 font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(row.equityBalance)}
                    </td>
                    <td className="py-3.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                      +{formatCurrency(row.compoundGain)}
                    </td>
                    <td className="py-3.5 px-3">
                      {row.crossesStandardFire ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
                          <Flame className="h-3 w-3" /> FIRE Reached
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-400">Accumulating</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Strategic Accelerators & Goal Links */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Card 1: Link With Goals */}
        <Card className="border-indigo-100 dark:border-gray-800 bg-gradient-to-br from-indigo-50/30 via-white to-transparent dark:from-gray-900 dark:to-gray-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-600" />
              Goal Capital Backing Your Freedom
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Active savings goals directly increase your liquid freedom reserves.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No savings goals created yet.</p>
            ) : (
              goals.slice(0, 3).map((g) => (
                <div key={g.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-xs">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{g.name}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(Number(g.currentAmount || 0))}</span>
                </div>
              ))
            )}
            {onNavigateToTab && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToTab('goals')}
                className="w-full text-xs font-semibold flex items-center justify-center gap-1.5 mt-2"
              >
                <span>Manage Financial Goals</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Principles of Autonomy */}
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Compass className="h-4 w-4 text-amber-500" />
              The 3 Laws of Financial Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex gap-2.5">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">1.</span>
              <p>
                <strong>The Savings Rate Supremacy:</strong> Your savings rate determines your time to freedom far more than your investment return. A 50% savings rate means every year of labor buys a full year of retirement.
              </p>
            </div>
            <div className="flex gap-2.5">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">2.</span>
              <p>
                <strong>The Rule of 25:</strong> Standard FIRE requires 25 times your annual expenses invested in broad index funds. Cutting just 500 MAD/month in unnecessary expenses removes 150,000 MAD from your freedom requirement!
              </p>
            </div>
            <div className="flex gap-2.5">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">3.</span>
              <p>
                <strong>Coast FIRE Magic:</strong> Once your current investments can compound to retirement without additional deposits, work stress evaporates and true career autonomy begins.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
