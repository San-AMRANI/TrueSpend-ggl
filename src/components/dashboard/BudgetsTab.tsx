import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { CategoryBudget, Payroll, Transaction, Debt, Goal, Subscription, DashboardTab, InvestmentsData } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { SpexAvatar } from '../common/SpexAvatar';
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
      '🍔 Dining & Takeaway': 6,
      '👕 Personal & Clothing': 4,
      '🎬 Entertainment': 4,
      '👥 Social': 3,
      '☕ Coffee & Quick Food': 3,
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
      '🎬 Entertainment': 3,
      '👥 Social': 3,
      '☕ Coffee & Quick Food': 2,
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
      '🍔 Dining & Takeaway': 5,
      '👕 Personal & Clothing': 4,
      '🎬 Entertainment': 3,
      '👥 Social': 2,
      '☕ Coffee & Quick Food': 2,
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
};

const DEFAULT_COLOR = '#6b7280';

const categoryColor = (cat: string) => CATEGORY_COLORS[cat] ?? DEFAULT_COLOR;

const statusConfig = {
  normal: { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2, label: 'On Track' },
  warning: { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: AlertTriangle, label: 'Warning' },
  over_budget: { bar: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', icon: TrendingUp, label: 'Over Budget' },
  critical: { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: AlertTriangle, label: 'Critical' },
  not_set: { bar: 'bg-gray-300 dark:bg-gray-700', badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: Target, label: 'No Budget' },
};

const PILLAR_META: Record<FinancialPillar, { label: string; badgeClass: string }> = {
  obligations: {
    label: '🏛️ Obligation & Need',
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
  },
  myself: {
    label: '✨ Spent on Myself',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  },
  investments: {
    label: '📈 Wealth Investment',
    badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
  },
  savings: {
    label: '🏦 Bank Retention & Savings',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
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

function predictDaysToOverspend(spent: number, budget: number, year: number, month: number): number | null {
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const elapsed = now.getUTCDate();
  if (elapsed === 0 || spent === 0) return null;
  const dailyRate = spent / elapsed;
  if (dailyRate === 0) return null;
  const remaining = budget - spent;
  if (remaining <= 0) return 0;
  const daysLeft = Math.floor(remaining / dailyRate);
  return daysLeft > daysInMonth - elapsed ? null : daysLeft;
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
  const daysWarning = !isWealth && amount !== undefined && isCurrentMonth ? predictDaysToOverspend(spent, amount, year, month) : null;
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
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Category accent bar */}
      <div className="h-1 w-full" style={{ background: color }} />
      <CardHeader className="pb-2 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug truncate">
              {category}
            </CardTitle>
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${pillarMeta.badgeClass}`}>
              {pillarMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badge}`}>
              <StatusIcon className="h-3 w-3" />
              {status.status === 'not_set'
                ? isWealth
                  ? 'No target'
                  : 'No budget'
                : isWealth && status.usagePercentage >= 100
                ? `${status.usagePercentage.toFixed(0)}% Met`
                : `${status.usagePercentage.toFixed(0)}%`}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {/* Spent / Budget display */}
        {amount !== undefined ? (
          <>
            <div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono tabular-nums">
                <span>
                  {spent.toFixed(2)} MAD {isSavings ? 'retained / saved' : isWealth ? 'invested' : 'spent'}
                </span>
                <span>
                  {amount.toFixed(2)} MAD {isWealth ? 'target' : 'budget'}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${statusCfg.bar}`}
                  style={{ width: `${Math.min(100, status.usagePercentage)}%` }}
                />
              </div>
            </div>

            {isWealth ? (
              <div className={`flex items-center gap-1 text-xs font-medium ${status.remaining <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {status.remaining <= 0 ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Target Achieved! {Math.abs(status.remaining) > 0.5 ? `+${Math.abs(status.remaining).toFixed(2)} MAD above target` : '100% protected'}
                    </span>
                  </>
                ) : (
                  <>
                    <Target className="h-3.5 w-3.5 shrink-0" />
                    <span>{status.remaining.toFixed(2)} MAD left to reach target</span>
                  </>
                )}
              </div>
            ) : (
              <div className={`flex items-center gap-1 text-xs font-medium ${status.remaining < 0 ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                {status.remaining < 0 ? (
                  <><TrendingUp className="h-3 w-3" />{Math.abs(status.remaining).toFixed(2)} MAD over budget</>
                ) : (
                  <><TrendingDown className="h-3 w-3" />{status.remaining.toFixed(2)} MAD remaining</>
                )}
              </div>
            )}

            {/* Bank-as-Savings Retention Breakdown for 🛟 Emergency & goals Fund */}
            {isSavings && retentionMeta && (
              <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-emerald-900 dark:text-emerald-200 font-semibold">
                  <span className="flex items-center gap-1">
                    <Landmark className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    Kept in Bank (No Tx Needed):
                  </span>
                  <span className="font-mono tabular-nums">
                    {(isCurrentMonth ? retentionMeta.protectedBankRetention : retentionMeta.liveRetainedInBank).toFixed(0)} MAD
                  </span>
                </div>
                {isCurrentMonth && (
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span>Live Unspent Salary in Bank:</span>
                    <span className="font-mono tabular-nums font-medium">{retentionMeta.liveRetainedInBank.toFixed(0)} MAD</span>
                  </div>
                )}
                {retentionMeta.explicitTxAmount > 0 && (
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span>Explicit Savings Transfers:</span>
                    <span className="font-mono tabular-nums font-medium">+{retentionMeta.explicitTxAmount.toFixed(0)} MAD</span>
                  </div>
                )}
              </div>
            )}

            {pace && (
              <p className={`text-xs ${pace.difference > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {Math.abs(pace.difference).toFixed(2)} MAD {pace.difference > 0 ? 'ahead of pace' : 'behind pace'}
              </p>
            )}
            {/* Adaptive daily category limit (only for consumption categories) */}
            {!isWealth && amount !== undefined && isCurrentMonth && pace && pace.daysInMonth > 0 && (
              (() => {
                const daysLeft = Math.max(1, pace.daysInMonth - pace.elapsedDays);
                const remaining = Math.max(0, amount - spent);
                const dailyLimit = remaining / daysLeft;
                return (
                  <div className="flex items-center gap-1.5 rounded-md bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1.5 text-xs">
                    <span className="font-medium text-indigo-700 dark:text-indigo-300 font-mono tabular-nums">
                      {dailyLimit.toFixed(0)} MAD/day
                    </span>
                    <span className="text-indigo-500 dark:text-indigo-400">
                      for {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </span>
                  </div>
                );
              })()
            )}
            {daysWarning !== null && daysWarning <= 5 && (
              <div className="flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                At this pace, budget exceeded in ~{daysWarning} day{daysWarning !== 1 ? 's' : ''}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isSavings
                ? `${spent.toFixed(2)} MAD currently retained in bank · Set a target to lock your savings buffer.`
                : spent > 0
                ? `${spent.toFixed(2)} MAD ${isWealth ? 'invested' : 'spent'} · Set a budget to track.`
                : 'No spending or budget yet.'}
            </p>
            {isSavings && retentionMeta && retentionMeta.liveRetainedInBank > 0 && (
              <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>🏦 Live Unspent Salary in Bank:</span>
                <span className="font-mono font-bold tabular-nums">{retentionMeta.liveRetainedInBank.toFixed(0)} MAD</span>
              </div>
            )}
          </div>
        )}

        {/* Edit / Delete row */}
        {editing ? (
          <div className="flex gap-2 pt-1">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-sm"
              placeholder="Amount MAD"
              autoFocus
            />
            <Button type="button" size="icon" className="h-8 w-8 shrink-0" disabled={saving} onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => { setDraft(budget?.amount ?? ''); setEditing(true); }}
            >
              <Pencil className="mr-1 h-3 w-3" />
              {budget ? (isWealth ? 'Edit target' : 'Edit budget') : isWealth ? 'Set target' : 'Set budget'}
            </Button>
            {budget && onDelete && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 text-red-500 hover:bg-red-50 hover:border-red-200 dark:hover:bg-red-900/20"
                disabled={deleting}
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
      label: '🏛️ Obligations & Needs',
      pct: needsPct,
      setPct: setNeedsPct,
      categories: NEEDS_CATEGORIES,
      color: '#6366f1',
      spent: fourPillar.spentOnObligations,
      isWealth: false,
      subNote: `Housing, Groceries, Transport, Family & Debt (${fourPillar.obligationsPctOfIncome.toFixed(1)}% of income)`,
    },
    {
      label: '✨ Spent on Myself (Wants)',
      pct: wantsPct,
      setPct: setWantsPct,
      categories: WANTS_CATEGORIES,
      color: '#f97316',
      spent: fourPillar.spentOnMyself,
      isWealth: false,
      subNote: `Dining, Coffee, Clothing, Entertainment & Social (${fourPillar.myselfPctOfIncome.toFixed(1)}% of income)`,
    },
    {
      label: '🏦 Retained in Bank & Invested',
      pct: savingsPct,
      setPct: setSavingsPct,
      categories: SAVINGS_CATEGORIES,
      color: '#10b981',
      spent: fourPillar.effectiveSavedForBudget + fourPillar.investedAmount,
      isWealth: true,
      subNote: `Kept in Bank: ${fourPillar.effectiveSavedForBudget.toFixed(0)} MAD + Invested: ${fourPillar.investedAmount.toFixed(0)} MAD (No dummy tx needed)`,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The 50/30/20 rule splits your monthly income ({baseAmount.toFixed(0)} MAD) into <strong>Obligations</strong>, <strong>Spent on Myself</strong>, and <strong>Bank-Retained Savings &amp; Investments</strong>.
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
            <Card key={g.label} className="overflow-hidden">
              <div className="h-1" style={{ background: g.color }} />
              <CardHeader className="pb-2 pt-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">{g.label}</CardTitle>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={g.pct}
                    onChange={(e) => g.setPct(Number(e.target.value) || 0)}
                    className="w-16 h-7 text-xs text-right p-1"
                  />
                  <span className="text-xs text-gray-500">%</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-2xl font-bold tabular-nums font-mono" style={{ color: g.color }}>
                  {g.spent.toFixed(0)} MAD
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{g.subNote}</p>
                {target > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Target ({g.pct}%): {target.toFixed(0)} MAD
                  </p>
                )}
                {target > 0 && (
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                )}
                {g.isWealth ? (
                  over ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ +{(g.spent - target).toFixed(0)} MAD retained above target!
                    </p>
                  ) : (
                    target > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {(target - g.spent).toFixed(0)} MAD more needed to hit target
                      </p>
                    )
                  )
                ) : (
                  over && <p className="text-xs text-red-500 font-medium">{(g.spent - target).toFixed(0)} MAD over limit</p>
                )}
                <ul className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5 pt-1">
                  {g.categories.slice(0, 4).map((c) => (
                    <li key={c} className="truncate">
                      {c}
                    </li>
                  ))}
                  {g.categories.length > 4 && <li>+{g.categories.length - 4} more</li>}
                </ul>
              </CardContent>
            </Card>
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
  onDelete,
}: {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  year: number;
  month: number;
  payrolls: Payroll[];
  wallets?: Array<{ id: string; type?: string }>;
  fourPillar: FourPillarBreakdown;
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Spendable Living Envelopes</p>
          <p className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">{totalLivingEnvelope.toFixed(2)} MAD</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Living Spent (Obligations + Myself)</p>
          <p className="text-xl font-bold font-mono tabular-nums text-orange-600">{totalLivingSpent.toFixed(2)} MAD</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Spendable Remaining</p>
          <p className={`text-xl font-bold font-mono tabular-nums ${totalLivingLeft < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalLivingLeft.toFixed(2)} MAD</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Retained in Bank &amp; Invested</p>
          <p className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
            {(fourPillar.effectiveSavedForBudget + fourPillar.investedAmount).toFixed(2)} MAD
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {monthBudgets.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No envelopes for this month. Add category budgets above.</p>
        )}
        {livingBudgets.map((b) => {
          const spent = getCategorySpending(transactions, b.category, year, month, payrolls, wallets);
          const amount = parseFloat(b.amount);
          const left = amount - spent;
          const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
          const color = categoryColor(b.category);
          const pillar = getCategoryPillar(b.category);
          return (
            <div key={b.id} className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
              <div className="h-9 w-1 rounded-full shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.category}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${PILLAR_META[pillar].badgeClass}`}>
                      {pillar === 'myself' ? '✨ Myself' : '🏛️ Obligation'}
                    </span>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 tabular-nums font-mono ${left < 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                    {left < 0 ? '-' : ''}{Math.abs(left).toFixed(0)} MAD left
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">{spent.toFixed(0)} / {amount.toFixed(0)} MAD spent</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => onDelete(b.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}

        {wealthBudgets.length > 0 && (
          <div className="pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 px-1">
              🏦 Wealth Retention &amp; Investment Targets (Backed by Bank Balance &amp; Transfers)
            </p>
            {wealthBudgets.map((b) => {
              const isSavings = isSavingsRetentionCategory(b.category);
              const allocated = isSavings
                ? fourPillar.effectiveSavedForBudget
                : getCategorySpending(transactions, b.category, year, month, payrolls, wallets);
              const amount = parseFloat(b.amount);
              const pct = amount > 0 ? Math.min(100, (allocated / amount) * 100) : 0;
              const color = categoryColor(b.category);
              return (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 px-4 py-3">
                  <div className="h-9 w-1 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{b.category}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold shrink-0">
                          {isSavings ? '🏦 Auto-Retained in Bank' : '📈 Capital Deployed'}
                        </span>
                      </div>
                      <span className="text-sm font-bold shrink-0 tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
                        {allocated >= amount ? `✓ Target Met (${allocated.toFixed(0)} MAD)` : `${(amount - allocated).toFixed(0)} MAD to target`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                      {allocated.toFixed(0)} / {amount.toFixed(0)} MAD {isSavings ? 'retained in bank (no transaction needed)' : 'invested'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => onDelete(b.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
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
  const { token } = useAuth();
  const [monthRef, setMonthRef] = useState(() => getCurrentFinancialMonth(payrolls) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [budgetModel, setBudgetModel] = useState<BudgetModel>('category');
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [newCategory, setNewCategory] = useState<string>(expenseCategories[0]);
  const [newAmount, setNewAmount] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [autoBudgetOpen, setAutoBudgetOpen] = useState(false);
  const [autoBudgetLoading, setAutoBudgetLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('spex_ai');
  const [spexUserNotes, setSpexUserNotes] = useState('');
  const [spexGenerating, setSpexGenerating] = useState(false);
  const [spexPlanResult, setSpexPlanResult] = useState<Awaited<ReturnType<typeof dashboardService.generateSpexBudgetPlan>> | null>(null);
  const [spexCustomOverrides, setSpexCustomOverrides] = useState<Record<string, number>>({});
  const [showPeriodHistory, setShowPeriodHistory] = useState(false);

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
      }),
    [transactions, budgets, monthRef, payrolls, wallets, isCurrentMonth]
  );

  // Effective spent/allocated for any category (automatically crediting Bank Retention for 🛟 Emergency & goals Fund)
  const getEffectiveCategoryAmount = useCallback(
    (cat: string) => {
      const norm = normalizeCategory(cat);
      if (isSavingsRetentionCategory(norm)) {
        return fourPillar.effectiveSavedForBudget;
      }
      return getCategorySpending(transactions, norm, monthRef.year, monthRef.month, payrolls, wallets);
    },
    [fourPillar.effectiveSavedForBudget, transactions, monthRef, payrolls, wallets]
  );

  // All active categories for current view (have budget or have spending/allocations or retained savings)
  const budgetRows = useMemo(() => {
    const active = new Set<string>();
    budgets.filter((b) => b.year === monthRef.year && b.month === monthRef.month).forEach((b) => active.add(normalizeCategory(b.category)));
    transactions
      .filter((tx) => {
        if (!isInMonth(tx, monthRef.year, monthRef.month, payrolls)) return false;
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
  }, [budgets, monthRef, transactions, payrolls, wallets, fourPillar.effectiveSavedForBudget, fourPillar.liveRetainedInBank]);

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
      }),
    [transactions, payrolls, monthRef.year, monthRef.month, totalIncome, subscriptions, debts, wallets]
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

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Budget &amp; Salary Retention Planner</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bank-as-Savings hybrid engine: plan what you spend on Obligations &amp; Yourself, and automatically retain the rest in your bank.
          </p>
        </div>
        {/* Month navigator & Auto Budget */}
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setAutoBudgetOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700 dark:text-white mr-2 whitespace-nowrap shrink-0">
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Budget
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={() => setMonthRef(getCurrentFinancialMonth(payrolls) || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 })} className="whitespace-nowrap shrink-0">
            {monthLabel(monthRef.year, monthRef.month)}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── 4-Pillar Salary & Bank-Retention Vision Hub ── */}
      <Card className="border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/40 via-white to-emerald-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950/20 shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  4-Pillar Salary &amp; Bank-Retention Architecture
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Zero-Transaction Bank Retention Active
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Your salary account is your savings account: you only spend what you allocate to <strong>Obligations</strong> &amp; <strong>Yourself</strong>, and the rest stays protected in your bank without needing a dummy savings transaction.
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Period Income Baseline</p>
              <p className="text-lg font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                <AnimatedMetricValue value={totalIncome} suffix=" MAD" />
              </p>
            </div>
          </div>

          {/* 4-Pillar Stacked Allocation Bar */}
          {totalIncome > 0 && (
            <div className="space-y-1.5">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'left' }}
                className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex"
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
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (fourPillar.investedAmount / totalIncome) * 100)}%` }}
                  title={`Invested: ${fourPillar.investedAmount.toFixed(0)} MAD`}
                />
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (fourPillar.totalActualRetainedAndSaved / totalIncome) * 100)}%` }}
                  title={`Retained in Bank & Saved: ${fourPillar.totalActualRetainedAndSaved.toFixed(0)} MAD`}
                />
              </motion.div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  Obligations: {fourPillar.obligationsPctOfIncome.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Myself: {fourPillar.myselfPctOfIncome.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Invested: {fourPillar.investedPctOfIncome.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Kept in Bank / Saved: {fourPillar.savedPctOfIncome.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* 4 Pillar Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Pillar 1: Obligations */}
            <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-gray-900/90 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">🏛️ Spent on Obligations</span>
                <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  {fourPillar.obligationsPctOfIncome.toFixed(1)}% of inc.
                </span>
              </div>
              <p className="text-xl font-black font-mono tabular-nums text-gray-900 dark:text-white">
                <AnimatedMetricValue value={fourPillar.spentOnObligations} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                Budget: {fourPillar.plannedObligationsBudget.toFixed(0)} MAD •{' '}
                {fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations >= 0
                  ? `${(fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations).toFixed(0)} left`
                  : `${Math.abs(fourPillar.plannedObligationsBudget - fourPillar.spentOnObligations).toFixed(0)} over`}
              </p>
            </div>

            {/* Pillar 2: Spent on Myself */}
            <div className="rounded-xl border border-amber-100 dark:border-amber-900/50 bg-white dark:bg-gray-900/90 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">✨ Spent on Myself</span>
                <span className="text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {fourPillar.myselfPctOfIncome.toFixed(1)}% of inc.
                </span>
              </div>
              <p className="text-xl font-black font-mono tabular-nums text-gray-900 dark:text-white">
                <AnimatedMetricValue value={fourPillar.spentOnMyself} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                Budget: {fourPillar.plannedMyselfBudget.toFixed(0)} MAD •{' '}
                {fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself >= 0
                  ? `${(fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself).toFixed(0)} left`
                  : `${Math.abs(fourPillar.plannedMyselfBudget - fourPillar.spentOnMyself).toFixed(0)} over`}
              </p>
            </div>

            {/* Pillar 3: Invested */}
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-white dark:bg-gray-900/90 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">📈 Invested (Wealth)</span>
                <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {fourPillar.investedPctOfIncome.toFixed(1)}% of inc.
                </span>
              </div>
              <p className="text-xl font-black font-mono tabular-nums text-gray-900 dark:text-white">
                <AnimatedMetricValue value={fourPillar.investedAmount} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                Target: {fourPillar.plannedInvestmentBudget.toFixed(0)} MAD • Stocks &amp; Crypto
              </p>
            </div>

            {/* Pillar 4: Retained in Bank & Saved */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">🏦 Retained in Bank</span>
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {fourPillar.savedPctOfIncome.toFixed(1)}% kept
                </span>
              </div>
              <p className="text-xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                <AnimatedMetricValue value={fourPillar.effectiveSavedForBudget} decimals={0} suffix=" MAD" />
              </p>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-mono">
                Live in Bank: {fourPillar.liveRetainedInBank.toFixed(0)} MAD
                {fourPillar.plannedSavingsBudget > 0 ? ` • Target: ${fourPillar.plannedSavingsBudget.toFixed(0)}` : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Spendable Living Budget</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            <AnimatedMetricValue value={livingBudgetTotal} decimals={0} />
          </p>
          <p className="text-xs text-gray-400 font-mono">
            MAD ({totalBudget.toFixed(0)} total w/ wealth)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Living Spent So Far</p>
          <p className={`text-2xl font-bold font-mono tabular-nums ${livingSpentTotal > livingBudgetTotal && livingBudgetTotal > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
            <AnimatedMetricValue value={livingSpentTotal} decimals={0} />
          </p>
          <p className="text-xs text-gray-400 font-mono">
            Oblig: {fourPillar.spentOnObligations.toFixed(0)} • Myself: {fourPillar.spentOnMyself.toFixed(0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Spendable Remaining</p>
          <p className={`text-2xl font-bold font-mono tabular-nums ${livingRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {livingBudgetTotal > 0 ? <AnimatedMetricValue value={livingRemaining} decimals={0} /> : '—'}
          </p>
          <p className="text-xs text-gray-400">MAD safe to spend</p>
        </Card>
        <Card className="p-4 flex flex-col items-start">
          <p className="text-xs text-gray-500 dark:text-gray-400">Budget Health Score</p>
          <div className="flex items-end gap-2">
            <p className={`text-2xl font-bold ${gradeColor}`}>{grade}</p>
            <p className="text-sm text-gray-500 mb-0.5 font-mono">
              <AnimatedMetricValue value={healthScore} decimals={0} />/100
            </p>
          </div>
          <p className="text-xs text-gray-400">{overBudgetCount > 0 ? `${overBudgetCount} living cat. over budget` : 'All living budgets on track'}</p>
        </Card>
      </div>

      {/* ── Overall Living Consumption Pace Bar ── */}
      {livingBudgetTotal > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Monthly Living Spending Pace (Obligations + Spent on Myself)
              </div>
              <span className={`text-sm font-semibold font-mono tabular-nums ${pace.difference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pace.difference > 0 ? '+' : ''}{pace.difference.toFixed(2)} MAD vs ideal pace
              </span>
            </div>
            <div className="flex items-center gap-3">
              <AnimatedProgressBar
                className="flex-1"
                trackClassName="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
                percent={livingBudgetTotal > 0 ? (livingSpentTotal / livingBudgetTotal) * 100 : 0}
                barClassName={livingSpentTotal > livingBudgetTotal ? 'bg-red-500' : pace.difference > 0 ? 'bg-amber-500' : 'bg-emerald-500'}
              />
              <span className="text-sm tabular-nums font-mono text-gray-500 dark:text-gray-400 shrink-0">
                {livingBudgetTotal > 0 ? `${Math.min(100, (livingSpentTotal / livingBudgetTotal) * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1 font-mono">
              <span>0 MAD</span>
              <span>Ideal today: {pace.ideal.toFixed(0)} MAD</span>
              <span>{livingBudgetTotal.toFixed(0)} MAD Living Cap</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Interconnected Debt Payoff Reserve Hub ── */}
      {totalPayableDebt > 0 && (
        <Card className={`border overflow-hidden transition-all shadow-xs ${
          isDebtFullyReserved
            ? 'border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/50 via-white to-white dark:from-emerald-950/20 dark:via-gray-900 dark:to-gray-900'
            : 'border-orange-200 dark:border-orange-900/50 bg-gradient-to-r from-orange-50/60 via-white to-white dark:from-orange-950/20 dark:via-gray-900 dark:to-gray-900'
        }`}>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                  isDebtFullyReserved
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                    : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400'
                }`}>
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                      Debt Servicing &amp; Payoff Allocation
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isDebtFullyReserved
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
                    }`}>
                      {isDebtFullyReserved ? (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Budgeted &amp; Protected</>
                      ) : (
                        <><AlertTriangle className="h-3.5 w-3.5" /> Under-Reserved</>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                    You have <strong className="text-gray-900 dark:text-gray-200">{totalPayableDebt.toFixed(2)} MAD</strong> across {pendingPayables.length} active payable debts.
                    {isDebtFullyReserved
                      ? ` Your ${monthLabel(monthRef.year, monthRef.month)} budget safely reserves ${currentDebtBudget.toFixed(2)} MAD for debt servicing.`
                      : ` Recommended monthly payoff allocation: ${recommendedDebtAllocation.toFixed(2)} MAD. Currently only ${currentDebtBudget.toFixed(2)} MAD is budgeted for debt servicing.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                {!isDebtFullyReserved && (
                  <Button
                    size="sm"
                    disabled={reservingDebt}
                    onClick={handleAutoReserveDebt}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-9 shadow-xs flex items-center gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{reservingDebt ? 'Reserving…' : `Auto-Reserve ${recommendedDebtAllocation.toFixed(0)} MAD in Budget`}</span>
                  </Button>
                )}
                {setActiveTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('debts')}
                    className="text-xs h-9 border-gray-200 dark:border-gray-800"
                  >
                    <span>View Debts &amp; IOUs</span>
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 text-gray-400" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Interconnected Stock Portfolio & 📈 Investments Budget Hub ── */}
      {(currentInvestmentBudget > 0 || (investmentsData && (investmentsData.positions.length > 0 || investmentsData.buyingPower.investmentWalletBalanceMad > 0))) && (
        <Card className="border border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/50 via-white to-indigo-50/30 dark:from-emerald-950/20 dark:via-gray-900 dark:to-indigo-950/20 shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                      Equities &amp; Stock Portfolio Allocation (📈 Investments)
                    </h3>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                      {currentInvestmentSpent.toFixed(0)} / {currentInvestmentBudget > 0 ? currentInvestmentBudget.toFixed(0) : recommendedInvestmentBudget.toFixed(0)} MAD Funded
                    </span>
                    {investmentsData && investmentsData.buyingPower.investmentWalletBalanceMad > 0 && (
                      <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-bold font-mono tabular-nums text-amber-800 dark:text-amber-300">
                        Brokerage Cash: {investmentsData.buyingPower.investmentWalletBalanceMad.toFixed(0)} MAD
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                    {currentInvestmentBudget > 0
                      ? remainingInvestmentBudget > 0
                        ? `You have ${remainingInvestmentBudget.toFixed(2)} MAD left in your 📈 Investments target this cycle. Transferring cash to your Brokerage Reserve wallet or buying stocks directly from Bank/Cash automatically tracks against this target.`
                        : `You have fulfilled 100% of your ${currentInvestmentBudget.toFixed(0)} MAD 📈 Investments target this cycle! Buying stocks using cash already inside your Brokerage Reserve wallet will not double-count.`
                      : `You hold ${investmentsData?.positions.length || 0} stock positions worth ${(investmentsData?.totalPortfolioValueMad || 0).toFixed(0)} MAD. Set a monthly 📈 Investments target (recommended 10%: ${recommendedInvestmentBudget.toFixed(0)} MAD) to automate your Payday Stock Splitter.`}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {currentInvestmentBudget <= 0 && (
                  <Button
                    size="sm"
                    onClick={() => onSaveBudget('📈 Investments', monthRef.year, monthRef.month, recommendedInvestmentBudget)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 flex items-center gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Set {recommendedInvestmentBudget.toFixed(0)} MAD Stock Target</span>
                  </Button>
                )}
                {onFundInvestmentWallet && remainingInvestmentBudget > 0 && isCurrentMonth && (
                  <Button
                    size="sm"
                    disabled={fundingBrokerage}
                    onClick={handleFundRemainingInvestmentBudget}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 flex items-center gap-1.5"
                  >
                    <WalletCards className="h-3.5 w-3.5" />
                    <span>{fundingBrokerage ? 'Funding…' : `Fund ${remainingInvestmentBudget.toFixed(0)} MAD to Brokerage`}</span>
                  </Button>
                )}
                {setActiveTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('investments')}
                    className="text-xs h-9 border-gray-200 dark:border-gray-800"
                  >
                    <span>Open Stock Portfolio</span>
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 text-gray-400" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Interconnected Smart Surplus Sweep into Savings Goals ── */}
      {budgetSurplus > 0 && goals.length > 0 && (
        <Card className="border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-teal-50/30 to-white dark:from-indigo-950/30 dark:via-teal-950/20 dark:to-gray-900 shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Smart Surplus Sweep: Allocate Unspent Living Budget to Goals
                    </h3>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      +{budgetSurplus.toFixed(2)} MAD Unspent Living Budget
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">
                    This money is already retained in your bank account. You can optionally earmark a portion of your unspent living budget directly into a specific Savings Goal milestone.
                  </p>
                </div>
              </div>

              {/* Sweep Action Controls */}
              <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
                <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-gray-900 dark:text-gray-100 focus:outline-none px-2 py-1 max-w-[140px] truncate"
                  >
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        🎯 {g.name}
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
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-gray-700 dark:text-gray-300"
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
                    className="w-16 bg-transparent text-xs font-bold text-right text-indigo-600 dark:text-indigo-400 focus:outline-none px-1"
                  />
                  <span className="text-[10px] text-gray-400 pr-1">MAD</span>
                </div>

                <Button
                  size="sm"
                  disabled={sweeping || !onContributeGoal}
                  onClick={handleExecuteSurplusSweep}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{sweeping ? 'Sweeping…' : 'Sweep to Goal'}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Model Selector + Add Form ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800/60">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">Add / Update Budget or Retention Target</CardTitle>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                  {setCategoriesCount} / {expenseCategories.length} Set
                </span>
              </div>
              <div>
                {totalIncome > 0 ? (
                  unbudgetedIncome > 0.01 ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shadow-2xs">
                      <Landmark className="w-3.5 h-3.5 text-emerald-500" />
                      {unbudgetedIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD Unbudgeted (Auto-Retained in Bank)
                    </span>
                  ) : unbudgetedIncome < -0.01 ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      Over-allocated by {Math.abs(unbudgetedIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                      100% Allocated Across Spending &amp; Retention
                    </span>
                  )
                ) : (
                  <span className="text-xs text-gray-400 font-medium">
                    {unsetCategories.length} Categories Unbudgeted
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Allocation Meter & Quick Summary */}
            <div className="p-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                <div>
                  <span className="text-gray-400 block text-[11px] font-sans">Period Income</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {totalIncome > 0 ? `${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 0 })} MAD` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] font-sans">Spendable Budgets</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {livingBudgetTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })} MAD
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] font-sans">Wealth Targets</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {(fourPillar.plannedSavingsBudget + fourPillar.plannedInvestmentBudget).toLocaleString(undefined, { minimumFractionDigits: 0 })} MAD
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px] font-sans">Kept in Bank (Auto)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {fourPillar.effectiveSavedForBudget.toLocaleString(undefined, { minimumFractionDigits: 0 })} MAD
                  </span>
                </div>
              </div>
              {totalIncome > 0 && (
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${totalBudget > totalIncome ? 'bg-red-500' : 'bg-indigo-600'}`}
                      style={{ width: `${Math.min(100, (totalBudget / totalIncome) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{((totalBudget / totalIncome) * 100).toFixed(0)}% Explicitly Budgeted</span>
                    <span>
                      {unbudgetedIncome >= 0
                        ? `${((unbudgetedIncome / totalIncome) * 100).toFixed(0)}% Unbudgeted (Automatically Kept in Bank)`
                        : 'Over budget'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Unset Categories Quick Pick Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {unsetCategories.length > 0 ? `Unset Categories (${unsetCategories.length} remaining):` : 'All Categories Budgeted:'}
                </span>
                {unsetCategories.length > 0 && (
                  <span className="text-[11px] text-gray-400">Click a chip to set its budget</span>
                )}
              </div>
              {unsetCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {unsetCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setNewCategory(cat);
                        setNewAmount('');
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                        newCategory === cat
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold shadow-2xs scale-105'
                          : 'border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{cat}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>All 16 categories have an active budget! You can select any category below to adjust its amount.</span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleAdd} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                <div className="sm:col-span-6 space-y-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Category
                  </label>
                  <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    {expenseCategories.map((c) => {
                      const existingAmt = monthBudgetsMap.get(c) ?? 0;
                      const p = getCategoryPillar(c);
                      const tag = p === 'myself' ? 'Myself' : p === 'obligations' ? 'Obligation' : p === 'investments' ? 'Investment' : 'Bank Retention';
                      return (
                        <option key={c} value={c}>
                          {c} [{tag}] {existingAmt > 0 ? `(Set: ${existingAmt.toFixed(0)} MAD)` : '— (Unset)'}
                        </option>
                      );
                    })}
                  </Select>
                  <div className="text-[11px] pt-0.5">
                    {currentCategoryExistingBudget > 0 ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                        Current budget: {currentCategoryExistingBudget.toFixed(2)} MAD (updating will overwrite)
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Currently unset (0.00 MAD)
                      </span>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Amount (MAD)
                    </label>
                    {unbudgetedIncome > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewAmount(Math.max(0, unbudgetedIncome).toFixed(2))}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                      >
                        Fill Max ({Math.max(0, unbudgetedIncome).toFixed(0)})
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
                  />
                  {isNewAmountValid && totalIncome > 0 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      Leaves{' '}
                      <span className={projectedRemaining < 0 ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>
                        {projectedRemaining >= 0
                          ? `${projectedRemaining.toFixed(2)} MAD`
                          : `-${Math.abs(projectedRemaining).toFixed(2)} MAD`}
                      </span>{' '}
                      unbudgeted in bank
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 pt-5 sm:pt-6">
                  <Button type="submit" disabled={addSaving} className="w-full h-9 font-medium">
                    <Plus className="mr-1 h-4 w-4" />
                    {addSaving ? 'Saving…' : currentCategoryExistingBudget > 0 ? 'Update' : 'Set'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">View Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              { id: 'category', label: 'Category View', icon: LayoutGrid, desc: '4-Pillar category cards + Bank retention' },
              { id: '503020', label: '50/30/20 Rule', icon: PieChart, desc: 'Obligations / Myself / Retained split' },
              { id: 'envelope', label: 'Envelope View', icon: Layers, desc: 'Living envelopes + Wealth targets' },
            ] as { id: BudgetModel; label: string; icon: any; desc: string }[]).map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setBudgetModel(id)}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${budgetModel === id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700' : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${budgetModel === id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-sm font-medium ${budgetModel === id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Copy + Pillar Filter Bar + Donut ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={copyLoading} onClick={handleCopy} className="whitespace-nowrap shrink-0">
            <Copy className="mr-2 h-4 w-4" />
            {copyLoading ? 'Copying…' : "Copy previous month's budgets"}
          </Button>
          {budgetRows.length > 0 && totalBudget > 0 && (
            <Button type="button" variant="outline" size="sm" disabled={clearLoading} onClick={handleClearAll} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30 whitespace-nowrap shrink-0">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Pillar Filter Pills */}
        {budgetModel === 'category' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {([
              { id: 'all', label: `All (${budgetRows.length})` },
              { id: 'obligations', label: `🏛️ Obligations (${budgetRows.filter((c) => getCategoryPillar(c) === 'obligations').length})` },
              { id: 'myself', label: `✨ Spent on Myself (${budgetRows.filter((c) => getCategoryPillar(c) === 'myself').length})` },
              { id: 'wealth', label: `🏦 Saved & Invested (${budgetRows.filter((c) => isWealthAllocationCategory(c)).length})` },
            ] as { id: PillarFilter; label: string }[]).map((tab) => {
              const active = pillarFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPillarFilter(tab.id)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="budgetPillarFilterPill"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-indigo-600 shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main Content Area (switches by model) ── */}
      {budgetModel === 'category' && (
        <>
          {filteredBudgetRows.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
            <Card>
              <CardContent>
                <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  No spending or budgets in this filter for {monthLabel(monthRef.year, monthRef.month)} yet.
                  <br />Use the form above to set your first budget.
                </p>
              </CardContent>
            </Card>
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
          onSave={(cat, amount) => onSaveBudget(cat, monthRef.year, monthRef.month, amount)}
          onDelete={onDeleteBudget}
        />
      )}

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
                  {/* Plan 1: Spex AI Personalized Pattern Plan */}
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
                  ⚠️ No income detected. Please configure your salary in <strong>Settings</strong> or add income transactions first.
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
