import React, { useMemo, useState } from 'react';
import { Calendar, FileCheck2, Flame, Inbox, X } from 'lucide-react';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { MotionModal, StaggerItem, StaggerList } from '../../ui/MotionPrimitives';
import { dashboardService } from '../../../services/api/dashboardService';
import { useAuth } from '../../../context/AuthContext';
import type { FinancialPeriod } from '../../../lib/financialMonth';
import type {
  CommitmentOccurrence,
  DashboardTab,
  KPI,
  Payroll,
  Transaction,
  WalletsWorkbenchSection,
} from '../../../types';
import type { OperationalRadarPayload } from '../OverviewTab';
import { computeCycleAnomalies } from './overviewHelpers';

interface OverviewBand4Props {
  kpis: KPI | null;
  transactions: Transaction[];
  payrolls: Payroll[];
  currentFm: FinancialPeriod | null;
  operationalRadar: OperationalRadarPayload | null;
  isHydratingRadar?: boolean;
  onEnsureRadarLoaded?: (force?: boolean) => Promise<void> | void;
  onDataChange?: () => Promise<void> | void;
  isPrivacyMode: boolean;
  setActiveTab: (tab: DashboardTab) => void;
  openTransaction: (transactionId: string) => void;
  openAccountsSection: (section: WalletsWorkbenchSection) => void;
}

