import React, { useMemo, useState } from 'react';
import { FinancialContext, Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Pencil,
  Trash,
  Tag,
  Landmark,
  Sparkles,
  Link2,
  Unlink,
  Download,
  Flame,
  Calendar,
  Target,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { netExpenseOf } from '../../lib/finance';
import { computeRealTimeContextStatus, getContextTimelineMeta } from './ContextsTab';

interface ContextDetailProps {
  context: FinancialContext;
  transactions: Transaction[];
  allTransactions?: Transaction[];
  onBack: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: () => void;
  onLinkTransactions?: (transactionIds: string[], contextId: string) => Promise<any>;
}

export const ContextDetail: React.FC<ContextDetailProps> = ({
  context,
  transactions,
  allTransactions = [],
  onBack,
  onEdit,
  onDelete,
  onLinkTransactions,
}) => {
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [linkingAll, setLinkingAll] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const effectiveStatus = computeRealTimeContextStatus(context);
  const timelineMeta = getContextTimelineMeta(context);

  const matchingUnlinked = useMemo(() => {
    if (!allTransactions?.length) return [];
    const startStr = context.startDate ? format(new Date(context.startDate), 'yyyy-MM-dd') : null;
    const endStr = context.endDate ? format(new Date(context.endDate), 'yyyy-MM-dd') : null;
    const nameTokens = context.name
      .toLowerCase()
      .split(/[\s,\-_/]+/)
      .filter((tok) => tok.length >= 3);

    return allTransactions.filter((t) => {
      if (t.contextId || dismissedIds.has(t.id)) return false;
      const txDateStr = format(new Date(t.createdAt), 'yyyy-MM-dd');
      const noteText = (t.notes || '').toLowerCase();

      let dateMatches = false;
      if (startStr && endStr) {
        dateMatches = txDateStr >= startStr && txDateStr <= endStr;
      } else if (startStr) {
        dateMatches = txDateStr === startStr;
      } else if (endStr) {
        dateMatches = txDateStr === endStr;
      }

      const keywordMatches =
        nameTokens.length > 0 && nameTokens.some((tok) => noteText.includes(tok));

      return dateMatches || keywordMatches;
    });
  }, [allTransactions, context.startDate, context.endDate, context.name, dismissedIds]);

  const handleLinkSingle = async (txId: string) => {
    if (!onLinkTransactions) return;
    setLinkingId(txId);
    try {
      await onLinkTransactions([txId], context.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlinkSingle = async (txId: string) => {
    if (!onLinkTransactions) return;
    setUnlinkingId(txId);
    try {
      await onLinkTransactions([txId], '');
    } catch (e) {
      console.error(e);
    } finally {
      setUnlinkingId(null);
    }
  };

  const handleLinkAll = async () => {
    if (!onLinkTransactions || matchingUnlinked.length === 0) return;
    setLinkingAll(true);
    try {
      await onLinkTransactions(
        matchingUnlinked.map((t) => t.id),
        context.id
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLinkingAll(false);
    }
  };

  const expenses = transactions.filter((t) => t.type === 'Expense');
  const refunds = transactions.filter((t) => t.type === 'Income');

  const grossSpent = expenses.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const reimbursableTotal = expenses.reduce(
    (sum, t) => sum + (parseFloat(t.reimbursableAmount || '0') || 0),
    0
  );
  const spent = expenses.reduce((sum, t) => sum + netExpenseOf(t), 0);
  const refunded = refunds.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const netCost = Math.max(0, spent - refunded);
  const budget = context.budget ? parseFloat(context.budget) : 0;

  const progressPercent = budget > 0 ? Math.min(Math.max((netCost / budget) * 100, 0), 100) : 0;
  const remainingBudget = budget > 0 ? budget - netCost : 0;

  // Remaining days in this context for Safe Daily Allowance
  const remainingContextDays = useMemo(() => {
    if (!context.endDate && !context.startDate) return 1;
    const endRef = context.endDate
      ? new Date(context.endDate)
      : new Date(context.startDate!);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endRef.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((endRef.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  }, [context.startDate, context.endDate]);

  const safeDailyBudget =
    budget > 0 && effectiveStatus !== 'Completed'
      ? Math.max(0, remainingBudget / remainingContextDays)
      : 0;

  // Daily burn velocity & peak day
  const { dailyBurnRate, peakDay } = useMemo(() => {
    const byDay: Record<string, number> = {};
    expenses.forEach((tx) => {
      const d = format(new Date(tx.createdAt), 'MMM d, yyyy');
      byDay[d] = (byDay[d] || 0) + netExpenseOf(tx);
    });
    const entries = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
    const activeDaysCount = Math.max(1, timelineMeta.elapsedDays || entries.length || 1);
    return {
      dailyBurnRate: netCost / activeDaysCount,
      peakDay: entries[0] || null,
    };
  }, [expenses, netCost, timelineMeta.elapsedDays]);

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, { amount: number; count: number }> = {};
    expenses.forEach((t) => {
      if (!cats[t.category]) cats[t.category] = { amount: 0, count: 0 };
      cats[t.category].amount += netExpenseOf(t);
      cats[t.category].count += 1;
    });
    return Object.entries(cats).sort((a, b) => b[1].amount - a[1].amount);
  }, [expenses]);

  const timeline = useMemo(() => {
    return [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions]);

  const handleExportCSV = () => {
    if (timeline.length === 0) return;
    const headers = [
      'Date',
      'Type',
      'Category',
      'Gross Amount (MAD)',
      'Reimbursable (MAD)',
      'Net Impact (MAD)',
      'Notes',
    ];
    const rows = timeline.map((tx) => {
      const gross = parseFloat(tx.amount) || 0;
      const reimb = parseFloat(tx.reimbursableAmount || '0') || 0;
      const net = tx.type === 'Expense' ? netExpenseOf(tx) : gross;
      return [
        format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm'),
        tx.type,
        `"${(tx.category || '').replace(/"/g, '""')}"`,
        gross.toFixed(2),
        reimb.toFixed(2),
        net.toFixed(2),
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${context.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3">
          <Button variant="ghost" onClick={onBack} className="p-2 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                {context.name}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  effectiveStatus === 'Active'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/25 dark:border-emerald-800 dark:text-emerald-300'
                    : effectiveStatus === 'Planned'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/25 dark:border-blue-800 dark:text-blue-300'
                    : 'bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'
                }`}
              >
                {effectiveStatus === 'Active' && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {effectiveStatus === 'Planned' && <Clock className="w-3 h-3" />}
                {effectiveStatus === 'Completed' && <CheckCircle2 className="w-3 h-3" />}
                {effectiveStatus}
              </span>
              {(context.startDate || context.endDate) && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                  Auto-Status • {timelineMeta.badgeText}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {context.startDate
                  ? format(new Date(context.startDate), 'MMM d, yyyy')
                  : 'Flexible start'}
                {context.endDate && ` → ${format(new Date(context.endDate), 'MMM d, yyyy')}`}
              </span>
              {timelineMeta.durationDays > 0 && (
                <span>
                  • {timelineMeta.durationDays}{' '}
                  {timelineMeta.durationDays === 1 ? 'day window' : 'days window'}
                </span>
              )}
              {context.notes && <span className="italic">• "{context.notes}"</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {timeline.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-1.5" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={onDelete}
          >
            <Trash className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 4-Card Executive Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Net Context Cost</span>
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
              {netCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              <span className="text-xs font-normal text-gray-500">MAD</span>
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span>Gross: {grossSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD</span>
              {reimbursableTotal > 0 && (
                <span className="text-indigo-600 dark:text-indigo-400">
                  • Splits: -{reimbursableTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
              {refunded > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  • Refunds: -{refunded.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Budget &amp; Safe Daily Cap</span>
              <Target className="w-4 h-4 text-emerald-500" />
            </div>
            {budget > 0 ? (
              <>
                <p
                  className={`mt-1.5 text-2xl font-bold font-mono tabular-nums ${
                    remainingBudget < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {remainingBudget >= 0 ? '+' : ''}
                  {remainingBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                  <span className="text-xs font-normal text-gray-500">MAD left</span>
                </p>
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {effectiveStatus !== 'Completed' && remainingBudget > 0
                    ? `Safe pace: ${safeDailyBudget.toFixed(0)} MAD/day (${remainingContextDays}d left)`
                    : `Of ${budget.toLocaleString()} MAD target (${progressPercent.toFixed(0)}% used)`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-xl font-bold text-gray-400 dark:text-gray-500">
                  Open Budget
                </p>
                <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Edit context to set a spending cap
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Daily Burn Velocity</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
              {dailyBurnRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
              <span className="text-xs font-normal text-gray-500">MAD/day</span>
            </p>
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {peakDay
                ? `Peak: ${peakDay[1].toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD on ${peakDay[0]}`
                : 'No daily spend recorded yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
              <span>Timeline Progress</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
              {transactions.length}{' '}
              <span className="text-xs font-normal text-gray-500">
                {transactions.length === 1 ? 'entry' : 'entries'}
              </span>
            </p>
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${timelineMeta.timeProgressPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {timelineMeta.badgeText} ({timelineMeta.timeProgressPercent.toFixed(0)}% elapsed)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Financial Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Net Expense Impact
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums mt-0.5">
                  {spent.toLocaleString(undefined, { maximumFractionDigits: 2 })} MAD
                </p>
              </div>
              {reimbursableTotal > 0 && (
                <div>
                  <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    Splits Owed to You
                  </p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {reimbursableTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} MAD
                  </p>
                </div>
              )}
              {refunded > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Direct Refunds / Inflow
                  </p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{refunded.toLocaleString(undefined, { maximumFractionDigits: 2 })} MAD
                  </p>
                </div>
              )}
            </div>

            {budget > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      Net Cost vs Target Budget
                    </p>
                    <p className="text-xl font-bold font-mono tabular-nums mt-0.5">
                      {netCost.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{' '}
                      <span className="text-gray-500 font-semibold">
                        {budget.toLocaleString()} MAD
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {netCost > budget ? 'Over Budget' : 'Remaining'}
                    </p>
                    <p
                      className={`text-lg font-bold font-mono tabular-nums ${
                        netCost > budget
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {(budget - netCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                      MAD
                    </p>
                  </div>
                </div>
                <div className="h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      netCost > budget
                        ? 'bg-red-500'
                        : progressPercent > 85
                        ? 'bg-amber-500'
                        : 'bg-primary'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {netCost > budget ? (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" /> Budget ceiling exceeded
                      </span>
                    ) : (
                      'Within target budget envelope'
                    )}
                  </span>
                  <span className="font-mono">{((netCost / budget) * 100).toFixed(1)}% used</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-3.5">
                {categoryBreakdown.map(([cat, info]) => {
                  const pct = spent > 0 ? (info.amount / spent) * 100 : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-medium truncate pr-2">
                          {cat}{' '}
                          <span className="text-xs text-gray-400 font-normal">({info.count})</span>
                        </span>
                        <span className="font-mono font-semibold tabular-nums shrink-0">
                          {info.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD{' '}
                          <span className="text-xs text-gray-400 font-normal">
                            ({pct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/80 rounded-full"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                No expenses linked yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Smart Unlinked Transactions Suggestion Banner */}
      {matchingUnlinked.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base text-blue-900 dark:text-blue-200">
                  Matching Unlinked Transactions ({matchingUnlinked.length})
                </CardTitle>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={linkingAll || Boolean(linkingId)}
                onClick={handleLinkAll}
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                {linkingAll ? 'Linking...' : `Link All (${matchingUnlinked.length}) to Context`}
              </Button>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Detected unlinked transactions matching this context's date window or keywords. Link
              them in one click.
            </p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {matchingUnlinked.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/30 gap-3"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2 rounded-full ${
                      tx.type === 'Expense'
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                    }`}
                  >
                    {tx.type === 'Expense' ? (
                      <Tag className="w-4 h-4" />
                    ) : (
                      <Landmark className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {tx.notes || tx.category}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-2 mt-0.5">
                      <span>{format(new Date(tx.createdAt), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>{tx.category}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end space-x-3">
                  <span
                    className={`font-semibold font-mono text-sm ${
                      tx.type === 'Expense'
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {tx.type === 'Expense' ? '-' : '+'}
                    {parseFloat(tx.amount).toLocaleString()} MAD
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      disabled={linkingId === tx.id || linkingAll}
                      onClick={() => handleLinkSingle(tx.id)}
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      {linkingId === tx.id ? 'Linking...' : 'Link'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      onClick={() => setDismissedIds((prev) => new Set(prev).add(tx.id))}
                      title="Dismiss suggestion"
                    >
                      Ignore
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Linked Timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Context Ledger ({timeline.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length > 0 ? (
            <div className="space-y-3">
              {timeline.map((tx) => (
                <div
                  key={tx.id}
                  className="flex justify-between items-center p-3 rounded-lg border border-gray-100 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors gap-3"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div
                      className={`p-2 rounded-full shrink-0 ${
                        tx.type === 'Expense'
                          ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      }`}
                    >
                      {tx.type === 'Expense' ? (
                        <Tag className="w-4 h-4" />
                      ) : (
                        <Landmark className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{tx.notes || tx.category}</p>
                      <div className="flex flex-wrap items-center text-xs text-gray-500 dark:text-gray-400 gap-x-2 gap-y-0.5 mt-0.5">
                        <span>{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</span>
                        <span>•</span>
                        <span>{tx.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div
                        className={`font-semibold font-mono tabular-nums ${
                          tx.type === 'Expense'
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {tx.type === 'Expense' ? '-' : '+'}
                        {(tx.type === 'Expense'
                          ? netExpenseOf(tx)
                          : parseFloat(tx.amount)
                        ).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                        MAD
                      </div>
                      {tx.type === 'Expense' &&
                        tx.reimbursableAmount &&
                        parseFloat(tx.reimbursableAmount) > 0 && (
                          <p className="text-xs text-indigo-500 dark:text-indigo-400">
                            gross {parseFloat(tx.amount).toLocaleString()} • -
                            {parseFloat(tx.reimbursableAmount).toLocaleString()} split
                          </p>
                        )}
                    </div>
                    {onLinkTransactions && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1.5 h-8 w-8 text-gray-400 hover:text-amber-600"
                        disabled={unlinkingId === tx.id}
                        onClick={() => handleUnlinkSingle(tx.id)}
                        title="Unlink transaction from this context"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No transactions linked to this context yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
