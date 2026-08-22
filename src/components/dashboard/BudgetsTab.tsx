import React, { useMemo, useState, useCallback } from 'react';
import { CategoryBudget, Transaction } from '../../types';
import { expenseCategories } from '../../lib/categories';
import {
  budgetFor,
  getBudgetStatus,
  getCategorySpending,
  getSpendingPace,
  monthLabel,
  getExpensesForMonth,
  amountOf,
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
} from 'lucide-react';

type PlanKey = 'balanced' | 'savings_first' | 'essentials';

const BUDGET_PLANS: Record<PlanKey, { name: string; description: string; rules: Record<string, number> }> = {
  balanced: {
    name: '50/30/20 — Balanced',
    description: '50% Needs • 30% Wants • 20% Savings & Debt. Classic, widely recommended rule.',
    rules: {
      '🏠 Housing & Utilities': 25,
      '🛒 Groceries': 12,
      '🚗 Transportation': 5,
      '🩺 Health & Medical': 5,
      '📱 Telecom & Subscriptions': 3,
      '🍔 Dining & Takeaway': 7,
      '👕 Personal & Clothing': 5,
      '🎬 Entertainment': 5,
      '👥 Social': 5,
      '☕ Coffee & Quick Food': 3,
      '👨‍👩‍👦 Family & Gifts': 3,
      '📚 Education & Development': 2,
      '💰 Savings & Goals': 10,
      '💳 Debt & Obligations': 5,
      '🚨 Unexpected': 5,
    },
  },
  savings_first: {
    name: '60/20/20 — Savings First',
    description: '60% Needs • 20% Wants • 20% Savings & Debt. Great if you want to save aggressively.',
    rules: {
      '🏠 Housing & Utilities': 28,
      '🛒 Groceries': 14,
      '🚗 Transportation': 7,
      '🩺 Health & Medical': 6,
      '📱 Telecom & Subscriptions': 5,
      '🍔 Dining & Takeaway': 5,
      '👕 Personal & Clothing': 4,
      '🎬 Entertainment': 3,
      '👥 Social': 3,
      '☕ Coffee & Quick Food': 2,
      '👨‍👩‍👦 Family & Gifts': 2,
      '📚 Education & Development': 1,
      '💰 Savings & Goals': 12,
      '💳 Debt & Obligations': 5,
      '🚨 Unexpected': 3,
    },
  },
  essentials: {
    name: '70/20/10 — Essentials Mode',
    description: '70% Needs • 20% Wants • 10% Savings. For tight months when essentials come first.',
    rules: {
      '🏠 Housing & Utilities': 30,
      '🛒 Groceries': 15,
      '🚗 Transportation': 10,
      '🩺 Health & Medical': 7,
      '📱 Telecom & Subscriptions': 5,
      '🍔 Dining & Takeaway': 6,
      '👕 Personal & Clothing': 5,
      '🎬 Entertainment': 3,
      '👥 Social': 3,
      '☕ Coffee & Quick Food': 2,
      '👨‍👩‍👦 Family & Gifts': 1,
      '📚 Education & Development': 3,
      '💰 Savings & Goals': 5,
      '💳 Debt & Obligations': 3,
      '🚨 Unexpected': 2,
    },
  },
};

interface BudgetsTabProps {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  salary: number;
  payday: number;
  onSaveBudget: (category: string, year: number, month: number, amount: number) => Promise<void>;
  onSaveBudgetsBatch: (budgets: { category: string; year: number; month: number; amount: number }[]) => Promise<void>;
  onCopyPrevious: (year: number, month: number) => Promise<number>;
  onClearMonth: (year: number, month: number) => Promise<number>;
  onDeleteBudget: (id: string) => Promise<void>;
}

type BudgetModel = 'category' | '503020' | 'envelope';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  '🏠 Housing & Utilities': '#6366f1',
  '🛒 Groceries': '#22c55e',
  '🍔 Dining & Takeaway': '#f97316',
  '☕ Coffee & Quick Food': '#a78bfa',
  '🚗 Transportation': '#3b82f6',
  '📱 Telecom & Subscriptions': '#06b6d4',
  '🩺 Health & Medical': '#ec4899',
  '👕 Personal & Clothing': '#eab308',
  '🎬 Entertainment': '#8b5cf6',
  '👥 Social': '#14b8a6',
  '👨‍👩‍👦 Family & Gifts': '#f43f5e',
  '📚 Education & Development': '#0ea5e9',
  '💳 Debt & Obligations': '#ef4444',
  '💰 Savings & Goals': '#10b981',
  '🚨 Unexpected': '#9ca3af',
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

