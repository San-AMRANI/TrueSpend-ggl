import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { TemplatesGallery } from './TemplatesGallery';
import { Button } from '../ui/Button';
import type { DashboardTab, ExperienceTier } from '../../types';

interface OnboardingFlowProps {
  isOpen: boolean;
  onComplete: (jumpToTab?: DashboardTab) => void;
  onClose?: () => void;
}

const TOTAL_STEPS = 9;

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const { user, token, switchExperienceTier, refreshUserProfile, refreshOnboarding } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<ExperienceTier>(
    user?.experienceTier || 'basic'
  );
  const [currency, setCurrency] = useState(user?.baseCurrency || 'MAD');
  const [countryCode, setCountryCode] = useState(user?.countryCode || 'MA');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Casablanca');
  const [payday, setPayday] = useState<number>(user?.payday ?? 25);
  const [salary, setSalary] = useState<string>(user?.salary ? String(user.salary) : '');
  const [emergencyBuffer, setEmergencyBuffer] = useState<string>(
    user?.emergencyBuffer ? String(user.emergencyBuffer) : ''
  );

  const [accounts, setAccounts] = useState<
    Array<{ name: string; type: 'Bank' | 'Cash' | 'Savings'; openingBalance: string; isMain: boolean }>
  >([
    { name: 'Main Bank', type: 'Bank', openingBalance: '0', isMain: true },
    { name: 'Cash Wallet', type: 'Cash', openingBalance: '0', isMain: false },
  ]);

  const [goalName, setGoalName] = useState('Starter Emergency Reserve');
  const [goalTarget, setGoalTarget] = useState('5000');
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !user) return null;

  const isSkippable = step >= 5 && step <= 8;

  const handleSaveStep4 = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await dashboardService.updateOnboardingState(
        {
          action: 'save_step',
          stepId: 'preferences',
          baseCurrency: currency,
          countryCode,
          timezone,
          payday,
          salary: salary ? Number(salary) : 0,
          emergencyBuffer: emergencyBuffer ? Number(emergencyBuffer) : 0,
        },
        token
      );
      await refreshUserProfile();
      setStep(5);
    } catch (err: any) {
      setError(err?.message || 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAccounts = async () => {
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      await dashboardService.setupOpeningAccounts(
        accounts.map((a) => ({
          name: a.name.trim(),
          type: a.type,
          openingBalance: Number(a.openingBalance) || 0,
          isMain: a.isMain,
          currency,
        })),
        token
      );
      await refreshOnboarding();
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
        await dashboardService.createGoal(
          {
            name: goalName.trim(),
            targetAmount: Number(goalTarget),
            currentAmount: 0,
            category: 'Emergency Fund',
            notes: 'Created during onboarding',
          },
          token
        ).catch(() => undefined);
      }
      if (billName.trim() && Number(billAmount) > 0) {
        await dashboardService.createSubscription(
          {
            name: billName.trim(),
            amount: String(Number(billAmount)),
            currency,
            billingCycle: 'monthly',
            status: 'active',
          },
          token
        ).catch(() => undefined);
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
    try {
      await dashboardService.updateOnboardingState(
        { action: 'complete', stepId: 'completed_wizard' },
        token
      );
      await refreshUserProfile();
      await refreshOnboarding();
      onComplete(jumpToTab);
    } finally {
      setSaving(false);
    }
  };

  const handleChooseTierNext = async () => {
    setSaving(true);
    setError('');
    try {
      if (selectedTier !== user.experienceTier) {
        await switchExperienceTier(selectedTier);
      }
      setStep(4);
    } catch (err: any) {
      setError(err?.message || 'Failed to update experience mode.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden my-auto">
        {/* Progress Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-gray-50/70 dark:bg-gray-950/50">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Guided Setup · Step {step} of {TOTAL_STEPS}
            </p>
            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              {step === 1 && 'Welcome to Your Private TrueSpend Workspace'}
              {step === 2 && 'Account Security & Email Verification'}
              {step === 3 && 'Choose Your Experience Mode (Both Free)'}
              {step === 4 && 'Currency, Payday & Planning Anchor'}
              {step === 5 && 'Set Up Accounts & Opening Balances'}
              {step === 6 && 'Apply a Starter Template'}
              {step === 7 && 'First Savings Goal & Recurring Bill'}
              {step === 8 && 'Privacy & Data Ownership Controls'}
              {step === 9 && 'Your Private Workspace Is Ready'}
            </h2>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close setup wizard"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                TrueSpend keeps every financial record strictly isolated to your own verified
                account. Nothing is shared across users, and you decide how simple or detailed your
                workspace feels.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                    Private by Default
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your balances, wallets, budgets, and goals are strictly isolated to you.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1.5">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                    Basic or Advanced (Free)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pick simplicity now or full analytics later. Switching never touches your data.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-1.5">
                  <Landmark className="h-5 w-5 text-amber-600" />
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                    Honest Accounting
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Opening account balances never inflate your monthly income metrics.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Email verified: {user.email}
                  </p>
                  <p className="text-emerald-800/80 dark:text-emerald-300/80">
                    Your account is protected with scrypt2 passphrase hashing, rotating session
                    tokens, and instant sign-out across all devices.
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can update your email or review active login sessions anytime in{' '}
                <strong>Settings → Security &amp; Sessions</strong>.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Both experiences are <strong>completely free</strong>. Choose the interface complexity
                that matches your style today:
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedTier('basic')}
                  className={`rounded-2xl border p-4 text-left transition-all cursor-pointer space-y-2.5 ${
                    selectedTier === 'basic'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-bold text-sm text-gray-900 dark:text-white">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      Basic Experience
                    </span>
                    <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Calm everyday personal finance without overwhelming complexity.
                  </p>
                  <ul className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
                    <li>• Overview, Accounts &amp; Transactions</li>
                    <li>• Monthly Budgets &amp; Starter Templates</li>
                    <li>• Recurring Bills, Debts &amp; Savings Goals</li>
                    <li>• Clean Analytics Charts &amp; Spex AI Q&amp;A</li>
                  </ul>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTier('advanced')}
                  className={`rounded-2xl border p-4 text-left transition-all cursor-pointer space-y-2.5 ${
                    selectedTier === 'advanced'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-bold text-sm text-gray-900 dark:text-white">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      Advanced Experience
                    </span>
                    <span className="rounded px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      Free
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Full financial operating system for power users and deep analysis.
                  </p>
                  <ul className="text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
                    <li>• Everything in Basic, plus:</li>
                    <li>• Investments, Crypto Sync &amp; External Wealth</li>
                    <li>• Multi-month Forecasting &amp; What-If Simulators</li>
                    <li>• Statement CSV Import, Rules, Contexts &amp; Journal Audit</li>
                  </ul>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Main Currency
                </label>
                <select
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
                  Payday / Cycle Reset Day (1–31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={payday}
                  onChange={(e) => setPayday(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Country Code
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Expected Monthly Income (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Safety Buffer (optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={emergencyBuffer}
                  onChange={(e) => setEmergencyBuffer(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Add your Bank, Cash, or Savings accounts with their real opening balances. Opening
                balances initialize your wallets without creating fake income transactions.
              </p>

              <div className="space-y-2.5">
                {accounts.map((acc, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 sm:grid-cols-12 items-center rounded-xl border border-gray-200 dark:border-gray-800 p-3"
                  >
                    <input
                      type="text"
                      value={acc.name}
                      onChange={(e) =>
                        setAccounts((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row))
                        )
                      }
                      placeholder="Account name"
                      className="sm:col-span-5 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                    />
                    <select
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
                      className="sm:col-span-3 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                    >
                      <option value="Bank">Bank</option>
                      <option value="Cash">Cash</option>
                      <option value="Savings">Savings</option>
                    </select>
                    <input
                      type="number"
                      value={acc.openingBalance}
                      onChange={(e) =>
                        setAccounts((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, openingBalance: e.target.value } : row
                          )
                        )
                      }
                      placeholder={`Opening (${currency})`}
                      className="sm:col-span-3 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                    />
                    <button
                      type="button"
                      disabled={accounts.length <= 1}
                      onClick={() =>
                        setAccounts((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="sm:col-span-1 p-1.5 rounded-lg text-gray-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer justify-self-end"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

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
                <Plus className="h-3.5 w-3.5" /> Add another account
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Optionally apply one or more curated templates tailored to your{' '}
                <strong>{selectedTier === 'advanced' ? 'Advanced' : 'Basic'}</strong> workspace.
                Templates never duplicate items if applied more than once.
              </p>
              <TemplatesGallery compact />
            </div>
          )}

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
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder={`Target amount (${currency})`}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
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
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder={`Monthly amount (${currency})`}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs"
                />
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <p>
                Review your built-in data rights and security protections before entering the
                dashboard:
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
                  <p className="font-semibold text-gray-900 dark:text-white">Active Sessions</p>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    Inspect and revoke signed-in browsers or sign out all devices in Settings →
                    Security.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
                  <p className="font-semibold text-gray-900 dark:text-white">Export &amp; Deletion</p>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    Download your personal JSON dataset or permanently delete your account anytime in
                    Settings → Privacy.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 9 && (
            <div className="text-center space-y-4 py-3">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  You&apos;re all set, {user.displayName || user.username}!
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  Your private <strong>{selectedTier === 'advanced' ? 'Advanced' : 'Basic'}</strong>{' '}
                  workspace is ready. Jump directly to Overview or log your first transaction.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {isSkippable && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                Skip this step
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 1 && (
              <Button size="sm" onClick={() => setStep(2)} className="inline-flex items-center gap-1">
                Get Started <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 2 && (
              <Button size="sm" onClick={() => setStep(3)} className="inline-flex items-center gap-1">
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 3 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleChooseTierNext}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Saving...' : 'Use Selected Experience'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 4 && (
              <Button
                size="sm"
                disabled={saving}
                onClick={handleSaveStep4}
                className="inline-flex items-center gap-1"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
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
                {saving ? 'Saving...' : 'Save Accounts'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 6 && (
              <Button size="sm" onClick={() => setStep(7)} className="inline-flex items-center gap-1">
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
                {saving ? 'Saving...' : 'Save & Continue'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 8 && (
              <Button size="sm" onClick={() => setStep(9)} className="inline-flex items-center gap-1">
                Finish Setup <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === 9 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => handleFinish('transactions')}
                >
                  Log First Transaction
                </Button>
                <Button size="sm" disabled={saving} onClick={() => handleFinish('overview')}>
                  {saving ? 'Opening...' : 'Enter Workspace'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
