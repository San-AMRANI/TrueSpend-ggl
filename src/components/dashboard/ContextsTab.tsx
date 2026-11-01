import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FinancialContext, FinancialContextStatus, FinancialContextType, Transaction } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { netExpenseOf } from '../../lib/finance';
import {
  Map as MapIcon,
  Briefcase,
  Wrench,
  Heart,
  Layers,
  Plus,
  Pencil,
  X,
  Calendar as CalendarIcon,
  Tag,
  Sparkles,
  Link2,
  CheckCircle2,
  Search,
  Copy,
  Clock,
  TrendingUp,
  Wallet,
  Zap,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ContextDetail } from './ContextDetail';

interface ContextsTabProps {
  contexts: FinancialContext[];
  transactions: Transaction[];
  handleCreateContext: (data: any) => Promise<void>;
  handleUpdateContext: (id: string, data: any) => Promise<void>;
  handleDeleteContext: (id: string) => Promise<void>;
  handleLinkTransactions?: (transactionIds: string[], contextId: string) => Promise<any>;
}

interface SuggestedLink {
  transaction: Transaction;
  suggestedContext: FinancialContext;
  allMatchingContexts: FinancialContext[];
}

const contextTypeIcons: Record<string, React.ReactNode> = {
  Trip: <MapIcon className="w-5 h-5" />,
  'Work / Mission': <Briefcase className="w-5 h-5" />,
  Project: <Wrench className="w-5 h-5" />,
  'Life Event': <Heart className="w-5 h-5" />,
  Other: <Layers className="w-5 h-5" />,
};

export function toDateKeyStr(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dateObj.getTime())) return null;
  return format(dateObj, 'yyyy-MM-dd');
}

export function computeRealTimeContextStatus(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  fallbackStatus: FinancialContextStatus = 'Planned',
  now: Date = new Date()
): { status: FinancialContextStatus; isDateDriven: boolean; reason: string } {
  const startStr = toDateKeyStr(startDate);
  const endStr = toDateKeyStr(endDate);
  if (!startStr && !endStr) {
    return {
      status: fallbackStatus || 'Planned',
      isDateDriven: false,
      reason: 'Manual status (no dates set)',
    };
  }

  const todayStr = format(now, 'yyyy-MM-dd');

  if (startStr && endStr) {
    if (todayStr < startStr) {
      return {
        status: 'Planned',
        isDateDriven: true,
        reason: `Starts in the future (${startStr})`,
      };
    }
    if (todayStr >= startStr && todayStr <= endStr) {
      return {
        status: 'Active',
        isDateDriven: true,
        reason:
          startStr === endStr
            ? `Active today (${startStr})`
            : `Today (${todayStr}) is within ${startStr} → ${endStr}`,
      };
    }
    return {
      status: 'Completed',
      isDateDriven: true,
      reason: `Ended on ${endStr}`,
    };
  }

  if (startStr) {
    if (todayStr < startStr) {
      return {
        status: 'Planned',
        isDateDriven: true,
        reason: `Scheduled for ${startStr}`,
      };
    }
    if (todayStr === startStr) {
      return {
        status: 'Active',
        isDateDriven: true,
        reason: `Active today (${startStr})`,
      };
    }
    return {
      status: 'Completed',
      isDateDriven: true,
      reason: `Completed after ${startStr}`,
    };
  }

  if (endStr) {
    if (todayStr <= endStr) {
      return {
        status: 'Active',
        isDateDriven: true,
        reason: `Active until ${endStr}`,
      };
    }
    return {
      status: 'Completed',
      isDateDriven: true,
      reason: `Ended on ${endStr}`,
    };
  }

  return { status: fallbackStatus, isDateDriven: false, reason: 'Manual status' };
}

