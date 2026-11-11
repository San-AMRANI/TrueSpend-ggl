/**
 * useNotifications — Diversified Multi-Domain Notification & Financial Intelligence Engine
 *
 * Delivers a rich, randomized, multi-section stream of financial notifications across:
 *   1. Calendar & Approaching Future Events (upcoming bills, payday countdown, debt due dates, goal deadlines, dividends, payday stock splitter, weekend forecast)
 *   2. Subscriptions & Recurring Drain (projected true cycle dates, paid-check guard, per-service spotlights, 5-year equity compounding trade-offs)
 *   3. Stocks, Equities & Portfolio Statuses (per-position pulse, 24h gainers/dips, fee-adjusted breakeven crossovers, buying power, watchlist proximity, dividends)
 *   4. Budgets, Debts & Goals (net category spend alerts, approaching limits, Bank-as-Savings retention, per-contact reimbursements owed, goal milestones)
 *   5. Creative Behavioral & Wealth Ideas (Zero-Spend Day streaks, Micro-Leak radar, Stock-Equivalent translator, Reimbursement Shield, Day-of-Week habits)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativePlatform } from '../lib/capacitorBridge';
import type {
  CategoryBudget,
  DashboardTab,
  Debt,
  Goal,
  InvestmentsData,
  Payroll,
  Subscription,
  Transaction,
} from '../types';
import { isReimbursementIncome, netExpenseOf, reimbursedAmountOf } from '../lib/finance';

// ─── Types ────────────────────────────────────────────────────────────────────
export type NotificationCategory =
  | 'calendar'
  | 'subscriptions'
  | 'stocks'
  | 'budgets'
  | 'creative';

export type NotificationSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export interface SmartNotificationItem {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  metricBadge: string;
  timestamp: string;
  actionLabel: string;
  actionTab: DashboardTab;
  read?: boolean;
  dismissed?: boolean;
}

export interface NotifChannelPrefs {
  calendarEnabled: boolean;
  subscriptionsEnabled: boolean;
  stocksEnabled: boolean;
  budgetsEnabled: boolean;
  creativeEnabled: boolean;
  cadence: 'realtime_priority' | 'twice_daily' | 'daily_digest';
}

export interface NotifSettings {
  enabled: boolean;
  time: string; // "HH:MM"
  channels: NotifChannelPrefs;
}

export interface ServerNotifSettings {
  enabled: boolean;
  dailyInsightEnabled: boolean;
  budgetWarningEnabled: boolean;
  forecastWarningEnabled: boolean;
  debtReminderEnabled: boolean;
  anomalyEnabled: boolean;
  goalEnabled: boolean;
  deliveryTime: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface NotifData {
  monthlyExpenses: number;
  monthlyIncome: number;
  totalBudget: number;
  totalSpent: number;
  daysUntilPayday: number;
  dailyAllowance: number;
  dailyRemaining: number;
  overspentCategories: string[];
  topCategory: string | null;
  savings: number;
  // Extended multi-domain context
  budgets?: CategoryBudget[];
  transactions?: Transaction[];
  subscriptions?: Subscription[];
  investmentsData?: InvestmentsData | null;
  debts?: Debt[];
  goals?: Goal[];
  payrolls?: Payroll[];
  emergencyBuffer?: number;
  totalLiquidBalance?: number;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const KEY_ENABLED = 'truespend_notif_enabled';
const KEY_TIME = 'truespend_notif_time';
const KEY_CHANNELS = 'truespend_notif_channels_v4';
const KEY_SENT_LOG_TODAY = 'truespend_notif_sent_log_v4';
const DEFAULT_TIME = '09:00';

const DEFAULT_CHANNELS: NotifChannelPrefs = {
  calendarEnabled: true,
  subscriptionsEnabled: true,
  stocksEnabled: true,
  budgetsEnabled: true,
  creativeEnabled: true,
  cadence: 'realtime_priority',
};

// Check every 30 seconds for scheduled or random interval delivery
const CHECK_INTERVAL_MS = 30_000;
const NATIVE_NOTIFICATION_ID = 1001;
const NATIVE_CHANNEL_ID = 'truespend-daily-insights';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function loadChannelPrefs(): NotifChannelPrefs {
  try {
    const raw = localStorage.getItem(KEY_CHANNELS);
    if (!raw) return DEFAULT_CHANNELS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CHANNELS,
      ...parsed,
      cadence: parsed.cadence || 'realtime_priority',
    };
  } catch {
    return DEFAULT_CHANNELS;
  }
}

interface DailySentLog {
  date: string;
  count: number;
  lastSentTimestamp: number;
  lastCategory?: NotificationCategory;
  sentInsightIds: string[];
}

function getTodaySentLog(): DailySentLog {
  const today = toDay(new Date());
  try {
    const raw = localStorage.getItem(KEY_SENT_LOG_TODAY);
    if (!raw) return { date: today, count: 0, lastSentTimestamp: 0, sentInsightIds: [] };
    const parsed = JSON.parse(raw) as DailySentLog;
    if (parsed.date !== today) {
      return { date: today, count: 0, lastSentTimestamp: 0, sentInsightIds: [] };
    }
    return parsed;
  } catch {
    return { date: today, count: 0, lastSentTimestamp: 0, sentInsightIds: [] };
  }
}

function recordSentInsight(insightId: string, category?: NotificationCategory) {
  const today = toDay(new Date());
  const log = getTodaySentLog();
  const nextIds = Array.from(new Set([...log.sentInsightIds, insightId])).slice(-40);
  const updated: DailySentLog = {
    date: today,
    count: log.count + 1,
    lastSentTimestamp: Date.now(),
    lastCategory: category || log.lastCategory,
    sentInsightIds: nextIds,
  };
  try {
    localStorage.setItem(KEY_SENT_LOG_TODAY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

function shouldSendScheduledNow(cadence: NotifChannelPrefs['cadence'], timeStr: string): boolean {
  const log = getTodaySentLog();
  const now = new Date();
  const hour = now.getHours();

  // Respect quiet hours (22:30 to 07:30)
  if (hour >= 23 || hour < 7) return false;

  if (cadence === 'daily_digest') {
    const [hh, mm] = timeStr.split(':').map(Number);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 9, mm || 0, 0);
    return now >= target && log.count < 2 && Date.now() - log.lastSentTimestamp > 3 * 60 * 60 * 1000;
  }

  if (cadence === 'twice_daily') {
    const minGapMs = 2.5 * 60 * 60 * 1000;
    return log.count < 4 && Date.now() - log.lastSentTimestamp >= minGapMs;
  }

  // 'realtime_priority' (default): Diversified random stream throughout the day (up to 10/day, spaced 45–75 mins apart)
  const randomCooldownMs = 45 * 60 * 1000;
  if (log.count >= 10) return false;
  if (log.lastSentTimestamp > 0 && Date.now() - log.lastSentTimestamp < randomCooldownMs) {
    return false;
  }
  return true;
}

const fmtMad = (n: number) => `${Math.round(n).toLocaleString('fr-MA')} MAD`;

const fmtUsd = (n: number, decimals = 2) =>
  `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

/**
 * Projects a subscription's TRUE next billing date onto the current/future timeline
 * so a past `nextBillingDate` (like an old "Mobile Plan 100 MAD" anchor date) NEVER gets
 * stuck firing as "Due Today" every single day! Also checks if the subscription was
 * already paid in recent transactions.
 */
