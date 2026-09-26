import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  TrendingUp,
  Sliders,
  DollarSign,
  ArrowRight,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  CheckCircle,
  HelpCircle,
  Zap,
  Coffee,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { ResilienceAudit, DashboardTab } from '../../types';

interface ResilienceTabProps {
  audit: ResilienceAudit | null;
  loading?: boolean;
  onRefresh?: () => void;
  onUpdateProfile: (payload: any) => Promise<any>;
  onSimulateCustom: (payload: any) => Promise<any>;
  onNavigateToTab: (tab: DashboardTab) => void;
}

export const ResilienceTab: React.FC<ResilienceTabProps> = ({
  audit,
  loading = false,
  onRefresh,
  onUpdateProfile,
  onSimulateCustom,
  onNavigateToTab,
}) => {
  // Scenario states
  const [activeScenario, setActiveScenario] = useState<'jobLoss' | 'emergency' | 'inflation' | 'blackSwan' | 'custom'>('jobLoss');
  const [jobLossMonths, setJobLossMonths] = useState<number>(3);
  const [freezeSubscriptions, setFreezeSubscriptions] = useState<boolean>(true);
  const [emergencyShockAmount, setEmergencyShockAmount] = useState<number>(2500);
  const [inflationRate, setInflationRate] = useState<number>(12);

  // Custom simulation states
  const [customJobLossMonths, setCustomJobLossMonths] = useState<number>(3);
  const [customEmergency, setCustomEmergency] = useState<number>(2000);
  const [customInflation, setCustomInflation] = useState<number>(10);
  const [customCutDiscretionary, setCustomCutDiscretionary] = useState<number>(50);
  const [customSimulationResult, setCustomSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Config modal
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [configTargetMonths, setConfigTargetMonths] = useState<number>(audit?.profile?.emergencyTargetMonths ?? 6);
  const [configEssentialRatio, setConfigEssentialRatio] = useState<number>(Number(audit?.profile?.essentialExpensesRatio ?? 60));
  const [configMicroThreshold, setConfigMicroThreshold] = useState<number>(Number(audit?.profile?.microLeakThreshold ?? 20));
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Handler for custom simulation
  const handleRunCustomSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await onSimulateCustom({
        jobLossMonths: customJobLossMonths,
        emergencyExpense: customEmergency,
        inflationRate: customInflation,
        freezeSubscriptions: freezeSubscriptions ? 100 : 0,
        cutDiscretionary: customCutDiscretionary,
      });
      setCustomSimulationResult(res);
    } catch (e) {
      console.error('Custom simulation error:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Handler for updating user profile
  const handleSaveProfileConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await onUpdateProfile({
        emergencyTargetMonths: configTargetMonths,
        essentialExpensesRatio: configEssentialRatio,
        microLeakThreshold: configMicroThreshold,
      });
      setIsConfigOpen(false);
    } catch (e) {
      console.error('Error saving resilience config:', e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  if (!audit && loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
          <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const baseline = audit?.baseline ?? {
    liquidBalance: 0,
    savingsBalance: 0,
    totalAssets: 0,
    totalDebtsPayable: 0,
    totalDebtsReceivable: 0,
    monthlySalary: 5000,
    monthlyExpenses: 3000,
    essentialMonthly: 1800,
    discretionaryMonthly: 1200,
    subscriptionMonthly: 150,
    netMonthlySurplus: 2000,
    savingsRatePercent: 40,
    runwayMonths: 4.5,
    runwayDays: 135,
    targetRunwayMonths: 6,
    emergencyTargetAmount: 10800,
  };

  const overallScore = audit?.overallScore ?? 68;
  const grade = audit?.grade ?? 'A';
  const gradeLabel = audit?.gradeLabel ?? 'Solid Resilience';
  const verdict = audit?.verdict ?? 'Moderate buffer against unexpected economic surprises.';
  const pillars = audit?.pillars ?? [];
  const microLeaks = audit?.microLeaks ?? {
    threshold: 20,
    totalCount: 0,
    totalSpent: 0,
    monthlyDrain: 0,
    annualProjected: 0,
    tenYearCompounded: 0,
    workHoursEquivalent: 0,
    items: [],
  };
  const directives = audit?.directives ?? [];

  // Dynamic calculations for scenario 1: Job loss
  const dailyBurn = baseline.essentialMonthly > 0 ? baseline.essentialMonthly / 30 : 50;
  const freezeSavings = freezeSubscriptions ? baseline.subscriptionMonthly * jobLossMonths : 0;
  const adjustedJobLossBurn = (baseline.essentialMonthly * jobLossMonths) - freezeSavings;
  const dynamicJobLossEnding = baseline.liquidBalance - adjustedJobLossBurn;
  const dynamicJobLossSurvives = dynamicJobLossEnding >= 0;
  const dynamicDaysRemaining = dailyBurn > 0 ? Math.floor(baseline.liquidBalance / (adjustedJobLossBurn / (jobLossMonths * 30))) : 0;

  // Dynamic calculations for scenario 2: Emergency shock
  const dynamicEmergencyEnding = baseline.liquidBalance - emergencyShockAmount;
  const dynamicEmergencySurvives = dynamicEmergencyEnding >= 0;
  const bufferRetainedPercent = baseline.emergencyTargetAmount > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, dynamicEmergencyEnding) / baseline.emergencyTargetAmount) * 100)))
    : 0;

  // Dynamic calculations for scenario 3: Inflation
  const inflationExtraMonthly = baseline.essentialMonthly * (inflationRate / 100);
  const dynamicNewMonthlyExpenses = baseline.monthlyExpenses + inflationExtraMonthly;
  const dynamicNewSurplus = baseline.monthlySalary - dynamicNewMonthlyExpenses;

  return (
    <div className="space-y-10 pb-12">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Resilience & Stress Defense
            </h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300">
              Lab v2.4
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>5-Pillar Solvency Audit</span>
            <span aria-hidden="true">·</span>
            <span>Economic Shock Simulations</span>
            <span aria-hidden="true">·</span>
            <span>Habit Leak Radar</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            <span>Configure Targets</span>
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              title="Refresh Audit"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* ── Main Scorecard Section ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Overall Grade Card */}
        <div className="lg:col-span-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
              <span>Overall Resilience</span>
              <span>Max 100 Pts</span>
            </div>

            <div className="mt-4 flex items-baseline gap-4">
              <div className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {grade}
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {overallScore}/100
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {gradeLabel}
                </div>
              </div>
            </div>

            {/* Score Progress Bar */}
            <div className="mt-4 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${
                  overallScore >= 80
                    ? 'bg-emerald-500'
                    : overallScore >= 60
                    ? 'bg-blue-500'
                    : overallScore >= 45
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>

            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {verdict}
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>Audit Target: {baseline.targetRunwayMonths} mo buffer</span>
            <span>Audited live</span>
          </div>
        </div>

        {/* 3 Vital Signs Indicators */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sign 1: Liquid Runway */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>Liquid Runway</span>
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {baseline.runwayMonths} Months
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {baseline.runwayDays} days of essential living ($
                {Math.round(baseline.essentialMonthly)}/mo)
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
              Target: {baseline.targetRunwayMonths} months ($
              {baseline.emergencyTargetAmount.toLocaleString()})
            </div>
          </div>

          {/* Sign 2: Monthly Cash Surplus */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>Monthly Cash Flow</span>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {baseline.netMonthlySurplus >= 0 ? '+' : ''}$
                {Math.round(baseline.netMonthlySurplus).toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {baseline.savingsRatePercent >= 0 ? '+' : ''}
                {baseline.savingsRatePercent}% net savings rate
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
              Income: ${Math.round(baseline.monthlySalary).toLocaleString()} · Spend: $
              {Math.round(baseline.monthlyExpenses).toLocaleString()}
            </div>
          </div>

          {/* Sign 3: Liabilities vs Reserves */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>Debt Solvency</span>
                <ShieldCheck className="w-4 h-4 text-gray-400" />
              </div>
              <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
                {baseline.totalDebtsPayable === 0
                  ? '0 Debt'
                  : `$${Math.round(baseline.totalDebtsPayable).toLocaleString()}`}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {baseline.totalDebtsPayable === 0
                  ? 'Complete freedom from liabilities'
                  : `${Math.round(
                      (baseline.totalDebtsPayable / (baseline.liquidBalance || 1)) * 100
                    )}% of liquid cash`}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500">
              Liquid Cash: ${Math.round(baseline.liquidBalance).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── 01. The 5 Defense Pillars Scorecard ────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            01. Solvency Pillar Breakdown
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Weighted algorithmic rating
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {pillars.map((pillar) => {
            const pct = Math.round((pillar.score / pillar.maxScore) * 100);
            return (
              <div
                key={pillar.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium truncate">{pillar.name}</span>
                    <span>{pillar.weight}</span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      {pillar.score}/{pillar.maxScore}
                    </span>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      {pillar.metric}
                    </span>
                  </div>

                  <div className="mt-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${
                        pct >= 80
                          ? 'bg-emerald-500'
                          : pct >= 60
                          ? 'bg-blue-500'
                          : pct >= 40
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-3 text-xs font-medium text-gray-900 dark:text-gray-200">
                    {pillar.headline}
                  </div>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-normal line-clamp-3">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 02. Interactive Crisis Stress-Test Simulator ───────────── */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              02. Crisis Stress-Test Simulator
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Subject your live finances to realistic macro & micro economic shocks
            </p>
          </div>

          {/* Scenario Tab Buttons */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
            <button
              onClick={() => setActiveScenario('jobLoss')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeScenario === 'jobLoss'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Job Interruption
            </button>
            <button
              onClick={() => setActiveScenario('emergency')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeScenario === 'emergency'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Emergency Shock
            </button>
            <button
              onClick={() => setActiveScenario('inflation')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeScenario === 'inflation'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Stagflation Surge
            </button>
            <button
              onClick={() => setActiveScenario('blackSwan')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeScenario === 'blackSwan'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Black Swan
            </button>
            <button
              onClick={() => setActiveScenario('custom')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeScenario === 'custom'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Custom Lab
            </button>
          </div>
        </div>

        {/* Simulator Container */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          {/* SCENARIO 1: JOB LOSS */}
          {activeScenario === 'jobLoss' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Income Stoppage / Job Loss
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Simulates zero incoming payroll. How long do liquid reserves last?
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-600 dark:text-gray-300">
                      Duration without Income
                    </span>
                    <span className="text-gray-900 dark:text-white font-bold">
                      {jobLossMonths} Months ({jobLossMonths * 30} days)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={jobLossMonths}
                    onChange={(e) => setJobLossMonths(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>1 mo</span>
                    <span>3 mo</span>
                    <span>6 mo</span>
                    <span>12 mo</span>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={freezeSubscriptions}
                      onChange={(e) => setFreezeSubscriptions(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      Emergency Freeze: Pause all subscriptions ($
                      {Math.round(baseline.subscriptionMonthly)}/mo saved)
                    </span>
                  </label>
                </div>
              </div>

              {/* Outcome Display */}
              <div className="lg:col-span-7 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Survival Simulation Result
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                        dynamicJobLossSurvives
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      {dynamicJobLossSurvives ? 'Absorbed Successfully' : 'Deficit / Exhaustion'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Remaining Cash
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          dynamicJobLossSurvives
                            ? 'text-gray-900 dark:text-white'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {dynamicJobLossSurvives
                          ? `$${Math.round(dynamicJobLossEnding).toLocaleString()}`
                          : `-$${Math.abs(Math.round(dynamicJobLossEnding)).toLocaleString()}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Max Survival Days
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {dynamicDaysRemaining} Days
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {dynamicJobLossSurvives
                      ? `Your available reserves will support you through ${jobLossMonths} full months with $${Math.round(
                          dynamicJobLossEnding
                        ).toLocaleString()} buffer remaining.`
                      : `At current burn rate, your liquid balance is exhausted after ${dynamicDaysRemaining} days. You would need $${Math.abs(
                          Math.round(dynamicJobLossEnding)
                        ).toLocaleString()} in external borrowing.`}
                  </p>
                </div>

                {freezeSubscriptions && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Freezing recurring subscriptions adds +
                      {audit?.stressScenarios.jobLoss.extendedDaysWithFreeze ?? 18} days to your runway.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCENARIO 2: EMERGENCY EXPENSE SHOCK */}
          {activeScenario === 'emergency' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Emergency Out-of-Pocket Shock
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Major car breakdown, unexpected home repair, or urgent medical deductible.
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    Select Shock Size
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[1000, 2500, 5000, 10000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setEmergencyShockAmount(amt)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition ${
                          emergencyShockAmount === amt
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-600 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        ${amt >= 1000 ? `${amt / 1000}k` : amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Custom Amount</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      ${emergencyShockAmount.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="15000"
                    step="500"
                    value={emergencyShockAmount}
                    onChange={(e) => setEmergencyShockAmount(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              {/* Outcome Display */}
              <div className="lg:col-span-7 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Shock Absorption Analysis
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                        dynamicEmergencySurvives
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      {dynamicEmergencySurvives ? 'Absorbed Without Debt' : 'Liquidity Shortfall'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Remaining Cushion
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          dynamicEmergencySurvives
                            ? 'text-gray-900 dark:text-white'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {dynamicEmergencySurvives
                          ? `$${Math.round(dynamicEmergencyEnding).toLocaleString()}`
                          : `-$${Math.abs(Math.round(dynamicEmergencyEnding)).toLocaleString()}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Buffer Retained
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {bufferRetainedPercent}%
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {dynamicEmergencySurvives
                      ? `Your liquid assets absorb this $${emergencyShockAmount.toLocaleString()} bill with zero borrowing. You still hold $${Math.round(
                          dynamicEmergencyEnding
                        ).toLocaleString()} in liquid cash (${bufferRetainedPercent}% of target).`
                      : `A $${emergencyShockAmount.toLocaleString()} shock exceeds your liquid bank/cash reserves. You would experience a $${Math.abs(
                          Math.round(dynamicEmergencyEnding)
                        ).toLocaleString()} immediate shortfall.`}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-500">
                  Target Emergency Fund: ${baseline.emergencyTargetAmount.toLocaleString()} ({baseline.targetRunwayMonths} mo)
                </div>
              </div>
            </div>
          )}

          {/* SCENARIO 3: STAGFLATION SURGE */}
          {activeScenario === 'inflation' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Stagflation & Cost-of-Living Surge
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Simulates inflation across food, utilities, housing, and fuel.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-600 dark:text-gray-300">
                      Essential Inflation Rate
                    </span>
                    <span className="text-gray-900 dark:text-white font-bold">
                      +{inflationRate}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="25"
                    step="1"
                    value={inflationRate}
                    onChange={(e) => setInflationRate(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>+4% (Mild)</span>
                    <span>+12% (Moderate)</span>
                    <span>+25% (Extreme)</span>
                  </div>
                </div>
              </div>

              {/* Outcome Display */}
              <div className="lg:col-span-7 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Inflation Impact
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                        dynamicNewSurplus >= 0
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      {dynamicNewSurplus >= 0 ? 'Cash Flow Positive' : 'Deficit Triggered'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Monthly Extra Cost
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        +${Math.round(inflationExtraMonthly).toLocaleString()}/mo
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        New Monthly Surplus
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          dynamicNewSurplus >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {dynamicNewSurplus >= 0 ? '+' : ''}$
                        {Math.round(dynamicNewSurplus).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {dynamicNewSurplus >= 0
                      ? `Your income absorbs a +${inflationRate}% inflation surge. Monthly surplus reduces from $${Math.round(
                          baseline.netMonthlySurplus
                        )} to $${Math.round(dynamicNewSurplus)}/mo.`
                      : `A +${inflationRate}% inflation rate pushes your expenses above income, generating a -$${Math.abs(
                          Math.round(dynamicNewSurplus)
                        )}/mo monthly burn.`}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-500">
                  Annualized wealth erosion: ${Math.round(inflationExtraMonthly * 12).toLocaleString()}/year
                </div>
              </div>
            </div>
          )}

          {/* SCENARIO 4: BLACK SWAN */}
          {activeScenario === 'blackSwan' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Black Swan Compound Shock
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Simultaneous convergence of 3 catastrophic factors at once:
                  </p>
                </div>

                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Factor 1: 60-day complete salary halt (Job loss)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Factor 2: $2,500 immediate emergency deductible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Factor 3: +12% cost-of-living inflation spike</span>
                  </div>
                </div>
              </div>

              {/* Outcome Display */}
              <div className="lg:col-span-7 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                      Compound Crisis Result
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                        audit?.stressScenarios.blackSwan.survives
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                      }`}
                    >
                      {audit?.stressScenarios.blackSwan.survives ? 'Survived' : 'Critical Failure'}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Remaining Buffer
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          audit?.stressScenarios.blackSwan.survives
                            ? 'text-gray-900 dark:text-white'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        ${audit?.stressScenarios.blackSwan.cashRemaining.toLocaleString() ?? 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Deficit Gap
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        ${audit?.stressScenarios.blackSwan.deficitAmount.toLocaleString() ?? 0}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {audit?.stressScenarios.blackSwan.verdict}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-500">
                  {audit?.stressScenarios.blackSwan.timelineDescription}
                </div>
              </div>
            </div>
          )}

          {/* SCENARIO 5: CUSTOM STRESS LAB */}
          {activeScenario === 'custom' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    Custom Scenario Sandbox
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Design custom economic stress parameters and simulate immediately.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                      <span>Job Loss Months:</span>
                      <span className="font-semibold">{customJobLossMonths} mo</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      value={customJobLossMonths}
                      onChange={(e) => setCustomJobLossMonths(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                      <span>Emergency Expense:</span>
                      <span className="font-semibold">${customEmergency}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="500"
                      value={customEmergency}
                      onChange={(e) => setCustomEmergency(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                      <span>Inflation Surge:</span>
                      <span className="font-semibold">+{customInflation}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={customInflation}
                      onChange={(e) => setCustomInflation(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                      <span>Cut Discretionary Spend:</span>
                      <span className="font-semibold">{customCutDiscretionary}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={customCutDiscretionary}
                      onChange={(e) => setCustomCutDiscretionary(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>

                  <button
                    onClick={handleRunCustomSimulation}
                    disabled={isSimulating}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition flex items-center justify-center gap-2"
                  >
                    {isSimulating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sliders className="w-4 h-4" />
                    )}
                    <span>Run Custom Stress Simulation</span>
                  </button>
                </div>
              </div>

              {/* Outcome Display */}
              <div className="lg:col-span-7 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col justify-between">
                {customSimulationResult ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                        Custom Simulation Outcome
                      </span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                          customSimulationResult.survives
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {customSimulationResult.survives ? 'Survived' : 'Deficit / Shortfall'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Projected Ending Cash
                        </div>
                        <div
                          className={`text-2xl font-bold mt-1 ${
                            customSimulationResult.survives
                              ? 'text-gray-900 dark:text-white'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          ${customSimulationResult.projectedEndingCash.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Simulated Monthly Burn
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                          ${customSimulationResult.simulatedMonthlyBurn.toLocaleString()}/mo
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <div>
                        • Total Simulated Cash Drain: $
                        {customSimulationResult.totalSimulatedDrain.toLocaleString()}
                      </div>
                      <div>
                        • Monthly Savings from Expense Cuts: $
                        {customSimulationResult.monthlySavingsFromAdjustments.toLocaleString()}/mo
                      </div>
                      <div>
                        • Custom Runway Duration: {customSimulationResult.runwayMonths} months (
                        {customSimulationResult.runwayDays} days)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <Sliders className="w-8 h-8 mb-2 stroke-[1.5]" />
                    <p className="text-xs">
                      Adjust your custom parameters on the left and click "Run Custom Stress Simulation" to evaluate outcome.
                    </p>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-500">
                  Simulated with live account balances ($
                  {baseline.liquidBalance.toLocaleString()})
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 03. Micro-Leak Radar & Habit Scanner ─────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              03. Micro-Drain Radar & Habit Scanner
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Detects frequent micro-charges under ${microLeaks.threshold} that quietly bleed wealth
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('impulse-shield')}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Launch Impulse Shield</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 4 Financial Drag Metric Cards */}
          <div className="lg:col-span-4 space-y-3">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Monthly Micro-Drain
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${microLeaks.monthlyDrain.toLocaleString()}/mo
              </div>
              <div className="text-xs text-gray-500 mt-1">
                From {microLeaks.totalCount} micro-transactions in the past 90 days
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                1-Year Projected Leak
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${microLeaks.annualProjected.toLocaleString()}/year
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Direct cash leaving your accounts without budgeting
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                10-Year Opportunity Cost
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                ${microLeaks.tenYearCompounded.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Value if invested into index funds at 7% compound return
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Labor Cost Equivalent
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {microLeaks.workHoursEquivalent} Hours/mo
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Time worked every month solely to pay for small daily taps
              </div>
            </div>
          </div>

          {/* Micro-leak Categories Breakdown */}
          <div className="lg:col-span-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Top Micro-Drain Culprits
                </span>
                <span className="text-xs text-gray-500">
                  Transactions ≤ ${microLeaks.threshold}
                </span>
              </div>

              {microLeaks.items.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  <Coffee className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600 stroke-[1.5]" />
                  No micro-leak transactions recorded under ${microLeaks.threshold}. Your small habits are well guarded.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {microLeaks.items.map((item, idx) => {
                    const share = Math.round((item.totalAmount / (microLeaks.totalSpent || 1)) * 100);
                    return (
                      <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {item.category}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                            <span>{item.count} purchases</span>
                            <span aria-hidden="true">·</span>
                            <span>Avg ${item.avgAmount}</span>
                            {item.sampleNotes.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate italic">"{item.sampleNotes[0]}"</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            ${item.totalAmount.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {share}% of leak volume
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>Past 90-day transactions analyzed</span>
              <button
                onClick={() => onNavigateToTab('transactions')}
                className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                Inspect Ledger
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04. Tactical Fortification Directives ──────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            04. Tactical Fortification Directives
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Actionable moves to elevate your score
          </span>
        </div>

        {directives.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-xs text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500 stroke-[1.5]" />
            Your defense pillars are operating at fortress caliber. No urgent vulnerabilities detected.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {directives.map((dir) => (
              <div
                key={dir.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      +{dir.estimatedBoost} Resilience Points
                    </span>
                    <span className="text-gray-500 uppercase tracking-wider text-[10px]">
                      {dir.priority} Priority
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2">
                    {dir.title}
                  </h3>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {dir.description}
                  </p>
                </div>

                {dir.actionTab && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => onNavigateToTab(dir.actionTab as DashboardTab)}
                      className="text-xs font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition"
                    >
                      <span>{dir.actionLabel || 'Execute Action'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Configuration Modal ─────────────────────────────────────── */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Configure Resilience Parameters
              </h3>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfileConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Emergency Buffer (Months of essential expenses)
                </label>
                <select
                  value={configTargetMonths}
                  onChange={(e) => setConfigTargetMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value={3}>3 Months (Lean Buffer)</option>
                  <option value={6}>6 Months (Recommended Standard)</option>
                  <option value={9}>9 Months (Conservative)</option>
                  <option value={12}>12 Months (Fortress Defense)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Baseline Essential Expense Ratio (% of spending that is non-negotiable)
                </label>
                <input
                  type="number"
                  min="30"
                  max="90"
                  value={configEssentialRatio}
                  onChange={(e) => setConfigEssentialRatio(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Typically 50% - 70% covers rent, food, utilities, health, and transit.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Micro-Leak Threshold ($ amount)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={configMicroThreshold}
                  onChange={(e) => setConfigMicroThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Purchases below this amount will be tracked for recurring habit drain.
                </span>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5"
                >
                  {isSavingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Parameters</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
