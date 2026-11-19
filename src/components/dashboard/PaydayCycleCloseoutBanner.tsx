import React, { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Sparkles,
  ArrowRight,
  PiggyBank,
  CopyCheck,
  CheckCircle2,
  Banknote,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import {
  CategoryBudget,
  DashboardTab,
  Goal,
  KPI,
  Payroll,
  Transaction,
  Wallet,
} from '../../types';
import { getCurrentFinancialMonth, isInFinancialMonth } from '../../lib/financialMonth';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { Button } from '../ui/Button';
import { MotionModal } from '../ui/MotionPrimitives';

interface PaydayCycleCloseoutBannerProps {
  kpis: KPI | null;
  payrolls: Payroll[];
  budgets: CategoryBudget[];
  goals: Goal[];
  wallets: Wallet[];
  transactions: Transaction[];
  setActiveTab: (tab: DashboardTab) => void;
  onDataChange?: () => Promise<void> | void;
}

export const PaydayCycleCloseoutBanner: React.FC<PaydayCycleCloseoutBannerProps> = ({
  kpis,
  payrolls,
  budgets,
  goals,
  wallets,
  transactions,
  setActiveTab,
  onDataChange,
}) => {
  const { token } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [sweepPct, setSweepPct] = useState<number>(50);
  const [customSweepAmount, setCustomSweepAmount] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>(goals[0]?.id || '');
  const [selectedSourceWalletId, setSelectedSourceWalletId] = useState<string>(
    wallets.find((w) => w.type === 'Bank' && w.isMain)?.id || wallets[0]?.id || ''
  );
  const [isSweeping, setIsSweeping] = useState(false);
  const [isRollingBudgets, setIsRollingBudgets] = useState(false);
  const [isConfirmingPayroll, setIsConfirmingPayroll] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const currentFm = useMemo(() => getCurrentFinancialMonth(payrolls), [payrolls]);

  const cycleMetrics = useMemo(() => {
    if (!currentFm) return null;
    const { year, month } = currentFm;
    const safeToSpend = Math.max(0, Number(kpis?.safeToSpend || 0));
    const daysUntilPayday = Math.max(0, Number(kpis?.daysUntilPayday ?? 0));

    // Calculate unspent budget envelope surplus for the active financial period
    const activeBudgets = budgets.filter((b) => b.year === year && b.month === month);
    const totalBudgeted = activeBudgets.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

    const periodExpenses = transactions.filter(
      (tx) =>
        tx.type === 'Expense' &&
        isInFinancialMonth(new Date(tx.createdAt), payrolls, year, month)
    );
    const totalSpentInCycle = periodExpenses.reduce((sum, tx) => {
      const gross = parseFloat(tx.amount) || 0;
      const reimb = parseFloat(tx.reimbursableAmount || '0') || 0;
      return sum + Math.max(0, gross - reimb);
    }, 0);
    const unspentEnvelopeSurplus = Math.max(0, totalBudgeted - totalSpentInCycle);

    // Check next financial month year/month
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthBudgetsCount = budgets.filter(
      (b) => b.year === nextYear && b.month === nextMonth
    ).length;

    // Find any unconfirmed payroll due within 7 days or recently scheduled
    const nowMs = Date.now();
    const dueUnconfirmedPayroll = payrolls.find((p) => {
      if (p.status === 'confirmed') return false;
      const schedMs = new Date(p.scheduledFor).getTime();
      if (Number.isNaN(schedMs)) return false;
      const diffDays = (schedMs - nowMs) / (1000 * 60 * 60 * 24);
      return diffDays <= 7 && diffDays >= -15;
    });

    const isCloseoutWindow = daysUntilPayday <= 7 || Boolean(dueUnconfirmedPayroll);
    const startLabel = currentFm.start.toISOString().slice(0, 10);
    const endLabel = currentFm.end.toISOString().slice(0, 10);

    return {
      year,
      month,
      nextYear,
      nextMonth,
      startLabel,
      endLabel,
      safeToSpend,
      daysUntilPayday,
      totalBudgeted,
      totalSpentInCycle,
      unspentEnvelopeSurplus,
      activeBudgetsCount: activeBudgets.length,
      nextMonthBudgetsCount,
      dueUnconfirmedPayroll,
      isCloseoutWindow,
    };
  }, [currentFm, kpis, budgets, transactions, payrolls]);

  if (!currentFm || !cycleMetrics || isDismissed) {
    return null;
  }

  const effectiveSweepAmount =
    customSweepAmount.trim() !== ''
      ? Math.max(0, parseFloat(customSweepAmount) || 0)
      : Math.round(((cycleMetrics.safeToSpend * sweepPct) / 100) * 100) / 100;

  const handleConfirmDuePayroll = async () => {
    if (!token || !cycleMetrics.dueUnconfirmedPayroll) return;
    setIsConfirmingPayroll(true);
    setFeedbackMsg(null);
    try {
      const p = cycleMetrics.dueUnconfirmedPayroll;
      await dashboardService.confirmPayroll(
        p.id,
        {
          confirmedAmount: parseFloat(p.amount) || undefined,
          confirmedDate: new Date().toISOString().slice(0, 10),
          walletId: p.walletId || selectedSourceWalletId || undefined,
        },
        token
      );
      setFeedbackMsg(`Confirmed ${parseFloat(p.amount).toLocaleString()} MAD payday deposit and rolled cycle!`);
      await onDataChange?.();
    } catch (e: any) {
      setFeedbackMsg(e?.message || 'Unable to confirm payroll');
    } finally {
      setIsConfirmingPayroll(false);
    }
  };

  const handleSweepSurplusToGoal = async () => {
    if (!token || effectiveSweepAmount <= 0) return;
    const targetGoal = goals.find((g) => g.id === selectedGoalId) || goals[0];
    if (!targetGoal) {
      setActiveTab('goals');
      setIsModalOpen(false);
      return;
    }
    setIsSweeping(true);
    setFeedbackMsg(null);
    try {
      await dashboardService.contributeToGoal(
        targetGoal.id,
        {
          amount: effectiveSweepAmount,
          walletId: selectedSourceWalletId || undefined,
          note: `Cycle closeout surplus sweep (${cycleMetrics.startLabel} → ${cycleMetrics.endLabel})`,
          date: new Date().toISOString().slice(0, 10),
        },
        token
      );
      setFeedbackMsg(
        `Swept ${effectiveSweepAmount.toFixed(2)} MAD leftover Safe-to-Spend into "${targetGoal.name}"!`
      );
      await onDataChange?.();
    } catch (e: any) {
      setFeedbackMsg(e?.message || 'Unable to sweep surplus into goal');
    } finally {
      setIsSweeping(false);
    }
  };

  const handleRolloverBudgets = async () => {
    if (!token) return;
    setIsRollingBudgets(true);
    setFeedbackMsg(null);
    try {
      const res = await dashboardService.copyPreviousMonthBudgets(
        cycleMetrics.nextYear,
        cycleMetrics.nextMonth,
        token
      );
      setFeedbackMsg(
        `Rolled over ${res?.copied ?? cycleMetrics.activeBudgetsCount} category budget envelopes into next cycle (${cycleMetrics.nextMonth}/${cycleMetrics.nextYear})!`
      );
      await onDataChange?.();
    } catch (e: any) {
      setFeedbackMsg(e?.message || 'Unable to roll over category budgets');
    } finally {
      setIsRollingBudgets(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-2xl border p-4 sm:p-4.5 shadow-xs transition-all ${
          cycleMetrics.isCloseoutWindow
            ? 'border-emerald-200/90 dark:border-emerald-900/60 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/50 dark:from-emerald-950/30 dark:via-gray-900 dark:to-indigo-950/20'
            : 'border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900/90'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                cycleMetrics.isCloseoutWindow
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                  : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
              }`}
            >
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100">
                  Payday Rollover &amp; Cycle Closeout Assistant
                </h4>
                <span className="text-[11px] font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                  · {cycleMetrics.startLabel} → {cycleMetrics.endLabel} ({cycleMetrics.daysUntilPayday}d to payday)
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Leftover Safe-to-Spend:{' '}
                <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {cycleMetrics.safeToSpend.toFixed(0)} MAD
                </strong>
                {cycleMetrics.unspentEnvelopeSurplus > 0 && (
                  <>
                    {' '}
                    · Unspent budget envelopes:{' '}
                    <strong className="font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
                      {cycleMetrics.unspentEnvelopeSurplus.toFixed(0)} MAD
                    </strong>
                  </>
                )}
                {cycleMetrics.dueUnconfirmedPayroll && (
                  <>
                    {' '}
                    · <strong className="text-amber-600 dark:text-amber-400">Payday confirmation ready</strong>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setFeedbackMsg(null);
                setIsModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Cycle Closeout &amp; Rollover
            </Button>
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              title="Hide for this session"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <MotionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        containerClassName="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarCheck2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Payday Rollover &amp; Cycle Closeout Summary
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Active financial period: {cycleMetrics.startLabel} to {cycleMetrics.endLabel} ({cycleMetrics.daysUntilPayday} days remaining)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {feedbackMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Cycle Snapshot Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-[11px] text-gray-500 block">Leftover Safe-to-Spend</span>
              <span className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {cycleMetrics.safeToSpend.toFixed(0)} MAD
              </span>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-[11px] text-gray-500 block">Cycle Living Spend</span>
              <span className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {cycleMetrics.totalSpentInCycle.toFixed(0)} MAD
              </span>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
              <span className="text-[11px] text-gray-500 block">Unspent Budgets</span>
              <span className="text-sm font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {cycleMetrics.unspentEnvelopeSurplus.toFixed(0)} MAD
              </span>
            </div>
          </div>

          {/* Step 1: Confirm Pending Payday Deposit (if any) */}
          {cycleMetrics.dueUnconfirmedPayroll && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Banknote className="h-4 w-4" />
                  1. Confirm Scheduled Payday Deposit
                </span>
                <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                  {parseFloat(cycleMetrics.dueUnconfirmedPayroll.amount).toLocaleString()} MAD
                </span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                Scheduled for {cycleMetrics.dueUnconfirmedPayroll.scheduledFor.slice(0, 10)}. Confirming credits your bank wallet and anchors the new financial cycle.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDuePayroll}
                disabled={isConfirmingPayroll}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                {isConfirmingPayroll ? 'Confirming Payday...' : 'Confirm Salary Deposit & Roll Cycle'}
              </Button>
            </div>
          )}

          {/* Step 2: Sweep Leftover Safe-to-Spend Surplus into a Savings Goal */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Sweep Leftover Cycle Surplus to Savings Goal
              </span>
              <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {effectiveSweepAmount.toFixed(0)} MAD
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setSweepPct(pct);
                    setCustomSweepAmount('');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    customSweepAmount === '' && sweepPct === pct
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {pct}% ({Math.round((cycleMetrics.safeToSpend * pct) / 100)} MAD)
                </button>
              ))}
              <input
                type="number"
                min="0"
                step="10"
                value={customSweepAmount}
                onChange={(e) => setCustomSweepAmount(e.target.value)}
                placeholder="Custom MAD"
                className="ml-auto w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-mono text-gray-900 dark:text-white"
              />
            </div>

            {goals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Target Savings Goal</label>
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white"
                  >
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({parseFloat(String(g.currentAmount || 0)).toFixed(0)} /{' '}
                        {parseFloat(String(g.targetAmount || 0)).toFixed(0)} MAD)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">From Wallet</label>
                  <select
                    value={selectedSourceWalletId}
                    onChange={(e) => setSelectedSourceWalletId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.balance.toLocaleString()} MAD)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                No active savings goals yet. Click below to create a savings goal first.
              </p>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSweepSurplusToGoal}
              disabled={isSweeping || (goals.length > 0 && effectiveSweepAmount <= 0)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {goals.length === 0
                ? 'Open Savings Goals to Create Target'
                : isSweeping
                ? 'Sweeping Surplus...'
                : `Sweep ${effectiveSweepAmount.toFixed(0)} MAD to Goal`}
            </Button>
          </div>

          {/* Step 3: Roll Over Category Budget Envelopes to Next Cycle */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <CopyCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Roll Over Category Budgets to Next Cycle ({cycleMetrics.nextMonth}/{cycleMetrics.nextYear})
              </span>
              <span className="text-[11px] font-mono text-gray-500">
                {cycleMetrics.activeBudgetsCount} envelopes
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Carry forward your {cycleMetrics.activeBudgetsCount} active category caps ({cycleMetrics.totalBudgeted.toFixed(0)} MAD total) into next period so your new cycle starts fully protected.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRolloverBudgets}
                disabled={isRollingBudgets || cycleMetrics.activeBudgetsCount === 0}
                className="flex-1 text-xs"
              >
                {isRollingBudgets
                  ? 'Rolling Over Envelopes...'
                  : `Copy ${cycleMetrics.activeBudgetsCount} Budgets to ${cycleMetrics.nextMonth}/${cycleMetrics.nextYear}`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setActiveTab('reports');
                }}
                className="text-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
                Full Retrospective
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </MotionModal>
    </>
  );
};