function computeBudgetHealthScore(categories: { spent: number; amount: number | undefined }[]): number {
  const withBudget = categories.filter((c) => c.amount !== undefined && c.amount > 0);
  if (!withBudget.length) return 0;
  const totalScore = withBudget.reduce((sum, c) => {
    const pct = (c.spent / c.amount!) * 100;
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
  payday: number;
  onSave: (amount: number) => Promise<void>;
  onDelete: (() => Promise<void>) | undefined;
  isCurrentMonth: boolean;
}

function BudgetCard({ category, budget, spent, year, month, payday, onSave, onDelete, isCurrentMonth }: BudgetCardProps) {
  const amount = budget ? parseFloat(budget.amount) : undefined;
  const status = getBudgetStatus(amount, spent);
  const statusCfg = statusConfig[status.status];
  const StatusIcon = statusCfg.icon;
  const pace = amount !== undefined ? getSpendingPace(spent, amount, year, month, payday) : null;
  const daysWarning = amount !== undefined && isCurrentMonth ? predictDaysToOverspend(spent, amount, year, month) : null;
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
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{category}</CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badge}`}>
              <StatusIcon className="h-3 w-3" />
              {status.status === 'not_set' ? 'No budget' : `${status.usagePercentage.toFixed(0)}%`}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {/* Spent / Budget display */}
        {amount !== undefined ? (
          <>
            <div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{spent.toFixed(2)} MAD spent</span>
                <span>{amount.toFixed(2)} MAD budget</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${statusCfg.bar}`}
                  style={{ width: `${Math.min(100, status.usagePercentage)}%` }}
                />
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${status.remaining < 0 ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
              {status.remaining < 0 ? (
                <><TrendingUp className="h-3 w-3" />{Math.abs(status.remaining).toFixed(2)} MAD over budget</>
              ) : (
                <><TrendingDown className="h-3 w-3" />{status.remaining.toFixed(2)} MAD remaining</>
              )}
            </div>
            {pace && (
              <p className={`text-xs ${pace.difference > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {Math.abs(pace.difference).toFixed(2)} MAD {pace.difference > 0 ? 'ahead of pace' : 'behind pace'}
              </p>
            )}
            {daysWarning !== null && daysWarning <= 5 && (
              <div className="flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-900/20 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                At this pace, budget exceeded in ~{daysWarning} day{daysWarning !== 1 ? 's' : ''}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">{spent > 0 ? `${spent.toFixed(2)} MAD spent · Set a budget to track.` : 'No spending or budget yet.'}</p>
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
              {budget ? 'Edit budget' : 'Set budget'}
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

// ─── 50/30/20 Rule View ───────────────────────────────────────────────────────
const NEEDS_CATEGORIES = ['🏠 Housing & Utilities', '🛒 Groceries', '🚗 Transportation', '🩺 Health & Medical', '📱 Telecom & Subscriptions'];
const WANTS_CATEGORIES = ['🍔 Dining & Takeaway', '☕ Coffee & Quick Food', '🎬 Entertainment', '👥 Social', '👕 Personal & Clothing', '👨‍👩‍👦 Family & Gifts'];
const SAVINGS_CATEGORIES = ['💰 Savings & Goals', '📚 Education & Development', '💳 Debt & Obligations'];

function Rule503020View({ budgets, transactions, totalBudget, year, month, payday }: { budgets: CategoryBudget[]; transactions: Transaction[]; totalBudget: number; year: number; month: number; payday: number }) {
  const [needsPct, setNeedsPct] = useState(50);
  const [wantsPct, setWantsPct] = useState(30);
  const [savingsPct, setSavingsPct] = useState(20);

  const calculateFromBudgets = () => {
    if (totalBudget === 0) return;
    const getGroupBudget = (cats: string[]) => budgets.filter(b => b.year === year && b.month === month && cats.includes(b.category)).reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const nB = getGroupBudget(NEEDS_CATEGORIES);
    const wB = getGroupBudget(WANTS_CATEGORIES);
    const sB = getGroupBudget(SAVINGS_CATEGORIES);
    
    setNeedsPct(Math.round((nB / totalBudget) * 100));
    setWantsPct(Math.round((wB / totalBudget) * 100));
    setSavingsPct(Math.round((sB / totalBudget) * 100));
  };

  const totalSpent = useMemo(() => {
    return getExpensesForMonth(transactions, year, month, payday).reduce((s, tx) => s + amountOf(tx), 0);
  }, [transactions, year, month, payday]);

  const getGroupSpent = (cats: string[]) =>
    getExpensesForMonth(transactions, year, month, payday)
      .filter((tx) => cats.includes(tx.category ?? ''))
      .reduce((s, tx) => s + amountOf(tx), 0);

  const groups = [
    { label: 'Needs', pct: needsPct, setPct: setNeedsPct, categories: NEEDS_CATEGORIES, color: '#6366f1', spent: getGroupSpent(NEEDS_CATEGORIES) },
    { label: 'Wants', pct: wantsPct, setPct: setWantsPct, categories: WANTS_CATEGORIES, color: '#f97316', spent: getGroupSpent(WANTS_CATEGORIES) },
    { label: 'Savings & Debt', pct: savingsPct, setPct: setSavingsPct, categories: SAVINGS_CATEGORIES, color: '#10b981', spent: getGroupSpent(SAVINGS_CATEGORIES) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The 50/30/20 rule divides your monthly spending. Modify these percentages below or calculate them automatically.
          {totalBudget > 0 ? ` Based on your ${totalBudget.toFixed(0)} MAD total budget.` : ' Set category budgets to see your total.'}
        </p>
        <Button variant="outline" size="sm" onClick={calculateFromBudgets} className="whitespace-nowrap shrink-0">
          <Target className="mr-2 h-4 w-4" /> Calculate from Budgets
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups.map((g) => {
          const target = totalBudget > 0 ? (g.pct / 100) * totalBudget : 0;
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
                <p className="text-2xl font-bold tabular-nums" style={{ color: g.color }}>{g.spent.toFixed(0)} MAD</p>
                {target > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">Target: {target.toFixed(0)} MAD</p>}
                {target > 0 && (
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                )}
                {over && <p className="text-xs text-red-500 font-medium">{(g.spent - target).toFixed(0)} MAD over target</p>}
                <ul className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5 pt-1">
                  {g.categories.slice(0, 4).map((c) => <li key={c} className="truncate">{c}</li>)}
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

// ─── Envelope View ────────────────────────────────────────────────────────────
function EnvelopeView({ budgets, transactions, year, month, payday, onSave, onDelete }: {
  budgets: CategoryBudget[];
  transactions: Transaction[];
  year: number;
  month: number;
  payday: number;
  onSave: (cat: string, amount: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const totalEnvelope = monthBudgets.reduce((s, b) => s + parseFloat(b.amount), 0);
  const totalSpent = monthBudgets.reduce((s, b) => s + getCategorySpending(transactions, b.category, year, month, payday), 0);
  const totalLeft = totalEnvelope - totalSpent;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Envelopes</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalEnvelope.toFixed(2)} MAD</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
          <p className="text-xl font-bold text-orange-600">{totalSpent.toFixed(2)} MAD</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
          <p className={`text-xl font-bold ${totalLeft < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalLeft.toFixed(2)} MAD</p>
        </div>
      </div>
      <div className="space-y-2">
        {monthBudgets.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No envelopes for this month. Add category budgets above.</p>
        )}
        {monthBudgets.map((b) => {
          const spent = getCategorySpending(transactions, b.category, year, month, payday);
          const amount = parseFloat(b.amount);
          const left = amount - spent;
          const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
          const color = categoryColor(b.category);
          return (
            <div key={b.id} className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
              <div className="h-9 w-1 rounded-full shrink-0" style={{ background: color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{b.category}</p>
                  <span className={`text-sm font-semibold shrink-0 tabular-nums ${left < 0 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                    {left < 0 ? '-' : ''}{Math.abs(left).toFixed(0)} MAD left
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{spent.toFixed(0)} / {amount.toFixed(0)} MAD</p>
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
    </div>
  );
}

import { getCurrentFinancialMonth } from '../../lib/financialMonth';

// ─── Main Component ───────────────────────────────────────────────────────────
export const BudgetsTab: React.FC<BudgetsTabProps> = ({ budgets, transactions, salary, payday, onSaveBudget, onSaveBudgetsBatch, onCopyPrevious, onClearMonth, onDeleteBudget }) => {
  const [monthRef, setMonthRef] = useState(() => getCurrentFinancialMonth(payday));
  const [budgetModel, setBudgetModel] = useState<BudgetModel>('category');
  const [newCategory, setNewCategory] = useState<string>(expenseCategories[0]);
  const [newAmount, setNewAmount] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  const [autoBudgetOpen, setAutoBudgetOpen] = useState(false);
  const [autoBudgetLoading, setAutoBudgetLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('balanced');

  const currentFM = getCurrentFinancialMonth(payday);
  const isCurrentMonth = monthRef.year === currentFM.year && monthRef.month === currentFM.month;

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = (dir: -1 | 1) => setMonthRef((cur) => {
    const d = new Date(Date.UTC(cur.year, cur.month - 1 + dir, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  });

  // All active categories for current view (have budget or have spending)
  const budgetRows = useMemo(() => {
    const active = new Set<string>();
    budgets.filter((b) => b.year === monthRef.year && b.month === monthRef.month).forEach((b) => active.add(b.category));
    transactions
      .filter((tx) => tx.type === 'Expense')
      .forEach((tx) => {
        const d = new Date(tx.createdAt);
        if (d.getUTCFullYear() === monthRef.year && d.getUTCMonth() + 1 === monthRef.month) {
          active.add(tx.category || 'Uncategorized');
        }
      });
    return Array.from(active).sort((a, b) => a.localeCompare(b));
  }, [budgets, monthRef, transactions]);

  // Summary stats
  const totalBudget = useMemo(() =>
    budgets.filter((b) => b.year === monthRef.year && b.month === monthRef.month).reduce((s, b) => s + parseFloat(b.amount), 0),
    [budgets, monthRef]);

  const totalSpent = useMemo(() =>
    budgetRows.reduce((s, cat) => s + getCategorySpending(transactions, cat, monthRef.year, monthRef.month, payday), 0),
    [budgetRows, transactions, monthRef, payday]);

  const pace = useMemo(() => getSpendingPace(totalSpent, totalBudget, monthRef.year, monthRef.month, payday), [totalSpent, totalBudget, monthRef, payday]);

  const categoryData = useMemo(() => budgetRows.map((cat) => {
    const budget = budgetFor(budgets, cat, monthRef.year, monthRef.month);
    const spent = getCategorySpending(transactions, cat, monthRef.year, monthRef.month, payday);
    return { label: cat, spent, color: categoryColor(cat), amount: budget ? parseFloat(budget.amount) : undefined };
  }), [budgets, transactions, budgetRows, monthRef, payday]);

  const healthScore = useMemo(() => computeBudgetHealthScore(categoryData), [categoryData]);
  const { grade, color: gradeColor } = gradeFromScore(healthScore);

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

  const overBudgetCount = categoryData.filter((c) => c.amount !== undefined && c.spent > c.amount).length;

  // ─── Income Calculation ───────────────────────────────────────────────────────
  // Source of truth: ALL Income-type transactions for the selected month.
  // The KpiService auto-deposits salary as a '📥 Income' transaction on payday,
  // so we never need to add the `salary` prop separately here — it's already in
  // the transactions array. If the user hasn't reached payday yet, we fall back
  // to the configured salary as an estimate.
  const incomeBreakdown = useMemo(() => {
    const items: { label: string; amount: number }[] = [];
    let total = 0;

    transactions.forEach(tx => {
      if (tx.type !== 'Income') return;
      const d = new Date(tx.createdAt);
      if (d.getUTCFullYear() !== monthRef.year || d.getUTCMonth() + 1 !== monthRef.month) return;
      const amt = parseFloat(tx.amount as any) || 0;
      if (amt <= 0) return;
      total += amt;
      items.push({
        label: tx.notes || tx.category || 'Income',
        amount: amt,
      });
    });

    // If no income transactions found for this month, use the configured salary
    // as a planning estimate (payday hasn't arrived yet, or salary not auto-deposited)
    const baseSalary = parseFloat(salary as any) || 0;
    if (total === 0 && baseSalary > 0) {
      items.push({ label: 'Estimated Salary (not yet deposited)', amount: baseSalary });
      total = baseSalary;
    }

    return { items, total };
  }, [transactions, salary, monthRef]);

  const totalIncome = incomeBreakdown.total;


  const handleApplyAutoBudget = async () => {
    setAutoBudgetLoading(true);
    try {
      const rules = BUDGET_PLANS[selectedPlan].rules;
      const newBudgets = Object.entries(rules).map(([cat, pct]) => ({
        category: cat,
        year: monthRef.year,
        month: monthRef.month,
        amount: Math.round((totalIncome * pct) / 100),
      }));
      await onSaveBudgetsBatch(newBudgets);
      setAutoBudgetOpen(false);
      showToast(`Auto-budget applied using the ${BUDGET_PLANS[selectedPlan].name} plan!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to apply auto-budget.', 'error');
    } finally {
      setAutoBudgetLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Budget Planner</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Plan, track, and control your monthly spending</p>
        </div>
        {/* Month navigator & Auto Budget */}
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setAutoBudgetOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700 dark:text-white mr-2">
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Budget
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={() => setMonthRef(getCurrentFinancialMonth(payday))}>
            {monthLabel(monthRef.year, monthRef.month)}
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Summary KPI Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Budget</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{totalBudget.toFixed(0)}</p>
          <p className="text-xs text-gray-400">MAD / month</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
          <p className={`text-2xl font-bold tabular-nums ${totalSpent > totalBudget && totalBudget > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{totalSpent.toFixed(0)}</p>
          <p className="text-xs text-gray-400">MAD so far</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
          <p className={`text-2xl font-bold tabular-nums ${totalBudget - totalSpent < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {totalBudget > 0 ? (totalBudget - totalSpent).toFixed(0) : '—'}
          </p>
          <p className="text-xs text-gray-400">MAD left</p>
        </Card>
        <Card className="p-4 flex flex-col items-start">
          <p className="text-xs text-gray-500 dark:text-gray-400">Health Score</p>
          <div className="flex items-end gap-2">
            <p className={`text-2xl font-bold ${gradeColor}`}>{grade}</p>
            <p className="text-sm text-gray-500 mb-0.5">{healthScore}/100</p>
          </div>
          <p className="text-xs text-gray-400">{overBudgetCount > 0 ? `${overBudgetCount} over budget` : 'All within budget'}</p>
        </Card>
      </div>

      {/* ── Overall Pace Bar ── */}
      {totalBudget > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
                Monthly Spending Pace
              </div>
              <span className={`text-sm font-semibold ${pace.difference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pace.difference > 0 ? '+' : ''}{pace.difference.toFixed(2)} MAD vs pace
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${totalSpent > totalBudget ? 'bg-red-500' : pace.difference > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%` }}
                />
              </div>
              <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                {totalBudget > 0 ? `${Math.min(100, (totalSpent / totalBudget) * 100).toFixed(0)}%` : '—'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0 MAD</span>
              <span>Ideal today: {pace.ideal.toFixed(0)} MAD</span>
              <span>{totalBudget.toFixed(0)} MAD</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Model Selector + Add Form ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add / Update Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
                <Select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount (MAD)</label>
                <Input required min="0" step="0.01" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
              </div>
              <Button type="submit" disabled={addSaving} className="h-9">
                <Plus className="mr-1 h-4 w-4" />
                {addSaving ? 'Saving…' : 'Set Budget'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">View Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {([
              { id: 'category', label: 'Category View', icon: LayoutGrid, desc: 'Budget by individual category' },
              { id: '503020', label: '50/30/20 Rule', icon: PieChart, desc: 'Needs / Wants / Savings split' },
              { id: 'envelope', label: 'Envelope View', icon: Layers, desc: 'Cash envelope tracking' },
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

      {/* ── Copy + Donut ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={copyLoading} onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            {copyLoading ? 'Copying…' : "Copy previous month's budgets"}
          </Button>
          {budgetRows.length > 0 && totalBudget > 0 && (
            <Button type="button" variant="outline" disabled={clearLoading} onClick={handleClearAll} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/30">
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>
        {categoryData.filter((c) => c.spent > 0).length > 0 && (
          <div className="flex items-center gap-4 flex-wrap">
            <DonutChart categories={categoryData.map(c => ({ label: c.label, value: c.spent, color: c.color }))} />
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {categoryData.filter((c) => c.spent > 0).slice(0, 6).map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="truncate max-w-[140px]">{c.label}</span>
                  <span className="ml-auto tabular-nums font-medium">{c.spent.toFixed(0)} MAD</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content Area (switches by model) ── */}
      {budgetModel === 'category' && (
        <>
          {budgetRows.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {budgetRows.map((cat) => {
                const budget = budgetFor(budgets, cat, monthRef.year, monthRef.month);
                const spent = getCategorySpending(transactions, cat, monthRef.year, monthRef.month, payday);
                return (
                  <BudgetCard
                    key={cat}
                    category={cat}
                    budget={budget}
                    spent={spent}
                    year={monthRef.year}
                    month={monthRef.month}
                    payday={payday}
                    isCurrentMonth={isCurrentMonth}
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
                  No spending or budgets for {monthLabel(monthRef.year, monthRef.month)} yet.
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
          transactions={transactions}
          totalBudget={totalBudget}
          year={monthRef.year}
          month={monthRef.month}
          payday={payday}
        />
      )}

      {budgetModel === 'envelope' && (
        <EnvelopeView
          budgets={budgets}
          transactions={transactions}
          year={monthRef.year}
          month={monthRef.month}
          payday={payday}
          onSave={(cat, amount) => onSaveBudget(cat, monthRef.year, monthRef.month, amount)}
          onDelete={onDeleteBudget}
        />
      )}

      {/* ── Auto-Budget Modal ── */}
      {autoBudgetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => !autoBudgetLoading && setAutoBudgetOpen(false)}>
          <Card className="w-full sm:max-w-lg shadow-2xl rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
            <CardHeader className="flex-shrink-0 pb-2">
              {/* drag handle on mobile */}
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3 sm:hidden" />
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500 shrink-0" />
                <span className="truncate">Auto-Budget — {monthLabel(monthRef.year, monthRef.month)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto flex-1 pb-6">

              {/* Income sources */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Income this month</p>
                {incomeBreakdown.items.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No income found for this month and no salary configured in Settings.</p>
                ) : (
                  incomeBreakdown.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300 truncate flex-1 pr-4">{item.label}</span>
                      <span className="font-medium text-emerald-600 shrink-0">+{item.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD</span>
                    </div>
                  ))
                )}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between font-bold text-base">
                  <span>Total Available Income</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{totalIncome.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD</span>
                </div>
              </div>

              {/* Plan selector */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Budget plan</p>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(BUDGET_PLANS).map(([key, plan]) => (
                    <label key={key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedPlan === key
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}>
                      <input type="radio" name="plan" value={key} checked={selectedPlan === key} onChange={() => setSelectedPlan(key as any)} className="mt-1 accent-indigo-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{plan.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {totalIncome > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Category breakdown preview</p>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                    {Object.entries(BUDGET_PLANS[selectedPlan].rules).map(([cat, pct]) => (
                      <div key={cat} className="flex justify-between py-1.5 px-3">
                        <span className="truncate flex-1 pr-4 text-gray-700 dark:text-gray-300">{cat}</span>
                        <span className="text-gray-400 shrink-0 mr-4 w-10 text-right">{pct}%</span>
                        <span className="font-semibold shrink-0 w-28 text-right text-gray-900 dark:text-gray-100">{((totalIncome * pct) / 100).toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MAD</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalIncome === 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-300">
                  ⚠️ No income detected. Please configure your salary in <strong>Settings</strong> or add income transactions first.
                </div>
              )}

              <p className="text-xs text-gray-400">
                ⚠️ Applying will <strong>overwrite</strong> all existing budgets for {monthLabel(monthRef.year, monthRef.month)}.
              </p>

              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setAutoBudgetOpen(false)} disabled={autoBudgetLoading}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyAutoBudget}
                  disabled={autoBudgetLoading || totalIncome === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                >
                  {autoBudgetLoading ? 'Applying…' : 'Apply Auto-Budget'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
