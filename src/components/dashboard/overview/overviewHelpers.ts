import { format } from 'date-fns';
import { normalizeCategory } from '../../../lib/categories';
import { isInMonth, netExpenseOf } from '../../../lib/finance';
import type { FinancialPeriod } from '../../../lib/financialMonth';
import type { KPI, Payroll, Transaction } from '../../../types';

export interface DisciplineStreakStats {
  streakDays: number;
  daysUnderIn30d: number;
}

/**
 * Lightweight 30-day discipline counter used by Frame-1 Hero Band 1.
 * Avoids running macro 50/30/20 or full-history anomaly math on Frame 1.
 */
export function computeDailyDisciplineStreak(
  transactions: readonly Transaction[],
  dailyAllowance: number,
  nowMs: number = Date.now(),
): DisciplineStreakStats {
  const allowance = dailyAllowance > 0 ? dailyAllowance : 200;
  const cutoffMs = nowMs - 31 * 86_400_000;
  const dailySpendMap = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue;
    const t = new Date(tx.createdAt).getTime();
    if (!Number.isFinite(t) || t < cutoffMs) continue;
    const dayKey = new Date(t).toISOString().slice(0, 10);
    dailySpendMap.set(dayKey, (dailySpendMap.get(dayKey) || 0) + netExpenseOf(tx));
  }

  let streakDays = 0;
  let daysUnderIn30d = 0;
  for (let i = 0; i < 30; i++) {
    const key = new Date(nowMs - i * 86_400_000).toISOString().slice(0, 10);
    const spent = dailySpendMap.get(key) || 0;
    if (spent <= allowance) {
      daysUnderIn30d++;
      if (streakDays === i) streakDays++;
    }
  }

  return { streakDays, daysUnderIn30d };
}

export interface MacroBenchmarkStats {
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
}

const NEEDS_CATS = new Set([
  '🏢 Housing & Utilities',
  '🛒 Groceries',
  '🚗 Transportation',
  '🩺 Health & Medical',
  '📱 Telecom & Subscriptions',
  '🛡️ Insurance / Annual Costs',
  '🏠 Household & Family',
]);

const SAVINGS_AND_DEBT_CATS = new Set([
  '🛟 Emergency & goals Fund',
  '📈 Investments',
  '💳 Debt & Obligations',
]);

export function computeMacroBenchmark(
  transactions: readonly Transaction[],
  kpis: KPI | null,
  currentFm: FinancialPeriod | null,
  payrolls: Payroll[],
): MacroBenchmarkStats {
  let needsAmt = 0;
  let wantsAmt = 0;
  let savingsAmt = Math.max(0, (kpis?.monthlyIncome ?? 0) - (kpis?.monthlyExpenses ?? 0));

  if (currentFm) {
    for (const tx of transactions) {
      if (tx.type === 'Expense' && isInMonth(tx, currentFm.year, currentFm.month, payrolls)) {
        const norm = normalizeCategory(tx.category);
        const amt = netExpenseOf(tx);
        if (SAVINGS_AND_DEBT_CATS.has(norm)) savingsAmt += amt;
        else if (NEEDS_CATS.has(norm)) needsAmt += amt;
        else wantsAmt += amt;
      }
    }
  }

  const total = Math.max(1, needsAmt + wantsAmt + savingsAmt);
  const needsPct = Math.round((needsAmt / total) * 100);
  const wantsPct = Math.round((wantsAmt / total) * 100);
  const savingsPct = Math.max(0, 100 - needsPct - wantsPct);
  return { needsPct, wantsPct, savingsPct };
}

export interface SpendingAnomaly {
  txId: string;
  title: string;
  category: string;
  amount: number;
  categoryAvg: number;
  multiplier: number;
  dateLabel: string;
}

export function computeCycleAnomalies(
  transactions: readonly Transaction[],
  currentFm: FinancialPeriod | null,
  payrolls: Payroll[],
): SpendingAnomaly[] {
  if (!currentFm) return [];
  const catStats = new Map<string, { sum: number; count: number }>();
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue;
    const norm = normalizeCategory(tx.category) || 'Uncategorized';
    const amt = netExpenseOf(tx);
    if (amt <= 0) continue;
    const cur = catStats.get(norm) || { sum: 0, count: 0 };
    cur.sum += amt;
    cur.count += 1;
    catStats.set(norm, cur);
  }

  const anomalies: SpendingAnomaly[] = [];
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue;
    if (!isInMonth(tx, currentFm.year, currentFm.month, payrolls)) continue;
    const norm = normalizeCategory(tx.category) || 'Uncategorized';
    const amt = netExpenseOf(tx);
    const stat = catStats.get(norm);
    if (stat && stat.count >= 2 && amt >= 150) {
      const avg = stat.sum / stat.count;
      if (avg > 0 && amt >= avg * 2.1) {
        anomalies.push({
          txId: tx.id,
          title: tx.notes || norm,
          category: norm,
          amount: amt,
          categoryAvg: avg,
          multiplier: Number((amt / avg).toFixed(1)),
          dateLabel: format(new Date(tx.createdAt), 'MMM d'),
        });
      }
    }
  }

  anomalies.sort((a, b) => b.amount - a.amount);
  return anomalies.slice(0, 3);
}

export function healthColor(score: number): string {
  return score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-500';
}

export function healthBg(score: number): string {
  return score >= 75
    ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/60 dark:border-emerald-900/50'
    : score >= 50
    ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200/60 dark:border-amber-900/50'
    : 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/60 dark:border-rose-900/50';
}

export function healthLabel(score: number): string {
  return score >= 85
    ? 'Excellent'
    : score >= 70
    ? 'Good'
    : score >= 50
    ? 'Fair'
    : score >= 30
    ? 'Needs Attention'
    : 'Critical';
}