export function getContextTimelineMeta(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  now: Date = new Date()
) {
  const startStr = toDateKeyStr(startDate);
  const endStr = toDateKeyStr(endDate) || startStr;
  const todayStr = format(now, 'yyyy-MM-dd');

  if (!startStr && !endStr) {
    return {
      durationDays: 1,
      elapsedDays: 1,
      progressPct: 0,
      badgeText: 'Open-ended timeline',
      isTodayActive: false,
    };
  }

  const startObj = new Date(`${startStr || endStr}T12:00:00`);
  const endObj = new Date(`${endStr || startStr}T12:00:00`);
  const todayObj = new Date(`${todayStr}T12:00:00`);

  const durationDays = Math.max(1, differenceInCalendarDays(endObj, startObj) + 1);

  if (todayStr < (startStr || '')) {
    const daysUntil = Math.max(1, differenceInCalendarDays(startObj, todayObj));
    return {
      durationDays,
      elapsedDays: 0,
      progressPct: 0,
      badgeText:
        daysUntil === 1
          ? `Starts tomorrow • ${durationDays}d duration`
          : `Starts in ${daysUntil} days • ${durationDays}d duration`,
      isTodayActive: false,
    };
  }

  if (endStr && todayStr > endStr) {
    const daysAgo = Math.max(1, differenceInCalendarDays(todayObj, endObj));
    return {
      durationDays,
      elapsedDays: durationDays,
      progressPct: 100,
      badgeText:
        durationDays === 1
          ? `1-day event • Ended ${daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`}`
          : `${durationDays} days • Ended ${daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`}`,
      isTodayActive: false,
    };
  }

  const elapsedDays = Math.min(
    durationDays,
    Math.max(1, differenceInCalendarDays(todayObj, startObj) + 1)
  );
  const remainingDays = Math.max(0, durationDays - elapsedDays);
  const progressPct = Math.min(100, Math.round((elapsedDays / durationDays) * 100));

  return {
    durationDays,
    elapsedDays,
    progressPct,
    badgeText:
      durationDays === 1
        ? 'Active Today • 1-Day Event'
        : remainingDays === 0
        ? `Final Day (Day ${elapsedDays} of ${durationDays})`
        : `Day ${elapsedDays} of ${durationDays} • ${remainingDays}d left`,
    isTodayActive: true,
  };
}

const QUICK_TEMPLATES: {
  label: string;
  type: FinancialContextType;
  defaultName: string;
  daysOffsetStart: number;
  durationDays: number;
}[] = [
  {
    label: '🚆 Today Excursion',
    type: 'Trip',
    defaultName: "Today's Trip",
    daysOffsetStart: 0,
    durationDays: 1,
  },
  {
    label: '✈️ Weekend Trip',
    type: 'Trip',
    defaultName: 'Weekend Getaway',
    daysOffsetStart: 0,
    durationDays: 3,
  },
  {
    label: '💼 Work Mission',
    type: 'Work / Mission',
    defaultName: 'Business Mission',
    daysOffsetStart: 0,
    durationDays: 5,
  },
  {
    label: '🛠️ Home Project',
    type: 'Project',
    defaultName: 'Home Upgrade Project',
    daysOffsetStart: 0,
    durationDays: 14,
  },
  {
    label: '🎉 Life Event',
    type: 'Life Event',
    defaultName: 'Family Celebration',
    daysOffsetStart: 7,
    durationDays: 2,
  },
];