export function projectUpcomingSubscription(
  sub: Subscription,
  now: Date,
  transactions: Transaction[] = []
): {
  nextDate: Date;
  nextDateIso: string;
  diffDays: number;
  amount: number;
  monthlyEq: number;
  alreadyPaidRecently: boolean;
} {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const amount = Math.max(0, Number(sub.amount) || 0);
  const rawCycle = (sub.billingCycle || 'monthly').trim().toLowerCase();

  let monthlyEq = amount;
  if (rawCycle === 'yearly' || rawCycle === 'annual') monthlyEq = amount / 12;
  else if (rawCycle === 'every_6_months') monthlyEq = amount / 6;
  else if (rawCycle === 'quarterly' || rawCycle === 'every_3_months') monthlyEq = amount / 3;
  else if (rawCycle === 'every_2_months') monthlyEq = amount / 2;
  else if (rawCycle === 'weekly') monthlyEq = amount * 4.33;
  else if (rawCycle === 'biweekly') monthlyEq = amount * 2.165;

  let candidate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date(todayStart);
  if (Number.isNaN(candidate.getTime())) {
    candidate = new Date(todayStart);
  }
  candidate = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());

  const anchorDay = candidate.getDate();

  const advanceOneCycle = (d: Date): Date => {
    if (rawCycle === 'weekly') {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    }
    if (rawCycle === 'biweekly') {
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14);
    }
    let monthsToAdd = 1;
    if (rawCycle === 'yearly' || rawCycle === 'annual') monthsToAdd = 12;
    else if (rawCycle === 'every_6_months') monthsToAdd = 6;
    else if (rawCycle === 'quarterly' || rawCycle === 'every_3_months') monthsToAdd = 3;
    else if (rawCycle === 'every_2_months') monthsToAdd = 2;
    else {
      const mMatch = rawCycle.match(/^every_(\d+)_months?$/);
      if (mMatch) monthsToAdd = Math.max(1, parseInt(mMatch[1], 10));
    }

    const targetYear = d.getFullYear();
    const targetMonth = d.getMonth() + monthsToAdd;
    const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
    return new Date(targetYear, targetMonth, Math.min(anchorDay, maxDays));
  };

  // Roll forward any past date until it is on or after todayStart
  let guard = 0;
  while (candidate < todayStart && guard < 120) {
    candidate = advanceOneCycle(candidate);
    guard++;
  }

  // Check if the user already logged a payment matching this subscription in the last 10 days
  const tenDaysAgo = new Date(todayStart.getTime() - 10 * 24 * 60 * 60 * 1000);
  const subNameLower = (sub.name || '').toLowerCase().trim();
  const alreadyPaidRecently = transactions.some((tx) => {
    if (tx.type !== 'Expense') return false;
    const txDate = new Date(tx.createdAt);
    if (txDate < tenDaysAgo) return false;
    const notesLower = (tx.notes || '').toLowerCase();
    const catLower = (tx.category || '').toLowerCase();
    const txAmt = Number(tx.amount) || 0;
    if (subNameLower && notesLower.includes(subNameLower)) return true;
    if (
      (catLower.includes('subscription') || catLower.includes('telecom')) &&
      Math.abs(txAmt - amount) < 1
    ) {
      return true;
    }
    return false;
  });

  // If candidate is today or within 2 days AND already paid recently, advance to next cycle!
  let diffDays = Math.round((candidate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  if (alreadyPaidRecently && diffDays <= 3) {
    candidate = advanceOneCycle(candidate);
    diffDays = Math.round((candidate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  const yyyy = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, '0');
  const dd = String(candidate.getDate()).padStart(2, '0');

  return {
    nextDate: candidate,
    nextDateIso: `${yyyy}-${mm}-${dd}`,
    diffDays,
    amount,
    monthlyEq,
    alreadyPaidRecently,
  };
}

// ─── Multi-Domain Smart Insight Generator ─────────────────────────────────────
export function generateSmartNotifications(
  data: NotifData | null,
  channels: NotifChannelPrefs = DEFAULT_CHANNELS,
  shuffleSeed = 0
): SmartNotificationItem[] {
  if (!data) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIso = toDay(now);
  const txs = data.transactions || [];

  const byCategory: Record<NotificationCategory, SmartNotificationItem[]> = {
    calendar: [],
    subscriptions: [],
    stocks: [],
    budgets: [],
    creative: [],
  };

  const pushItem = (
    item: Omit<SmartNotificationItem, 'timestamp' | 'read' | 'dismissed'>
  ) => {
    byCategory[item.category].push({
      ...item,
      timestamp: now.toISOString(),
    });
  };

  // Pre-project all active subscriptions with true future cycle dates
  const activeSubs = (data.subscriptions || []).filter((s) => s.status === 'active');
  const plannedSubs = (data.subscriptions || []).filter((s) => s.status === 'planned');
  const projectedSubs = activeSubs
    .map((sub) => ({
      sub,
      ...projectUpcomingSubscription(sub, now, txs),
    }))
    .sort((a, b) => a.diffDays - b.diffDays);

  // ============================================================================
  // 1. CALENDAR & APPROACHING FUTURE EVENTS RADAR
  // ============================================================================
  if (channels.calendarEnabled) {
    // 1A. Individual Future Calendar Events Approaching (Subscriptions / Bills within 1–14 days)
    const approachingCalendarSubs = projectedSubs.filter(
      (p) => p.diffDays >= 0 && p.diffDays <= 14
    );
    approachingCalendarSubs.slice(0, 4).forEach((item) => {
      const whenLabel =
        item.diffDays === 0
          ? 'Today'
          : item.diffDays === 1
          ? 'Tomorrow'
          : `in ${item.diffDays} days`;
      pushItem({
        id: `cal-event-sub-${item.sub.id}-${item.nextDateIso}`,
        category: 'calendar',
        severity: item.diffDays <= 2 ? 'warning' : 'info',
        title: `📅 Calendar Event ${whenLabel}: ${item.sub.icon || '📱'} ${item.sub.name}`,
        body: `Scheduled on your Financial Calendar for ${formatShortDate(item.nextDate)} (${item.nextDateIso}) — ${fmtMad(item.amount)} (${item.sub.billingCycle || 'monthly'}).`,
        metricBadge: `${whenLabel} · ${fmtMad(item.amount)}`,
        actionLabel: 'View on Calendar',
        actionTab: 'calendar',
      });
    });

    // 1B. Approaching Future Payroll / Payday Event on Calendar
    const upcomingPayrolls = (data.payrolls || [])
      .map((p) => {
        const dt = new Date(p.scheduledFor);
        const dStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const diff = Math.round((dStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        return { payroll: p, date: dStart, diff, amount: Number(p.amount) || 0 };
      })
      .filter((p) => p.diff >= 0 && p.diff <= 25)
      .sort((a, b) => a.diff - b.diff);

    if (upcomingPayrolls.length > 0) {
      const nextPay = upcomingPayrolls[0];
      pushItem({
        id: `cal-event-payroll-${nextPay.payroll.id}-${todayIso}`,
        category: 'calendar',
        severity: 'opportunity',
        title:
          nextPay.diff === 0
            ? `🎉 Calendar Event Today: Payday (${fmtMad(nextPay.amount)})!`
            : `🗓️ Approaching Calendar Payday: ${formatShortDate(nextPay.date)} (${nextPay.diff}d)`,
        body: `Your scheduled salary of ${fmtMad(nextPay.amount)} is on the calendar in ${nextPay.diff} day${nextPay.diff === 1 ? '' : 's'}. Keep daily spending within ${fmtMad(Math.max(0, data.dailyAllowance))}/day to maximize bank retention.`,
        metricBadge: `In ${nextPay.diff}d · +${fmtMad(nextPay.amount)}`,
        actionLabel: 'Open Financial Calendar',
        actionTab: 'calendar',
      });

      // 1C. Post-Payday Stock Splitter Calendar Event (Payday + 1 day)
      if (
        data.investmentsData &&
        (data.investmentsData.positions || []).length > 0 &&
        nextPay.diff <= 7
      ) {
        const splitterDate = new Date(nextPay.date.getTime() + 24 * 60 * 60 * 1000);
        const topTickers = data.investmentsData.positions
          .slice(0, 3)
          .map((p) => p.ticker)
          .join(', ');
        const suggestedAlloc = Math.round(nextPay.amount * 0.15);
        pushItem({
          id: `cal-event-dca-${nextPay.payroll.id}-${todayIso}`,
          category: 'calendar',
          severity: 'opportunity',
          title: `📈 Calendar Event Approaching: Payday Stock Splitter (${formatShortDate(splitterDate)})`,
          body: `Scheduled 24h after payday: deploy ${fmtMad(suggestedAlloc)} (15% of salary) across ${topTickers} before lifestyle spending starts.`,
          metricBadge: `${formatShortDate(splitterDate)} · ${fmtMad(suggestedAlloc)}`,
          actionLabel: 'Preview on Calendar',
          actionTab: 'calendar',
        });
      }
    } else if (data.daysUntilPayday > 0) {
      const estPaydayDate = new Date(
        todayStart.getTime() + data.daysUntilPayday * 24 * 60 * 60 * 1000
      );
      pushItem({
        id: `cal-payday-countdown-${todayIso}`,
        category: 'calendar',
        severity: data.daysUntilPayday <= 5 ? 'opportunity' : 'info',
        title: `🗓️ Next Payday Cycle on ${formatShortDate(estPaydayDate)} (${data.daysUntilPayday}d left)`,
        body: `You have ${data.daysUntilPayday} days remaining in this financial cycle with a ${fmtMad(Math.max(0, data.dailyAllowance))}/day Safe-to-Spend allowance.`,
        metricBadge: `${data.daysUntilPayday}d to Payday`,
        actionLabel: 'Open Financial Calendar',
        actionTab: 'calendar',
      });
    }

    // 1D. Approaching Debt Due Date Events on Calendar (Payable & Receivable)
    const debtsWithDueDates = (data.debts || [])
      .filter((d) => d.status === 'Pending' && d.dueDate)
      .map((d) => {
        const dt = new Date(d.dueDate!);
        const dStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const diff = Math.round((dStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        return {
          debt: d,
          date: dStart,
          diff,
          amount: Number(d.remainingBalance ?? d.originalAmount) || 0,
        };
      })
      .filter((d) => d.diff >= -3 && d.diff <= 21 && d.amount > 0)
      .sort((a, b) => a.diff - b.diff);

    debtsWithDueDates.slice(0, 3).forEach((item) => {
      const isPayable = item.debt.type === 'Payable';
      const timing =
        item.diff < 0
          ? `${Math.abs(item.diff)}d overdue`
          : item.diff === 0
          ? 'Due Today'
          : `in ${item.diff}d (${formatShortDate(item.date)})`;
      pushItem({
        id: `cal-event-debt-${item.debt.id}-${todayIso}`,
        category: 'calendar',
        severity: isPayable ? 'warning' : 'opportunity',
        title: isPayable
          ? `📅 Calendar Debt Due ${timing}: Pay ${item.debt.contactName}`
          : `📅 Calendar Collection ${timing}: ${item.debt.contactName} Owes You`,
        body: isPayable
          ? `${fmtMad(item.amount)} payable to ${item.debt.contactName} is marked on your Financial Calendar (${timing}).`
          : `${item.debt.contactName} is scheduled to reimburse ${fmtMad(item.amount)} (${timing}). Remember: reimbursements are never counted as income.`,
        metricBadge: `${timing} · ${fmtMad(item.amount)}`,
        actionLabel: 'View Calendar Event',
        actionTab: 'calendar',
      });
    });

    // 1E. Approaching Goal Deadlines on Calendar
    const goalsWithDeadlines = (data.goals || [])
      .filter((g) => g.deadline && Number(g.targetAmount) > Number(g.currentAmount))
      .map((g) => {
        const dt = new Date(g.deadline!);
        const dStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const diff = Math.round((dStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        const remaining = Math.max(0, Number(g.targetAmount) - Number(g.currentAmount));
        return { goal: g, date: dStart, diff, remaining };
      })
      .filter((g) => g.diff >= 0 && g.diff <= 45)
      .sort((a, b) => a.diff - b.diff);

    goalsWithDeadlines.slice(0, 2).forEach((item) => {
      const dailyNeeded = item.remaining / Math.max(1, item.diff);
      pushItem({
        id: `cal-event-goal-${item.goal.id}-${todayIso}`,
        category: 'calendar',
        severity: 'info',
        title: `🎯 Calendar Goal Deadline (${formatShortDate(item.date)}): "${item.goal.name}"`,
        body: `Target date approaches in ${item.diff} days with ${fmtMad(item.remaining)} left to fund (~${fmtMad(dailyNeeded)}/day pace).`,
        metricBadge: `${item.diff}d left · ${fmtMad(item.remaining)}`,
        actionLabel: 'Review Goal Timeline',
        actionTab: 'goals',
      });
    });

    // 1F. 7-Day Calendar Bill Cluster Alert
    if (approachingCalendarSubs.filter((s) => s.diffDays <= 7).length >= 2) {
      const weekSubs = approachingCalendarSubs.filter((s) => s.diffDays <= 7);
      const clusterSum = weekSubs.reduce((acc, s) => acc + s.amount, 0);
      pushItem({
        id: `cal-bill-cluster-${todayIso}`,
        category: 'calendar',
        severity: 'warning',
        title: `📅 7-Day Calendar Cluster: ${weekSubs.length} Upcoming Charges`,
        body: `${weekSubs.map((s) => `${s.sub.name} (${formatShortDate(s.nextDate)})`).join(', ')} total ${fmtMad(clusterSum)} over the next 7 days.`,
        metricBadge: `${fmtMad(clusterSum)} / 7d`,
        actionLabel: 'Inspect Calendar Week',
        actionTab: 'calendar',
      });
    }

    // 1G. Weekend Calendar Cash-Flow Forecast & Daily Safe-to-Spend Pace
    const dayOfWeek = now.getDay(); // 0 Sun .. 6 Sat
    if (data.dailyAllowance > 0) {
      const weekendAllowance = data.dailyAllowance * 2.5;
      if (dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6) {
        pushItem({
          id: `cal-weekend-forecast-${todayIso}`,
          category: 'calendar',
          severity: 'info',
          title: `🌴 Weekend Calendar Budget Cap: ${fmtMad(weekendAllowance)}`,
          body: `Heading into the weekend, keeping total Friday–Sunday net spending under ${fmtMad(weekendAllowance)} protects your ${fmtMad(data.dailyAllowance)}/day payday runway.`,
          metricBadge: `${fmtMad(weekendAllowance)} Wknd Cap`,
          actionLabel: 'Check Cash Flow',
          actionTab: 'calendar',
        });
      }

      pushItem({
        id: `cal-daily-pace-${todayIso}`,
        category: 'calendar',
        severity: data.dailyRemaining >= 0 ? 'info' : 'warning',
        title:
          data.dailyRemaining >= 0
            ? `📆 Today's Calendar Allowance: ${fmtMad(data.dailyRemaining)} Available`
            : `⚠️ Daily Calendar Pace Exceeded by ${fmtMad(Math.abs(data.dailyRemaining))}`,
        body:
          data.dailyRemaining >= 0
            ? `Your daily Safe-to-Spend limit is ${fmtMad(data.dailyAllowance)} with ${fmtMad(data.dailyRemaining)} remaining today across ${data.daysUntilPayday || 15} days until payday.`
            : `Today's net spending passed your ${fmtMad(data.dailyAllowance)} daily cap by ${fmtMad(Math.abs(data.dailyRemaining))}. A lighter day tomorrow restores your trajectory.`,
        metricBadge: `${fmtMad(data.dailyRemaining)} Today`,
        actionLabel: 'Open Calendar',
        actionTab: 'calendar',
      });
    }
  }

  // ============================================================================
  // 2. SUBSCRIPTIONS & RECURRING DRAIN INTELLIGENCE (Fixed & Diversified!)
  // ============================================================================
  if (channels.subscriptionsEnabled && (projectedSubs.length > 0 || plannedSubs.length > 0)) {
    const totalMonthlySubs = projectedSubs.reduce((acc, s) => acc + s.monthlyEq, 0);
    const totalYearlySubs = totalMonthlySubs * 12;

    // 2A. Imminent Renewals (0 to 5 days out — ONLY if not already paid and using projected cycle date!)
    const imminentSubs = projectedSubs.filter(
      (s) => s.diffDays >= 0 && s.diffDays <= 5 && !s.alreadyPaidRecently
    );
    imminentSubs.forEach((item) => {
      pushItem({
        id: `sub-imminent-${item.sub.id}-${item.nextDateIso}`,
        category: 'subscriptions',
        severity: item.diffDays <= 1 ? 'warning' : 'info',
        title:
          item.diffDays === 0
            ? `🔔 ${item.sub.name} Cycle Date is Today (${fmtMad(item.amount)})`
            : `🔔 ${item.sub.name} Renews in ${item.diffDays} Day${item.diffDays === 1 ? '' : 's'} (${formatShortDate(item.nextDate)})`,
        body: `${item.sub.name} (${fmtMad(item.amount)} · ${item.sub.billingCycle || 'monthly'}) is scheduled on ${item.nextDateIso}. Log payment when settled or pause if unused.`,
        metricBadge: `${item.diffDays === 0 ? 'Today' : `In ${item.diffDays}d`} · ${fmtMad(item.amount)}`,
        actionLabel: 'Manage Subscription',
        actionTab: 'subscriptions',
      });
    });

    // 2B. Per-Subscription Rotating Value & Annual Cost Spotlight (so every subscription gets attention, never just one!)
    const sortedByCost = [...projectedSubs].sort((a, b) => b.monthlyEq - a.monthlyEq);
    sortedByCost.slice(0, 3).forEach((item, idx) => {
      const annualCost = item.monthlyEq * 12;
      const pctOfSubLoad =
        totalMonthlySubs > 0 ? Math.round((item.monthlyEq / totalMonthlySubs) * 100) : 0;
      pushItem({
        id: `sub-spotlight-${item.sub.id}-${todayIso}`,
        category: 'subscriptions',
        severity: 'info',
        title: `🔍 Subscription Spotlight #${idx + 1}: ${item.sub.icon || '🔄'} ${item.sub.name}`,
        body: `${item.sub.name} costs ${fmtMad(item.monthlyEq)}/mo (${fmtMad(annualCost)}/year — ${pctOfSubLoad}% of your recurring bill load). Next cycle: ${formatShortDate(item.nextDate)} (in ${item.diffDays}d).`,
        metricBadge: `${fmtMad(annualCost)}/yr`,
        actionLabel: 'Audit Subscriptions',
        actionTab: 'subscriptions',
      });
    });

    // 2C. 5-Year Equity Compounding Opportunity Cost
    if (totalMonthlySubs > 0) {
      const monthlySaved = totalMonthlySubs * 0.3;
      const r = 0.1 / 12;
      const n = 60;
      const fv5Yr = monthlySaved * ((Math.pow(1 + r, n) - 1) / r);
      pushItem({
        id: `sub-wealth-tradeoff-${todayIso}`,
        category: 'subscriptions',
        severity: 'opportunity',
        title: `🔄 ${projectedSubs.length} Active Subscriptions = ${fmtMad(totalYearlySubs)}/Year`,
        body: `Your recurring bills average ${fmtMad(totalMonthlySubs)}/mo. Redirecting 30% (${fmtMad(monthlySaved)}/mo) into S&P 500 or AI stocks compounds to ~${fmtMad(fv5Yr)} in 5 years.`,
        metricBadge: `${fmtMad(totalMonthlySubs)}/mo`,
        actionLabel: 'Optimize Recurring Bills',
        actionTab: 'subscriptions',
      });
    }

    // 2D. Subscription-to-Income Ratio & Workdays Equivalent
    if (data.monthlyIncome > 0 && totalMonthlySubs > 0) {
      const subIncomePct = (totalMonthlySubs / data.monthlyIncome) * 100;
      const workDaysPerYear = ((totalYearlySubs / data.monthlyIncome) * 22).toFixed(1);
      pushItem({
        id: `sub-workdays-equiv-${todayIso}`,
        category: 'subscriptions',
        severity: subIncomePct > 10 ? 'warning' : 'info',
        title: `⏱️ Subscriptions Equal ${workDaysPerYear} Workdays of Salary per Year`,
        body: `At ${subIncomePct.toFixed(1)}% of your monthly net income (${fmtMad(totalMonthlySubs)}/mo), you work ~${workDaysPerYear} days every year just to fund your ${projectedSubs.length} recurring subscriptions.`,
        metricBadge: `${subIncomePct.toFixed(1)}% of Income`,
        actionLabel: 'Review Subscriptions',
        actionTab: 'subscriptions',
      });
    }

    // 2E. Planned Subscriptions Queue
    if (plannedSubs.length > 0) {
      const plannedTotal = plannedSubs.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      pushItem({
        id: `sub-planned-queue-${todayIso}`,
        category: 'subscriptions',
        severity: 'info',
        title: `📝 ${plannedSubs.length} Planned Subscription${plannedSubs.length === 1 ? '' : 's'} on Hold (${fmtMad(plannedTotal)})`,
        body: `You have ${plannedSubs.map((p) => p.name).join(', ')} marked as Planned. Keep them paused until next cycle to preserve bank retention.`,
        metricBadge: `${fmtMad(plannedTotal)} Paused`,
        actionLabel: 'View Planned Subs',
        actionTab: 'subscriptions',
      });
    }
  }

  // ============================================================================
  // 3. STOCKS, EQUITIES & PORTFOLIO STATUSES
  // ============================================================================
  if (channels.stocksEnabled && data.investmentsData) {
    const inv = data.investmentsData;
    const usdToMad = inv.rates?.USD_TO_MAD || 9.82;
    const stockPositions = (inv.positions || []).filter(
      (p) =>
        p.market !== 'CRYPTO' &&
        !/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|USDT|USDC)$/i.test(p.ticker)
    );

    if (stockPositions.length > 0) {
      // 3A. Top 24h Gainer Alert
      const gainers = [...stockPositions]
        .filter((p) => (p.change24hPercent || 0) > 0)
        .sort((a, b) => (b.change24hPercent || 0) - (a.change24hPercent || 0));
      if (gainers.length > 0) {
        const topGainer = gainers[0];
        const move = topGainer.change24hPercent || 0;
        const valUsd = topGainer.marketValueUsd ?? topGainer.marketValueMad / usdToMad;
        pushItem({
          id: `stock-gainer-${todayIso}-${topGainer.ticker}`,
          category: 'stocks',
          severity: 'opportunity',
          title: `📈 Top 24h Stock Gainer: ${topGainer.ticker} +${move.toFixed(2)}%`,
          body: `${topGainer.companyName} is trading at ${
            topGainer.currency === 'MAD'
              ? fmtMad(Number(topGainer.currentPrice))
              : fmtUsd(Number(topGainer.currentPrice))
          } (Position value: ${fmtUsd(valUsd)} / ${fmtMad(topGainer.marketValueMad)}).`,
          metricBadge: `+${move.toFixed(2)}% 24h`,
          actionLabel: 'Open Stock Portfolio',
          actionTab: 'investments',
        });
      }

      // 3B. 24h Pullback / Dip-Buying Radar
      const pullbacks = [...stockPositions]
        .filter((p) => (p.change24hPercent || 0) < -0.3)
        .sort((a, b) => (a.change24hPercent || 0) - (b.change24hPercent || 0));
      if (pullbacks.length > 0) {
        const topDip = pullbacks[0];
        const move = topDip.change24hPercent || 0;
        const avgCost = Number(topDip.avgCostNum ?? topDip.avgCostPerShare);
        pushItem({
          id: `stock-dip-${todayIso}-${topDip.ticker}`,
          category: 'stocks',
          severity: 'info',
          title: `📉 Pullback Radar: ${topDip.ticker} ${move.toFixed(2)}% (24h)`,
          body: `${topDip.companyName} dipped to ${
            topDip.currency === 'MAD'
              ? fmtMad(Number(topDip.currentPrice))
              : fmtUsd(Number(topDip.currentPrice))
          } vs your ${topDip.currency === 'MAD' ? fmtMad(avgCost) : fmtUsd(avgCost)} average cost basis.`,
          metricBadge: `${move.toFixed(2)}% 24h`,
          actionLabel: 'Check DCA Opportunity',
          actionTab: 'investments',
        });
      }

      // 3C. Individual Fee-Adjusted Breakeven Winners (Up to 3 positions)
      const profitableStocks = stockPositions
        .filter((p) => (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad) > 0)
        .sort(
          (a, b) =>
            (b.netPnlAfterFeesMad ?? b.unrealizedPnlMad) -
            (a.netPnlAfterFeesMad ?? a.unrealizedPnlMad)
        );
      profitableStocks.slice(0, 3).forEach((pos) => {
        const netUsd =
          pos.netPnlAfterFeesUsd ??
          (pos.netPnlAfterFeesMad ?? pos.unrealizedPnlMad) / usdToMad;
        const netPct = pos.netPnlAfterFeesPercent ?? pos.unrealizedPnlPercent ?? 0;
        pushItem({
          id: `stock-breakeven-win-${todayIso}-${pos.ticker}`,
          category: 'stocks',
          severity: 'opportunity',
          title: `🎯 ${pos.ticker} Above Fee-Adjusted Breakeven (+${netPct.toFixed(1)}%)`,
          body: `${pos.companyName} is generating +${fmtUsd(netUsd)} (+${fmtMad(pos.netPnlAfterFeesMad ?? pos.unrealizedPnlMad)}) net profit after entry & exit fees. Breakeven floor: ${fmtUsd(pos.breakevenPriceUsd ?? pos.avgCostNum ?? Number(pos.avgCostPerShare))}.`,
          metricBadge: `+${fmtUsd(netUsd)} Net`,
          actionLabel: 'Inspect Position',
          actionTab: 'investments',
        });
      });

      // 3D. Total Portfolio Valuation & Net P&L Pulse
      const totalValMad = stockPositions.reduce((s, p) => s + (p.marketValueMad || 0), 0);
      const totalNetPnlMad = stockPositions.reduce(
        (s, p) => s + (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad ?? 0),
        0
      );
      if (totalValMad > 0) {
        pushItem({
          id: `stock-portfolio-summary-${todayIso}`,
          category: 'stocks',
          severity: totalNetPnlMad >= 0 ? 'opportunity' : 'info',
          title: `💼 Equity Portfolio Pulse: ${fmtUsd(totalValMad / usdToMad)} (${fmtMad(totalValMad)})`,
          body: `Across ${stockPositions.length} active stock positions, your fee-adjusted net P&L stands at ${totalNetPnlMad >= 0 ? '+' : ''}${fmtUsd(totalNetPnlMad / usdToMad)} (${totalNetPnlMad >= 0 ? '+' : ''}${fmtMad(totalNetPnlMad)}).`,
          metricBadge: `${totalNetPnlMad >= 0 ? '+' : ''}${fmtUsd(totalNetPnlMad / usdToMad)}`,
          actionLabel: 'Open Stocks Suite',
          actionTab: 'investments',
        });
      }

      // 3E. Brokerage Reserve Cash Buying Power Alert
      const buyingPowerMad = inv.buyingPower?.investmentWalletBalanceMad || 0;
      const buyingPowerUsd = buyingPowerMad / usdToMad;
      if (buyingPowerMad > 50) {
        pushItem({
          id: `stock-buying-power-${todayIso}`,
          category: 'stocks',
          severity: 'opportunity',
          title: `⚡ ${fmtUsd(buyingPowerUsd)} (${fmtMad(buyingPowerMad)}) Dry Powder Ready in Brokerage`,
          body: `Your Brokerage Reserve Wallet has ${fmtUsd(buyingPowerUsd)} in uninvested cash ready for limit orders or DCA tranches without touching your main bank account.`,
          metricBadge: `${fmtUsd(buyingPowerUsd)} Cash`,
          actionLabel: 'Deploy Buying Power',
          actionTab: 'investments',
        });
      }

      // 3F. Sector Concentration & Diversification Check
      if (totalValMad > 0 && stockPositions.length >= 2) {
        const bySector = new Map<string, number>();
        stockPositions.forEach((p) => {
          const sec = p.sector || 'Technology';
          bySector.set(sec, (bySector.get(sec) || 0) + (p.marketValueMad || 0));
        });
        const topSectorEntry = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topSectorEntry) {
          const topWeightPct = (topSectorEntry[1] / totalValMad) * 100;
          pushItem({
            id: `stock-sector-mix-${todayIso}`,
            category: 'stocks',
            severity: topWeightPct >= 65 ? 'warning' : 'info',
            title: `🧭 Portfolio Sector Mix: ${topWeightPct.toFixed(0)}% in ${topSectorEntry[0]}`,
            body: `Your largest sector exposure is ${topSectorEntry[0]} (${fmtUsd(topSectorEntry[1] / usdToMad)}) across ${bySector.size} sector${bySector.size === 1 ? '' : 's'}.`,
            metricBadge: `${topWeightPct.toFixed(0)}% ${topSectorEntry[0]}`,
            actionLabel: 'Review Allocation',
            actionTab: 'investments',
          });
        }
      }
    }

    // 3G. Watchlist Target Proximity & Alerts
    const watchlist = inv.watchlistPositions || [];
    watchlist.slice(0, 3).forEach((w) => {
      const price = Number(w.currentPrice || 0);
      const buyTarget = Number(w.alertBelow ?? w.targetPrice ?? 0);
      if (buyTarget > 0 && price > 0) {
        const diffPct = ((price - buyTarget) / buyTarget) * 100;
        pushItem({
          id: `stock-watchlist-${todayIso}-${w.ticker}`,
          category: 'stocks',
          severity: diffPct <= 0 ? 'opportunity' : 'info',
          title:
            diffPct <= 0
              ? `🟢 Watchlist Buy Zone Hit: ${w.ticker} at ${fmtUsd(price)}`
              : `🔭 Watchlist Radar: ${w.ticker} (${fmtUsd(price)}) vs ${fmtUsd(buyTarget)} Target`,
          body:
            diffPct <= 0
              ? `${w.companyName} (${w.ticker}) reached ${fmtUsd(price)}, inside your ${fmtUsd(buyTarget)} entry zone.`
              : `${w.companyName} is ${diffPct.toFixed(1)}% above your ${fmtUsd(buyTarget)} target entry price.`,
          metricBadge: `${fmtUsd(price)}`,
          actionLabel: 'Open Watchlist',
          actionTab: 'investments',
        });
      }
    });

    // 3H. Dividend Passive Income Projection
    const annualDivMad = Number((inv as any).projectedAnnualDividendsMad || 0);
    if (annualDivMad > 0) {
      pushItem({
        id: `stock-dividend-projection-${todayIso}`,
        category: 'stocks',
        severity: 'opportunity',
        title: `💵 Projected Annual Dividend Stream: ${fmtMad(annualDivMad)}/yr`,
        body: `Your dividend-paying holdings generate ~${fmtUsd(annualDivMad / usdToMad)}/yr (${fmtMad(annualDivMad / 12)}/mo average) in passive dividend cash flow.`,
        metricBadge: `${fmtMad(annualDivMad)}/yr`,
        actionLabel: 'View Dividend Calendar',
        actionTab: 'investments',
      });
    }
  }

  // ============================================================================
  // 4. BUDGETS, DEBTS & GOALS ALERTS (Net-of-Reimbursement Aware!)
  // ============================================================================
  if (channels.budgetsEnabled) {
    // 4A. Individual Overspent Categories
    data.overspentCategories.slice(0, 3).forEach((cat) => {
      pushItem({
        id: `budget-overspent-${todayIso}-${cat}`,
        category: 'budgets',
        severity: 'critical',
        title: `🚨 Budget Limit Crossed: ${cat}`,
        body: `Net spending in ${cat} (after deducting friend reimbursements) has exceeded this month's target. Use Spex AI Auto-Budget or reallocate surplus from under-spent categories.`,
        metricBadge: `Over Limit`,
        actionLabel: 'Rebalance Budget',
        actionTab: 'budgets',
      });
    });

    // 4B. Bank-as-Savings Zero-Transaction Retention Status
    if (data.monthlyIncome > 0) {
      const retainedMad = Math.max(0, data.monthlyIncome - data.monthlyExpenses);
      const retainedPct = Math.round((retainedMad / data.monthlyIncome) * 100);
      pushItem({
        id: `budget-bank-retention-${todayIso}`,
        category: 'budgets',
        severity: retainedPct >= 20 ? 'opportunity' : 'info',
        title: `🏦 Bank-as-Savings Retention: ${fmtMad(retainedMad)} (${retainedPct}% of Net Income)`,
        body: `Out of ${fmtMad(data.monthlyIncome)} net income (excluding reimbursements), ${fmtMad(retainedMad)} remains protected in your bank account without needing a dummy savings transaction.`,
        metricBadge: `${retainedPct}% Retained`,
        actionLabel: 'Open 4-Pillar Budgets',
        actionTab: 'budgets',
      });
    }

    // 4C. Unsettled "Receivable" Reimbursements Per Contact
    const owedToMe = (data.debts || []).filter(
      (d) =>
        d.type === 'Receivable' &&
        d.status !== 'Cleared' &&
        Number(d.remainingBalance ?? d.originalAmount) > 0
    );
    owedToMe.slice(0, 3).forEach((debt) => {
      const amt = Number(debt.remainingBalance ?? debt.originalAmount);
      pushItem({
        id: `debt-receivable-${debt.id}-${todayIso}`,
        category: 'budgets',
        severity: 'opportunity',
        title: `🤝 Pending Reimbursement: ${debt.contactName} Owes ${fmtMad(amt)}`,
        body: `Collecting ${fmtMad(amt)} from ${debt.contactName} restores your physical wallet cash without inflating your monthly income.`,
        metricBadge: `+${fmtMad(amt)} Owed`,
        actionLabel: 'Settle in Debts',
        actionTab: 'debts',
      });
    });

    // 4D. Active Payable Debts Reminder
    const payableDebts = (data.debts || []).filter(
      (d) =>
        d.type === 'Payable' &&
        d.status !== 'Cleared' &&
        Number(d.remainingBalance ?? d.originalAmount) > 0
    );
    if (payableDebts.length > 0) {
      const totalPayable = payableDebts.reduce(
        (s, d) => s + Number(d.remainingBalance ?? d.originalAmount),
        0
      );
      pushItem({
        id: `debt-payable-summary-${todayIso}`,
        category: 'budgets',
        severity: 'warning',
        title: `💳 Active Payable Obligations: ${fmtMad(totalPayable)} Across ${payableDebts.length} Record${payableDebts.length === 1 ? '' : 's'}`,
        body: `Ensure your "💳 Debt & Obligations" budget reserves enough to clear ${payableDebts.map((d) => d.contactName).join(', ')}.`,
        metricBadge: fmtMad(totalPayable),
        actionLabel: 'Manage Payables',
        actionTab: 'debts',
      });
    }

    // 4E. Individual Active Goals Progress
    const activeGoals = (data.goals || []).filter((g) => Number(g.targetAmount) > 0);
    activeGoals.slice(0, 3).forEach((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const pct = Math.min(100, (current / target) * 100);
      const remaining = Math.max(0, target - current);
      if (remaining > 0) {
        pushItem({
          id: `goal-progress-${g.id}-${todayIso}`,
          category: 'budgets',
          severity: pct >= 70 ? 'opportunity' : 'info',
          title: `🎯 Goal "${g.name}": ${pct.toFixed(0)}% Funded (${fmtMad(current)} / ${fmtMad(target)})`,
          body: `${fmtMad(remaining)} remaining to reach 100% on "${g.name}". You can sweep unspent living budget directly into this goal from the Budgets tab.`,
          metricBadge: `${pct.toFixed(0)}% Funded`,
          actionLabel: 'Open Goals',
          actionTab: 'goals',
        });
      }
    });
  }

  // ============================================================================
  // 5. CREATIVE BEHAVIORAL & WEALTH CHALLENGES
  // ============================================================================
  if (channels.creativeEnabled) {
    const todayExpenses = txs.filter(
      (t) => t.type === 'Expense' && t.createdAt && t.createdAt.slice(0, 10) === todayIso
    );

    // 5A. "Zero-Spend Day" Challenge & Rollover Reward
    if (todayExpenses.length === 0 && data.dailyAllowance > 0) {
      pushItem({
        id: `creative-zero-spend-${todayIso}`,
        category: 'creative',
        severity: 'opportunity',
        title: `🔥 Active "Zero-Spend Day" Streak Today!`,
        body: `0 MAD spent so far today! Finishing the day at 0 MAD banks +${fmtMad(data.dailyAllowance)} directly into your bank-retained savings buffer.`,
        metricBadge: `+${fmtMad(data.dailyAllowance)} Kept`,
        actionLabel: 'Simulate Surplus',
        actionTab: 'calculators',
      });
    }

    // 5B. 7-Day "Micro-Leak / Coffee & Impulse Radar" (Net of Reimbursements)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const microExpenses = txs.filter((t) => {
      if (t.type !== 'Expense') return false;
      const netAmt = netExpenseOf(t);
      const dt = new Date(t.createdAt);
      return netAmt > 0 && netAmt <= 120 && dt >= sevenDaysAgo;
    });
    if (microExpenses.length >= 3) {
      const microSum = microExpenses.reduce((s, t) => s + netExpenseOf(t), 0);
      const monthlyRunRate = microSum * 4.33;
      const usdEq = monthlyRunRate / (data.investmentsData?.rates?.USD_TO_MAD || 9.82);
      pushItem({
        id: `creative-micro-leak-${todayIso}`,
        category: 'creative',
        severity: 'info',
        title: `☕ Micro-Spend Radar: ${microExpenses.length} Small Purchases (${fmtMad(microSum)} in 7d)`,
        body: `Small purchases under 120 MAD are running at ~${fmtMad(monthlyRunRate)}/mo (${fmtUsd(usdEq)}/mo) — enough to buy fractional shares of VOO or NVDA every single payday.`,
        metricBadge: `${fmtMad(microSum)} / 7d`,
        actionLabel: 'Inspect Micro-Spends',
        actionTab: 'transactions',
      });
    }

    // 5C. "Reimbursement Shield" Insight (Shows how much friend pass-through money was excluded!)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let totalReimbExcluded30d = 0;
    txs.forEach((tx) => {
      const dt = new Date(tx.createdAt);
      if (dt < thirtyDaysAgo) return;
      if (tx.type === 'Income' && isReimbursementIncome(tx)) {
        totalReimbExcluded30d += Number(tx.amount) || 0;
      } else if (tx.type === 'Expense') {
        totalReimbExcluded30d += reimbursedAmountOf(tx);
      }
    });
    if (totalReimbExcluded30d > 0) {
      pushItem({
        id: `creative-reimbursement-shield-${todayIso}`,
        category: 'creative',
        severity: 'opportunity',
        title: `🛡️ Reimbursement Shield Stripped ${fmtMad(totalReimbExcluded30d)} in Pass-Throughs`,
        body: `TrueSpend automatically excluded ${fmtMad(totalReimbExcluded30d)} in friend splits & reimbursements over the last 30 days so your Income and Category Spending reflect 100% pure net figures.`,
        metricBadge: `${fmtMad(totalReimbExcluded30d)} Filtered`,
        actionLabel: 'View Net Analytics',
        actionTab: 'analytics',
      });
    }

    // 5D. Highest-Spend Day-of-Week Behavioral Pattern
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    txs.slice(0, 120).forEach((tx) => {
      if (tx.type !== 'Expense') return;
      const net = netExpenseOf(tx);
      if (net <= 0) return;
      const d = new Date(tx.createdAt);
      if (!Number.isNaN(d.getTime())) {
        weekdayTotals[d.getDay()] += net;
      }
    });
    const maxWeekdayVal = Math.max(...weekdayTotals);
    if (maxWeekdayVal > 0) {
      const peakDayIdx = weekdayTotals.indexOf(maxWeekdayVal);
      const totalSample = weekdayTotals.reduce((a, b) => a + b, 0);
      const peakSharePct = Math.round((maxWeekdayVal / Math.max(1, totalSample)) * 100);
      pushItem({
        id: `creative-weekday-pattern-${todayIso}`,
        category: 'creative',
        severity: 'info',
        title: `📊 Behavioral Pattern: ${weekdayNames[peakDayIdx]} is Your Peak Spend Day (${peakSharePct}%)`,
        body: `${peakSharePct}% of your recent net expenses happen on ${weekdayNames[peakDayIdx]}s. Planning a "${weekdayNames[peakDayIdx]} Cap" is the fastest lever to boost monthly bank retention.`,
        metricBadge: `${weekdayNames[peakDayIdx]} Peak`,
        actionLabel: 'Explore Habits in Analytics',
        actionTab: 'analytics',
      });
    }

    // 5E. Emergency Buffer Shield & Runway Months
    if ((data.totalLiquidBalance || 0) > 0 && (data.monthlyExpenses || 0) > 0) {
      const runwayMonths = (data.totalLiquidBalance || 0) / Math.max(1, data.monthlyExpenses);
      pushItem({
        id: `creative-runway-shield-${todayIso}`,
        category: 'creative',
        severity: runwayMonths >= 3 ? 'opportunity' : 'info',
        title: `🛡️ Liquid Runway Shield: ${runwayMonths.toFixed(1)} Months of Expenses Covered`,
        body: `Your liquid wallets hold ${fmtMad(data.totalLiquidBalance || 0)}, covering ${runwayMonths.toFixed(1)}x your current monthly net spend (${fmtMad(data.monthlyExpenses)}).`,
        metricBadge: `${runwayMonths.toFixed(1)} Mo Runway`,
        actionLabel: 'View Forecast',
        actionTab: 'forecast',
      });
    }

    // 5F. 15 MAD/Day Micro-Trim Compounding Idea
    pushItem({
      id: `creative-daily-margin-${todayIso}`,
      category: 'creative',
      severity: 'opportunity',
      title: `💡 The 20 MAD/Day Retention Rule = +7,300 MAD/Year`,
      body: `Keeping just 20 MAD/day unspent from your daily allowance automatically leaves +600 MAD/month (+7,300 MAD/year) in your salary bank account with zero extra effort.`,
      metricBadge: `+7,300 MAD/yr`,
      actionLabel: 'Open Calculators Hub',
      actionTab: 'calculators',
    });
  }

  // Interleave items across all 5 categories so the feed is always diverse (never all from one section)
  const categoryOrder: NotificationCategory[] = [
    'calendar',
    'stocks',
    'subscriptions',
    'budgets',
    'creative',
  ];

  // If shuffleSeed > 0, rotate category order and shuffle within categories
  const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
    if (seed === 0) return arr;
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.abs(Math.sin(seed + i * 17.3) * 10000)) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const orderedCats = seededShuffle(categoryOrder, shuffleSeed);
  const lists = orderedCats.map((c) => seededShuffle(byCategory[c], shuffleSeed));
  const interleaved: SmartNotificationItem[] = [];
  const maxLen = Math.max(0, ...lists.map((l) => l.length));

  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) {
        interleaved.push(list[i]);
      }
    }
  }

  return interleaved;
}

/**
 * Picks a RANDOM, diverse notification to push via Browser Notification API,
 * strictly avoiding recently sent notification IDs and rotating across categories!
 */
export function buildInsight(
  data: NotifData,
  channels: NotifChannelPrefs = DEFAULT_CHANNELS,
  preferredCategory?: NotificationCategory
): { id: string; title: string; body: string; category: NotificationCategory; actionTab: DashboardTab } {
  const all = generateSmartNotifications(data, channels, Math.floor(Math.random() * 1000) + 1);
  const log = getTodaySentLog();

  // Filter by preferredCategory if requested, otherwise exclude already-sent IDs and avoid repeating the same category back-to-back
  let pool = preferredCategory
    ? all.filter((n) => n.category === preferredCategory && !log.sentInsightIds.includes(n.id))
    : all.filter(
        (n) =>
          !log.sentInsightIds.includes(n.id) &&
          (!log.lastCategory || n.category !== log.lastCategory)
      );

  if (pool.length === 0 && preferredCategory) {
    pool = all.filter((n) => n.category === preferredCategory);
  }
  if (pool.length === 0) {
    pool = all.filter((n) => !log.sentInsightIds.includes(n.id));
  }
  if (pool.length === 0) {
    pool = all;
  }

  if (pool.length > 0) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    return {
      id: chosen.id,
      title: chosen.title,
      body: chosen.body,
      category: chosen.category,
      actionTab: chosen.actionTab,
    };
  }

  // Diverse fallback pool
  const fallbacks: Array<{
    id: string;
    title: string;
    body: string;
    category: NotificationCategory;
    actionTab: DashboardTab;
  }> = [
    {
      id: 'fallback-cal-events',
      title: '📅 Financial Calendar Radar Active',
      body: 'Your upcoming paydays, subscription renewals, and debt due dates are synced on your Financial Calendar.',
      category: 'calendar',
      actionTab: 'calendar',
    },
    {
      id: 'fallback-stocks-breakeven',
      title: '📈 Portfolio Breakeven Guard',
      body: 'Every stock in your Funding Wallet tracks live entry + exit fee drag so you never sell below breakeven.',
      category: 'stocks',
      actionTab: 'investments',
    },
    {
      id: 'fallback-sub-compounding',
      title: '🔄 Subscription Compounding Rule',
      body: 'Pausing one unused 150 MAD/mo subscription and auto-investing in S&P 500 ETFs builds ~11,600 MAD in 5 years.',
      category: 'subscriptions',
      actionTab: 'subscriptions',
    },
    {
      id: 'fallback-budget-retention',
      title: '🏦 Bank-as-Savings Retention',
      body: 'Whatever you do not spend on Obligations and Yourself stays protected in your bank account automatically.',
      category: 'budgets',
      actionTab: 'budgets',
    },
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications() {
  const native = isNativePlatform();
  const [supported, setSupported] = useState(native);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<NotifSettings>({
    enabled: localStorage.getItem(KEY_ENABLED) === 'true',
    time: localStorage.getItem(KEY_TIME) ?? DEFAULT_TIME,
    channels: loadChannelPrefs(),
  });
  const [serverSettings, setServerSettings] = useState<ServerNotifSettings | null>(null);
  const [snapshot, setSnapshot] = useState<NotifData | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState<number>(1);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<NotifData | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;

  useEffect(() => {
    if (native) {
      void (async () => {
        try {
          await LocalNotifications.createChannel({
            id: NATIVE_CHANNEL_ID,
            name: 'Daily financial insights',
            description: 'TrueSpend budget and spending insights',
            importance: 3,
            sound: 'default',
            vibration: true,
          });
          const result = await LocalNotifications.checkPermissions();
          setPermission(result.display as NotificationPermission);
        } catch (error) {
          console.error('[TrueSpend] Native notifications unavailable:', error);
          setSupported(false);
        }
      })();
      return;
    }
    if ('Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, [native]);

  // Generate live diversified smart feed from the latest financial snapshot
  const smartFeed = useMemo(
    () => generateSmartNotifications(snapshot, settings.channels, shuffleSeed),
    [snapshot, settings.channels, shuffleSeed]
  );

  const shuffleFeed = useCallback(() => {
    setShuffleSeed((prev) => prev + Math.floor(Math.random() * 50) + 1);
  }, []);

  // Kept as lightweight no-ops so any legacy callers compile cleanly without read/ignore clutter
  const unreadCount = smartFeed.length;
  const markAsRead = useCallback((_id: string) => {}, []);
  const markAllAsRead = useCallback(() => {}, []);
  const dismissNotification = useCallback((_id: string) => {}, []);
  const resetDismissed = useCallback(() => {
    shuffleFeed();
  }, [shuffleFeed]);

  const subscribeToServer = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const response = await fetch('/api/notifications/vapid-public-key');
        if (!response.ok) return;
        const { publicKey } = await response.json();
        if (!publicKey) return;
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(subscription),
      });
    } catch (err) {
      console.error('Failed to subscribe to push service', err);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (native) {
      const result = await LocalNotifications.requestPermissions();
      setPermission(result.display as NotificationPermission);
      return result.display === 'granted';
    }
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      await subscribeToServer();
    }
    return result === 'granted';
  }, [native]);

  const fetchServerPreferences = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const res = await fetch('/api/notifications/preferences', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
      if (res.ok) {
        const data = await res.json();
        setServerSettings({
          enabled: data.enabled,
          dailyInsightEnabled: data.dailyInsightEnabled,
          budgetWarningEnabled: data.budgetWarningEnabled,
          forecastWarningEnabled: data.forecastWarningEnabled,
          debtReminderEnabled: data.debtReminderEnabled,
          anomalyEnabled: data.anomalyEnabled,
          goalEnabled: data.goalEnabled ?? true,
          deliveryTime: data.deliveryTime,
          timezone: data.timezone,
          quietHoursStart: data.quietHoursStart,
          quietHoursEnd: data.quietHoursEnd,
        });
      }
    } catch (err) {
      console.error('Failed to fetch server preferences', err);
    }
  }, []);

  const updateServerPreferences = useCallback(
    async (patch: Partial<ServerNotifSettings>) => {
      const token = localStorage.getItem('auth_token');
      if (typeof patch.enabled === 'boolean' || typeof patch.deliveryTime === 'string') {
        setSettings((prev) => {
          const next = {
            ...prev,
            ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
            ...(typeof patch.deliveryTime === 'string' ? { time: patch.deliveryTime } : {}),
          };
          localStorage.setItem(KEY_ENABLED, String(next.enabled));
          localStorage.setItem(KEY_TIME, next.time);
          return next;
        });
      }

      if (!token) return;
      try {
        const res = await fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patch),
        });
        if (res.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
        if (res.ok) {
          const data = await res.json();
          setServerSettings((prev) => ({ ...(prev as ServerNotifSettings), ...data }));
          if (patch.enabled && permission === 'granted') {
            await subscribeToServer();
          }
        }
      } catch (err) {
        console.error('Failed to update server preferences', err);
      }
    },
    [permission]
  );

  useEffect(() => {
    fetchServerPreferences();
  }, [fetchServerPreferences]);

  const fireNotification = useCallback(
    async (
      data: NotifData,
      preferredCategory?: NotificationCategory,
      customPayload?: { title: string; body: string }
    ) => {
      if (native) {
        const s = settingsRef.current;
        const insight = customPayload ?? buildInsight(data, s.channels, preferredCategory);
        void LocalNotifications.schedule({
          notifications: [{
            id: NATIVE_NOTIFICATION_ID,
            title: insight.title,
            body: insight.body,
            channelId: NATIVE_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          }],
        }).then(() => markSentToday(s.channels.cadence)).catch(error => {
          console.error('[TrueSpend] Native notification failed:', error);
        });
        return;
      }
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      const s = settingsRef.current;
      const insight = customPayload
        ? {
            id: `custom-${Date.now()}`,
            category: preferredCategory || ('creative' as NotificationCategory),
            ...customPayload,
          }
        : buildInsight(data, s.channels, preferredCategory);

      const options: NotificationOptions & { tag: string } = {
        body: insight.body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `truespend-${insight.category}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requireInteraction: false,
      };

      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification(insight.title, options);
            recordSentInsight(insight.id, insight.category);
            return;
          }
        } catch (e) {
          console.warn('[TrueSpend] SW showNotification failed, using fallback:', e);
        }
      }

      try {
        new Notification(insight.title, options);
        recordSentInsight(insight.id, insight.category);
      } catch (e) {
        console.error('[TrueSpend] Notification constructor failed:', e);
      }
    },
    [native]
  );

  const sendNow = useCallback(
    async (
      data?: NotifData,
      preferredCategory?: NotificationCategory,
      customPayload?: { title: string; body: string }
    ) => {
      if (!supported || permission !== 'granted') return;
      const targetData =
        data && (data.monthlyIncome > 0 || data.subscriptions || data.investmentsData)
          ? data
          : dataRef.current ||
            data || {
              monthlyExpenses: 0,
              monthlyIncome: 0,
              totalBudget: 0,
              totalSpent: 0,
              daysUntilPayday: 0,
              dailyAllowance: 0,
              dailyRemaining: 0,
              overspentCategories: [],
              topCategory: null,
              savings: 0,
            };
      await fireNotification(targetData, preferredCategory, customPayload);
    },
    [supported, permission, fireNotification]
  );

  /**
   * Fires a randomized burst of N diverse notifications across different sections
   * (e.g. 1 from Calendar, 1 from Stocks, 1 from Subscriptions/Creative) spaced by 900ms.
   */
  const sendRandomBurst = useCallback(
    async (count = 3) => {
      if (!supported) return;
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) return;
      }
      const categories: NotificationCategory[] = [
        'calendar',
        'stocks',
        'subscriptions',
        'budgets',
        'creative',
      ].sort(() => Math.random() - 0.5) as NotificationCategory[];

      for (let i = 0; i < Math.min(count, categories.length); i++) {
        await sendNow(undefined, categories[i]);
        if (i < count - 1) {
          await new Promise((r) => setTimeout(r, 850));
        }
      }
    },
    [supported, permission, requestPermission, sendNow]
  );

  const tick = useCallback(() => {
    const s = settingsRef.current;
    const p = permissionRef.current;
    if (!s.enabled || p !== 'granted' || !dataRef.current) return;

    if (shouldSendScheduledNow(s.channels.cadence, s.time)) {
      fireNotification(dataRef.current);
    }
  }, [fireNotification]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const s = settingsRef.current;
    const p = permissionRef.current;
    if (!s.enabled || p !== 'granted') return;

    tick();
    intervalRef.current = setInterval(tick, CHECK_INTERVAL_MS);
  }, [tick]);

  const scheduleDaily = useCallback(
    (data: NotifData) => {
      dataRef.current = data;
      setSnapshot(data);
      if (native) {
        const [hours, minutes] = settingsRef.current.time.split(':').map(Number);
        const nextDelivery = new Date();
        nextDelivery.setHours(hours, minutes, 0, 0);
        if (nextDelivery <= new Date()) nextDelivery.setDate(nextDelivery.getDate() + 1);
        void LocalNotifications.cancel({ notifications: [{ id: NATIVE_NOTIFICATION_ID }] });
        void LocalNotifications.schedule({
          notifications: [{
            id: NATIVE_NOTIFICATION_ID,
            ...buildInsight(data, settingsRef.current.channels),
            channelId: NATIVE_CHANNEL_ID,
            schedule: { at: nextDelivery, repeats: true, every: 'day', allowWhileIdle: true },
          }],
        });
        return;
      }
      startInterval();
    },
    [native, startInterval]
  );

  useEffect(() => {
    if (native && settings.enabled && dataRef.current) scheduleDaily(dataRef.current);
  }, [native, settings.enabled, settings.time, settings.channels, scheduleDaily]);

  useEffect(() => {
    startInterval();
  }, [settings.enabled, settings.time, settings.channels.cadence, permission, startInterval]);

  const updateSettings = useCallback((patch: Partial<NotifSettings>) => {
    setSettings((prev) => {
      const next: NotifSettings = {
        ...prev,
        ...patch,
        channels: patch.channels ? { ...prev.channels, ...patch.channels } : prev.channels,
      };
      localStorage.setItem(KEY_ENABLED, String(next.enabled));
      localStorage.setItem(KEY_TIME, next.time);
      localStorage.setItem(KEY_CHANNELS, JSON.stringify(next.channels));
      return next;
    });
  }, []);

  const updateChannelPrefs = useCallback((patch: Partial<NotifChannelPrefs>) => {
    setSettings((prev) => {
      const nextChannels = { ...prev.channels, ...patch };
      localStorage.setItem(KEY_CHANNELS, JSON.stringify(nextChannels));
      return { ...prev, channels: nextChannels };
    });
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [tick]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    native,
    supported,
    permission,
    settings,
    serverSettings,
    smartFeed,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    resetDismissed,
    shuffleFeed,
    updateSettings,
    updateChannelPrefs,
    updateServerPreferences,
    requestPermission,
    scheduleDaily,
    sendNow,
    sendRandomBurst,
  };
}