export const OverviewBand4OperationalRadar: React.FC<OverviewBand4Props> = ({
  kpis,
  transactions,
  payrolls,
  currentFm,
  operationalRadar,
  isHydratingRadar = false,
  onEnsureRadarLoaded,
  onDataChange,
  isPrivacyMode,
  setActiveTab,
  openTransaction,
  openAccountsSection,
}) => {
  const { token } = useAuth();
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [settlingOccurrence, setSettlingOccurrence] = useState<CommitmentOccurrence | null>(null);
  const [occAction, setOccAction] = useState<'pay' | 'partial' | 'skip'>('pay');
  const [occAmount, setOccAmount] = useState('');
  const [occDate, setOccDate] = useState(new Date().toISOString().slice(0, 10));
  const [occWalletId, setOccWalletId] = useState('');
  const [occNotes, setOccNotes] = useState('');

  const upcomingCommitments = operationalRadar?.upcomingCommitments ?? [];
  const pendingReviews = operationalRadar?.pendingReviews ?? [];
  const integritySummary = operationalRadar?.integritySummary ?? null;

  const anomalies = useMemo(
    () => computeCycleAnomalies(transactions, currentFm, payrolls),
    [transactions, currentFm, payrolls],
  );

  const handleQuickApproveReview = async (item: OperationalRadarPayload['pendingReviews'][number]) => {
    if (!token) return;
    setBusyActionId(item.id);
    try {
      await dashboardService.decideReviewItem(
        item.id,
        {
          action: 'post_transaction',
          walletId: item.walletId || kpis?.accounts?.find((w) => w.isMain)?.id || kpis?.accounts?.[0]?.id,
          category: item.parsedCategory || undefined,
          description: item.parsedDescription || undefined,
          amount: Number(item.parsedAmount) || undefined,
        },
        token,
      );
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: 'Review item approved and posted to ledger', type: 'success' },
        }),
      );
      await Promise.all([
        Promise.resolve(onEnsureRadarLoaded?.(true)),
        Promise.resolve(onDataChange?.()),
      ]);
    } catch (e: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: e.message || 'Failed to approve review item', type: 'error' },
        }),
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const openOccurrenceSettleModal = (occ: CommitmentOccurrence) => {
    const remaining = Math.max(0, Number(occ.expectedAmount || 0) - Number(occ.paidAmount || 0));
    setSettlingOccurrence(occ);
    setOccAction('pay');
    setOccAmount(remaining > 0 ? remaining.toFixed(2) : String(occ.expectedAmount || '0'));
    setOccDate(new Date().toISOString().slice(0, 10));
    setOccWalletId(kpis?.accounts?.find((w) => w.isMain)?.id || kpis?.accounts?.[0]?.id || '');
    setOccNotes('');
  };

  const handleConfirmSettleOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !settlingOccurrence) return;
    setBusyActionId(settlingOccurrence.id);
    try {
      const parsedAmount = Number(occAmount);
      await dashboardService.settleCommitmentOccurrence(
        settlingOccurrence.id,
        {
          action: occAction,
          ...(occAction !== 'skip' && Number.isFinite(parsedAmount) && parsedAmount > 0
            ? { actualAmount: parsedAmount }
            : {}),
          ...(occAction !== 'skip' && occDate ? { actualDate: occDate } : {}),
          ...(occAction !== 'skip' && occWalletId ? { walletId: occWalletId } : {}),
          ...(occNotes.trim() ? { notes: occNotes.trim(), reason: occNotes.trim() } : {}),
        },
        token,
      );
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: `${settlingOccurrence.title} updated and journaled`, type: 'success' },
        }),
      );
      setSettlingOccurrence(null);
      await Promise.all([
        Promise.resolve(onEnsureRadarLoaded?.(true)),
        Promise.resolve(onDataChange?.()),
      ]);
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: err?.message || 'Failed to settle commitment', type: 'error' },
        }),
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const showRadarSkeleton = isHydratingRadar && !operationalRadar;

  return (
    <>
      <StaggerList className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Upcoming 14-Day Commitment Occurrences */}
        <StaggerItem className="min-w-0">
          <Card className="min-w-0 h-full border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  <span>14-Day Commitments Radar</span>
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Calendar ({upcomingCommitments.length}) →
                </button>
              </div>

              {showRadarSkeleton ? (
                <div className="mt-3 space-y-2 animate-pulse">
                  <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                </div>
              ) : upcomingCommitments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {upcomingCommitments.slice(0, 3).map((occ) => (
                    <div
                      key={occ.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {occ.title}
                        </p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          Due {occ.expectedDate} ·{' '}
                          {isPrivacyMode
                            ? '••••'
                            : `${parseFloat(String(occ.expectedAmount)).toFixed(0)} MAD`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyActionId === occ.id}
                        onClick={() => openOccurrenceSettleModal(occ)}
                        className="h-7 px-2.5 text-[11px] whitespace-nowrap shrink-0"
                      >
                        {busyActionId === occ.id ? '...' : 'Settle'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    All Near-Term Bills Clear
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    No unsettled recurring bills or installments due in the next 14 days.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 2. Financial Review Inbox Queue */}
        <StaggerItem className="min-w-0">
          <Card className="min-w-0 h-full border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Inbox className="h-4 w-4 text-emerald-500" />
                  <span>Financial Review Inbox</span>
                </p>
                <button
                  type="button"
                  onClick={() => openAccountsSection('review_inbox')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Inbox ({pendingReviews.length}) →
                </button>
              </div>

              {showRadarSkeleton ? (
                <div className="mt-3 space-y-2 animate-pulse">
                  <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                  <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800" />
                </div>
              ) : pendingReviews.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {pendingReviews.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {item.parsedDescription || item.parsedCategory || 'Review Item'}
                        </p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          {item.parsedAmount
                            ? `${isPrivacyMode ? '••••' : parseFloat(String(item.parsedAmount)).toFixed(0)} ${
                                item.parsedCurrency || 'MAD'
                              } · `
                            : ''}
                          {item.parsedDate} · {item.sourceType.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyActionId === item.id}
                        onClick={() => handleQuickApproveReview(item)}
                        className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0"
                      >
                        {busyActionId === item.id ? '...' : 'Confirm'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Inbox Zero Achieved
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    All OCR receipts, statement imports, and rule drafts are reconciled.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 3. Spending Anomaly Radar & Double-Entry Integrity */}
        <StaggerItem className="min-w-0">
          <Card className="min-w-0 h-full border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span>Anomaly Radar</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Analytics →
                  </button>
                </div>

                {anomalies.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {anomalies.slice(0, 2).map((anom) => (
                      <button
                        key={anom.txId}
                        type="button"
                        onClick={() => openTransaction(anom.txId)}
                        className="w-full flex items-center justify-between gap-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 px-2.5 py-1.5 text-left text-xs hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-white">
                            {anom.title}
                          </p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                            {anom.dateLabel} · {anom.multiplier}× avg (
                            {isPrivacyMode ? '••••' : anom.categoryAvg.toFixed(0)} MAD)
                          </p>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 shrink-0">
                          {isPrivacyMode ? '••••' : `${anom.amount.toFixed(0)} MAD`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    No outlier spikes (&gt;2.1× category average) detected this cycle.
                  </p>
                )}
              </div>

              {/* Trial Balance Footer */}
              <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck2 className="h-4 w-4 text-teal-500 shrink-0" />
                  <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                    {showRadarSkeleton
                      ? 'Verifying Trial Balance...'
                      : integritySummary?.healthy !== false
                      ? 'Trial Balance Verified'
                      : 'Reconciliation Needed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openAccountsSection('journal_audit')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Journal ({integritySummary ? integritySummary.journalEntryCount : transactions.length}) →
                </button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerList>

      <MotionModal
        isOpen={Boolean(settlingOccurrence)}
        onClose={() => setSettlingOccurrence(null)}
        zIndexClass="z-[85]"
        containerClassName="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-2xl"
      >
        {settlingOccurrence && (
          <form onSubmit={handleConfirmSettleOccurrence} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Settle Commitment
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {settlingOccurrence.title} · Expected{' '}
                  {Number(settlingOccurrence.expectedAmount || 0).toFixed(2)}{' '}
                  {settlingOccurrence.currency || 'MAD'} on {settlingOccurrence.expectedDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettlingOccurrence(null)}
                aria-label="Close settle commitment"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['pay', 'partial', 'skip'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOccAction(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    occAction === mode
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {mode === 'pay' ? 'Full Settle' : mode === 'partial' ? 'Partial' : 'Skip'}
                </button>
              ))}
            </div>

            {occAction !== 'skip' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Actual Amount ({settlingOccurrence.currency || 'MAD'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={occAmount}
                      onChange={(e) => setOccAmount(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Settlement Date
                    </label>
                    <input
                      type="date"
                      required
                      value={occDate}
                      onChange={(e) => setOccDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Posting Wallet / Account
                  </label>
                  <select
                    value={occWalletId}
                    onChange={(e) => setOccWalletId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                  >
                    {(kpis?.accounts || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.balance.toFixed(2)} {w.currency || 'MAD'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {occAction === 'skip'
                  ? 'Skip Reason (Optional)'
                  : 'Notes / Variance Reason (Optional)'}
              </label>
              <input
                type="text"
                value={occNotes}
                onChange={(e) => setOccNotes(e.target.value)}
                placeholder={
                  occAction === 'skip' ? 'e.g. Waived this month' : 'e.g. Paid via CIH transfer'
                }
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSettlingOccurrence(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busyActionId === settlingOccurrence.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busyActionId === settlingOccurrence.id
                  ? 'Posting...'
                  : occAction === 'skip'
                  ? 'Confirm Skip'
                  : 'Confirm & Post'}
              </Button>
            </div>
          </form>
        )}
      </MotionModal>
    </>
  );
};

export default OverviewBand4OperationalRadar;
