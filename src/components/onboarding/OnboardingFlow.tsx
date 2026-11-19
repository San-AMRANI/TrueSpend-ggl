import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sparkles,
  Landmark,
  WalletCards,
  Target,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Briefcase,
  UserCheck,
  CalendarRange,
  CalendarClock,
  PiggyBank,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { TemplatesGallery } from './TemplatesGallery';
import { Button } from '../ui/Button';
import {
  computeOnboardingPeriodDates,
  computeOnboardingPreviewMetrics,
  validateOnboardingSetup,
  type EmploymentType,
  type FinancialCycleMode,
  type OnboardingStartingPoint,
} from '../../lib/onboardingPeriod';
import type { DashboardTab, ExperienceTier } from '../../types';

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: (jumpToTab?: DashboardTab) => void;
  onClose?: () => void;
}

const TOTAL_STEPS = 8;

function formatOrdinal(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const STEP_META: Array<{ id: number; short: string; mandatory: boolean }> = [
  { id: 1, short: 'Workspace', mandatory: true },
  { id: 2, short: 'Employment', mandatory: true },
  { id: 3, short: 'Payroll & Start', mandatory: true },
  { id: 4, short: 'Financial Period', mandatory: true },
  { id: 5, short: 'Accounts & Cash', mandatory: true },
  { id: 6, short: 'Templates', mandatory: false },
  { id: 7, short: 'Goal & Bill', mandatory: false },
  { id: 8, short: 'Launch', mandatory: true },
];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const { user, onboarding, token, switchExperienceTier, refreshUserProfile, refreshOnboarding } =
    useAuth();

  const snapshot = onboarding?.profileSnapshot;

  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<ExperienceTier>(
    user?.experienceTier || 'basic'
  );
  const [currency, setCurrency] = useState(user?.baseCurrency || 'MAD');
  const [countryCode, setCountryCode] = useState(user?.countryCode || 'MA');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Casablanca');

  const [employmentType, setEmploymentType] = useState<EmploymentType>(
    snapshot?.employmentType || user?.employmentType || 'employee'
  );
  const [financialCycleMode, setFinancialCycleMode] = useState<FinancialCycleMode>(
    snapshot?.financialCycleMode || user?.financialCycleMode || 'payday_to_payday'
  );
  const [startingPoint, setStartingPoint] = useState<OnboardingStartingPoint>(
    snapshot?.startingPoint || user?.onboardingStartingPoint || 'mid_cycle'
  );
  const [paydayDay, setPaydayDay] = useState<number>(
    snapshot?.payday || user?.payday || 25
  );
  const [salaryInput, setSalaryInput] = useState<string>(() => {
    const initial = snapshot?.salary ?? user?.salary ?? 0;
    return initial > 0 ? String(initial) : '';
  });

  const [customStartDate, setCustomStartDate] = useState<string>(
    snapshot?.periodStartDate || user?.periodStartDate || ''
  );
  const [customNextPaydayDate, setCustomNextPaydayDate] = useState<string>(
    snapshot?.nextPaydayDate || user?.nextPaydayDate || ''
  );

  const [accounts, setAccounts] = useState<
    Array<{
      name: string;
      type: 'Bank' | 'Cash' | 'Savings';
      openingBalance: string;
      isMain: boolean;
    }>
  >([
    { name: 'Main Bank', type: 'Bank', openingBalance: '', isMain: true },
    { name: 'Cash Wallet', type: 'Cash', openingBalance: '', isMain: false },
  ]);
  const [emergencyBufferInput, setEmergencyBufferInput] = useState<string>(() => {
    const buf = snapshot?.emergencyBuffer ?? user?.emergencyBuffer ?? 0;
    return buf > 0 ? String(buf) : '0';
  });

  const [goalName, setGoalName] = useState('Starter Emergency Reserve');
  const [goalTarget, setGoalTarget] = useState('5000');
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Hydrate defaults when user or snapshot loads
  useEffect(() => {
    if (!isOpen || !user) return;
    setSelectedTier(user.experienceTier || 'basic');
    setCurrency(user.baseCurrency || 'MAD');
    setCountryCode(user.countryCode || 'MA');
    setTimezone(user.timezone || 'Africa/Casablanca');
    if (snapshot) {
      setEmploymentType(snapshot.employmentType);
      setFinancialCycleMode(snapshot.financialCycleMode);
      setStartingPoint(snapshot.startingPoint);
      setPaydayDay(snapshot.payday || 25);
      if (snapshot.salary > 0) setSalaryInput(String(snapshot.salary));
      if (snapshot.emergencyBuffer > 0) setEmergencyBufferInput(String(snapshot.emergencyBuffer));
      if (snapshot.periodStartDate) setCustomStartDate(snapshot.periodStartDate);
      if (snapshot.nextPaydayDate) setCustomNextPaydayDate(snapshot.nextPaydayDate);
      if (snapshot.accounts && snapshot.accounts.length > 0) {
        setAccounts(
          snapshot.accounts.map((a) => ({
            name: a.name,
            type: a.type,
            openingBalance: String(a.openingBalance),
            isMain: a.isMain,
          }))
        );
      }
    }
  }, [isOpen, user?.id]);

  const computedPeriod = useMemo(
    () =>
      computeOnboardingPeriodDates({
        employmentType,
        financialCycleMode,
        startingPoint,
        paydayDay,
        customStartDate,
        customNextPaydayDate,
      }),
    [
      employmentType,
      financialCycleMode,
      startingPoint,
      paydayDay,
      customStartDate,
      customNextPaydayDate,
    ]
  );

  // Sync custom date inputs smoothly whenever switching into custom_period if blank
  useEffect(() => {
    if (financialCycleMode === 'custom_period') {
      if (!customStartDate) setCustomStartDate(computedPeriod.periodStartDate);
      if (!customNextPaydayDate) setCustomNextPaydayDate(computedPeriod.nextPaydayDate);
    }
  }, [financialCycleMode, customStartDate, customNextPaydayDate, computedPeriod.periodStartDate, computedPeriod.nextPaydayDate]);

  const parsedSalary = Number(salaryInput) || 0;
  const parsedBuffer = Math.max(0, Number(emergencyBufferInput) || 0);

  const previewMetrics = useMemo(
    () =>
      computeOnboardingPreviewMetrics({
        accounts: accounts.map((a) => ({
          name: a.name,
          type: a.type,
          openingBalance: Number(a.openingBalance) || 0,
          isMain: a.isMain,
          currency,
        })),
        emergencyBuffer: parsedBuffer,
        daysRemaining: computedPeriod.daysRemaining,
      }),
    [accounts, currency, parsedBuffer, computedPeriod.daysRemaining]
  );

  if (!isOpen || !user) return null;

  const isSkippable = step === 6 || step === 7;

  const handleSaveStep1 = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      if (selectedTier !== user.experienceTier) {
        await switchExperienceTier(selectedTier);
      }
      await dashboardService.updateOnboardingState(
        {
          action: 'save_step',
          stepId: 'preferences',
          baseCurrency: currency,
          countryCode,
          timezone,
        },
        token
      );
      await refreshUserProfile();
      setStep(2);
    } catch (err: any) {
      setError(err?.message || 'Could not save workspace preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEmploymentType = (mode: EmploymentType) => {
    setEmploymentType(mode);
    setError('');
    if (mode === 'employee') {
      if (financialCycleMode === 'calendar_month' && paydayDay === 1) {
        setFinancialCycleMode('payday_to_payday');
        setPaydayDay(25);
      }
    } else {
      if (financialCycleMode === 'payday_to_payday') {
        setFinancialCycleMode('calendar_month');
        setPaydayDay(1);
      }
    }
  };

  const handleSaveStep2 = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await dashboardService.updateOnboardingState(
        {
          action: 'save_step',
          stepId: 'employment_profile',
          employmentType,
        },
        token
      );
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Could not save employment profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinueStep3 = () => {
    setError('');
    if (!Number.isInteger(paydayDay) || paydayDay < 1 || paydayDay > 31) {
      setError('Payday / cycle anchor day must be between 1 and 31.');
      return;
    }
    if (employmentType === 'employee' && parsedSalary <= 0) {
      setError(
        `Please enter your net paycheck / salary per cycle in ${currency} (must be greater than 0).`
      );
      return;
    }
    if (parsedSalary < 0) {
      setError('Income amount cannot be negative.');
      return;
    }
    setStep(4);
  };

  const handleSaveStep4Period = async () => {
    if (!token) return;
    setError('');

    const periodStartDate =
      financialCycleMode === 'custom_period'
        ? customStartDate || computedPeriod.periodStartDate
        : computedPeriod.periodStartDate;
    const nextPaydayDate =
      financialCycleMode === 'custom_period'
        ? customNextPaydayDate || computedPeriod.nextPaydayDate
        : computedPeriod.nextPaydayDate;

    const validation = validateOnboardingSetup({
      employmentType,
      financialCycleMode,
      startingPoint,
      paydayDay: computedPeriod.effectivePaydayDay,
      salary: parsedSalary,
      periodStartDate,
      nextPaydayDate,
      emergencyBuffer: parsedBuffer,
    });

    if (!validation.valid) {
      setError(validation.error || 'Please check your financial period dates.');
      return;
    }

    setSaving(true);
    try {
      await dashboardService.setupFinancialPeriod(
        {
          employmentType,
          financialCycleMode,
          startingPoint,
          paydayDay: computedPeriod.effectivePaydayDay,
          salary: parsedSalary,
          periodStartDate,
          nextPaydayDate,
          emergencyBuffer: parsedBuffer,
        },
        token
      );
      await Promise.all([refreshUserProfile(), refreshOnboarding()]);
      setStep(5);
    } catch (err: any) {
      setError(err?.message || 'Could not save your financial period.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccounts = async () => {
    if (!token) return;
    setError('');

    const validAccounts = accounts.filter((a) => a.name.trim().length > 0);
    if (validAccounts.length === 0) {
      setError('Please keep at least one named account (Bank or Cash) to continue.');
      return;
    }
    for (const acc of validAccounts) {
      if (acc.openingBalance.trim() === '' || !Number.isFinite(Number(acc.openingBalance))) {
        setError(`Enter your current balance for "${acc.name}" (enter 0 if empty).`);
        return;
      }
    }

    setSaving(true);
    try {
      await dashboardService.setupOpeningAccounts(
        validAccounts.map((a) => ({
          name: a.name.trim(),
          type: a.type,
          openingBalance: Number(a.openingBalance) || 0,
          isMain: a.isMain,
          currency,
        })),
        token,
        { emergencyBuffer: parsedBuffer }
      );
      await Promise.all([refreshUserProfile(), refreshOnboarding()]);
      setStep(6);
    } catch (err: any) {
      setError(err?.message || 'Could not save accounts.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoalAndBill = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      if (goalName.trim() && Number(goalTarget) > 0) {
        await dashboardService
          .createGoal(
            {
              name: goalName.trim(),
              targetAmount: Number(goalTarget),
              currentAmount: 0,
              category: 'Emergency Fund',
              notes: 'Created during onboarding',
            },
            token
          )
          .catch(() => undefined);
      }
      if (billName.trim() && Number(billAmount) > 0) {
        await dashboardService
          .createSubscription(
            {
              name: billName.trim(),
              amount: String(Number(billAmount)),
              currency,
              billingCycle: 'monthly',
              status: 'active',
            },
            token
          )
          .catch(() => undefined);
      }
      await refreshOnboarding();
      setStep(8);
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async (jumpToTab?: DashboardTab) => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await dashboardService.updateOnboardingState(
        { action: 'complete', stepId: 'completed_wizard' },
        token
      );
      await Promise.all([refreshUserProfile(), refreshOnboarding()]);
      onComplete(jumpToTab);
    } catch (err: any) {
      setError(
        err?.message ||
          'Please ensure your financial period and accounts are configured before launching.'
      );
    } finally {
      setSaving(false);
    }
  };

  const activeMeta = STEP_META.find((m) => m.id === step);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-wizard-title"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4 bg-gray-50/80 dark:bg-gray-950/60 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <span>
                Guided Setup · Step {step} of {TOTAL_STEPS}
              </span>
              <span className="text-gray-400 dark:text-gray-500">·</span>
              <span className={activeMeta?.mandatory ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}>
                {activeMeta?.mandatory ? 'Required Foundation' : 'Optional'}
              </span>
              {user.emailVerified && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 normal-case tracking-normal font-medium inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified ({user.email})
                  </span>
                </>
              )}
            </div>
            <h2
              id="onboarding-wizard-title"
              className="text-base sm:text-lg font-bold text-gray-900 dark:text-white"
            >
              {step === 1 && 'Workspace Mode & Regional Preferences'}
              {step === 2 && 'Employment & Income Profile'}
              {step === 3 && 'Payroll, Payday & Cycle Starting Point'}
              {step === 4 && 'Define Your Active Financial Period'}
              {step === 5 && 'Accounts & Exact Current Balances'}
              {step === 6 && 'Apply a Starter Template'}
              {step === 7 && 'First Savings Goal & Recurring Bill'}
              {step === 8 && 'Your Financial Engine Is Calibrated'}
            </h2>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close setup wizard"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Segmented Progress Bar + Step Strip */}
        <div className="px-5 py-2.5 border-b border-gray-100 dark:border-gray-800/80 bg-white dark:bg-gray-900 shrink-0">
          <div className="grid grid-cols-8 gap-1.5">
            {STEP_META.map((item) => {
              const isDone = item.id < step;
              const isCurrent = item.id === step;
              return (
                <div key={item.id} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isDone
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-indigo-600 dark:bg-indigo-500'
                        : 'bg-gray-200 dark:bg-gray-800'
                    }`}
                  />
                  <p
                    className={`hidden sm:block truncate text-[10px] font-medium ${
                      isCurrent
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                        : isDone
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {item.id}. {item.short}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Step Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {/* STEP 1: Workspace Mode & Regional Preferences */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Your financial ledger is strictly isolated to your verified account. Pick how
                simple or detailed your workspace feels—both options are free and switchable
                anytime without touching your records.
              </p>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedTier('basic')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-2 ${
                    selectedTier === 'basic'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-sm text-gray-900 dark:text-white">
                      <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Basic Experience
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Free · Calm
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Day-to-day salary budgeting, Safe-to-Spend runway, bills, debts, and savings goals.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTier('advanced')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-2 ${
                    selectedTier === 'advanced'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-sm text-gray-900 dark:text-white">
                      <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Advanced Experience
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Free · Full Suite
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Adds multi-month forecasting, What-If simulators, investments, CSV import, and rules.
                  </p>
                </button>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Main Currency
                  </label>
                  <select
                    aria-label="Main Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="MAD">MAD (Moroccan Dirham)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="CAD">CAD (Canadian Dollar)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Country Code
                  </label>
                  <input
                    type="text"
                    aria-label="Country Code"
                    maxLength={4}
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Timezone
                  </label>
                  <input
                    type="text"
                    aria-label="Timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Mandatory Employment Profile */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                TrueSpend is engineered primarily for <strong>salaried employees</strong> whose
                spending, budgets, and Safe-to-Spend runway revolve around recurring paydays. Tell
                us how your income works so we calibrate your cycle accurately:
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSelectEmploymentType('employee')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-2.5 ${
                    employmentType === 'employee'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                      <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Salaried Employee
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      Primary · Recommended
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    You receive a regular monthly paycheck on a predictable payday (e.g. 25th,
                    28th, or 1st).
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Unlocks Payday-to-Payday cycles · Exact Daily Allowance countdown · Paycheck
                    confirmation &amp; variance tracking
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectEmploymentType('non_employee')}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-2.5 ${
                    employmentType === 'non_employee'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                      <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Non-Employee / Variable Income
                    </span>
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      Freelance · Business
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Freelancer, contractor, business owner, or student without a fixed employer
                    payroll date.
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Anchors Safe-to-Spend to a monthly reset cycle (1st → End of Month or custom)
                    driven by your live cash pool
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Mandatory Payroll, Payday & Starting Point */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-gray-900 dark:text-white">
                      {employmentType === 'employee'
                        ? 'Your Monthly Payday (Day of Month)'
                        : 'Monthly Cycle Anchor Day'}
                    </label>
                    <span className="text-xs font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                      Day {paydayDay}
                    </span>
                  </div>

                  <input
                    type="number"
                    aria-label="Payday Day of Month"
                    min={1}
                    max={31}
                    value={paydayDay}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(31, Math.round(Number(e.target.value) || 1)));
                      setPaydayDay(val);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                  />

                  <div className="flex flex-wrap gap-1.5">
                    {[1, 5, 15, 25, 28, 31].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPaydayDay(d)}
                        className={`px-2.5 py-1 rounded-md border text-xs font-mono tabular-nums cursor-pointer transition-colors ${
                          paydayDay === d
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        {d === 31 ? 'Last (31)' : `${d}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Shorter months (like February) automatically clamp to the last calendar day.
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-gray-900 dark:text-white">
                      {employmentType === 'employee'
                        ? `Net Salary per Paycheck (${currency})`
                        : `Expected Monthly Income (${currency})`}
                    </label>
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {employmentType === 'employee' ? 'Required' : 'Optional baseline'}
                    </span>
                  </div>

                  <input
                    type="number"
                    aria-label="Net Monthly Salary"
                    min={0}
                    step="any"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(e.target.value)}
                    placeholder={employmentType === 'employee' ? 'e.g. 12000' : 'e.g. 8000 (or 0)'}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                  />

                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    {employmentType === 'employee'
                      ? 'Used to schedule your expected payday deposits, health score, and cycle benchmarks. Entering your net salary does NOT inflate your current cash balance.'
                      : 'Optional baseline for forecasting and retention metrics. Leave 0 if your monthly income varies completely.'}
                  </p>
                </div>
              </div>

              {/* Mandatory Starting Point Question */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Where are you starting in your financial month right now?
                  </h3>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Calibrates your opening balance math
                  </span>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setStartingPoint('first_day')}
                    className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-1.5 ${
                      startingPoint === 'first_day'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900 dark:text-white inline-flex items-center gap-1.5">
                        <CalendarRange className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Day 1 — Fresh Cycle Start
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      I just got paid or I&apos;m starting right at day 1 of a fresh cycle. I have
                      my full starting balance ready for the entire period.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStartingPoint('mid_cycle')}
                    className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-1.5 ${
                      startingPoint === 'mid_cycle'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900 dark:text-white inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Mid-Month / Mid-Cycle Start
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      I&apos;m already partway through the month. Next, I&apos;ll enter only the
                      money left in my accounts right now to pace until payday.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Mandatory Financial Period Definition */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                Every metric in TrueSpend—<strong>Safe-to-Spend</strong>,{' '}
                <strong>Daily Allowance</strong>, <strong>Budgets</strong>,{' '}
                <strong>Forecasts</strong>, and <strong>Cycle Report Cards</strong>—runs on your
                Financial Period. Choose how your period boundaries should be defined:
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setFinancialCycleMode('payday_to_payday')}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer space-y-1 ${
                    financialCycleMode === 'payday_to_payday'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Payday-to-Payday
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Runs from the {formatOrdinal(paydayDay)} until the day before next month&apos;s {formatOrdinal(paydayDay)}.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFinancialCycleMode('calendar_month')}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer space-y-1 ${
                    financialCycleMode === 'calendar_month'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Calendar Month
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Runs cleanly from the 1st through the final day of each calendar month.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFinancialCycleMode('custom_period')}
                  className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer space-y-1 ${
                    financialCycleMode === 'custom_period'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Custom Cycle Dates
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Adjust exact start &amp; next payday dates (ideal for shifted paydays).
                  </p>
                </button>
              </div>

              {financialCycleMode === 'custom_period' && (
                <div className="grid gap-3.5 sm:grid-cols-2 rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-950/40">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Current Period Start Date
                    </label>
                    <input
                      type="date"
                      aria-label="Current Period Start Date"
                      value={customStartDate || computedPeriod.periodStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Next Payday / Reset Date
                    </label>
                    <input
                      type="date"
                      aria-label="Next Payday Date"
                      value={customNextPaydayDate || computedPeriod.nextPaydayDate}
                      onChange={(e) => setCustomNextPaydayDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Live Period Blueprint Preview */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    Active Financial Period Preview
                  </span>
                  <span className="text-xs font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                    {computedPeriod.periodLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-200/80 dark:border-gray-800 text-xs">
                  <div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                      Period Start
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                      {computedPeriod.periodStartDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                      Cycle Ends
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                      {computedPeriod.periodEndDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                      Next Payday
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {computedPeriod.nextPaydayDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                      Days Left
                    </span>
                    <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                      {computedPeriod.daysRemaining}d of {computedPeriod.totalDays}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Mandatory Accounts & Current Balances */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {startingPoint === 'mid_cycle' ? (
                  <>
                    <strong>Mid-Cycle Balance Rule:</strong> Enter ONLY the exact money currently
                    sitting inside each account right now. With{' '}
                    <strong className="font-mono tabular-nums">
                      {computedPeriod.daysRemaining} days
                    </strong>{' '}
                    left until{' '}
                    <strong className="font-mono tabular-nums">
                      {computedPeriod.nextPaydayDate}
                    </strong>
                    , TrueSpend divides your spendable balance across those remaining days without
                    creating fake income transactions.
                  </>
                ) : (
                  <>
                    <strong>Day-1 Balance Rule:</strong> Enter your full starting balance inside
                    each account right now (including today&apos;s salary in your Bank account if
                    it has already been deposited).
                  </>
                )}
              </div>

              <div className="space-y-2.5">
                {accounts.map((acc, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2.5 sm:grid-cols-12 items-center rounded-xl border border-gray-200 dark:border-gray-800 p-3"
                  >
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                        Account Name
                      </label>
                      <input
                        type="text"
                        aria-label={`Account name ${idx + 1}`}
                        value={acc.name}
                        onChange={(e) =>
                          setAccounts((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row))
                          )
                        }
                        placeholder="Account name"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        aria-label={`Account type ${idx + 1}`}
                        value={acc.type}
                        onChange={(e) =>
                          setAccounts((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, type: e.target.value as 'Bank' | 'Cash' | 'Savings' }
                                : row
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                      >
                        <option value="Bank">Bank</option>
                        <option value="Cash">Cash</option>
                        <option value="Savings">Savings</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                        Current Balance ({currency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        aria-label={`Current balance ${acc.name || idx + 1}`}
                        value={acc.openingBalance}
                        onChange={(e) =>
                          setAccounts((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, openingBalance: e.target.value } : row
                            )
                          )
                        }
                        placeholder="0.00"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono tabular-nums text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-0">
                      <button
                        type="button"
                        disabled={accounts.length <= 1}
                        aria-label={`Remove account ${acc.name || idx + 1}`}
                        onClick={() =>
                          setAccounts((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setAccounts((prev) => [
                        ...prev,
                        { name: 'Savings Vault', type: 'Savings', openingBalance: '0', isMain: false },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Savings or Extra Account
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Protected Buffer ({currency}):
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    aria-label="Protected Emergency Buffer"
                    value={emergencyBufferInput}
                    onChange={(e) => setEmergencyBufferInput(e.target.value)}
                    className="w-28 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono tabular-nums text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Real-Time Daily Safe-to-Spend Calibration Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3.5 text-xs">
                <div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Total Current Cash
                  </span>
                  <span className="font-mono tabular-nums font-bold text-gray-900 dark:text-white">
                    {previewMetrics.totalOpeningCash.toFixed(2)} {currency}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Spendable Safe-to-Spend
                  </span>
                  <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                    {previewMetrics.spendableCash.toFixed(2)} {currency}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Daily Allowance ({computedPeriod.daysRemaining}d)
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {previewMetrics.dailyAllowance.toFixed(2)} {currency}/day
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Optional Starter Templates */}
          {step === 6 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Optionally apply curated templates tailored to your{' '}
                <strong>{selectedTier === 'advanced' ? 'Advanced' : 'Basic'}</strong> workspace.
                Budgets created here automatically attach to your newly configured financial period (
                <span className="font-mono tabular-nums">{computedPeriod.periodLabel}</span>).
              </p>
              <TemplatesGallery compact />
            </div>
          )}

          {/* STEP 7: Optional Goal & Recurring Bill */}
          {step === 7 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <Target className="h-4 w-4 text-emerald-600" />
                  <span>First Savings Goal (Optional)</span>
                </div>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Goal name"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder={`Target amount (${currency})`}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono tabular-nums text-gray-900 dark:text-white"
                />
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <WalletCards className="h-4 w-4 text-indigo-600" />
                  <span>Recurring Monthly Bill (Optional)</span>
                </div>
                <input
                  type="text"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  placeholder="e.g. Home Fiber Internet"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder={`Monthly amount (${currency})`}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono tabular-nums text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* STEP 8: Final Verification & Calibration Launch Summary */}
          {step === 8 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Ready to launch, {user.displayName || user.username}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Your {selectedTier === 'advanced' ? 'Advanced' : 'Basic'} workspace is
                    calibrated around your real financial period and balances.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 p-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Income Profile &amp; Cycle Start
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white block">
                    {employmentType === 'employee'
                      ? 'Salaried Employee'
                      : 'Non-Employee / Variable'}{' '}
                    · {startingPoint === 'first_day' ? 'Day-1 Start' : 'Mid-Cycle Start'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Active Financial Period
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400 block">
                    {computedPeriod.periodLabel} ({computedPeriod.daysRemaining}d left)
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Starting Cash Across Accounts
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white block">
                    {previewMetrics.totalOpeningCash.toFixed(2)} {currency} ({accounts.length}{' '}
                    accounts)
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                    Daily Safe-to-Spend Allowance
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 block">
                    {previewMetrics.dailyAllowance.toFixed(2)} {currency} / day
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                You can adjust your payday, export your JSON ledger, or review active sessions
                anytime in <strong>Financial Calendar</strong> and <strong>Settings</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setError('');
                  setStep((s) => Math.max(1, s - 1));
                }}
                className="inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {isSkippable && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep((s) => s + 1);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                Skip this step
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveStep1}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Saving...' : 'Save & Continue'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 2 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveStep2}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Saving...' : 'Continue to Payroll Setup'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 3 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleContinueStep3}
                className="inline-flex items-center gap-1"
              >
                Review Financial Period <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 4 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveStep4Period}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Calibrating Period...' : 'Confirm Financial Period'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 5 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveAccounts}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Saving Balances...' : 'Save Accounts & Balances'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 6 && (
              <Button
                size="sm"
                onClick={() => {
                  setError('');
                  setStep(7);
                }}
                className="inline-flex items-center gap-1"
              >
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 7 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveGoalAndBill}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Saving...' : 'Save & Review Summary'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 8 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleFinish('transactions')}
                >
                  Log First Transaction
                </Button>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => handleFinish('overview')}
                >
                  {saving ? 'Launching...' : 'Enter Workspace'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
