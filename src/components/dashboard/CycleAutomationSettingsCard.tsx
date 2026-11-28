import React, { useEffect, useState } from 'react';
import { CalendarCheck2, Check, Loader2, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { dashboardService } from '../../services/api/dashboardService';
import { isCreditLiabilitySubtype } from '../../lib/accountTaxonomy';
import { useAuth } from '../../context/AuthContext';
import type {
  CycleAutomationSettings,
  DashboardTab,
  Goal,
  PocketSweepMode,
  Wallet,
} from '../../types';

interface CycleAutomationSettingsCardProps {
  wallets: Wallet[];
  goals?: Goal[];
  onNavigateTab?: (tab: DashboardTab) => void;
}

const SWEEP_MODE_DESCRIPTIONS: Record<PocketSweepMode, string> = {
  bank_and_cash_recover:
    'Sweeps 100% of leftover Main Bank and Cash to Savings at cycle close for exact saved analytics, then recovers your physical Cash balance from the incoming payroll so Cash stays accurate and counts inside the new cycle.',
  main_bank_only:
    'Sweeps 100% of leftover Main Bank to Savings right before salary lands. Cash wallets stay untouched.',
  safe_surplus_only:
    'Sweeps only Safe-to-Spend surplus from Main Bank (leaving pending payables covered). Cash wallets stay untouched.',
  all_pocket_no_recover:
    'Sweeps 100% of both Main Bank and Cash balances to Savings without recovering Cash from the incoming payroll.',
  disabled:
    'Disables automatic end-of-cycle pocket sweeps. Payday deposit, budget rollover, and next-payroll scheduling still follow your toggles below.',
};

export const CycleAutomationSettingsCard: React.FC<CycleAutomationSettingsCardProps> = ({
  wallets,
  goals = [],
  onNavigateTab,
}) => {
  const { token } = useAuth();
  const [settings, setSettings] = useState<CycleAutomationSettings>({
    autoDepositPayroll: true,
    sweepMode: 'bank_and_cash_recover',
    targetSavingsWalletId: null,
    targetGoalId: null,
    autoRolloverBudgets: true,
    autoScheduleNextPayroll: true,
    autoYearlyCloseout: true,
    yearlyDriveBackup: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    dashboardService
      .getCycleCloseoutSettings(token)
      .then((res) => {
        if (active && res) setSettings(res);
      })
      .catch(() => {
        // Default state stays active if initial fetch fails
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const savingsEligibleWallets = wallets.filter(
    (w) => !isCreditLiabilitySubtype(w.accountSubtype)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await dashboardService.updateCycleCloseoutSettings(settings, token);
      setSettings(updated);
      setFeedback({ type: 'ok', text: 'Monthly & yearly payday automation saved.' });
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { type: 'success', message: 'Payday automation preferences updated.' },
        })
      );
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Unable to save automation preferences.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Monthly &amp; Yearly Payday Automation
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Runs automatically right before each salary deposit — closing your cycle cleanly without dashboard banners.
          </p>
        </div>
        {onNavigateTab && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('reports')}
            className="text-xs h-8 px-3 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            View Closeout History
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="h-36 w-full rounded-lg bg-gray-100/70 dark:bg-gray-900/50 animate-pulse" />
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Primary Automation Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  End-of-Month Pocket Sweep Strategy
                </label>
                <select
                  value={settings.sweepMode}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      sweepMode: e.target.value as PocketSweepMode,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="bank_and_cash_recover">
                    Sweep 100% Bank + Cash to Savings, then Recover Cash from New Payroll (Recommended)
                  </option>
                  <option value="main_bank_only">
                    Sweep 100% Main Bank to Savings (Keep Cash Untouched)
                  </option>
                  <option value="safe_surplus_only">
                    Sweep Safe-to-Spend Surplus Only (Reserve Pending Payables)
                  </option>
                  <option value="all_pocket_no_recover">
                    Sweep 100% Main Bank + Cash to Savings (No Cash Recovery)
                  </option>
                  <option value="disabled">Disable Automatic Pocket Sweep</option>
                </select>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {SWEEP_MODE_DESCRIPTIONS[settings.sweepMode]}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Target Savings Destination Wallet
                </label>
                <select
                  value={settings.targetSavingsWalletId || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      targetSavingsWalletId: e.target.value || null,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Auto-select Savings wallet (auto-creates Savings Reserve)</option>
                  {savingsEligibleWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Optional Target Savings Goal
                </label>
                <select
                  value={settings.targetGoalId || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      targetGoalId: e.target.value || null,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">None (keep swept funds in Savings Reserve only)</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({Number(g.currentAmount || 0).toFixed(0)} / {Number(g.targetAmount || 0).toFixed(0)} MAD)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clean Toggle Matrix */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
              {(
                [
                  {
                    key: 'autoDepositPayroll' as const,
                    title: 'Auto-deposit scheduled salary on payday',
                    desc: 'Automatically runs Monthly Closeout and posts your scheduled salary deposit on payday without manual confirmation.',
                  },
                  {
                    key: 'autoRolloverBudgets' as const,
                    title: 'Auto-rollover monthly category budgets',
                    desc: 'Copies your active monthly category budget allocations into the incoming financial period.',
                  },
                  {
                    key: 'autoScheduleNextPayroll' as const,
                    title: "Auto-schedule next month's expected payroll",
                    desc: 'Creates next month’s expected payday entry automatically so Safe-to-Spend and daily allowance stay calibrated.',
                  },
                  {
                    key: 'autoYearlyCloseout' as const,
                    title: 'Automatic Yearly Closeout & Annual Audit',
                    desc: 'Generates a permanent annual financial report, subscription sinking-fund audit, and project review when December closes.',
                  },
                  {
                    key: 'yearlyDriveBackup' as const,
                    title: 'Year-End Google Drive archive snapshot',
                    desc: 'Automatically archives your year-end backup to Google Drive when Drive is connected.',
                  },
                ]
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-start justify-between gap-4 py-3 cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 block">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                      {item.desc}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[item.key])}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs">
                {feedback && (
                  <span
                    className={
                      feedback.type === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1'
                        : 'text-rose-600 dark:text-rose-400 font-medium'
                    }
                  >
                    {feedback.type === 'ok' && <Check className="w-3.5 h-3.5" />}
                    {feedback.text}
                  </span>
                )}
              </div>
              <Button type="submit" size="sm" disabled={saving} className="h-9 px-4 text-xs">
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {saving ? 'Saving...' : 'Save Automation Settings'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