export const ContextsTab: React.FC<ContextsTabProps> = ({
  contexts,
  transactions,
  handleCreateContext,
  handleUpdateContext,
  handleDeleteContext,
  handleLinkTransactions,
}) => {
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<FinancialContext | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [formData, setFormData] = useState<Partial<FinancialContext>>({
    name: '',
    type: 'Trip',
    status: 'Planned',
    budget: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  // Automatically compute live status for every context based on real-time date
  const enrichedContexts = useMemo(() => {
    const now = new Date();
    return contexts.map((ctx) => {
      const autoMeta = computeRealTimeContextStatus(ctx.startDate, ctx.endDate, ctx.status, now);
      const timeline = getContextTimelineMeta(ctx.startDate, ctx.endDate, now);
      return {
        ...ctx,
        status: autoMeta.status,
        storedStatus: ctx.status,
        isDateDriven: autoMeta.isDateDriven,
        statusReason: autoMeta.reason,
        timeline,
      };
    });
  }, [contexts]);

  // Background auto-sync if any context's stored status differs from real-time date status
  const syncedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const ctx of enrichedContexts) {
      if (
        ctx.isDateDriven &&
        ctx.storedStatus !== ctx.status &&
        !syncedIdsRef.current.has(`${ctx.id}-${ctx.status}`)
      ) {
        syncedIdsRef.current.add(`${ctx.id}-${ctx.status}`);
        handleUpdateContext(ctx.id, {
          name: ctx.name,
          type: ctx.type,
          startDate: ctx.startDate,
          endDate: ctx.endDate,
          budget: ctx.budget,
          status: ctx.status,
          notes: ctx.notes,
        }).catch(() => {});
      }
    }
  }, [enrichedContexts, handleUpdateContext]);

  // State for suggestions linking
  const [selectedContextForTx, setSelectedContextForTx] = useState<Record<string, string>>({});
  const [dismissedTxIds, setDismissedTxIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('truespend_dismissed_context_links');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkingAll, setLinkingAll] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Compute unlinked transactions that match context dates or context name keywords in notes
  const suggestedLinks: SuggestedLink[] = useMemo(() => {
    const unlinked = transactions.filter((t) => !t.contextId && !dismissedTxIds.has(t.id));
    if (unlinked.length === 0 || enrichedContexts.length === 0) return [];

    const suggestions: SuggestedLink[] = [];

    for (const tx of unlinked) {
      const txDateStr = format(new Date(tx.createdAt), 'yyyy-MM-dd');
      const notesLower = (tx.notes || '').toLowerCase();
      const matching: FinancialContext[] = [];

      for (const ctx of enrichedContexts) {
        const startStr = toDateKeyStr(ctx.startDate);
        const endStr = toDateKeyStr(ctx.endDate);

        let matches = false;
        if (startStr && endStr) {
          matches = txDateStr >= startStr && txDateStr <= endStr;
        } else if (startStr) {
          matches = txDateStr === startStr;
        } else if (endStr) {
          matches = txDateStr === endStr;
        }

        // Also match if transaction notes explicitly mention the context name
        if (!matches && ctx.name && ctx.name.trim().length >= 4) {
          if (notesLower.includes(ctx.name.trim().toLowerCase())) {
            matches = true;
          }
        }

        if (matches) {
          matching.push(ctx);
        }
      }

      if (matching.length > 0) {
        matching.sort((a, b) => {
          const rank = { Active: 1, Planned: 2, Completed: 3 };
          return (rank[a.status] || 4) - (rank[b.status] || 4);
        });

        suggestions.push({
          transaction: tx,
          suggestedContext: matching[0],
          allMatchingContexts: matching,
        });
      }
    }

    return suggestions.sort(
      (a, b) => new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime()
    );
  }, [transactions, enrichedContexts, dismissedTxIds]);

  // Executive KPIs across all contexts
  const globalStats = useMemo(() => {
    let totalNetSpent = 0;
    let totalGrossSpent = 0;
    let totalReimbursable = 0;
    let totalBudgeted = 0;
    let linkedTxCount = 0;

    for (const ctx of enrichedContexts) {
      const ctxTxs = transactions.filter((t) => t.contextId === ctx.id);
      linkedTxCount += ctxTxs.length;
      const expenses = ctxTxs.filter((t) => t.type === 'Expense');
      const netSpent = expenses.reduce((sum, t) => sum + netExpenseOf(t), 0);
      const grossSpent = expenses.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const refunds = ctxTxs
        .filter((t) => t.type === 'Income')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      totalNetSpent += Math.max(0, netSpent - refunds);
      totalGrossSpent += grossSpent;
      totalReimbursable += Math.max(0, grossSpent - netSpent);
      if (ctx.budget) {
        totalBudgeted += parseFloat(ctx.budget) || 0;
      }
    }

    const activeCount = enrichedContexts.filter((c) => c.status === 'Active').length;
    const plannedCount = enrichedContexts.filter((c) => c.status === 'Planned').length;
    const completedCount = enrichedContexts.filter((c) => c.status === 'Completed').length;

    return {
      totalNetSpent,
      totalGrossSpent,
      totalReimbursable,
      totalBudgeted,
      linkedTxCount,
      activeCount,
      plannedCount,
      completedCount,
    };
  }, [enrichedContexts, transactions]);

  const handleDismiss = (txId: string) => {
    setDismissedTxIds((prev) => {
      const updated = new Set(prev).add(txId);
      try {
        localStorage.setItem('truespend_dismissed_context_links', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  const handleLinkSingle = async (txId: string, contextId: string, txDesc: string, ctxName: string) => {
    if (!handleLinkTransactions) return;
    setLinkingId(txId);
    try {
      await handleLinkTransactions([txId], contextId);
      setFeedbackMessage(`Linked "${txDesc}" to ${ctxName}`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (e) {
      console.error('Failed to link transaction', e);
    } finally {
      setLinkingId(null);
    }
  };

  const handleLinkAll = async () => {
    if (!handleLinkTransactions || suggestedLinks.length === 0) return;
    setLinkingAll(true);
    try {
      const groups: Record<string, string[]> = {};
      for (const item of suggestedLinks) {
        const targetCtxId = selectedContextForTx[item.transaction.id] || item.suggestedContext.id;
        if (!groups[targetCtxId]) groups[targetCtxId] = [];
        groups[targetCtxId].push(item.transaction.id);
      }
      for (const [ctxId, txIds] of Object.entries(groups)) {
        await handleLinkTransactions(txIds, ctxId);
      }
      setFeedbackMessage(
        `Successfully linked ${suggestedLinks.length} transaction${
          suggestedLinks.length > 1 ? 's' : ''
        } to matching contexts!`
      );
      setTimeout(() => setFeedbackMessage(null), 4500);
    } catch (e) {
      console.error('Failed to link all transactions', e);
    } finally {
      setLinkingAll(false);
    }
  };

  const handleOpenCreate = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setEditingContext(null);
    setFormData({
      name: '',
      type: 'Trip',
      status: 'Active',
      budget: '',
      startDate: todayStr,
      endDate: todayStr,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenClone = (e: React.MouseEvent, ctx: FinancialContext) => {
    e.stopPropagation();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setEditingContext(null);
    setFormData({
      name: `${ctx.name} (Copy)`,
      type: ctx.type,
      status: 'Active',
      budget: ctx.budget || '',
      startDate: todayStr,
      endDate: todayStr,
      notes: ctx.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, ctx: FinancialContext) => {
    e.stopPropagation();
    const startStr = toDateKeyStr(ctx.startDate) || '';
    const endStr = toDateKeyStr(ctx.endDate) || '';
    const autoMeta = computeRealTimeContextStatus(startStr, endStr, ctx.status);
    setEditingContext(ctx);
    setFormData({
      name: ctx.name,
      type: ctx.type,
      status: autoMeta.status,
      budget: ctx.budget || '',
      startDate: startStr,
      endDate: endStr,
      notes: ctx.notes || '',
    });
    setIsModalOpen(true);
  };

  // Live preview of status inside the modal based on formData dates
  const modalAutoStatus = useMemo(
    () =>
      computeRealTimeContextStatus(
        formData.startDate,
        formData.endDate,
        (formData.status as FinancialContextStatus) || 'Planned'
      ),
    [formData.startDate, formData.endDate, formData.status]
  );

  const handleDateChange = (field: 'startDate' | 'endDate', val: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: val };
      if (field === 'startDate' && val && !next.endDate) {
        next.endDate = val;
      }
      const computed = computeRealTimeContextStatus(
        next.startDate,
        next.endDate,
        (next.status as FinancialContextStatus) || 'Planned'
      );
      return {
        ...next,
        status: computed.status,
      };
    });
  };

  const applyTemplate = (tpl: (typeof QUICK_TEMPLATES)[number]) => {
    const now = new Date();
    const start = addDays(now, tpl.daysOffsetStart);
    const end = addDays(start, Math.max(0, tpl.durationDays - 1));
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const computed = computeRealTimeContextStatus(startStr, endStr, 'Active');
    setFormData((prev) => ({
      ...prev,
      name: prev.name || tpl.defaultName,
      type: tpl.type,
      startDate: startStr,
      endDate: endStr,
      status: computed.status,
    }));
  };

  const applyDatePreset = (preset: 'today' | 'weekend' | '7days') => {
    const now = new Date();
    let start = now;
    let end = now;
    if (preset === 'weekend') {
      const day = now.getDay();
      const daysToSat = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
      start = addDays(now, daysToSat);
      end = addDays(start, 1);
    } else if (preset === '7days') {
      start = now;
      end = addDays(now, 6);
    }
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    const computed = computeRealTimeContextStatus(startStr, endStr, 'Active');
    setFormData((prev) => ({
      ...prev,
      startDate: startStr,
      endDate: endStr,
      status: computed.status,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveStatus = modalAutoStatus.isDateDriven
      ? modalAutoStatus.status
      : (formData.status as FinancialContextStatus) || 'Planned';

    const payload = {
      ...formData,
      status: effectiveStatus,
      budget: formData.budget || null,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
    };
    if (editingContext) {
      await handleUpdateContext(editingContext.id, payload);
    } else {
      await handleCreateContext(payload);
    }
    setIsModalOpen(false);
  };

  // Filtered contexts
  const filteredContexts = useMemo(() => {
    return enrichedContexts.filter((ctx) => {
      if (typeFilter !== 'ALL' && ctx.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && ctx.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ctx.name.toLowerCase().includes(q);
        const matchNotes = (ctx.notes || '').toLowerCase().includes(q);
        const matchType = ctx.type.toLowerCase().includes(q);
        if (!matchName && !matchNotes && !matchType) return false;
      }
      return true;
    });
  }, [enrichedContexts, typeFilter, statusFilter, searchQuery]);

  if (selectedContextId) {
    const ctx = enrichedContexts.find((c) => c.id === selectedContextId);
    if (!ctx) {
      setSelectedContextId(null);
      return null;
    }
    return (
      <ContextDetail
        context={ctx}
        transactions={transactions.filter((t) => t.contextId === ctx.id)}
        allTransactions={transactions}
        onBack={() => setSelectedContextId(null)}
        onEdit={(e) => handleOpenEdit(e, ctx)}
        onDelete={async () => {
          await handleDeleteContext(ctx.id);
          setSelectedContextId(null);
        }}
        onLinkTransactions={handleLinkTransactions}
      />
    );
  }

  const active = filteredContexts.filter((c) => c.status === 'Active');
  const planned = filteredContexts.filter((c) => c.status === 'Planned');
  const completed = filteredContexts.filter((c) => c.status === 'Completed');

  const ContextCard = ({ ctx }: { ctx: (typeof enrichedContexts)[number] }) => {
    const ctxTransactions = transactions.filter((t) => t.contextId === ctx.id);
    const expenses = ctxTransactions.filter((t) => t.type === 'Expense');
    const spent = expenses.reduce((sum, t) => sum + netExpenseOf(t), 0);
    const grossSpent = expenses.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const reimbursable = Math.max(0, grossSpent - spent);
    const refunds = ctxTransactions
      .filter((t) => t.type === 'Income')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const netSpent = Math.max(0, spent - refunds);
    const budgetNum = ctx.budget ? parseFloat(ctx.budget) || 0 : 0;
    const budgetPct = budgetNum > 0 ? Math.min(100, (netSpent / budgetNum) * 100) : 0;
    const isOverBudget = budgetNum > 0 && netSpent > budgetNum;

    // Daily burn velocity
    const divisorDays =
      ctx.status === 'Active'
        ? Math.max(1, ctx.timeline.elapsedDays)
        : Math.max(1, ctx.timeline.durationDays);
    const dailyBurn = netSpent / divisorDays;

    // Top category
    const catTotals: Record<string, number> = {};
    expenses.forEach((t) => {
      const c = t.category || 'Other';
      catTotals[c] = (catTotals[c] || 0) + netExpenseOf(t);
    });
    const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    const startStr = toDateKeyStr(ctx.startDate);
    const endStr = toDateKeyStr(ctx.endDate);

    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-md group relative overflow-hidden ${
          ctx.status === 'Active'
            ? 'border-emerald-300/80 dark:border-emerald-800/70 ring-1 ring-emerald-500/20'
            : ''
        }`}
        onClick={() => setSelectedContextId(ctx.id)}
      >
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-start space-x-3.5 min-w-0">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  ctx.type === 'Trip'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : ctx.type === 'Work / Mission'
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    : ctx.type === 'Project'
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    : ctx.type === 'Life Event'
                    ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {contextTypeIcons[ctx.type] || <Tag className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">
                    {ctx.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      ctx.status === 'Active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300'
                        : ctx.status === 'Planned'
                        ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300'
                        : 'bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                    }`}
                    title={ctx.statusReason}
                  >
                    {ctx.status === 'Active' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    {ctx.isDateDriven ? `⚡ ${ctx.status}` : ctx.status}
                  </span>
                </div>

                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1 gap-1.5 flex-wrap">
                  <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {startStr ? format(new Date(`${startStr}T12:00:00`), 'MMM d, yyyy') : 'No start date'}
                    {endStr && endStr !== startStr
                      ? ` → ${format(new Date(`${endStr}T12:00:00`), 'MMM d, yyyy')}`
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title="Duplicate / Clone Context"
                onClick={(e) => handleOpenClone(e, ctx)}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                title="Edit Context"
                onClick={(e) => handleOpenEdit(e, ctx)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Live Timeline / Countdown Pill */}
          <div className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              {ctx.timeline.badgeText}
            </span>
            <span className="font-mono text-gray-500 dark:text-gray-400 shrink-0">
              {ctxTransactions.length} {ctxTransactions.length === 1 ? 'tx' : 'txs'}
            </span>
          </div>

          {/* Spend & Budget Section */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Net Context Spend</p>
                <p className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  {netSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  <span className="text-xs font-normal text-gray-500">MAD</span>
                </p>
              </div>
              {budgetNum > 0 ? (
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Budget Cap</p>
                  <p
                    className={`text-xs font-mono font-semibold tabular-nums ${
                      isOverBudget
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {budgetNum.toLocaleString()} MAD ({((netSpent / budgetNum) * 100).toFixed(0)}%)
                  </p>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg Burn</p>
                  <p className="text-xs font-mono font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                    {dailyBurn.toFixed(0)} MAD/day
                  </p>
                </div>
              )}
            </div>

            {budgetNum > 0 && (
              <div className="space-y-1">
                <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : budgetPct >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-gray-500 dark:text-gray-400">
                  <span>{dailyBurn.toFixed(0)} MAD/day avg</span>
                  <span
                    className={
                      isOverBudget
                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                        : 'text-emerald-600 dark:text-emerald-400 font-medium'
                    }
                  >
                    {isOverBudget
                      ? `Over by ${(netSpent - budgetNum).toFixed(0)} MAD`
                      : `${(budgetNum - netSpent).toFixed(0)} MAD remaining`}
                  </span>
                </div>
              </div>
            )}

            {/* Bottom telemetry chips */}
            {(topCategory || reimbursable > 0 || refunds > 0) && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {topCategory && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 truncate max-w-[180px]">
                    Top: {topCategory[0]} ({topCategory[1].toFixed(0)} MAD)
                  </span>
                )}
                {reimbursable > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-mono">
                    +{reimbursable.toFixed(0)} MAD split owed
                  </span>
                )}
                {refunds > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-mono">
                    +{refunds.toFixed(0)} MAD refunded
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Financial Contexts
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              <Zap className="w-3 h-3" /> Real-Time Date Sync
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track trips, work missions, projects, and life events — statuses automatically transition between{' '}
            <strong>Planned</strong>, <strong>Active</strong>, and <strong>Completed</strong> based on live dates.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> New Context
        </Button>
      </div>

      {/* Executive KPI Strip */}
      {enrichedContexts.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Live Context Status</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {globalStats.activeCount} Active
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {globalStats.plannedCount} Planned · {globalStats.completedCount} Completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Total Net Context Spend</span>
                <TrendingUp className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {globalStats.totalNetSpent.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-normal text-gray-500">MAD</span>
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono">
                Gross: {globalStats.totalGrossSpent.toFixed(0)} MAD
                {globalStats.totalReimbursable > 0
                  ? ` (−${globalStats.totalReimbursable.toFixed(0)} split)`
                  : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Allocated Context Budgets</span>
                <Wallet className="w-4 h-4 text-amber-500" />
              </div>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {globalStats.totalBudgeted > 0
                  ? `${globalStats.totalBudgeted.toLocaleString()} MAD`
                  : 'No Cap Set'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {globalStats.totalBudgeted > 0
                  ? `${((globalStats.totalNetSpent / globalStats.totalBudgeted) * 100).toFixed(1)}% utilized across contexts`
                  : 'Add budgets to track trip/project caps'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Tagged Transactions</span>
                <Receipt className="w-4 h-4 text-blue-500" />
              </div>
              <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {globalStats.linkedTxCount} Linked
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {suggestedLinks.length > 0
                  ? `${suggestedLinks.length} unlinked date matches ready`
                  : 'All matching dates linked'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filter Bar */}
      {enrichedContexts.length > 0 && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contexts by name, type, or notes..."
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-100/70 dark:bg-gray-800/70 text-xs">
              {(['ALL', 'Active', 'Planned', 'Completed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'ALL' ? 'All Status' : st}
                </button>
              ))}
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs h-8 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              <option value="ALL">All Types</option>
              <option value="Trip">Trip</option>
              <option value="Work / Mission">Work / Mission</option>
              <option value="Project">Project</option>
              <option value="Life Event">Life Event</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      )}

      {feedbackMessage && (
        <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium">{feedbackMessage}</span>
        </div>
      )}

      {/* Smart Unlinked Date/Keyword Suggestions Banner */}
      {suggestedLinks.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-blue-100/80 dark:border-blue-900/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base sm:text-lg text-blue-950 dark:text-blue-100 font-bold">
                      Smart Context Link Suggestions
                    </CardTitle>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                      {suggestedLinks.length} unlinked{' '}
                      {suggestedLinks.length === 1 ? 'transaction' : 'transactions'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-700/90 dark:text-blue-300 mt-0.5">
                    Detected transactions matching the active dates or notes of your contexts. Link them in one click.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-medium"
                  disabled={linkingAll || Boolean(linkingId)}
                  onClick={handleLinkAll}
                >
                  <Link2 className="w-4 h-4 mr-1.5" />
                  {linkingAll ? 'Linking All...' : `Link All (${suggestedLinks.length})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 space-y-2 max-h-80 overflow-y-auto">
            {suggestedLinks.map(({ transaction: tx, suggestedContext, allMatchingContexts }) => {
              const activeTargetId = selectedContextForTx[tx.id] || suggestedContext.id;
              const activeTargetCtx =
                enrichedContexts.find((c) => c.id === activeTargetId) || suggestedContext;
              const isThisLinking = linkingId === tx.id || linkingAll;

              return (
                <div
                  key={tx.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-900/40 shadow-xs hover:shadow-sm transition-all gap-3"
                >
                  <div className="flex items-start sm:items-center space-x-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        tx.type === 'Expense'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                          {tx.notes || tx.category || tx.type}
                        </span>
                        {tx.notes && tx.category && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {tx.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{format(new Date(tx.createdAt), 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span
                          className={`font-semibold font-mono ${
                            tx.type === 'Expense'
                              ? 'text-gray-900 dark:text-gray-100'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tx.type === 'Expense' ? '-' : '+'}
                          {parseFloat(tx.amount).toFixed(2)} MAD
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Context:</span>
                      {allMatchingContexts.length === 1 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
                          {activeTargetCtx.name}
                        </span>
                      ) : (
                        <select
                          value={activeTargetId}
                          onChange={(e) =>
                            setSelectedContextForTx({
                              ...selectedContextForTx,
                              [tx.id]: e.target.value,
                            })
                          }
                          className="text-xs h-8 py-1 px-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                          {allMatchingContexts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.status})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isThisLinking}
                        onClick={() =>
                          handleLinkSingle(
                            tx.id,
                            activeTargetCtx.id,
                            tx.notes || tx.category || tx.type,
                            activeTargetCtx.name
                          )
                        }
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1" />
                        {linkingId === tx.id ? 'Linking...' : `Link to ${activeTargetCtx.name}`}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isThisLinking}
                        onClick={() => handleDismiss(tx.id)}
                        className="text-xs h-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        title="Dismiss suggestion for this transaction"
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Active Contexts */}
      {active.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Active Now ({active.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((c) => (
              <ContextCard key={c.id} ctx={c} />
            ))}
          </div>
        </section>
      )}

      {/* Planned Contexts */}
      {planned.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h3 className="text-base font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Planned / Upcoming ({planned.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planned.map((c) => (
              <ContextCard key={c.id} ctx={c} />
            ))}
          </div>
        </section>
      )}

      {/* Completed Contexts */}
      {completed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            <h3 className="text-base font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Completed Archive ({completed.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completed.map((c) => (
              <ContextCard key={c.id} ctx={c} />
            ))}
          </div>
        </section>
      )}

      {enrichedContexts.length === 0 && (
        <Card className="border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <MapIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Financial Contexts Yet</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6 text-sm">
              Create a financial context to track expenses for a trip, work mission, home project, or life event. Statuses automatically update based on your dates.
            </p>
            <Button onClick={handleOpenCreate}>Create Your First Context</Button>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingContext ? 'Edit Financial Context' : 'Create Financial Context'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Status automatically adjusts to Planned, Active, or Completed from your dates.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Quick Starter Templates (only when creating) */}
              {!editingContext && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Quick Templates
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 text-gray-700 dark:text-gray-200 transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Context Name</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Today's Trip, Marrakech Getaway, Office Mission"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  >
                    <option value="Trip">Trip</option>
                    <option value="Work / Mission">Work / Mission</option>
                    <option value="Project">Project</option>
                    <option value="Life Event">Life Event</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center justify-between">
                    <span>Status</span>
                    {modalAutoStatus.isDateDriven && (
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                        ⚡ Auto-Synced
                      </span>
                    )}
                  </label>
                  <Select
                    value={modalAutoStatus.isDateDriven ? modalAutoStatus.status : formData.status}
                    disabled={modalAutoStatus.isDateDriven}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <option value="Planned">Planned (Before Start)</option>
                    <option value="Active">Active (Ongoing Today)</option>
                    <option value="Completed">Completed (Past End Date)</option>
                  </Select>
                </div>
              </div>

              {/* Date Range with Quick Date Presets */}
              <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Timeline Dates
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyDatePreset('today')}
                      className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-400"
                    >
                      Today (1-Day)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('weekend')}
                      className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-400"
                    >
                      Weekend
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('7days')}
                      className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-indigo-400"
                    >
                      7 Days
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleDateChange('startDate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleDateChange('endDate', e.target.value)}
                    />
                  </div>
                </div>

                {modalAutoStatus.isDateDriven && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 pt-1">
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Auto-Status: <strong>{modalAutoStatus.status}</strong> — {modalAutoStatus.reason}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Target Budget Cap (MAD · Optional)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  placeholder="e.g. 500.00"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes / Objectives (Optional)</label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Destination details, companions, or reimbursement rules..."
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-gray-100 dark:border-gray-800">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingContext ? 'Save Changes' : 'Create Context'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
