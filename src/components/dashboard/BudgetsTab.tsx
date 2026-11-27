import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { CategoryBudget, Payroll, Transaction, Debt, Goal, Subscription, DashboardTab, InvestmentsData, FinancialContext } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { SpexAvatar } from '../common/SpexAvatar';
import { TemplatesGallery } from '../onboarding/TemplatesGallery';
import { expenseCategories, normalizeCategory } from '../../lib/categories';
import {
  budgetFor,
  getBudgetStatus,
  getCategorySpending,
  getSpendingPace,
  monthLabel,
  getExpensesForMonth,
  netExpenseOf,
  amountOf,
  isInMonth,
  computeFourPillarBreakdown,
  buildChronologicalPeriodPatternSummary,
  getCategoryPillar,
  getProjectContextIds,
  parseProjectPlannedItems,
  isSavingsRetentionCategory,
  isWealthAllocationCategory,
  isInvestmentCategory,
  SPENT_ON_MYSELF_CATEGORIES,
  SPENT_ON_OBLIGATIONS_CATEGORIES,
  type FinancialPillar,
  type FourPillarBreakdown,
} from '../../lib/finance';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  BarChart3,
  Pencil,
  X,
  Check,
  LayoutGrid,
  PieChart,
  Layers,
  Sparkles,
  Zap,
  PiggyBank,
  ArrowRight,
  WalletCards,
  Shield,
  CreditCard,
  ExternalLink,
  Landmark,
  UserCheck,
  MessageSquarePlus,
  RefreshCw,
  CalendarRange,
  ChevronDown,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedMetricValue, AnimatedProgressBar, MotionModal } from '../ui/MotionPrimitives';

type FixedPlanKey = 'balanced' | 'savings_first' | 'essentials';
type PlanKey = 'spex_ai' | FixedPlanKey;

const BUDGET_PLANS: Record<FixedPlanKey, { name: string; description: string; rules: Record<string, number> }> = {
  balanced: {
    name: '50/30/20 — Balanced',
    description: '50% Needs • 30% Wants • 20% Savings & Investments. Classic, widely recommended rule.',
    rules: {
      '🏢 Housing & Utilities': 25,
      '🛒 Groceries': 12,
      '🚗 Transportation': 5,
      '🩺 Health & Medical': 4,
      '📱 Telecom & Subscriptions': 3,
      '🛡️ Insurance / Annual Costs': 3,
      '🏠 Household & Family': 3,
      '🍔 Dining & Takeaway': 5,
      '👕 Personal & Clothing': 4,
      '🎬 Entertainment': 3,
      '👥 Social': 3,
      '☕ Coffee & Quick Food': 3,
      '🛠️ Home, Tech & Equipment': 2,
      '⚠️ Unexpected': 3,
      '🛟 Emergency & goals Fund': 10,
      '📈 Investments': 7,
      '💳 Debt & Obligations': 5,
    },
  },
  savings_first: {
    name: '60/20/20 — Savings First',
    description: '60% Needs • 20% Wants • 20% Savings & Investments. Great if you want to grow wealth aggressively.',
    rules: {
      '🏢 Housing & Utilities': 28,
      '🛒 Groceries': 14,
      '🚗 Transportation': 6,
      '🩺 Health & Medical': 5,
      '📱 Telecom & Subscriptions': 4,
      '🛡️ Insurance / Annual Costs': 3,
      '🏠 Household & Family': 4,
      '🍔 Dining & Takeaway': 4,
      '👕 Personal & Clothing': 4,
      '🎬 Entertainment': 2,
      '👥 Social': 2,
      '☕ Coffee & Quick Food': 2,
      '🛠️ Home, Tech & Equipment': 2,
      '⚠️ Unexpected': 3,
      '🛟 Emergency & goals Fund': 12,
      '📈 Investments': 8,
      '💳 Debt & Obligations': 5,
    },
  },
  essentials: {
    name: '70/20/10 — Essentials Mode',
    description: '70% Needs • 20% Wants • 10% Savings. For tight months when essentials come first.',
    rules: {
      '🏢 Housing & Utilities': 30,
      '🛒 Groceries': 15,
      '🚗 Transportation': 8,
      '🩺 Health & Medical': 6,
      '📱 Telecom & Subscriptions': 4,
      '🛡️ Insurance / Annual Costs': 4,
      '🏠 Household & Family': 4,
      '🍔 Dining & Takeaway': 4,
      '👕 Personal & Clothing': 4,
      '🎬 Entertainment': 2,
      '👥 Social': 2,
      '☕ Coffee & Quick Food': 2,
      '🛠️ Home, Tech & Equipment': 2,
      '⚠️ Unexpected': 3,
      '🛟 Emergency & goals Fund': 5,
      '📈 Investments': 3,
      '💳 Debt & Obligations': 2,
    },
  },
};

interface BudgetsTabProps {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  payrolls: Payroll[];
  debts?: Debt[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  contexts?: FinancialContext[];
  wallets?: Array<{ id: string; name: string; type?: string; balance?: number }>;
  investmentsData?: InvestmentsData | null;
  onSaveBudget: (category: string, year: number, month: number, amount: number) => Promise<void>;
  onSaveBudgetsBatch: (budgets: { category: string; year: number; month: number; amount: number }[]) => Promise<void>;
  onCopyPrevious: (year: number, month: number) => Promise<number>;
  onClearMonth: (year: number, month: number) => Promise<number>;
  onDeleteBudget: (id: string) => Promise<void>;
  onContributeGoal?: (goalId: string, payload: { amount: number; walletId?: string; note?: string; date?: string }) => Promise<any>;
  onFundInvestmentWallet?: (payload: { sourceWalletId?: string; destinationWalletId?: string; amountMad: number; notes?: string }) => Promise<any>;
  setActiveTab?: (tab: DashboardTab) => void;
}

type BudgetModel = 'category' | '503020' | 'envelope';
type PillarFilter = 'all' | 'obligations' | 'myself' | 'wealth';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  '🏠 Household & Family': '#f43f5e',
  '🏢 Housing & Utilities': '#6366f1',
  '🛒 Groceries': '#22c55e',
  '🍔 Dining & Takeaway': '#f97316',
  '☕ Coffee & Quick Food': '#a78bfa',
  '🚗 Transportation': '#3b82f6',
  '👕 Personal & Clothing': '#eab308',
  '📱 Telecom & Subscriptions': '#06b6d4',
  '🎬 Entertainment': '#8b5cf6',
  '👥 Social': '#14b8a6',
  '🩺 Health & Medical': '#ec4899',
  '🛡️ Insurance / Annual Costs': '#64748b',
  '💳 Debt & Obligations': '#ef4444',
  '⚠️ Unexpected': '#f59e0b',
  '🛟 Emergency & goals Fund': '#10b981',
  '📈 Investments': '#3b82f6',
  '🛠️ Home, Tech & Equipment': '#0ea5e9',
  '📦 Others': '#94a3b8',
};

const DEFAULT_COLOR = '#6b7280';

const categoryColor = (cat: string) => CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;

const statusConfig = {
  normal: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', icon: CheckCircle2, label: 'On Track' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', icon: AlertTriangle, label: 'Warning' },
  over_budget: { bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', icon: TrendingUp, label: 'Over Budget' },
  critical: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500', icon: AlertTriangle, label: 'Critical' },
  not_set: { bar: 'bg-gray-300 dark:bg-gray-700', text: 'text-gray-500 dark:text-gray-400', dot: 'bg-gray-400', icon: Target, label: 'No Budget' },
};

const PILLAR_META: Record<FinancialPillar, { label: string; shortLabel: string; dotClass: string; textClass: string }> = {
  obligations: {
    label: 'Obligation & Need',
    shortLabel: 'Obligation',
    dotClass: 'bg-indigo-500',
    textClass: 'text-indigo-700 dark:text-indigo-400',
  },
  myself: {
    label: 'Spent on Myself',
    shortLabel: 'Myself',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  investments: {
    label: 'Wealth Investment',
    shortLabel: 'Investment',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-700 dark:text-blue-400',
  },
  savings: {
    label: 'Bank Retention & Savings',
    shortLabel: 'Bank Retention',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  },
};

function computeBudgetHealthScore(categories: { label?: string; spent: number; amount: number | undefined }[]): number {
  const withBudget = categories.filter((c) => c.amount !== undefined && c.amount > 0);
  if (!withBudget.length) return 0;
  const totalScore = withBudget.reduce((sum, c) => {
    const pct = (c.spent / c.amount!) * 100;
    if (c.label && isWealthAllocationCategory(c.label)) {
      // For Savings & Investments, meeting or exceeding the target is a 100 score!
      const wealthScore = pct >= 95 ? 100 : pct >= 75 ? 85 : pct >= 50 ? 65 : 35;
      return sum + wealthScore;
    }
    const score = pct >= 120 ? 0 : pct >= 100 ? 20 : pct >= 80 ? 60 : pct >= 60 ? 85 : 100;
    return sum + score;
  }, 0);
  return Math.round(totalScore / withBudget.length);
}

function gradeFromScore(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'A', color: 'text-emerald-600' };
  if (score >= 75) return { grade: 'B', color: 'text-blue-600' };
  if (score >= 60) return { grade: 'C', color: 'text-amber-600' };
  if (score >= 40) return { grade: 'D', color: 'text-orange-600' };
  return { grade: 'F', color: 'text-red-600' };
}

export function predictDaysToOverspend(
  spent: number,
  budget: number,
  year: number,
  month: number,
  pace?: { elapsedDays: number; daysInMonth: number } | null
): number | null {
  const now = new Date();
  const hasFinancialBounds = Boolean(pace && pace.daysInMonth > 0 && pace.elapsedDays > 0);
  const daysInPeriod = hasFinancialBounds
    ? pace!.daysInMonth
    : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const elapsed = hasFinancialBounds ? pace!.elapsedDays : now.getUTCDate();
  if (elapsed <= 0 || spent <= 0) return null;
  const dailyRate = spent / elapsed;
  if (dailyRate <= 0) return null;
  const remaining = budget - spent;
  if (remaining <= 0) return 0;
  const daysLeft = Math.floor(remaining / dailyRate);
  return daysLeft > Math.max(0, daysInPeriod - elapsed) ? null : daysLeft;
}

// ─── Mini Donut SVG ───────────────────────────────────────────────────────────
function DonutChart({ categories }: { categories: { label: string; value: number; color: string }[] }) {
  const total = categories.reduce((s, c) => s + c.value, 0);
  if (total === 0) return <div className="flex h-32 items-center justify-center text-sm text-gray-400">No spending data</div>;

  const size = 120;
  const r = 48;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const slices = categories
    .filter((c) => c.value > 0)
    .map((c) => {
      const pct = c.value / total;
      const dash = pct * circumference;
      const gap = circumference - dash;
      const slice = { ...c, dash, gap, offset };
      offset += dash;
      return slice;
    });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-32 w-32 -rotate-90">
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={20}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset}
          className="transition-all duration-500"
        />
      ))}
    </svg>
  );
}

// ─── Category Budget Card ─────────────────────────────────────────────────────
interface BudgetCardProps {
  category: string;
  budget: CategoryBudget | undefined;
  spent: number;
  year: number;
  month: number;
  payrolls: Payroll[];
  onSave: (amount: number) => Promise<void>;
  onDelete: (() => Promise<void>) | undefined;
  isCurrentMonth: boolean;
  retentionMeta?: {
    isSavingsRetention: boolean;
    isInvestmentTarget: boolean;
    protectedBankRetention: number;
    liveRetainedInBank: number;
    explicitTxAmount: number;
  };
}

