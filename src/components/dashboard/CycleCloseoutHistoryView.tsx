import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Loader2,
  RefreshCw,
  Settings2,
  Archive,
  TrendingUp,
  Repeat,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import type { CycleCloseoutRunRecord, DashboardTab } from '../../types';
import type { YearlyAuditSummary } from '../../lib/cycleCloseout';

interface CycleCloseoutHistoryViewProps {
  onNavigateTab?: (tab: DashboardTab) => void;
}

const formatMad = (val: number | null | undefined) => {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
};

const formatDateShort = (iso: string | undefined | null) => {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const triggerLabel = (src: string) => {
  if (src === 'auto_payroll') return 'Auto Payday';
  if (src === 'manual_confirm') return 'Payroll Confirm';
  return 'Manual Audit';
};

export const CycleCloseoutHistoryView: React.FC<CycleCloseoutHistoryViewProps> = ({
  onNavigateTab,
}) => {
  const { token } = useAuth();
  const currentYear = new Date().getFullYear();

  const [runs, setRuns] = useState<CycleCloseoutRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [generatingYear, setGeneratingYear] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getCycleCloseoutRuns(token, { limit: 60 });
      setRuns(res.runs || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load cycle closeout records.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const monthlyRuns = useMemo(
    () => runs.filter((r) => r.runType === 'monthly'),
    [runs]
  );

  const yearlyRuns = useMemo(
    () => runs.filter((r) => r.runType === 'yearly'),
    [runs]
  );

  const selectedYearlyRun = useMemo(
    () => yearlyRuns.find((r) => r.cycleKey === String(selectedYear)) || null,
    [yearlyRuns, selectedYear]
  );

  const yearlyAudit: (YearlyAuditSummary & { driveArchivedAt?: string | null }) | null =
    selectedYearlyRun && selectedYearlyRun.summary && typeof selectedYearlyRun.summary === 'object'
      ? (selectedYearlyRun.summary as YearlyAuditSummary & { driveArchivedAt?: string | null })
      : null;

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentYear, currentYear - 1, currentYear - 2]);
    for (const r of yearlyRuns) {
      const parsed = Number(r.cycleKey);
      if (Number.isInteger(parsed)) years.add(parsed);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [currentYear, yearlyRuns]);

  const handleGenerateYearly = async () => {
    if (!token) return;
    setGeneratingYear(true);
    setError(null);
    try {
      await dashboardService.runYearlyCloseout(
        { year: selectedYear, forceRefresh: true },
        token
      );
      await loadRuns();
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            type: 'success',
            message: `${selectedYear} annual closeout audit generated.`,
          },
        })
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to generate yearly audit.');
    } finally {
      setGeneratingYear(false);
    }
  };

  if (loading && runs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-44 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/50 animate-pulse" />
        <div className="h-56 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* ── Yearly Closeout & Annual Financial Audit ── */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Yearly Financial Closeout &amp; Annual Audit
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Full-year income, net living spend, savings rate, subscription sinking funds, project archival review, and net worth delta. Runs automatically on December closeout or on demand.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Select audit year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} Annual Audit
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerateYearly}
              disabled={generatingYear}
              className="h-9 px-3.5 text-xs whitespace-nowrap shrink-0"
            >
              {generatingYear ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {yearlyAudit ? `Refresh ${selectedYear} Audit` : `Generate ${selectedYear} Audit`}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {!yearlyAudit ? (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No annual audit saved yet for {selectedYear}.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
                TrueSpend automatically runs your Yearly Closeout when your December financial cycle closes. You can also generate a live snapshot for {selectedYear} right now.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateYearly}
                disabled={generatingYear}
                className="text-xs"
              >
                Generate {selectedYear} Annual Audit
              </Button>
            </div>
          ) : (
            <>
              {/* Metadata line (unboxed, typographic separators) */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Fiscal Year {yearlyAudit.year}</span>
                <span aria-hidden="true">·</span>
                <span>{triggerLabel(selectedYearlyRun!.triggerSource)}</span>
                <span aria-hidden="true">·</span>
                <span>Updated {formatDateShort(selectedYearlyRun!.executedAt)}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{yearlyAudit.totalTransactions} transactions</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{yearlyAudit.payrollsConfirmedCount} payrolls</span>
                {yearlyAudit.driveArchivedAt && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Archived to Drive ({formatDateShort(yearlyAudit.driveArchivedAt)})
                    </span>
                  </>
                )}
              </div>

              {/* Executive KPI Strip */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 border-y border-gray-100 dark:border-gray-800 py-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Earned Income</p>
                  <p className="mt-1 text-base font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                    {formatMad(yearlyAudit.earnedIncomeMad)}
                  </p>
                  {yearlyAudit.reimbursementsExcludedMad > 0 && (
                    <p className="text-[11px] text-gray-500 tabular-nums mt-0.5">
                      Excl. {yearlyAudit.reimbursementsExcludedMad.toFixed(0)} MAD reimb.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Net Living Spend</p>
                  <p className="mt-1 text-base font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                    {formatMad(yearlyAudit.netLivingSpendMad)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Saved &amp; Swept</p>
                  <p className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMad(yearlyAudit.totalSavedAndSweptMad)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Annual Savings Rate</p>
                  <p
                    className={`mt-1 text-base font-bold font-mono tabular-nums ${
                      yearlyAudit.annualSavingsRatePercent >= 20
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : yearlyAudit.annualSavingsRatePercent >= 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {yearlyAudit.annualSavingsRatePercent.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Net Worth Growth</p>
                  <p
                    className={`mt-1 text-base font-bold font-mono tabular-nums ${
                      (yearlyAudit.netWorthAudit?.deltaNetWorthMad ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {yearlyAudit.netWorthAudit?.deltaNetWorthMad !== null &&
                    yearlyAudit.netWorthAudit?.deltaNetWorthMad !== undefined
                      ? `${yearlyAudit.netWorthAudit.deltaNetWorthMad >= 0 ? '+' : ''}${formatMad(
                          yearlyAudit.netWorthAudit.deltaNetWorthMad
                        )}`
                      : formatMad(yearlyAudit.netWorthAudit?.endNetWorthMad)}
                  </p>
                </div>
              </div>

              {/* 12-Month Breakdown Table */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    12-Month Performance Ledger
                  </h4>
                  {yearlyAudit.bestMonth && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Best month: <strong className="text-emerald-600 dark:text-emerald-400">{yearlyAudit.bestMonth.label}</strong> ({yearlyAudit.bestMonth.savingsRatePercent.toFixed(1)}%)
                      {yearlyAudit.worstMonth && yearlyAudit.worstMonth.month !== yearlyAudit.bestMonth.month && (
                        <>
                          {' · '}Tightest: <strong className="text-amber-600 dark:text-amber-400">{yearlyAudit.worstMonth.label}</strong> ({yearlyAudit.worstMonth.savingsRatePercent.toFixed(1)}%)
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Month</th>
                        <th className="py-2.5 px-3 font-medium text-right">Income</th>
                        <th className="py-2.5 px-3 font-medium text-right">Living Spend</th>
                        <th className="py-2.5 px-3 font-medium text-right">Saved</th>
                        <th className="py-2.5 px-3 font-medium text-right">Invested</th>
                        <th className="py-2.5 px-3 font-medium text-right">Net Cashflow</th>
                        <th className="py-2.5 px-3 font-medium text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(yearlyAudit.monthlyBreakdown || []).map((row) => (
                        <tr
                          key={row.month}
                          className={`hover:bg-gray-50/70 dark:hover:bg-gray-800/40 ${
                            row.transactionCount === 0 ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">
                            {row.label}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                            {row.earnedIncomeMad.toFixed(0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                            {row.livingSpendMad.toFixed(0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            {row.savedMad.toFixed(0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                            {row.investedMad.toFixed(0)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono tabular-nums font-semibold ${
                              row.netCashflowMad >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {row.netCashflowMad >= 0 ? '+' : ''}
                            {row.netCashflowMad.toFixed(0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                            {row.earnedIncomeMad > 0 ? `${row.savingsRatePercent.toFixed(0)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Secondary Yearly Audit Panels (2-column flat layout with hairline dividers) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Top Spending Categories */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Top Spending Categories ({yearlyAudit.year})
                  </h4>
                  {yearlyAudit.topCategories.length === 0 ? (
                    <p className="text-xs text-gray-500">No living expenses logged for {yearlyAudit.year}.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                      {yearlyAudit.topCategories.map((cat) => (
                        <div key={cat.category} className="py-2 flex items-center justify-between gap-3 text-xs">
                          <span className="text-gray-800 dark:text-gray-200 truncate">{cat.category}</span>
                          <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                            <span className="text-gray-500">{cat.sharePercent.toFixed(1)}%</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {cat.amountMad.toFixed(0)} MAD
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Annual Subscriptions, Projects & Debt Carry-Forward */}
                <div className="space-y-5">
                  {/* Subscriptions Sinking Fund */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <Repeat className="w-4 h-4 text-indigo-500" />
                        Annual Subscriptions &amp; Sinking Fund
                      </h4>
                      <span className="text-xs font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                        {yearlyAudit.subscriptionsAudit.annualizedTotalMad.toFixed(0)} MAD/yr
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {yearlyAudit.subscriptionsAudit.activeCount} active plans · Monthly reserve:{' '}
                      <strong className="text-gray-800 dark:text-gray-200">
                        {yearlyAudit.subscriptionsAudit.monthlySinkingFundMad.toFixed(0)} MAD/mo
                      </strong>
                      {yearlyAudit.subscriptionsAudit.nonMonthlyItems.length > 0 && (
                        <>
                          {' '}· Non-monthly bills (yearly/quarterly):{' '}
                          <strong className="text-amber-600 dark:text-amber-400">
                            {yearlyAudit.subscriptionsAudit.nonMonthlySinkingFundMonthlyMad.toFixed(0)} MAD/mo reserve
                          </strong>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Debt Carry-Forward & Goals */}
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Carry-Forward Receivables</p>
                      <p className="mt-0.5 font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {yearlyAudit.debtCarryForward.openReceivablesMad.toFixed(0)} MAD ({yearlyAudit.debtCarryForward.openReceivablesCount})
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Carry-Forward Payables</p>
                      <p className="mt-0.5 font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {yearlyAudit.debtCarryForward.openPayablesMad.toFixed(0)} MAD ({yearlyAudit.debtCarryForward.openPayablesCount})
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Investments &amp; Dividends</p>
                      <p className="mt-0.5 font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                        {yearlyAudit.totalInvestedMad.toFixed(0)} MAD inv. · {yearlyAudit.dividendsReceivedMad.toFixed(0)} MAD div.
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Savings Goals Progress</p>
                      <p className="mt-0.5 font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                        {yearlyAudit.goalsAudit.completedGoalsCount}/{yearlyAudit.goalsAudit.totalGoalsCount} completed
                      </p>
                    </div>
                  </div>

                  {/* Completed / Expired Projects to Archive */}
                  {yearlyAudit.projectsAudit.completedOrExpiredToArchive.length > 0 && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                          <Archive className="w-3.5 h-3.5 text-amber-500" />
                          Projects Ready for Year-End Archival
                        </h5>
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('contexts')}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                          >
                            Review Projects <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {yearlyAudit.projectsAudit.completedOrExpiredToArchive.map((proj) => (
                          <div
                            key={proj.id}
                            className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400"
                          >
                            <span className="truncate">{proj.name}</span>
                            <span className="font-mono tabular-nums shrink-0">
                              {proj.spentInYearMad.toFixed(0)} MAD spent
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Monthly Closeout Automation History ── */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              Monthly Payday Closeout Log
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Audit trail of every automatic pre-payroll pocket sweep, incoming-payroll cash recovery, budget rollover, and next-payday schedule.
            </p>
          </div>
          {onNavigateTab && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onNavigateTab('settings')}
              className="h-9 px-3 text-xs whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              Configure Automation
            </Button>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          {monthlyRuns.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                No monthly closeouts executed yet.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Your first closeout will run automatically right before your next scheduled salary deposit — sweeping leftover Bank and Cash balances to Savings and recovering pocket Cash from the new payroll.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2.5 pr-3 font-medium">Closed Cycle</th>
                    <th className="py-2.5 px-3 font-medium">Trigger</th>
                    <th className="py-2.5 px-3 font-medium text-right">Bank Swept</th>
                    <th className="py-2.5 px-3 font-medium text-right">Cash Swept</th>
                    <th className="py-2.5 px-3 font-medium text-right">Cash Recovered</th>
                    <th className="py-2.5 px-3 font-medium text-right">Salary Posted</th>
                    <th className="py-2.5 px-3 font-medium text-right">Budgets</th>
                    <th className="py-2.5 pl-3 font-medium text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {monthlyRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        {run.cycleKey}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                        {triggerLabel(run.triggerSource)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {run.sweptBankAmountMad.toFixed(2)} MAD
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {run.sweptCashAmountMad.toFixed(2)} MAD
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                        {run.recoveredCashAmountMad > 0
                          ? `${run.recoveredCashAmountMad.toFixed(2)} MAD`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                        +{run.salaryDepositedMad.toFixed(0)} MAD
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                        {run.budgetsRolledCount}
                      </td>
                      <td className="py-2.5 pl-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatDateShort(run.executedAt)}
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
  );
};