function BudgetCard({
  category,
  budget,
  spent,
  year,
  month,
  payrolls,
  onSave,
  onDelete,
  isCurrentMonth,
  retentionMeta,
}: BudgetCardProps) {
  const amount = budget ? parseFloat(budget.amount) : undefined;
  const isWealth = isWealthAllocationCategory(category);
  const isSavings = isSavingsRetentionCategory(category);
  const pillar = getCategoryPillar(category);
  const pillarMeta = PILLAR_META[pillar];

  const status = getBudgetStatus(amount, spent, category);
  const statusCfg = statusConfig[status.status];
  const StatusIcon = statusCfg.icon;
  const pace = !isWealth && amount !== undefined ? getSpendingPace(spent, amount, year, month, payrolls) : null;
  const daysWarning =
    !isWealth && amount !== undefined && isCurrentMonth
      ? predictDaysToOverspend(spent, amount, year, month, pace)
      : null;
  const color = categoryColor(category);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budget?.amount ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(draft);
    if (!Number.isFinite(val) || val < 0) return;
    setSaving(true);
    try {
      await onSave(val);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      <div className="space-y-3">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug truncate">
                {category}
              </h4>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 pl-4">
              {pillarMeta.label}
            </p>
          </div>
          <div className={`inline-flex items-center gap-1 text-xs font-semibold font-mono tabular-nums shrink-0 ${statusCfg.text}`}>
            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
            <span>
              {status.status === 'not_set'
                ? isWealth
                  ? 'No target'
                  : 'No cap'
                : isWealth && status.usagePercentage >= 100
                ? `${status.usagePercentage.toFixed(0)}% Met`
                : `${status.usagePercentage.toFixed(0)}%`}
            </span>
          </div>
        </div>

        {/* Spent / Budget display */}
        {amount !== undefined ? (
          <div className="space-y-2.5">
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-1.5 font-mono tabular-nums">
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400 ml-1">
                    MAD {isSavings ? 'retained' : isWealth ? 'invested' : 'spent'}
                  </span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  / {amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${statusCfg.bar}`}
                  style={{ width: `${Math.min(100, status.usagePercentage)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              {isWealth ? (
                <span className={`font-medium font-mono tabular-nums ${status.remaining <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {status.remaining <= 0
                    ? Math.abs(status.remaining) > 0.5
                      ? `+${Math.abs(status.remaining).toFixed(0)} MAD above target`
                      : 'Target protected'
                    : `${status.remaining.toFixed(0)} MAD to target`}
                </span>
              ) : (
                <span className={`font-medium font-mono tabular-nums ${status.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {status.remaining < 0
                    ? `${Math.abs(status.remaining).toFixed(0)} MAD over`
                    : `${status.remaining.toFixed(0)} MAD left`}
                </span>
              )}

              {pace && (
                <span className={`text-[11px] font-mono tabular-nums ${pace.difference > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {Math.abs(pace.difference).toFixed(0)} MAD {pace.difference > 0 ? 'ahead' : 'under pace'}
                </span>
              )}
            </div>

            {/* Bank-as-Savings Retention Breakdown for 🛟 Emergency & goals Fund */}
            {isSavings && retentionMeta && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Live Unspent in Bank</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                    {retentionMeta.liveRetainedInBank.toFixed(0)} MAD
                  </span>
                </div>
                {isCurrentMonth && (
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>Min left if all caps spent</span>
                    <span className={`font-mono tabular-nums ${amount !== undefined && retentionMeta.protectedBankRetention < amount ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}`}>
                      {retentionMeta.protectedBankRetention.toFixed(0)} MAD
                    </span>
                  </div>
                )}
                {retentionMeta.explicitTxAmount > 0 && (
                  <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                    <span>Savings Transfers</span>
                    <span className="font-mono tabular-nums">+{retentionMeta.explicitTxAmount.toFixed(0)} MAD</span>
                  </div>
                )}
              </div>
            )}

            {/* Adaptive daily category limit & overspend warning */}
            {!isWealth && amount !== undefined && isCurrentMonth && pace && pace.daysInMonth > 0 && (
              (() => {
                const daysLeft = Math.max(1, pace.daysInMonth - pace.elapsedDays);
                const remaining = Math.max(0, amount - spent);
                const dailyLimit = remaining / daysLeft;
                return (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-gray-500 dark:text-gray-400">
                      Safe pace ({daysLeft}d left)
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-gray-800 dark:text-gray-200">
                      {dailyLimit.toFixed(0)} MAD/day
                    </span>
                  </div>
                );
              })()
            )}
            {daysWarning !== null && daysWarning <= 5 && (
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                At this pace, cap exceeded in ~{daysWarning}d
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 py-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
              {isSavings
                ? `${spent.toFixed(0)} MAD retained in bank · No target set`
                : spent > 0
                ? `${spent.toFixed(0)} MAD ${isWealth ? 'invested' : 'spent'} · No cap set`
                : 'No spending or cap yet.'}
            </p>
            {isSavings && retentionMeta && retentionMeta.liveRetainedInBank > 0 && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                Live unspent in bank: {retentionMeta.liveRetainedInBank.toFixed(0)} MAD
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit / Delete row */}
      <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
        {editing ? (
          <div className="flex gap-1.5">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder="Amount MAD"
              autoFocus
            />
            <Button type="button" size="icon" className="h-8 w-8 shrink-0" disabled={saving} onClick={handleSave}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              onClick={() => { setDraft(budget?.amount ?? ''); setEditing(true); }}
            >
              <Pencil className="mr-1.5 h-3 w-3" />
              {budget ? (isWealth ? 'Edit target' : 'Edit cap') : isWealth ? 'Set target' : 'Set cap'}
            </Button>
            {budget && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                disabled={deleting}
                onClick={handleDelete}
                aria-label={`Delete budget for ${category}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 50/30/20 Rule View (Retention-Aware) ─────────────────────────────────────
const NEEDS_CATEGORIES = [...SPENT_ON_OBLIGATIONS_CATEGORIES];
const WANTS_CATEGORIES = [...SPENT_ON_MYSELF_CATEGORIES];
const SAVINGS_CATEGORIES = [
  '🛟 Emergency & goals Fund',
  '📈 Investments',
];

function Rule503020View({
  budgets,
  totalBudget,
  year,
  month,
  fourPillar,
}: {
  budgets: CategoryBudget[];
  totalBudget: number;
  year: number;
  month: number;
  fourPillar: FourPillarBreakdown;
}) {
  const [needsPct, setNeedsPct] = useState(50);
  const [wantsPct, setWantsPct] = useState(30);
  const [savingsPct, setSavingsPct] = useState(20);

  const baseAmount = fourPillar.periodIncome > 0 ? fourPillar.periodIncome : totalBudget;

  const calculateFromBudgets = () => {
    if (totalBudget === 0) return;
    const getGroupBudget = (cats: string[]) =>
      budgets
        .filter((b) => b.year === year && b.month === month && cats.map(normalizeCategory).includes(normalizeCategory(b.category)))
        .reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const nB = getGroupBudget(NEEDS_CATEGORIES);
    const wB = getGroupBudget(WANTS_CATEGORIES);
    const sB = getGroupBudget(SAVINGS_CATEGORIES);

    setNeedsPct(Math.round((nB / totalBudget) * 100));
    setWantsPct(Math.round((wB / totalBudget) * 100));
    setSavingsPct(Math.round((sB / totalBudget) * 100));
  };

  const groups = [
    {
      label: 'Obligations & Needs',
      pct: needsPct,
      setPct: setNeedsPct,
      categories: NEEDS_CATEGORIES,
      color: '#6366f1',
      spent: fourPillar.spentOnObligations,
      isWealth: false,
      subNote: `Housing, Groceries, Transport, Family & Debt (${fourPillar.obligationsPctOfIncome.toFixed(1)}% of income)`,
    },
    {
      label: 'Spent on Myself (Wants)',
      pct: wantsPct,
      setPct: setWantsPct,
      categories: WANTS_CATEGORIES,
      color: '#f97316',
      spent: fourPillar.spentOnMyself,
      isWealth: false,
      subNote: `Dining, Coffee, Clothing, Social & Others (${fourPillar.myselfPctOfIncome.toFixed(1)}% of income)`,
    },
    {
      label: 'Retained in Bank & Invested',
      pct: savingsPct,
      setPct: setSavingsPct,
      categories: SAVINGS_CATEGORIES,
      color: '#10b981',
      spent: fourPillar.totalActualRetainedAndSaved + fourPillar.investedAmount,
      isWealth: true,
      subNote: `Kept in Bank: ${fourPillar.totalActualRetainedAndSaved.toFixed(0)} MAD + Invested: ${fourPillar.investedAmount.toFixed(0)} MAD`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Splits monthly income (<span className="font-mono tabular-nums font-medium text-gray-800 dark:text-gray-200">{baseAmount.toFixed(0)} MAD</span>) across Obligations, Spent on Myself, and Bank-Retained Savings &amp; Investments.
        </p>
        <Button variant="outline" size="sm" onClick={calculateFromBudgets} className="whitespace-nowrap shrink-0">
          <Target className="mr-2 h-4 w-4" /> Sync % from Budgets
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => {
          const target = baseAmount > 0 ? (g.pct / 100) * baseAmount : 0;
          const pct = target > 0 ? Math.min(100, (g.spent / target) * 100) : 0;
          const over = g.spent > target && target > 0;
          return (
            <div key={g.label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{g.label}</h4>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    type="number"
                    value={g.pct}
                    onChange={(e) => g.setPct(Number(e.target.value) || 0)}
                    className="w-14 h-7 text-xs text-right font-mono p-1"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums font-mono text-gray-900 dark:text-gray-100">
                  {g.spent.toFixed(0)} <span className="text-xs font-normal text-gray-500">MAD</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{g.subNote}</p>
              </div>
              {target > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    <span>Target ({g.pct}%)</span>
                    <span>{target.toFixed(0)} MAD</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                </div>
              )}
              {g.isWealth ? (
                over ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium font-mono tabular-nums">
                    +{(g.spent - target).toFixed(0)} MAD above target
                  </p>
                ) : (
                  target > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium font-mono tabular-nums">
                      {(target - g.spent).toFixed(0)} MAD more needed to hit target
                    </p>
                  )
                )
              ) : (
                over && <p className="text-xs text-red-600 dark:text-red-400 font-medium font-mono tabular-nums">{(g.spent - target).toFixed(0)} MAD over limit</p>
              )}
              <ul className="border-t border-gray-100 dark:border-gray-800 pt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                {g.categories.slice(0, 4).map((c) => (
                  <li key={c} className="truncate">{c}</li>
                ))}
                {g.categories.length > 4 && <li>+{g.categories.length - 4} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Envelope View (Retention-Aware) ──────────────────────────────────────────
function EnvelopeView({
  budgets,
  transactions,
  year,
  month,
  payrolls,
  wallets,
  fourPillar,
  excludeContextIds,
  onDelete,
}: {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  year: number;
  month: number;
  payrolls: Payroll[];
  wallets?: Array<{ id: string; type?: string }>;
  fourPillar: FourPillarBreakdown;
  excludeContextIds?: Set<string> | string[];
  onSave: (cat: string, amount: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const livingBudgets = monthBudgets.filter((b) => !isWealthAllocationCategory(b.category));
  const wealthBudgets = monthBudgets.filter((b) => isWealthAllocationCategory(b.category));

  const totalLivingEnvelope = livingBudgets.reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalLivingSpent = fourPillar.totalLivingSpent;
  const totalLivingLeft = totalLivingEnvelope - totalLivingSpent;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-3.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Living Envelopes</p>
          <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-0.5">{totalLivingEnvelope.toFixed(0)} MAD</p>
        </div>
        <div className="p-3.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Living Spent</p>
          <p className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">{totalLivingSpent.toFixed(0)} MAD</p>
        </div>
        <div className="p-3.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Envelope Remaining</p>
          <p className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${totalLivingLeft < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalLivingLeft.toFixed(0)} MAD</p>
        </div>
        <div className="p-3.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Retained &amp; Invested</p>
          <p className="text-lg font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
            {(fourPillar.totalActualRetainedAndSaved + fourPillar.investedAmount).toFixed(0)} MAD
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {monthBudgets.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No envelopes for this month. Use the form above to set category budgets.</p>
        )}
        {livingBudgets.map((b) => {
          const spent = getCategorySpending(transactions, b.category, year, month, payrolls, wallets, excludeContextIds);
          const amount = parseFloat(b.amount);
          const left = amount - spent;
          const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
          const color = categoryColor(b.category);
          const pillar = getCategoryPillar(b.category);
          return (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.category}</p>
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                      {PILLAR_META[pillar].shortLabel}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 tabular-nums font-mono ${left < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {left < 0 ? '-' : ''}{Math.abs(left).toFixed(0)} MAD left
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums shrink-0">
                    {spent.toFixed(0)} / {amount.toFixed(0)} MAD
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => onDelete(b.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}

        {wealthBudgets.length > 0 && (
          <>
            <div className="bg-gray-50/80 dark:bg-gray-800/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Wealth Retention &amp; Investment Targets
            </div>
            {wealthBudgets.map((b) => {
              const isSavings = isSavingsRetentionCategory(b.category);
              const allocated = isSavings
                ? fourPillar.totalActualRetainedAndSaved
                : getCategorySpending(transactions, b.category, year, month, payrolls, wallets, excludeContextIds);
              const amount = parseFloat(b.amount);
              const pct = amount > 0 ? Math.min(100, (allocated / amount) * 100) : 0;
              const color = categoryColor(b.category);
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.category}</p>
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
                          {isSavings ? 'Auto-Retained' : 'Invested'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold shrink-0 tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
                        {allocated >= amount ? `Target Met (${allocated.toFixed(0)} MAD)` : `${(amount - allocated).toFixed(0)} MAD to target`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums shrink-0">
                        {allocated.toFixed(0)} / {amount.toFixed(0)} MAD
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => onDelete(b.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

import { getCurrentFinancialMonth } from '../../lib/financialMonth';

// ─── Main Component ───────────────────────────────────────────────────────────
export const BudgetsTab: React.FC<BudgetsTabProps> = ({
  budgets,
  transactions,
  payrolls,
  debts = [],
  goals = [],
  subscriptions = [],
  contexts = [],
  wallets = [],
  investmentsData = null,
  onSaveBudget,
  onSaveBudgetsBatch,
  onCopyPrevious,
  onClearMonth,
  onDeleteBudget,
  onContributeGoal,
  onFundInvestmentWallet,
  setActiveTab,
}) => {
  const { token, user } = useAuth();
  const [monthRef, setMonthRef] = useState(() => getCurrentFinancialMonth(payrolls) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [budgetModel, setBudgetModel] = useState<BudgetModel>('category');
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [excludeProjectSpend, setExcludeProjectSpend] = useState<boolean>(true);
  const [newCategory, setNewCategory] = useState<string>(expenseCategories[0]);
  const [newAmount, setNewAmount] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [autoBudgetOpen, setAutoBudgetOpen] = useState(false);
  const [autoBudgetLoading, setAutoBudgetLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const isAdvanced = user?.experienceTier === 'advanced';
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(isAdvanced ? 'spex_ai' : 'balanced');
  const [spexUserNotes, setSpexUserNotes] = useState('');
  const [spexGenerating, setSpexGenerating] = useState(false);
  const [spexPlanResult, setSpexPlanResult] = useState<Awaited<ReturnType<typeof dashboardService.generateSpexBudgetPlan>> | null>(null);
  const [spexCustomOverrides, setSpexCustomOverrides] = useState<Record<string, number>>({});
  const [showPeriodHistory, setShowPeriodHistory] = useState(false);
  const [showUnsetPicker, setShowUnsetPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!isAdvanced && selectedPlan === 'spex_ai') {
      setSelectedPlan('balanced');
    }
  }, [isAdvanced, selectedPlan]);

  const currentFM = getCurrentFinancialMonth(payrolls) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const isCurrentMonth = monthRef.year === currentFM.year && monthRef.month === currentFM.month;

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = (dir: -1 | 1) => setMonthRef((cur) => {
    const d = new Date(Date.UTC(cur.year, cur.month - 1 + dir, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  });

  // ─── Project Budget Scope & Separation ────────────────────────────────────────
  const projectContextIds = useMemo(() => getProjectContextIds(contexts), [contexts]);
  const activeExcludedProjectIds = useMemo(
    () => (excludeProjectSpend && projectContextIds.size > 0 ? projectContextIds : undefined),
    [excludeProjectSpend, projectContextIds]
  );

  const projectBudgetSummaries = useMemo(() => {
    return (contexts || [])
      .filter((ctx) => ctx.type === 'Project')
      .map((ctx) => {
        const linkedTxs = transactions.filter((tx) => tx.contextId === ctx.id && tx.type === 'Expense');
        const totalSpent = linkedTxs.reduce((sum, tx) => sum + netExpenseOf(tx), 0);
        const monthSpent = linkedTxs
          .filter((tx) => isInMonth(tx, monthRef.year, monthRef.month, payrolls))
          .reduce((sum, tx) => sum + netExpenseOf(tx), 0);
        const budgetCap = ctx.budget ? Number.parseFloat(ctx.budget) || 0 : 0;
        const plannedItems = parseProjectPlannedItems(ctx.plannedItems ?? ctx.plannedItemsJson);
        const plannedEstimateTotal = plannedItems.reduce((sum, item) => sum + (item.estimatedAmount || 0), 0);
        const purchasedCount = plannedItems.filter((item) => item.purchased).length;
        return {
          context: ctx,
          totalSpent,
          monthSpent,
          budgetCap,
          plannedItemsCount: plannedItems.length,
          purchasedCount,
          plannedEstimateTotal,
          txCount: linkedTxs.length,
        };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { Active: 0, Planned: 1, Completed: 2 };
        return (order[a.context.status] ?? 3) - (order[b.context.status] ?? 3) || b.monthSpent - a.monthSpent;
      });
  }, [contexts, transactions, monthRef, payrolls]);

  const activeOrPlannedProjects = useMemo(
    () => projectBudgetSummaries.filter((p) => p.context.status !== 'Completed' || p.monthSpent > 0),
    [projectBudgetSummaries]
  );

  // ─── Unified 4-Pillar & Bank-as-Savings Retention Breakdown ───────────────────
  const fourPillar = useMemo(
    () =>
      computeFourPillarBreakdown({
        transactions,
        budgets,
        year: monthRef.year,
        month: monthRef.month,
        payrolls,
        wallets,
        isCurrentMonth,
        excludeContextIds: activeExcludedProjectIds,
      }),
    [transactions, budgets, monthRef, payrolls, wallets, isCurrentMonth, activeExcludedProjectIds]
  );

  // Effective spent/allocated for any category (automatically crediting Bank Retention for 🛟 Emergency & goals Fund)
  const getEffectiveCategoryAmount = useCallback(
    (cat: string) => {
      const norm = normalizeCategory(cat);
      if (isSavingsRetentionCategory(norm)) {
        return fourPillar.effectiveSavedForBudget;
      }
      return getCategorySpending(
        transactions,
        norm,
        monthRef.year,
        monthRef.month,
        payrolls,
        wallets,
        activeExcludedProjectIds
      );
    },
    [fourPillar.effectiveSavedForBudget, transactions, monthRef, payrolls, wallets, activeExcludedProjectIds]
  );

  // All active categories for current view (have budget or have spending/allocations or retained savings)
  const budgetRows = useMemo(() => {
    const active = new Set<string>();
    budgets.filter((b) => b.year === monthRef.year && b.month === monthRef.month).forEach((b) => active.add(normalizeCategory(b.category)));
    transactions
      .filter((tx) => {
        if (!isInMonth(tx, monthRef.year, monthRef.month, payrolls)) return false;
        if (
          activeExcludedProjectIds &&
          tx.type === 'Expense' &&
          tx.contextId &&
          activeExcludedProjectIds.has(tx.contextId)
        ) {
          return false;
        }
        if (tx.type === 'Expense' || tx.type === 'Debt Repayment') return true;
        if (tx.type === 'Transfer') {
          let norm = normalizeCategory(tx.category);
          if (wallets && tx.destinationWalletId) {
            const dest = wallets.find((w) => w.id === tx.destinationWalletId);
            const destType = dest?.type?.toLowerCase();
            if (destType === 'investment') norm = '📈 Investments';
            else if (destType === 'savings') norm = '🛟 Emergency & goals Fund';
          }
          return Boolean(norm && norm !== '🔄 Transfer' && norm !== 'Transfer');
        }
        return false;
      })
      .forEach((tx) => {
        let cat = normalizeCategory(tx.category);
        if (tx.type === 'Debt Repayment') cat = '💳 Debt & Obligations';
        if (tx.type === 'Transfer' && wallets && tx.destinationWalletId) {
          const dest = wallets.find((w) => w.id === tx.destinationWalletId);
          const destType = dest?.type?.toLowerCase();
          if (destType === 'investment') cat = '📈 Investments';
          else if (destType === 'savings') cat = '🛟 Emergency & goals Fund';
        }
        active.add(cat || 'Uncategorized');
      });

    // Always surface '🛟 Emergency & goals Fund' if there is retained savings in bank so user sees their bank retention without needing a dummy transaction
    if (fourPillar.effectiveSavedForBudget > 0 || fourPillar.liveRetainedInBank > 0) {
      active.add('🛟 Emergency & goals Fund');
    }

    return Array.from(active).sort((a, b) => a.localeCompare(b));
  }, [budgets, monthRef, transactions, payrolls, wallets, activeExcludedProjectIds, fourPillar.effectiveSavedForBudget, fourPillar.liveRetainedInBank]);

  const filteredBudgetRows = useMemo(() => {
    if (pillarFilter === 'all') return budgetRows;
    return budgetRows.filter((cat) => {
      const p = getCategoryPillar(cat);
      if (pillarFilter === 'wealth') return p === 'savings' || p === 'investments';
      return p === pillarFilter;
    });
  }, [budgetRows, pillarFilter]);

  // Summary stats: separate Total Allocated (Living + Wealth) from Spendable Living Budget & Living Spent
  const totalBudget = useMemo(
    () => budgets.filter((b) => b.year === monthRef.year && b.month === monthRef.month).reduce((s, b) => s + parseFloat(b.amount), 0),
    [budgets, monthRef]
  );

  const livingBudgetTotal = fourPillar.plannedLivingBudget;
  const livingSpentTotal = fourPillar.totalLivingSpent;
  const livingRemaining = livingBudgetTotal - livingSpentTotal;

  // Pace strictly measures Living Consumption against Living Budget (not distorted by Savings Reserve)
  const pace = useMemo(
    () => getSpendingPace(livingSpentTotal, livingBudgetTotal, monthRef.year, monthRef.month, payrolls),
    [livingSpentTotal, livingBudgetTotal, monthRef, payrolls]
  );

  const categoryData = useMemo(
    () =>
      budgetRows.map((cat) => {
        const budget = budgetFor(budgets, cat, monthRef.year, monthRef.month);
        const spent = getEffectiveCategoryAmount(cat);
        return { label: cat, spent, color: categoryColor(cat), amount: budget ? parseFloat(budget.amount) : undefined };
      }),
    [budgets, budgetRows, monthRef, getEffectiveCategoryAmount]
  );

  const healthScore = useMemo(() => computeBudgetHealthScore(categoryData), [categoryData]);
  const { grade, color: gradeColor } = gradeFromScore(healthScore);

  const incomeBreakdown = useMemo(
    () => ({
      items: fourPillar.incomeItems,
      total: fourPillar.periodIncome,
    }),
    [fourPillar.incomeItems, fourPillar.periodIncome]
  );

  const totalIncome = fourPillar.periodIncome;

  // Map of configured budgets for the active month
  const monthBudgetsMap = useMemo(() => {
    const map = new Map<string, number>();
    budgets
      .filter((b) => b.year === monthRef.year && b.month === monthRef.month)
      .forEach((b) => {
        map.set(normalizeCategory(b.category), parseFloat(b.amount) || 0);
      });
    return map;
  }, [budgets, monthRef]);

  // Categories that have no budget set (> 0)
  const unsetCategories = useMemo(() => {
    return expenseCategories.filter((cat) => !monthBudgetsMap.has(cat) || (monthBudgetsMap.get(cat) ?? 0) <= 0);
  }, [monthBudgetsMap]);

  const setCategoriesCount = expenseCategories.length - unsetCategories.length;
  const unbudgetedIncome = totalIncome > 0 ? totalIncome - totalBudget : 0;
  const currentCategoryExistingBudget = monthBudgetsMap.get(newCategory) ?? 0;

  const parsedNewAmount = parseFloat(newAmount);
  const isNewAmountValid = Number.isFinite(parsedNewAmount) && parsedNewAmount >= 0;
  const projectedTotalBudget = isNewAmountValid ? (totalBudget - currentCategoryExistingBudget + parsedNewAmount) : totalBudget;
  const projectedRemaining = totalIncome > 0 ? (totalIncome - projectedTotalBudget) : 0;

  // ─── Connected Debts Servicing & Payoff Allocation ─────────────────────────
  const pendingPayables = useMemo(() => {
    return (debts || []).filter((d) => d.type === 'Payable' && d.status === 'Pending');
  }, [debts]);

  const totalPayableDebt = useMemo(() => {
    return pendingPayables.reduce((acc, d) => acc + (parseFloat(d.remainingBalance) || 0), 0);
  }, [pendingPayables]);

  const recommendedDebtAllocation = useMemo(() => {
    if (totalPayableDebt <= 0) return 0;
    const dueThisMonth = pendingPayables
      .filter((d) => {
        if (!d.dueDate) return false;
        const dt = new Date(d.dueDate);
        return dt.getUTCFullYear() === monthRef.year && dt.getUTCMonth() + 1 === monthRef.month;
      })
      .reduce((acc, d) => acc + (parseFloat(d.remainingBalance) || 0), 0);

    if (dueThisMonth > 0) return dueThisMonth;
    if (totalPayableDebt <= 1000) return totalPayableDebt;
    return Math.min(totalPayableDebt, Math.max(300, Math.round(totalPayableDebt * 0.1)));
  }, [pendingPayables, totalPayableDebt, monthRef]);

  const currentDebtBudget = monthBudgetsMap.get('💳 Debt & Obligations') ?? 0;
  const isDebtFullyReserved = totalPayableDebt > 0 && currentDebtBudget >= recommendedDebtAllocation;
  const [reservingDebt, setReservingDebt] = useState(false);

  const handleAutoReserveDebt = async () => {
    if (recommendedDebtAllocation <= 0) return;
    setReservingDebt(true);
    try {
      await onSaveBudget('💳 Debt & Obligations', monthRef.year, monthRef.month, recommendedDebtAllocation);
      showToast(`Reserved ${recommendedDebtAllocation.toFixed(2)} MAD for debt repayment in ${monthLabel(monthRef.year, monthRef.month)} budget!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to auto-reserve debt budget.', 'error');
    } finally {
      setReservingDebt(false);
    }
  };

  // ─── Connected Surplus Sweep to Savings Goals ──────────────────────────────
  const budgetSurplus = Math.max(0, livingBudgetTotal - livingSpentTotal);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [sweepAmount, setSweepAmount] = useState<string>('');
  const [selectedSweepWalletId, setSelectedSweepWalletId] = useState<string>('');
  const [sweeping, setSweeping] = useState(false);

  // ─── Connected Stock Portfolio & 📈 Investments Budget Hub ──────────────────
  const currentInvestmentBudget = monthBudgetsMap.get('📈 Investments') ?? 0;
  const currentInvestmentSpent = fourPillar.investedAmount;
  const remainingInvestmentBudget = Math.max(0, currentInvestmentBudget - currentInvestmentSpent);
  const recommendedInvestmentBudget = useMemo(
    () => (totalIncome > 0 ? Math.round(totalIncome * 0.1) : 1500),
    [totalIncome]
  );
  const [fundingBrokerage, setFundingBrokerage] = useState(false);

  const handleFundRemainingInvestmentBudget = async () => {
    if (!onFundInvestmentWallet) return;
    const amt = remainingInvestmentBudget > 0 ? remainingInvestmentBudget : Math.min(budgetSurplus > 0 ? budgetSurplus : 1000, 2500);
    if (amt <= 0) return;
    setFundingBrokerage(true);
    try {
      await onFundInvestmentWallet({
        amountMad: amt,
        notes: `Budget allocation transfer for ${monthLabel(monthRef.year, monthRef.month)}`,
      });
      showToast(`Transferred ${amt.toFixed(2)} MAD into your Brokerage Reserve Wallet!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to fund Brokerage Wallet.', 'error');
    } finally {
      setFundingBrokerage(false);
    }
  };

  useEffect(() => {
    if (!selectedGoalId && goals && goals.length > 0) {
      setSelectedGoalId(goals[0].id);
    }
  }, [goals, selectedGoalId]);

  useEffect(() => {
    if (!selectedSweepWalletId && wallets && wallets.length > 0) {
      const mainW = (wallets as any).find((w: any) => w.isMain) || wallets[0];
      setSelectedSweepWalletId(mainW.id);
    }
  }, [wallets, selectedSweepWalletId]);

  const handleExecuteSurplusSweep = async () => {
    if (!onContributeGoal || !selectedGoalId) return;
    const amt = parseFloat(sweepAmount);
    if (!amt || amt <= 0) {
      showToast('Enter a valid amount to sweep into goal.', 'error');
      return;
    }
    setSweeping(true);
    try {
      const targetGoal = goals?.find((g) => g.id === selectedGoalId);
      await onContributeGoal(selectedGoalId, {
        amount: amt,
        walletId: selectedSweepWalletId || undefined,
        note: `Budget surplus sweep from ${monthLabel(monthRef.year, monthRef.month)}`,
        date: new Date().toISOString(),
      });
      showToast(`🎉 Swept +${amt.toFixed(2)} MAD into ${targetGoal?.name || 'Goal'}!`, 'success');
      setSweepAmount('');
    } catch (err: any) {
      showToast(err.message || 'Failed to sweep surplus into goal.', 'error');
    } finally {
      setSweeping(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmount);
    if (!Number.isFinite(val) || val < 0) { showToast('Enter a valid amount.', 'error'); return; }
    setAddSaving(true);
    try {
      await onSaveBudget(newCategory, monthRef.year, monthRef.month, val);
      setNewAmount('');
      showToast(`Budget set for ${newCategory}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to save budget.', 'error');
    } finally {
      setAddSaving(false);
    }
  };

  const handleCopy = async () => {
    setCopyLoading(true);
    try {
      const n = await onCopyPrevious(monthRef.year, monthRef.month);
      showToast(n > 0 ? `${n} budget${n !== 1 ? 's' : ''} copied from previous month.` : 'No new budgets to copy.');
    } catch {
      showToast('Failed to copy budgets.', 'error');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to delete all budgets for ${monthLabel(monthRef.year, monthRef.month)}?`)) return;
    setClearLoading(true);
    try {
      const n = await onClearMonth(monthRef.year, monthRef.month);
      showToast(n > 0 ? `Cleared ${n} budget${n !== 1 ? 's' : ''}.` : 'No budgets to clear.');
    } catch {
      showToast('Failed to clear budgets.', 'error');
    } finally {
      setClearLoading(false);
    }
  };

  // Only count consumption categories (not Savings/Investments) as "over budget"
  const overBudgetCount = categoryData.filter(
    (c) => !isWealthAllocationCategory(c.label) && c.amount !== undefined && c.spent > c.amount
  ).length;

  // ─── Chronological Financial Periods Pattern Summary (Oldest -> Current, Net of Reimbursements) ───
  const localPatternSummary = useMemo(
    () =>
      buildChronologicalPeriodPatternSummary({
        transactions,
        payrolls,
        targetYear: monthRef.year,
        targetMonth: monthRef.month,
        targetIncomeMad: totalIncome > 0 ? totalIncome : undefined,
        subscriptions,
        debts,
        wallets,
        excludeContextIds: activeExcludedProjectIds,
      }),
    [transactions, payrolls, monthRef.year, monthRef.month, totalIncome, subscriptions, debts, wallets, activeExcludedProjectIds]
  );

  const effectiveTargetIncome = useMemo(
    () => (totalIncome > 0 ? totalIncome : localPatternSummary.targetIncomeBaselineMad),
    [totalIncome, localPatternSummary.targetIncomeBaselineMad]
  );

  const oldestPeriodLabel = useMemo(
    () =>
      localPatternSummary.periodsOldestToCurrent.length > 0
        ? localPatternSummary.periodsOldestToCurrent[0].monthName
        : monthLabel(monthRef.year, monthRef.month),
    [localPatternSummary.periodsOldestToCurrent, monthRef.year, monthRef.month]
  );

  const latestPeriodLabel = useMemo(
    () =>
      localPatternSummary.periodsOldestToCurrent.length > 0
        ? localPatternSummary.periodsOldestToCurrent[localPatternSummary.periodsOldestToCurrent.length - 1].monthName
        : monthLabel(monthRef.year, monthRef.month),
    [localPatternSummary.periodsOldestToCurrent, monthRef.year, monthRef.month]
  );

  const activeSubscriptionsMonthlyMad = useMemo(
    () =>
      (subscriptions || [])
        .filter((s) => !s.status || s.status === 'active' || s.status === 'planned')
        .reduce((acc, sub) => {
          const amt = Number(sub.amount) || 0;
          const cycle = (sub.billingCycle || 'monthly').toLowerCase();
          if (cycle === 'yearly' || cycle === 'annual') return acc + amt / 12;
          if (cycle === 'quarterly' || cycle === 'every_3_months') return acc + amt / 3;
          if (cycle === 'every_6_months') return acc + amt / 6;
          if (cycle === 'every_2_months') return acc + amt / 2;
          if (cycle === 'weekly') return acc + amt * 4.33;
          if (cycle === 'biweekly') return acc + amt * 2.165;
          return acc + amt;
        }, 0),
    [subscriptions]
  );

  // Build effective Spex allocations (merges AI plan if generated, otherwise local chronological pattern engine, plus any inline overrides)
  const effectiveSpexAllocations = useMemo(() => {
    const baseList =
      spexPlanResult && spexPlanResult.allocations.length > 0
        ? spexPlanResult.allocations.map((a) => ({
            category: a.category,
            amount: a.amount,
            pctOfIncome: a.pctOfIncome,
            pillar: a.pillar,
            reasoning: a.reasoning,
            historicalNetAvgMad: a.historicalAvgNetMad,
          }))
        : localPatternSummary.categoryProfiles
            .filter((cp) => cp.suggestedPatternBudgetMad > 0 || cp.category === '🛟 Emergency & goals Fund')
            .map((cp) => ({
              category: cp.category,
              amount: cp.suggestedPatternBudgetMad,
              pctOfIncome:
                effectiveTargetIncome > 0
                  ? Number(((cp.suggestedPatternBudgetMad / effectiveTargetIncome) * 100).toFixed(1))
                  : 0,
              pillar: cp.pillar,
              reasoning: cp.patternReasoning,
              historicalNetAvgMad: cp.recencyWeightedAvgNetMad,
            }));

    return baseList.map((item) => {
      const override = spexCustomOverrides[item.category];
      const finalAmount = override !== undefined ? override : item.amount;
      return {
        ...item,
        amount: finalAmount,
        pctOfIncome:
          effectiveTargetIncome > 0
            ? Number(((finalAmount / effectiveTargetIncome) * 100).toFixed(1))
            : 0,
      };
    });
  }, [spexPlanResult, localPatternSummary.categoryProfiles, spexCustomOverrides, effectiveTargetIncome]);

  const effectiveSpexPillarSummary = useMemo(() => {
    const inc = Math.max(1, effectiveTargetIncome);
    let obligationsMad = 0;
    let myselfMad = 0;
    let investmentsMad = 0;
    let savingsTargetMad = 0;
    for (const a of effectiveSpexAllocations) {
      if (a.pillar === 'obligations') obligationsMad += a.amount;
      else if (a.pillar === 'myself') myselfMad += a.amount;
      else if (a.pillar === 'investments') investmentsMad += a.amount;
      else if (a.pillar === 'savings') savingsTargetMad += a.amount;
    }
    const unallocatedRetained = Math.max(
      0,
      effectiveTargetIncome - (obligationsMad + myselfMad + investmentsMad + savingsTargetMad)
    );
    const retainedInBankMad = savingsTargetMad + unallocatedRetained;
    return {
      obligationsMad,
      obligationsPct: Number(((obligationsMad / inc) * 100).toFixed(1)),
      myselfMad,
      myselfPct: Number(((myselfMad / inc) * 100).toFixed(1)),
      investmentsMad,
      investmentsPct: Number(((investmentsMad / inc) * 100).toFixed(1)),
      retainedInBankMad,
      retainedInBankPct: Number(((retainedInBankMad / inc) * 100).toFixed(1)),
    };
  }, [effectiveSpexAllocations, effectiveTargetIncome]);

  const handleGenerateSpexPlan = useCallback(
    async (customNotes?: string) => {
      setSpexGenerating(true);
      try {
        const res = await dashboardService.generateSpexBudgetPlan(
          {
            year: monthRef.year,
            month: monthRef.month,
            userNotes: (customNotes !== undefined ? customNotes : spexUserNotes).trim() || undefined,
            targetIncomeMad: effectiveTargetIncome > 0 ? effectiveTargetIncome : undefined,
          },
          token
        );
        setSpexPlanResult(res);
        setSpexCustomOverrides({});
        showToast(
          res.modelUsed && res.modelUsed !== 'pattern-fallback'
            ? `✨ Spex AI synthesized ${res.periodsAnalyzed.length} financial periods into your personal plan!`
            : `✨ Spex Pattern Engine calculated your plan across ${res.periodsAnalyzed.length} financial periods!`
        );
      } catch (err: any) {
        showToast(err.message || 'Spex used your local chronological pattern engine.', 'error');
      } finally {
        setSpexGenerating(false);
      }
    },
    [monthRef.year, monthRef.month, spexUserNotes, effectiveTargetIncome, token, showToast]
  );

  // Reset cached AI plan when target month changes
  useEffect(() => {
    setSpexPlanResult(null);
    setSpexCustomOverrides({});
  }, [monthRef.year, monthRef.month]);

  const handleApplyAutoBudget = async () => {
    setAutoBudgetLoading(true);
    try {
      if (selectedPlan === 'spex_ai') {
        const newBudgets = effectiveSpexAllocations
          .filter((a) => a.amount >= 0)
          .map((a) => ({
            category: a.category,
            year: monthRef.year,
            month: monthRef.month,
            amount: Math.round(a.amount),
          }));
        await onSaveBudgetsBatch(newBudgets);
        setAutoBudgetOpen(false);
        showToast(
          `Applied Spex Personalized Pattern Plan (${localPatternSummary.periodsOldestToCurrent.length} financial periods analyzed)!`
        );
      } else {
        const rules = BUDGET_PLANS[selectedPlan].rules;
        const baseIncome = effectiveTargetIncome;
        const newBudgets = Object.entries(rules).map(([cat, pct]) => ({
          category: cat,
          year: monthRef.year,
          month: monthRef.month,
          amount: Math.round((baseIncome * pct) / 100),
        }));
        await onSaveBudgetsBatch(newBudgets);
        setAutoBudgetOpen(false);
        showToast(`Auto-budget applied using the ${BUDGET_PLANS[selectedPlan].name} plan!`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to apply auto-budget.', 'error');
    } finally {
      setAutoBudgetLoading(false);
    }
  };

  const hasConnectedHubs =
    activeOrPlannedProjects.length > 0 ||
    Boolean(setActiveTab) ||
    totalPayableDebt > 0 ||
    currentInvestmentBudget > 0 ||
    Boolean(
      investmentsData &&
        (investmentsData.positions.length > 0 || investmentsData.buyingPower.investmentWalletBalanceMad > 0)
    ) ||
    (budgetSurplus > 0 && goals.length > 0);

  return (
    <div className="space-y-6">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'}`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 1: Clean Top Header & Scope Bar ── */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Monthly Budget
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Plan spending caps for Obligations &amp; Yourself — unspent salary stays retained in your bank.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1 shrink-0">
              <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous month" className="h-9 w-9">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMonthRef(getCurrentFinancialMonth(payrolls) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 })}
                className="h-9 whitespace-nowrap shrink-0 font-medium"
              >
                {monthLabel(monthRef.year, monthRef.month)}
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next month" className="h-9 w-9">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              onClick={() => setAutoBudgetOpen(true)}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700 dark:text-white whitespace-nowrap shrink-0"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Auto-Budget
            </Button>
          </div>
        </div>

        {/* Scope Strip: Routine Monthly vs Combined (Clearly Explained) */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Monthly budget scope"
              className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-white dark:bg-gray-950 text-xs shrink-0"
            >
              <button
                type="button"
                aria-pressed={excludeProjectSpend}
                onClick={() => setExcludeProjectSpend(true)}
                className={`px-3 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  excludeProjectSpend
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Routine Monthly
              </button>
              <button
                type="button"
                aria-pressed={!excludeProjectSpend}
                onClick={() => setExcludeProjectSpend(false)}
                className={`px-3 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                  !excludeProjectSpend
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Combined
              </button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 hidden sm:inline" />
              {excludeProjectSpend ? (
                <span>
                  <strong className="font-medium text-gray-900 dark:text-gray-200">Routine Monthly:</strong>{' '}
                  Excludes Project-tagged purchases from monthly category caps so big upgrades stay separate.
                </span>
              ) : (
                <span>
                  <strong className="font-medium text-gray-900 dark:text-gray-200">Combined:</strong>{' '}
                  Includes Project-tagged purchases inside your regular monthly category caps.
                </span>
              )}
            </p>
          </div>
          {excludeProjectSpend && fourPillar.excludedProjectSpent > 0 && (
            <span className="text-xs font-mono tabular-nums font-semibold text-sky-700 dark:text-sky-400 whitespace-nowrap shrink-0">
              {fourPillar.excludedProjectSpent.toFixed(0)} MAD in Projects (separate)
            </span>
          )}
        </div>
      </div>

      {/* ── Section 2: Unified Budget & Bank-Retention Summary ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {/* Top KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-800">
          <div className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Period Income</p>
            <p className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-0.5">
              <AnimatedMetricValue value={totalIncome} decimals={0} suffix=" MAD" />
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono tabular-nums">
              {totalBudget.toFixed(0)} MAD total caps &amp; targets
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Living Spent / Cap</p>
            <p className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${livingSpentTotal > livingBudgetTotal && livingBudgetTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
              <AnimatedMetricValue value={livingSpentTotal} decimals={0} />
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {' '}/ {livingBudgetTotal.toFixed(0)} MAD
              </span>
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono tabular-nums">
              Oblig {fourPillar.spentOnObligations.toFixed(0)} · Myself {fourPillar.spentOnMyself.toFixed(0)}
              {excludeProjectSpend && fourPillar.excludedProjectSpent > 0 ? ` · Proj ${fourPillar.excludedProjectSpent.toFixed(0)}` : ''}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Safe to Spend Left</p>
            <p className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${livingRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {livingBudgetTotal > 0 ? <AnimatedMetricValue value={livingRemaining} decimals={0} suffix=" MAD" /> : '—'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {livingBudgetTotal > 0 ? (livingRemaining < 0 ? 'Over living budget cap' : 'Remaining in living caps') : 'Set living caps below'}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Budget Health</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className={`text-xl font-bold ${gradeColor}`}>{grade}</span>
              <span className="text-sm font-mono tabular-nums text-gray-500 dark:text-gray-400">
                <AnimatedMetricValue value={healthScore} decimals={0} />/100
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {overBudgetCount > 0 ? `${overBudgetCount} living cat. over cap` : 'All living caps on track'}
            </p>
          </div>
        </div>

        {/* 4-Pillar Breakdown & Stacked Bar */}
        <div className="p-4 sm:p-5 space-y-4">
          {totalIncome > 0 && (
            <div className="space-y-2">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'left' }}
                className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex"
              >
                <div
                  className="h-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, (fourPillar.spentOnObligations / totalIncome) * 100)}%` }}
                  title={`Obligations: ${fourPillar.spentOnObligations.toFixed(0)} MAD`}
                />
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (fourPillar.spentOnMyself / totalIncome) * 100)}%` }}
                  title={`Spent on Myself: ${fourPillar.spentOnMyself.toFixed(0)} MAD`}
                />
                {fourPillar.excludedProjectSpent > 0 && (
                  <div
                    className="h-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (fourPillar.excludedProjectSpent / totalIncome) * 100)}%` }}
                    title={`Projects (Separate): ${fourPillar.excludedProjectSpent.toFixed(0)} MAD`}
                  />
                )}
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (fourPillar.investedAmount / totalIncome) * 100)}%` }}
                  title={`Invested: ${fourPillar.investedAmount.toFixed(0)} MAD`}
                />
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (fourPillar.totalActualRetainedAndSaved / totalIncome) * 100)}%` }}
                  title={`Live Retained in Bank & Saved: ${fourPillar.totalActualRetainedAndSaved.toFixed(0)} MAD`}
                />
              </motion.div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-gray-600 dark:text-gray-400 font-mono tabular-nums">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  Obligations {fourPillar.obligationsPctOfIncome.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Myself {fourPillar.myselfPctOfIncome.toFixed(1)}%
                </span>
                {fourPillar.excludedProjectSpent > 0 && (
                  <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    Projects {((fourPillar.excludedProjectSpent / totalIncome) * 100).toFixed(1)}%
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Invested {fourPillar.investedPctOfIncome.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live in Bank {fourPillar.savedPctOfIncome.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* 4 Pillars Clean Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Pillar 1: Obligations */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  Obligations
                </span>
                <span className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {fourPillar.obligationsPctOfIncome.toFixed(1)}%
                </span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                <AnimatedMetricValue value={fourPillar.spentOnObligations} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                Cap {fourPillar.plannedObligationsBudget.toFixed(0)} ·{' '}
                <span className={fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                  {fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations >= 0
                    ? `${(fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations).toFixed(0)} left`
                    : `${Math.abs(fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations).toFixed(0)} over`}
                </span>
              </p>
            </div>

            {/* Pillar 2: Spent on Myself */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Spent on Myself
                </span>
                <span className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {fourPillar.myselfPctOfIncome.toFixed(1)}%
                </span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                <AnimatedMetricValue value={fourPillar.spentOnMyself} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                Cap {fourPillar.plannedMyselfBudget.toFixed(0)} ·{' '}
                <span className={fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                  {fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself >= 0
                    ? `${(fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself).toFixed(0)} left`
                    : `${Math.abs(fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself).toFixed(0)} over`}
                </span>
              </p>
            </div>

            {/* Pillar 3: Invested */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Invested
                </span>
                <span className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {fourPillar.investedPctOfIncome.toFixed(1)}%
                </span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                <AnimatedMetricValue value={fourPillar.investedAmount} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                Target {fourPillar.plannedInvestmentBudget.toFixed(0)} MAD · Portfolio
              </p>
            </div>

            {/* Pillar 4: Retained in Bank (Actual live unspent + savings transfers, consistent across Routine & Combined) */}
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Retained in Bank
                </span>
                <span className="text-[11px] font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  {fourPillar.savedPctOfIncome.toFixed(1)}%
                </span>
              </div>
              <p className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                <AnimatedMetricValue value={fourPillar.totalActualRetainedAndSaved} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-mono tabular-nums">
                {fourPillar.plannedSavingsBudget > 0
                  ? `Target ${fourPillar.plannedSavingsBudget.toFixed(0)} MAD`
                  : 'Live unspent from period income'}
                {fourPillar.explicitSavingsTx > 0 ? ` · +${fourPillar.explicitSavingsTx.toFixed(0)} saved tx` : ''}
              </p>
              {isCurrentMonth && livingBudgetTotal > 0 && (
                <p className={`text-[10px] font-mono tabular-nums ${fourPillar.plannedSavingsBudget > 0 && fourPillar.protectedBankRetention < fourPillar.plannedSavingsBudget ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700/75 dark:text-emerald-400/75'}`}>
                  Min left if all caps spent: {fourPillar.protectedBankRetention.toFixed(0)} MAD
                </p>
              )}
            </div>
          </div>

          {/* Transparent Cash Reconciliation Line */}
          {totalIncome > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
              <span>
                Income {totalIncome.toFixed(0)} − Oblig {fourPillar.spentOnObligations.toFixed(0)} − Myself {fourPillar.spentOnMyself.toFixed(0)}
                {fourPillar.excludedProjectSpent > 0 ? ` − Projects ${fourPillar.excludedProjectSpent.toFixed(0)}` : ''}
                {fourPillar.investedAmount > 0 ? ` − Invested ${fourPillar.investedAmount.toFixed(0)}` : ''}
                {fourPillar.explicitSavingsTx > 0 ? ` − Savings Tx ${fourPillar.explicitSavingsTx.toFixed(0)}` : ''}
                {' = '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {fourPillar.liveRetainedInBank.toFixed(0)} MAD live in bank
                </strong>
              </span>
              {fourPillar.reimbursedIncomeExcluded > 0 && (
                <span>Reimbursements stripped: {fourPillar.reimbursedIncomeExcluded.toFixed(0)} MAD</span>
              )}
            </div>
          )}
        </div>

        {/* Integrated Living Consumption Pace Strip */}
        {livingBudgetTotal > 0 && (
          <div className="px-4 py-3 sm:px-5 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-indigo-500" />
                Living Spending Pace
              </span>
              <span className={`font-semibold font-mono tabular-nums ${pace.difference > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {pace.difference > 0 ? '+' : ''}{pace.difference.toFixed(0)} MAD vs ideal today ({pace.ideal.toFixed(0)} MAD)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <AnimatedProgressBar
                className="flex-1"
                trackClassName="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden"
                percent={livingBudgetTotal > 0 ? (livingSpentTotal / livingBudgetTotal) * 100 : 0}
                barClassName={livingSpentTotal > livingBudgetTotal ? 'bg-red-500' : pace.difference > 0 ? 'bg-amber-500' : 'bg-emerald-500'}
              />
              <span className="text-xs tabular-nums font-mono text-gray-500 dark:text-gray-400 shrink-0">
                {livingBudgetTotal > 0 ? `${Math.min(100, (livingSpentTotal / livingBudgetTotal) * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Quick Set / Update Category Budget Bar ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Set or Update Category Cap
            </h3>
            <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
              {setCategoriesCount}/{expenseCategories.length} set
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            {totalIncome > 0 && (
              <span
                className={
                  unbudgetedIncome < -0.01
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : 'text-emerald-700 dark:text-emerald-400 font-medium'
                }
              >
                {unbudgetedIncome > 0.01
                  ? `${unbudgetedIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD unbudgeted (stays in bank)`
                  : unbudgetedIncome < -0.01
                  ? `Over-allocated by ${Math.abs(unbudgetedIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD`
                  : '100% of income allocated'}
              </span>
            )}
            {unsetCategories.length > 0 && (
              <button
                type="button"
                onClick={() => setShowUnsetPicker((v) => !v)}
                className="font-sans text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showUnsetPicker ? 'Hide unset' : `Pick unset (${unsetCategories.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Inline Form */}
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6 space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Category
            </label>
            <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {expenseCategories.map((c) => {
                const existingAmt = monthBudgetsMap.get(c) ?? 0;
                const p = getCategoryPillar(c);
                const tag = PILLAR_META[p].shortLabel;
                return (
                  <option key={c} value={c}>
                    {c} [{tag}] {existingAmt > 0 ? `(${existingAmt.toFixed(0)} MAD)` : '— Unset'}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="sm:col-span-4 space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                Monthly Cap (MAD)
              </label>
              {unbudgetedIncome > 0 && (
                <button
                  type="button"
                  onClick={() => setNewAmount(Math.max(0, unbudgetedIncome).toFixed(2))}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium font-mono"
                >
                  Fill {Math.max(0, unbudgetedIncome).toFixed(0)}
                </button>
              )}
            </div>
            <Input
              required
              min="0"
              step="0.01"
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder={currentCategoryExistingBudget > 0 ? currentCategoryExistingBudget.toFixed(2) : '0.00'}
              className="font-mono"
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={addSaving} className="w-full h-10 font-medium whitespace-nowrap">
              <Plus className="mr-1 h-4 w-4" />
              {addSaving ? 'Saving…' : currentCategoryExistingBudget > 0 ? 'Update' : 'Set Cap'}
            </Button>
          </div>
        </form>

        {/* Subtle live preview / status line */}
        {isNewAmountValid && totalIncome > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            Saving {parsedNewAmount.toFixed(0)} MAD leaves{' '}
            <strong className={projectedRemaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
              {projectedRemaining >= 0
                ? `${projectedRemaining.toFixed(0)} MAD`
                : `-${Math.abs(projectedRemaining).toFixed(0)} MAD`}
            </strong>{' '}
            unbudgeted in bank.
          </p>
        )}

        {/* Collapsible Unset Category Quick Picker */}
        {showUnsetPicker && unsetCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            {unsetCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setNewCategory(cat);
                  setNewAmount('');
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  newCategory === cat
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-medium'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Category Budgets Workspace & View Switcher ── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* View Mode Segmented Control */}
          <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-100/70 dark:bg-gray-900 w-fit">
            {([
              { id: 'category', label: 'Categories', icon: LayoutGrid },
              { id: '503020', label: '50/30/20', icon: PieChart },
              { id: 'envelope', label: 'Envelopes', icon: Layers },
            ] as { id: BudgetModel; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setBudgetModel(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  budgetModel === id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Pillar Filter Tabs (Category View) */}
          {budgetModel === 'category' && (
            <div className="flex items-center gap-1 overflow-x-auto">
              {([
                { id: 'all', label: `All (${budgetRows.length})` },
                { id: 'obligations', label: `Obligations (${budgetRows.filter((c) => getCategoryPillar(c) === 'obligations').length})` },
                { id: 'myself', label: `Myself (${budgetRows.filter((c) => getCategoryPillar(c) === 'myself').length})` },
                { id: 'wealth', label: `Saved & Invested (${budgetRows.filter((c) => isWealthAllocationCategory(c)).length})` },
              ] as { id: PillarFilter; label: string }[]).map((tab) => {
                const active = pillarFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPillarFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Utility Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" disabled={copyLoading} onClick={handleCopy} className="whitespace-nowrap shrink-0 h-8 text-xs">
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copyLoading ? 'Copying…' : 'Copy Prev Month'}
            </Button>
            {budgetRows.length > 0 && totalBudget > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={clearLoading}
                onClick={handleClearAll}
                className="h-8 text-xs text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/40 whitespace-nowrap shrink-0"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Main View Area */}
        {budgetModel === 'category' && (
          <>
            {filteredBudgetRows.length > 0 ? (
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {filteredBudgetRows.map((cat) => {
                  const budget = budgetFor(budgets, cat, monthRef.year, monthRef.month);
                  const spent = getEffectiveCategoryAmount(cat);
                  const isSavings = isSavingsRetentionCategory(cat);
                  const isInvest = isInvestmentCategory(cat);
                  return (
                    <BudgetCard
                      key={cat}
                      category={cat}
                      budget={budget}
                      spent={spent}
                      year={monthRef.year}
                      month={monthRef.month}
                      payrolls={payrolls}
                      isCurrentMonth={isCurrentMonth}
                      retentionMeta={
                        isSavings || isInvest
                          ? {
                              isSavingsRetention: isSavings,
                              isInvestmentTarget: isInvest,
                              protectedBankRetention: fourPillar.protectedBankRetention,
                              liveRetainedInBank: fourPillar.liveRetainedInBank,
                              explicitTxAmount: isSavings ? fourPillar.explicitSavingsTx : fourPillar.investedAmount,
                            }
                          : undefined
                      }
                      onSave={(amount) => onSaveBudget(cat, monthRef.year, monthRef.month, amount)}
                      onDelete={budget ? () => onDeleteBudget(budget.id) : undefined}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-12 px-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No spending or budgets in this filter for {monthLabel(monthRef.year, monthRef.month)} yet.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Use the category cap form above or click Auto-Budget to populate your month.
                </p>
              </div>
            )}
          </>
        )}

        {budgetModel === '503020' && (
          <Rule503020View
            budgets={budgets}
            totalBudget={totalBudget}
            year={monthRef.year}
            month={monthRef.month}
            fourPillar={fourPillar}
          />
        )}

        {budgetModel === 'envelope' && (
          <EnvelopeView
            budgets={budgets}
            transactions={transactions}
            year={monthRef.year}
            month={monthRef.month}
            payrolls={payrolls}
            wallets={wallets}
            fourPillar={fourPillar}
            excludeContextIds={activeExcludedProjectIds}
            onSave={(cat, amount) => onSaveBudget(cat, monthRef.year, monthRef.month, amount)}
            onDelete={onDeleteBudget}
          />
        )}
      </div>

      {/* ── Section 5: Connected Plans & Allocations (Compact 2-Col Grid) ── */}
      {hasConnectedHubs && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Connected Plans &amp; Allocations
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active Projects & Setup Budgets */}
            {(activeOrPlannedProjects.length > 0 || setActiveTab) && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        Projects &amp; Setup Budgets
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {excludeProjectSpend
                          ? 'Tracked separately from Routine Monthly caps.'
                          : 'Currently merged into Combined monthly caps.'}
                      </p>
                    </div>
                    {setActiveTab && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('contexts')}
                        className="h-8 text-xs shrink-0 whitespace-nowrap"
                      >
                        Manage
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {activeOrPlannedProjects.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                      {activeOrPlannedProjects.map((proj) => {
                        const pct = proj.budgetCap > 0 ? Math.min(100, (proj.totalSpent / proj.budgetCap) * 100) : 0;
                        const isOver = proj.budgetCap > 0 && proj.totalSpent > proj.budgetCap;
                        return (
                          <div key={proj.context.id} className="py-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {proj.context.name}
                                </span>
                                <span className="text-[11px] text-gray-400 shrink-0">{proj.context.status}</span>
                              </div>
                              <div className="text-right font-mono tabular-nums shrink-0">
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                                  {proj.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  {proj.budgetCap > 0 ? ` / ${proj.budgetCap.toLocaleString()}` : ''} MAD
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                              {proj.budgetCap > 0 ? (
                                <div className="flex items-center gap-2 flex-1 max-w-xs">
                                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${isOver ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-sky-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span>{pct.toFixed(0)}%</span>
                                </div>
                              ) : (
                                <span>
                                  {proj.plannedItemsCount > 0 ? `${proj.purchasedCount}/${proj.plannedItemsCount} items` : 'No cap'}
                                </span>
                              )}
                              <span>This cycle: {proj.monthSpent.toFixed(0)} MAD</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                      Create a Project context for room setups, gear upgrades, or multi-purchase plans to keep them separate from monthly caps.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Debt Servicing Reserve */}
            {totalPayableDebt > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                      Debt Servicing Reserve
                    </h4>
                    <span className={`text-xs font-medium ${isDebtFullyReserved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {isDebtFullyReserved ? 'Reserved' : 'Under-Reserved'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    <strong className="font-mono tabular-nums text-gray-900 dark:text-gray-200">{totalPayableDebt.toFixed(0)} MAD</strong> across {pendingPayables.length} active payable{pendingPayables.length !== 1 ? 's' : ''}.{' '}
                    {isDebtFullyReserved
                      ? `${currentDebtBudget.toFixed(0)} MAD reserved in this month's budget.`
                      : `Recommended monthly reserve: ${recommendedDebtAllocation.toFixed(0)} MAD (currently ${currentDebtBudget.toFixed(0)} MAD).`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {!isDebtFullyReserved && (
                    <Button
                      size="sm"
                      disabled={reservingDebt}
                      onClick={handleAutoReserveDebt}
                      className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                      {reservingDebt ? 'Reserving…' : `Reserve ${recommendedDebtAllocation.toFixed(0)} MAD`}
                    </Button>
                  )}
                  {setActiveTab && (
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('debts')} className="h-8 text-xs">
                      View Debts
                      <ExternalLink className="ml-1.5 h-3 w-3 text-gray-400" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Stock Portfolio Allocation */}
            {(currentInvestmentBudget > 0 || (investmentsData && (investmentsData.positions.length > 0 || investmentsData.buyingPower.investmentWalletBalanceMad > 0))) && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      Stock Portfolio Target
                    </h4>
                    <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-400">
                      {currentInvestmentSpent.toFixed(0)} / {currentInvestmentBudget > 0 ? currentInvestmentBudget.toFixed(0) : recommendedInvestmentBudget.toFixed(0)} MAD
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {currentInvestmentBudget > 0
                      ? remainingInvestmentBudget > 0
                        ? `${remainingInvestmentBudget.toFixed(0)} MAD left in this cycle's investment target.`
                        : `100% of your ${currentInvestmentBudget.toFixed(0)} MAD target funded this cycle.`
                      : `${investmentsData?.positions.length || 0} positions worth ${(investmentsData?.totalPortfolioValueMad || 0).toFixed(0)} MAD.`}
                    {investmentsData && investmentsData.buyingPower.investmentWalletBalanceMad > 0
                      ? ` Brokerage cash: ${investmentsData.buyingPower.investmentWalletBalanceMad.toFixed(0)} MAD.`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {currentInvestmentBudget <= 0 && (
                    <Button
                      size="sm"
                      onClick={() => onSaveBudget('📈 Investments', monthRef.year, monthRef.month, recommendedInvestmentBudget)}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Set {recommendedInvestmentBudget.toFixed(0)} MAD Target
                    </Button>
                  )}
                  {onFundInvestmentWallet && remainingInvestmentBudget > 0 && isCurrentMonth && (
                    <Button
                      size="sm"
                      disabled={fundingBrokerage}
                      onClick={handleFundRemainingInvestmentBudget}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <WalletCards className="mr-1.5 h-3.5 w-3.5" />
                      {fundingBrokerage ? 'Funding…' : `Fund ${remainingInvestmentBudget.toFixed(0)} MAD`}
                    </Button>
                  )}
                  {setActiveTab && (
                    <Button size="sm" variant="outline" onClick={() => setActiveTab('investments')} className="h-8 text-xs">
                      Portfolio
                      <ExternalLink className="ml-1.5 h-3 w-3 text-gray-400" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Smart Surplus Sweep into Savings Goals */}
            {budgetSurplus > 0 && goals.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <PiggyBank className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Sweep Unspent Living Budget
                    </h4>
                    <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      +{budgetSurplus.toFixed(0)} MAD available
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Optionally earmark unspent living budget toward a Savings Goal.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 flex-1 min-w-[200px]">
                    <select
                      value={selectedGoalId}
                      onChange={(e) => setSelectedGoalId(e.target.value)}
                      className="bg-transparent text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none px-1.5 py-1 max-w-[120px] truncate"
                    >
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-1.5">
                      {[0.25, 0.5, 1].map((ratio) => {
                        const val = Math.round(budgetSurplus * ratio);
                        return (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => setSweepAmount(String(val))}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-indigo-400 text-gray-700 dark:text-gray-300"
                          >
                            {ratio === 1 ? '100%' : `${ratio * 100}%`}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={budgetSurplus}
                      placeholder={budgetSurplus.toFixed(0)}
                      value={sweepAmount}
                      onChange={(e) => setSweepAmount(e.target.value)}
                      className="w-16 bg-transparent text-xs font-mono font-semibold text-right text-gray-900 dark:text-gray-100 focus:outline-none px-1 ml-auto"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={sweeping || !onContributeGoal}
                    onClick={handleExecuteSurplusSweep}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                  >
                    {sweeping ? 'Sweeping…' : 'Sweep'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 6: Starter Templates (Collapsible Disclosure) ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Starter Budget Templates
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
              Quick-start presets for common monthly lifestyles
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${showTemplates ? 'rotate-180' : ''}`}
          />
        </button>
        {showTemplates && (
          <div className="border-t border-gray-100 dark:border-gray-800 p-4">
            <TemplatesGallery
              compact
              onApplied={() => {
                showToast('Starter template applied!');
                window.dispatchEvent(new CustomEvent('truespend:tier-changed'));
              }}
            />
          </div>
        )}
      </div>

      {/* ── Auto-Budget Modal (Spex AI Personalized Pattern + 3 Fixed Plans) ── */}
      <MotionModal
        isOpen={autoBudgetOpen}
        onClose={() => !autoBudgetLoading && !spexGenerating && setAutoBudgetOpen(false)}
        zIndexClass="z-50"
        containerClassName="w-full sm:max-w-2xl my-auto"
      >
        <Card
          className="w-full shadow-2xl rounded-2xl max-h-[92dvh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
            <CardHeader className="flex-shrink-0 pb-2 border-b border-gray-100 dark:border-gray-800">
              {/* drag handle on mobile */}
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3 sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />
                  <span className="truncate">Auto-Budget — {monthLabel(monthRef.year, monthRef.month)}</span>
                </CardTitle>
                <button
                  type="button"
                  onClick={() => !autoBudgetLoading && !spexGenerating && setAutoBudgetOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 overflow-y-auto flex-1 pt-4 pb-6">
              {/* Income sources (Strict Net Income — Reimbursements Excluded) */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                    Net Period Income Baseline (Reimbursements Excluded)
                  </p>
                  {(fourPillar.reimbursedIncomeExcluded > 0 || localPatternSummary.totalReimbursementsStrippedMad > 0) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      ✓ Reimbursements Stripped
                    </span>
                  )}
                </div>
                {incomeBreakdown.items.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Using historical financial period median net income:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                      {effectiveTargetIncome.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
                    </strong>
                  </p>
                ) : (
                  incomeBreakdown.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600 dark:text-gray-300 truncate flex-1 pr-4">{item.label}</span>
                      <span className="font-medium font-mono text-emerald-600 shrink-0">
                        +{item.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
                      </span>
                    </div>
                  ))
                )}
                {fourPillar.reimbursedIncomeExcluded > 0 && (
                  <div className="flex justify-between text-[11px] text-amber-700 dark:text-amber-400 pt-1 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <span>🔙 Reimbursements excluded from income this period:</span>
                    <span className="font-mono font-semibold">
                      -{fourPillar.reimbursedIncomeExcluded.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD (Not Income)
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-sm sm:text-base">
                  <span>Available Net Income for {monthLabel(monthRef.year, monthRef.month)}</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                    {effectiveTargetIncome.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
                  </span>
                </div>
              </div>

              {/* Plan selector: Spex AI Pattern Plan + 3 Fixed Plans */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Choose Budget Plan</p>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Plan 1: Spex AI Personalized Pattern Plan (Advanced Mode) */}
                  {isAdvanced && (
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                      selectedPlan === 'spex_ai'
                        ? 'border-indigo-500 bg-gradient-to-r from-indigo-50/90 via-purple-50/50 to-emerald-50/50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-emerald-950/20 shadow-xs ring-1 ring-indigo-500/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value="spex_ai"
                      checked={selectedPlan === 'spex_ai'}
                      onChange={() => setSelectedPlan('spex_ai')}
                      className="mt-1.5 accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <SpexAvatar size={28} animated={spexGenerating} state={spexGenerating ? 'review' : 'idle'} />
                          <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                            Spex AI — Personalized Pattern Plan
                          </span>
                          <span className="rounded-full bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-bold">
                            AI Pattern Engine
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {localPatternSummary.periodsOldestToCurrent.length} Financial Period{localPatternSummary.periodsOldestToCurrent.length !== 1 ? 's' : ''} (Oldest → Current)
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        Follows <strong>your TrueSpend Personal Pattern Rule</strong> instead of rigid 50/30/20 rules: groups all historical transactions by financial periods from oldest ({oldestPeriodLabel}) to current ({latestPeriodLabel}), strips out all reimbursements, locks active subscriptions ({activeSubscriptionsMonthlyMad.toFixed(0)} MAD/mo) &amp; payable debts ({recommendedDebtAllocation.toFixed(0)} MAD/mo), and retains surplus in your bank.
                      </p>
                    </div>
                  </label>
                  )}

                  {/* 3 Fixed Plans */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(Object.entries(BUDGET_PLANS) as [FixedPlanKey, (typeof BUDGET_PLANS)[FixedPlanKey]][]).map(([key, plan]) => (
                      <label
                        key={key}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                          selectedPlan === key
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={key}
                          checked={selectedPlan === key}
                          onChange={() => setSelectedPlan(key)}
                          className="mt-1 accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs sm:text-sm leading-snug">{plan.name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{plan.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Spex AI Pattern Plan Interactive Workspace ── */}
              {selectedPlan === 'spex_ai' && (
                <div className="space-y-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/15 p-3.5">
                  {/* Chronological Financial Periods Progression Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        Chronological Financial Periods Analyzed: {oldestPeriodLabel} → {latestPeriodLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPeriodHistory((v) => !v)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {showPeriodHistory
                        ? 'Hide Period-by-Period Progression'
                        : `Inspect ${localPatternSummary.periodsOldestToCurrent.length} Financial Periods`}
                    </button>
                  </div>

                  {/* Collapsible Oldest -> Current Financial Periods Table */}
                  {showPeriodHistory && localPatternSummary.periodsOldestToCurrent.length > 0 && (
                    <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-900 overflow-x-auto max-h-44">
                      <table className="w-full text-[11px] font-mono">
                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 sticky top-0">
                          <tr>
                            <th className="text-left px-2.5 py-1.5 font-sans">Period (Oldest → Current)</th>
                            <th className="text-right px-2 py-1.5 font-sans">Net Income</th>
                            <th className="text-right px-2 py-1.5 font-sans">Obligations</th>
                            <th className="text-right px-2 py-1.5 font-sans">Myself</th>
                            <th className="text-right px-2 py-1.5 font-sans">Retained/Saved</th>
                            <th className="text-right px-2.5 py-1.5 font-sans">Reimb. Stripped</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {localPatternSummary.periodsOldestToCurrent.map((p, idx) => (
                            <tr key={`${p.year}-${p.month}-${idx}`} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                              <td className="px-2.5 py-1.5 font-sans font-medium text-gray-800 dark:text-gray-200">
                                #{idx + 1} {p.monthName}
                              </td>
                              <td className="px-2 py-1.5 text-right text-emerald-600">
                                {p.netIncomeMad.toFixed(0)}
                              </td>
                              <td className="px-2 py-1.5 text-right text-indigo-600 dark:text-indigo-400">
                                {p.spentOnObligationsMad.toFixed(0)}
                              </td>
                              <td className="px-2 py-1.5 text-right text-amber-600 dark:text-amber-400">
                                {p.spentOnMyselfMad.toFixed(0)}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                                {p.retainedInBankMad.toFixed(0)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right text-gray-400">
                                {(p.reimbursedInflowExcludedMad + p.reimbursedExpensesDeductedMad) > 0
                                  ? `-${(p.reimbursedInflowExcludedMad + p.reimbursedExpensesDeductedMad).toFixed(0)}`
                                  : '0'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Optional Next-Month Comments / Unusual Plans Input */}
                  <div className="space-y-2 rounded-lg bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <MessageSquarePlus className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        Optional Comments / Unusual Plans for {monthLabel(monthRef.year, monthRef.month)}
                      </label>
                      <span className="text-[10px] font-medium text-gray-400">
                        Optional — leave empty for pure historical pattern
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={spexUserNotes}
                      onChange={(e) => setSpexUserNotes(e.target.value)}
                      placeholder="E.g., 'Next month I have car insurance (2,500 MAD) and a family trip, so trim dining & coffee to compensate' — or leave blank to rely purely on your historical financial periods, subscriptions & obligations."
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none"
                    />
                    {/* Quick prompt chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        'Trim dining & coffee by 25% to boost bank retention',
                        'Add 1,500 MAD for unexpected / car maintenance next month',
                        'Traveling / family event next month (+1,000 MAD social/household)',
                        'Prioritize aggressive debt payoff & stock investment',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setSpexUserNotes((prev) => (prev ? `${prev}. ${chip}` : chip))}
                          className="text-[10px] px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {spexPlanResult
                          ? `✓ Calculated by ${spexPlanResult.modelUsed && spexPlanResult.modelUsed !== 'pattern-fallback' ? 'Spex AI (Gemini)' : 'Spex Pattern Engine'} across ${spexPlanResult.periodsAnalyzed.length} financial periods.`
                          : `Showing baseline TrueSpend Pattern across ${localPatternSummary.periodsOldestToCurrent.length} periods. Click to run Spex AI synthesis:`}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={spexGenerating}
                        onClick={() => handleGenerateSpexPlan()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shrink-0 flex items-center gap-1.5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${spexGenerating ? 'animate-spin' : ''}`} />
                        <span>
                          {spexGenerating
                            ? 'Spex Analyzing Periods…'
                            : spexPlanResult
                            ? 'Recalculate with Spex AI'
                            : 'Calculate Plan with Spex AI'}
                        </span>
                      </Button>
                    </div>
                  </div>

                  {/* Spex Executive Summary & Pattern Insight Banner */}
                  <div className="rounded-lg bg-white/90 dark:bg-gray-900/90 border border-indigo-100 dark:border-indigo-900/50 p-3 space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <SpexAvatar size={24} state={spexGenerating ? 'review' : 'waving'} />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                          {spexPlanResult?.planName || 'Spex Personalized Pattern Plan (Chronological Net-Habit Model)'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          {spexPlanResult?.executiveSummary ||
                            `Built directly from your ${localPatternSummary.periodsOldestToCurrent.length} chronological financial periods (${oldestPeriodLabel} → ${latestPeriodLabel}). All friend splits and reimbursements (${localPatternSummary.totalReimbursementsStrippedMad.toFixed(0)} MAD total) were stripped so every category reflects your true net spending.`}
                        </p>
                        {spexPlanResult?.patternInsights && spexPlanResult.patternInsights.length > 0 && (
                          <p className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                            💡 {spexPlanResult.patternInsights[0]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 4-Pillar Pattern Summary Pills */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] font-mono">
                      <div className="rounded bg-indigo-50/70 dark:bg-indigo-950/40 px-2 py-1">
                        <span className="text-gray-500 dark:text-gray-400 block font-sans text-[10px]">🏛️ Obligations</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300">
                          {effectiveSpexPillarSummary.obligationsMad.toFixed(0)} MAD ({effectiveSpexPillarSummary.obligationsPct}%)
                        </span>
                      </div>
                      <div className="rounded bg-amber-50/70 dark:bg-amber-950/40 px-2 py-1">
                        <span className="text-gray-500 dark:text-gray-400 block font-sans text-[10px]">✨ Spent on Myself</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">
                          {effectiveSpexPillarSummary.myselfMad.toFixed(0)} MAD ({effectiveSpexPillarSummary.myselfPct}%)
                        </span>
                      </div>
                      <div className="rounded bg-blue-50/70 dark:bg-blue-950/40 px-2 py-1">
                        <span className="text-gray-500 dark:text-gray-400 block font-sans text-[10px]">📈 Investments</span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {effectiveSpexPillarSummary.investmentsMad.toFixed(0)} MAD ({effectiveSpexPillarSummary.investmentsPct}%)
                        </span>
                      </div>
                      <div className="rounded bg-emerald-50/70 dark:bg-emerald-950/40 px-2 py-1">
                        <span className="text-gray-500 dark:text-gray-400 block font-sans text-[10px]">🏦 Kept in Bank</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {effectiveSpexPillarSummary.retainedInBankMad.toFixed(0)} MAD ({effectiveSpexPillarSummary.retainedInBankPct}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Breakdown Preview (Supports both Spex AI Pattern Plan with inline edit & Fixed Plans) */}
              {effectiveTargetIncome > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {selectedPlan === 'spex_ai'
                        ? 'Spex Pattern Category Allocations (Editable before applying)'
                        : 'Category Breakdown Preview'}
                    </p>
                    {selectedPlan === 'spex_ai' && Object.keys(spexCustomOverrides).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSpexCustomOverrides({})}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                      >
                        Reset manual edits
                      </button>
                    )}
                  </div>

                  {selectedPlan === 'spex_ai' ? (
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 text-xs sm:text-sm">
                      {effectiveSpexAllocations.map((item) => (
                        <div key={item.category} className="p-2.5 sm:px-3.5 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {item.category}
                              </span>
                              <span className="text-[10px] font-mono text-gray-400 shrink-0">
                                Hist. Net Avg: {item.historicalNetAvgMad.toFixed(0)} MAD
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-mono text-gray-400 w-12 text-right">
                                {item.pctOfIncome.toFixed(1)}%
                              </span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="50"
                                  value={item.amount}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0);
                                    setSpexCustomOverrides((prev) => ({
                                      ...prev,
                                      [item.category]: val,
                                    }));
                                  }}
                                  className="w-20 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-right font-mono text-xs font-bold text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                                />
                                <span className="text-[11px] font-mono text-gray-500">MAD</span>
                              </div>
                            </div>
                          </div>
                          {item.reasoning && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                              {item.reasoning}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                      {Object.entries(BUDGET_PLANS[selectedPlan].rules).map(([cat, pct]) => (
                        <div key={cat} className="flex justify-between py-1.5 px-3">
                          <span className="truncate flex-1 pr-4 text-gray-700 dark:text-gray-300">{cat}</span>
                          <span className="text-gray-400 shrink-0 mr-4 w-10 text-right">{pct}%</span>
                          <span className="font-semibold shrink-0 w-28 text-right text-gray-900 dark:text-gray-100 font-mono">
                            {((effectiveTargetIncome * pct) / 100).toLocaleString('fr-MA', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}{' '}
                            MAD
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {effectiveTargetIncome === 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-300">
                  ⚠️ No income detected. Please schedule a payroll in the <strong>Financial Calendar</strong> or add income transactions first.
                </div>
              )}

              <p className="text-xs text-gray-400">
                ⚠️ Applying will <strong>overwrite</strong> all existing budgets for {monthLabel(monthRef.year, monthRef.month)}.
              </p>

              <div className="flex justify-end gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAutoBudgetOpen(false)}
                  disabled={autoBudgetLoading || spexGenerating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyAutoBudget}
                  disabled={autoBudgetLoading || spexGenerating || effectiveTargetIncome === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                >
                  {autoBudgetLoading
                    ? 'Applying…'
                    : selectedPlan === 'spex_ai'
                    ? 'Apply Spex Pattern Plan'
                    : 'Apply Auto-Budget'}
                </Button>
              </div>
            </CardContent>
          </Card>
      </MotionModal>
    </div>
  );
};
