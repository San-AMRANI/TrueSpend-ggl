/**
 * useNotifications — Smart Multi-Domain Notification & Financial Intelligence Engine
 *
 * Synthesizes real-time insights across:
 *   1. Calendar & Cash Flow (bill clusters, payday countdown, weekend velocity, safe-to-spend pace)
 *   2. Subscriptions & Recurring Drain (imminent 24h-72h renewals, overdue bills, compound wealth opportunity cost)
 *   3. Stocks, Equities & Portfolio Statuses (breakeven crossovers, 24h movers, watchlist buy/sell triggers, sector concentration, dividends)
 *   4. Budgets, Debts & Goals (overspent categories, debt recovery nudges, goal milestones)
 *   5. Creative Behavioral Ideas (No-Spend Day streaks, micro-leak impulse radar, stock-equivalent translations, buffer shield)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativePlatform } from '../lib/capacitorBridge';
import type {
  DashboardTab,
  Debt,
  Goal,
  InvestmentsData,
  Payroll,
  Subscription,
  Transaction,
} from '../types';

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
  read: boolean;
  dismissed?: boolean;
}

export interface NotifChannelPrefs {
  calendarEnabled: boolean;
  subscriptionsEnabled: boolean;
  stocksEnabled: boolean;
  budgetsEnabled: boolean;
  creativeEnabled: boolean;
  cadence: 'daily_digest' | 'twice_daily' | 'realtime_priority';
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
const KEY_LAST_SENT = 'truespend_notif_last_sent';
const KEY_CHANNELS = 'truespend_notif_channels_v3';
const KEY_READ_IDS = 'truespend_notif_read_ids_v3';
const KEY_DISMISSED_IDS = 'truespend_notif_dismissed_ids_v3';
const DEFAULT_TIME = '09:00';

const DEFAULT_CHANNELS: NotifChannelPrefs = {
  calendarEnabled: true,
  subscriptionsEnabled: true,
  stocksEnabled: true,
  budgetsEnabled: true,
  creativeEnabled: true,
  cadence: 'daily_digest',
};

// How often to check if it's time to send (ms)
const CHECK_INTERVAL_MS = 30_000;
const NATIVE_NOTIFICATION_ID = 1001;
const NATIVE_CHANNEL_ID = 'truespend-daily-insights';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function loadChannelPrefs(): NotifChannelPrefs {
  try {
    const raw = localStorage.getItem(KEY_CHANNELS);
    if (!raw) return DEFAULT_CHANNELS;
    return { ...DEFAULT_CHANNELS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CHANNELS;
  }
}

function loadStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveStringSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // ignore storage quota errors
  }
}

const KEY_SENT_LOG_TODAY = 'truespend_notif_sent_log_v3';

interface DailySentLog {
  date: string;
  count: number;
  lastSentTimestamp: number;
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

function alreadySentToday(cadence: NotifChannelPrefs['cadence']): boolean {
  const log = getTodaySentLog();
  const today = toDay(new Date());
  const last = localStorage.getItem(KEY_LAST_SENT);

  if (cadence === 'daily_digest') {
    return log.count >= 1 || (last !== null && last.startsWith(today));
  }

  if (cadence === 'twice_daily') {
    const slot = new Date().getHours() < 15 ? 'AM' : 'PM';
    return log.count >= 2 || last === `${today}-${slot}`;
  }

  // 'realtime_priority': Up to 4 distinct notifications per day, spaced at least 3 hours apart
  const threeHoursMs = 3 * 60 * 60 * 1000;
  if (log.count >= 4) return true;
  if (log.lastSentTimestamp > 0 && Date.now() - log.lastSentTimestamp < threeHoursMs) {
    return true;
  }
  return false;
}

function markSentToday(cadence: NotifChannelPrefs['cadence'], insightId?: string) {
  const today = toDay(new Date());
  const slot = cadence === 'twice_daily' ? (new Date().getHours() < 15 ? '-AM' : '-PM') : '';
  localStorage.setItem(KEY_LAST_SENT, `${today}${slot}`);

  const log = getTodaySentLog();
  const updated: DailySentLog = {
    date: today,
    count: log.count + 1,
    lastSentTimestamp: Date.now(),
    sentInsightIds: insightId
      ? Array.from(new Set([...log.sentInsightIds, insightId]))
      : log.sentInsightIds,
  };
  localStorage.setItem(KEY_SENT_LOG_TODAY, JSON.stringify(updated));
}

function isDeliveryTimePassed(timeStr: string): boolean {
  const [hh, mm] = timeStr.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
  return now >= target;
}

const fmtMad = (n: number) =>
  `${Math.round(n).toLocaleString('fr-MA')} MAD`;

const fmtUsd = (n: number, decimals = 2) =>
  `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

// ─── Multi-Domain Smart Insight Generator ─────────────────────────────────────
export function generateSmartNotifications(
  data: NotifData | null,
  channels: NotifChannelPrefs = DEFAULT_CHANNELS,
  readIds: Set<string> = new Set(),
  dismissedIds: Set<string> = new Set()
): SmartNotificationItem[] {
  if (!data) return [];

  const now = new Date();
  const todayIso = toDay(now);
  const items: SmartNotificationItem[] = [];

  const pushItem = (
    item: Omit<SmartNotificationItem, 'timestamp' | 'read' | 'dismissed'>
  ) => {
    if (dismissedIds.has(item.id)) return;
    items.push({
      ...item,
      timestamp: now.toISOString(),
      read: readIds.has(item.id),
    });
  };

  // ============================================================================
  // 1. SUBSCRIPTIONS & RECURRING DRAIN INTELLIGENCE
  // ============================================================================
  if (channels.subscriptionsEnabled && data.subscriptions && data.subscriptions.length > 0) {
    const activeSubs = data.subscriptions.filter((s) => s.status === 'active');

    // Compute days until renewal for each active subscription
    const withDays = activeSubs.map((sub) => {
      const nextDate = new Date(sub.nextBillingDate);
      const diffDays = Math.ceil(
        (nextDate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const monthlyEq =
        sub.billingCycle === 'yearly'
          ? Number(sub.amount) / 12
          : sub.billingCycle === 'weekly'
          ? Number(sub.amount) * 4.33
          : Number(sub.amount);
      return { sub, diffDays, amount: Number(sub.amount), monthlyEq };
    });

    // 1A. Overdue or Due Today subscriptions
    const dueNow = withDays.filter((s) => s.diffDays <= 0);
    if (dueNow.length > 0) {
      const top = dueNow[0];
      const totalDueMad = dueNow.reduce((acc, s) => acc + s.amount, 0);
      pushItem({
        id: `sub-due-now-${todayIso}-${top.sub.id}`,
        category: 'subscriptions',
        severity: 'critical',
        title:
          dueNow.length === 1
            ? `⚡ ${top.sub.name} Renewal Due Today`
            : `⚡ ${dueNow.length} Subscriptions Due for Renewal`,
        body:
          dueNow.length === 1
            ? `${top.sub.name} (${fmtMad(top.amount)}) is scheduled on ${top.sub.nextBillingDate}. Mark as paid or pause before auto-debit.`
            : `${dueNow.map((d) => d.sub.name).join(', ')} total ${fmtMad(totalDueMad)} due now. Review wallet liquidity before settlement.`,
        metricBadge: fmtMad(totalDueMad),
        actionLabel: 'Review Subscriptions',
        actionTab: 'subscriptions',
      });
    }

    // 1B. Imminent Renewals (1 to 3 days out)
    const imminent = withDays.filter((s) => s.diffDays >= 1 && s.diffDays <= 3);
    if (imminent.length > 0) {
      const nextSub = imminent.sort((a, b) => a.diffDays - b.diffDays)[0];
      pushItem({
        id: `sub-imminent-${todayIso}-${nextSub.sub.id}`,
        category: 'subscriptions',
        severity: 'warning',
        title: `🔔 ${nextSub.sub.name} Renews in ${nextSub.diffDays} Day${nextSub.diffDays === 1 ? '' : 's'}`,
        body: `${fmtMad(nextSub.amount)} (${nextSub.sub.billingCycle}) will hit your ${nextSub.sub.walletName || 'primary'} wallet on ${nextSub.sub.nextBillingDate}. Still getting full value?`,
        metricBadge: `In ${nextSub.diffDays}d · ${fmtMad(nextSub.amount)}`,
        actionLabel: 'Manage Renewal',
        actionTab: 'subscriptions',
      });
    }

    // 1C. Subscription Wealth Opportunity Cost (Creative Subs + Stocks cross-insight)
    const totalMonthlySubs = withDays.reduce((acc, s) => acc + s.monthlyEq, 0);
    if (totalMonthlySubs > 0) {
      // 5-year compound value at 10% annual return if 25% of subscription spend was invested
      const monthlySaved = totalMonthlySubs * 0.25;
      const r = 0.1 / 12;
      const n = 60;
      const fv5Yr = monthlySaved * ((Math.pow(1 + r, n) - 1) / r);
      pushItem({
        id: `sub-wealth-tradeoff-${todayIso}`,
        category: 'subscriptions',
        severity: 'info',
        title: `🔄 Subscription Drain vs. 5-Year Equity Wealth`,
        body: `Your ${activeSubs.length} active subscriptions cost ${fmtMad(totalMonthlySubs)}/mo (${fmtMad(totalMonthlySubs * 12)}/yr). Trimming just 25% and auto-investing in S&P 500 / AI ETFs projects to ${fmtMad(fv5Yr)} in 5 years.`,
        metricBadge: `${fmtMad(totalMonthlySubs)}/mo`,
        actionLabel: 'Audit Subscriptions',
        actionTab: 'subscriptions',
      });
    }
  }

  // ============================================================================
  // 2. STOCKS, EQUITIES & PORTFOLIO STATUSES
  // ============================================================================
  if (channels.stocksEnabled && data.investmentsData) {
    const inv = data.investmentsData;
    const usdToMad = inv.rates?.USD_TO_MAD || 9.82;
    // Filter strictly to non-crypto stock/ETF/BVC positions
    const stockPositions = (inv.positions || []).filter(
      (p) =>
        p.market !== 'CRYPTO' &&
        !/^(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|USDT|USDC)$/i.test(p.ticker)
    );

    if (stockPositions.length > 0) {
      // 2A. 24h Top Mover / Volatility Alert
      const sortedByAbsMove = [...stockPositions].sort(
        (a, b) => Math.abs(b.change24hPercent || 0) - Math.abs(a.change24hPercent || 0)
      );
      const topMover = sortedByAbsMove[0];
      if (topMover && Math.abs(topMover.change24hPercent || 0) >= 1.2) {
        const move = topMover.change24hPercent || 0;
        const isUp = move >= 0;
        const valUsd = topMover.marketValueUsd ?? topMover.marketValueMad / usdToMad;
        pushItem({
          id: `stock-mover-${todayIso}-${topMover.ticker}`,
          category: 'stocks',
          severity: isUp ? 'opportunity' : 'warning',
          title: `${isUp ? '📈' : '📉'} Stock Pulse: ${topMover.ticker} ${isUp ? '+' : ''}${move.toFixed(2)}% (24h)`,
          body: `${topMover.companyName} is trading at ${
            topMover.currency === 'MAD'
              ? fmtMad(Number(topMover.currentPrice))
              : fmtUsd(Number(topMover.currentPrice))
          } (Position value: ${fmtUsd(valUsd)} / ${fmtMad(topMover.marketValueMad)}).`,
          metricBadge: `${isUp ? '+' : ''}${move.toFixed(2)}% 24h`,
          actionLabel: 'Open Stocks Workspace',
          actionTab: 'investments',
        });
      }

      // 2B. Breakeven Price Crossover / Profit-Lock Alert
      const profitableStocks = stockPositions.filter(
        (p) => (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad) > 0
      );
      const nearBreakevenStocks = stockPositions.filter((p) => {
        const dist = p.distanceToBreakevenPercent ?? 0;
        return dist >= -2.5 && dist <= 2.0;
      });

      if (profitableStocks.length > 0) {
        const best = [...profitableStocks].sort(
          (a, b) =>
            (b.netPnlAfterFeesMad ?? b.unrealizedPnlMad) -
            (a.netPnlAfterFeesMad ?? a.unrealizedPnlMad)
        )[0];
        const netUsd =
          best.netPnlAfterFeesUsd ??
          (best.netPnlAfterFeesMad ?? best.unrealizedPnlMad) / usdToMad;
        pushItem({
          id: `stock-breakeven-clear-${todayIso}-${best.ticker}`,
          category: 'stocks',
          severity: 'opportunity',
          title: `🎯 ${best.ticker} Trading Above Fee-Adjusted Breakeven`,
          body: `${best.ticker} has cleared both entry and exit fee drag with ${fmtUsd(netUsd)} (+${(best.netPnlAfterFeesPercent ?? best.unrealizedPnlPercent).toFixed(1)}%) net profit. Breakeven floor: ${fmtUsd(best.breakevenPriceUsd ?? best.avgCostNum ?? Number(best.avgCostPerShare))}.`,
          metricBadge: `+${fmtUsd(netUsd)} Net`,
          actionLabel: 'Inspect Position',
          actionTab: 'investments',
        });
      } else if (nearBreakevenStocks.length > 0) {
        const closest = nearBreakevenStocks[0];
        pushItem({
          id: `stock-near-breakeven-${todayIso}-${closest.ticker}`,
          category: 'stocks',
          severity: 'info',
          title: `⚖️ ${closest.ticker} Approaching Breakeven Threshold`,
          body: `${closest.ticker} is within ${Math.abs(closest.distanceToBreakevenPercent ?? 0).toFixed(2)}% of its fee-adjusted breakeven price (${fmtUsd(closest.breakevenPriceUsd ?? closest.avgCostNum ?? Number(closest.avgCostPerShare))}). Avoid selling below breakeven.`,
          metricBadge: `${(closest.distanceToBreakevenPercent ?? 0).toFixed(2)}% to BE`,
          actionLabel: 'Check Breakeven',
          actionTab: 'investments',
        });
      }

      // 2C. Portfolio P&L & Sector Concentration Status
      const totalStocksMad = stockPositions.reduce((s, p) => s + (p.marketValueMad || 0), 0);
      const totalNetPnlMad = stockPositions.reduce(
        (s, p) => s + (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad ?? 0),
        0
      );
      if (totalStocksMad > 0) {
        const bySector = new Map<string, number>();
        stockPositions.forEach((p) => {
          const sec = p.sector || 'Technology & Cloud';
          bySector.set(sec, (bySector.get(sec) || 0) + (p.marketValueMad || 0));
        });
        const topSectorEntry = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topSectorEntry) {
          const topWeightPct = (topSectorEntry[1] / totalStocksMad) * 100;
          if (topWeightPct >= 65 && stockPositions.length >= 2) {
            pushItem({
              id: `stock-sector-conc-${todayIso}`,
              category: 'stocks',
              severity: 'warning',
              title: `🧭 Equity Sector Concentration: ${topWeightPct.toFixed(0)}% in ${topSectorEntry[0]}`,
              body: `${stockPositions.length} held stocks (${fmtUsd(totalStocksMad / usdToMad)}) are heavily weighted in ${topSectorEntry[0]} (Net P&L: ${totalNetPnlMad >= 0 ? '+' : ''}${fmtUsd(totalNetPnlMad / usdToMad)}). Consider balancing with Banking, Mechanics/Industrials, or Dividend ETFs.`,
              metricBadge: `${topWeightPct.toFixed(0)}% Sector Weight`,
              actionLabel: 'Rebalance Sectors',
              actionTab: 'investments',
            });
          }
        }
      }
    }

    // 2D. Watchlist Buy/Sell Target Triggered
    const watchlist = inv.watchlistPositions || [];
    for (const w of watchlist) {
      const price = Number(w.currentPrice || 0);
      const buyTarget = Number(w.alertBelow ?? w.targetPrice ?? 0);
      const sellTarget = Number(w.alertAbove ?? 0);
      if (buyTarget > 0 && price > 0 && price <= buyTarget) {
        pushItem({
          id: `watchlist-buy-hit-${todayIso}-${w.ticker}`,
          category: 'stocks',
          severity: 'opportunity',
          title: `🟢 Watchlist Buy Zone Reached: ${w.ticker}`,
          body: `${w.companyName} (${w.ticker}) is at ${fmtUsd(price)}, hitting your target entry zone of ${fmtUsd(buyTarget)}.`,
          metricBadge: `${fmtUsd(price)} <= ${fmtUsd(buyTarget)}`,
          actionLabel: 'View Watchlist',
          actionTab: 'investments',
        });
      } else if (sellTarget > 0 && price > 0 && price >= sellTarget) {
        pushItem({
          id: `watchlist-sell-hit-${todayIso}-${w.ticker}`,
          category: 'stocks',
          severity: 'opportunity',
          title: `🔔 Watchlist Price Target Reached: ${w.ticker}`,
          body: `${w.companyName} (${w.ticker}) reached ${fmtUsd(price)}, crossing your ${fmtUsd(sellTarget)} target.`,
          metricBadge: `${fmtUsd(price)} >= ${fmtUsd(sellTarget)}`,
          actionLabel: 'View Watchlist',
          actionTab: 'investments',
        });
      }
    }

    // 2E. Upcoming Dividend Calendar Event (Next 14 Days)
    const divEvents = inv.dividendEvents || [];
    const upcomingDivs = divEvents.filter((d) => {
      const dt = new Date(d.paymentDate || d.exDividendDate || '');
      const diff = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 14;
    });
    if (upcomingDivs.length > 0) {
      const nextDiv = upcomingDivs[0];
      pushItem({
        id: `stock-div-upcoming-${todayIso}-${nextDiv.ticker}`,
        category: 'stocks',
        severity: 'opportunity',
        title: `💵 Upcoming Dividend Event: ${nextDiv.ticker}`,
        body: `${nextDiv.ticker} has a scheduled ${nextDiv.status === 'confirmed' || nextDiv.status === 'paid' ? 'confirmed' : 'estimated'} dividend of ${
          nextDiv.currency === 'MAD'
            ? fmtMad(nextDiv.netAmount)
            : fmtUsd(nextDiv.netAmount)
        } on ${nextDiv.paymentDate || nextDiv.exDividendDate}.`,
        metricBadge:
          nextDiv.currency === 'MAD'
            ? fmtMad(nextDiv.netAmount)
            : fmtUsd(nextDiv.netAmount),
        actionLabel: 'Open Dividends Tab',
        actionTab: 'investments',
      });
    }
  }

  // ============================================================================
  // 3. CALENDAR & CASH FLOW INSIGHTS
  // ============================================================================
  if (channels.calendarEnabled) {
    // 3A. 7-Day Upcoming Bill Cluster Radar (Calendar + Subscriptions + Debts)
    const next7DaysSubs = (data.subscriptions || []).filter((s) => {
      if (s.status !== 'active') return false;
      const diff = Math.ceil(
        (new Date(s.nextBillingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diff >= 0 && diff <= 7;
    });

    if (next7DaysSubs.length >= 2) {
      const clusterSum = next7DaysSubs.reduce((acc, s) => acc + Number(s.amount || 0), 0);
      pushItem({
        id: `cal-bill-cluster-${todayIso}`,
        category: 'calendar',
        severity: 'warning',
        title: `📅 7-Day Calendar Cluster: ${next7DaysSubs.length} Bills Ahead`,
        body: `Your Financial Calendar shows ${next7DaysSubs.length} recurring charges (${next7DaysSubs.map((s) => s.name).join(', ')}) totaling ${fmtMad(clusterSum)} within the next 7 days.`,
        metricBadge: `${fmtMad(clusterSum)} in 7d`,
        actionLabel: 'Open Financial Calendar',
        actionTab: 'calendar',
      });
    }

    // 3B. Payday Countdown & Safe-to-Spend Runway
    if (data.daysUntilPayday > 0 && data.daysUntilPayday <= 5) {
      pushItem({
        id: `cal-payday-countdown-${todayIso}`,
        category: 'calendar',
        severity: data.dailyRemaining < 0 ? 'warning' : 'opportunity',
        title: `🗓️ Payday Countdown: ${data.daysUntilPayday} Day${data.daysUntilPayday === 1 ? '' : 's'} Remaining`,
        body: `Next salary cycle lands in ${data.daysUntilPayday} day${data.daysUntilPayday === 1 ? '' : 's'}. Keep daily spending under ${fmtMad(Math.max(0, data.dailyAllowance))} to finish the period with a clean surplus.`,
        metricBadge: `${data.daysUntilPayday}d to Payday`,
        actionLabel: 'View Cash Flow Calendar',
        actionTab: 'calendar',
      });
    } else if (data.daysUntilPayday > 5 && data.dailyAllowance > 0) {
      pushItem({
        id: `cal-runway-check-${todayIso}`,
        category: 'calendar',
        severity: data.dailyRemaining >= 0 ? 'info' : 'warning',
        title:
          data.dailyRemaining >= 0
            ? `📆 Calendar Pace: ${fmtMad(data.dailyRemaining)} Safe Today`
            : `⚠️ Daily Pace Exceeded by ${fmtMad(Math.abs(data.dailyRemaining))}`,
        body:
          data.dailyRemaining >= 0
            ? `With ${data.daysUntilPayday} days until payday, your daily Safe-to-Spend allowance is ${fmtMad(data.dailyAllowance)} (${fmtMad(data.dailyRemaining)} left today).`
            : `Today's spending crossed your ${fmtMad(data.dailyAllowance)} daily pace by ${fmtMad(Math.abs(data.dailyRemaining))}. Holding back tomorrow re-balances your calendar runway.`,
        metricBadge: `${fmtMad(data.dailyRemaining)} today`,
        actionLabel: 'Inspect Calendar',
        actionTab: 'calendar',
      });
    }
  }

  // ============================================================================
  // 4. BUDGETS, DEBTS & GOALS ALERTS
  // ============================================================================
  if (channels.budgetsEnabled) {
    // 4A. Overspent Category Alert
    if (data.overspentCategories.length > 0) {
      const cat = data.overspentCategories[0];
      pushItem({
        id: `budget-overspent-${todayIso}-${cat}`,
        category: 'budgets',
        severity: 'critical',
        title: `🚨 Category Limit Exceeded: "${cat}"`,
        body:
          data.overspentCategories.length === 1
            ? `You've crossed your monthly budget allocation for "${cat}". Reallocate surplus from under-spent categories or pause discretionary spend.`
            : `${data.overspentCategories.length} categories (${data.overspentCategories.slice(0, 3).join(', ')}) are over budget this month.`,
        metricBadge: `${data.overspentCategories.length} Over Limit`,
        actionLabel: 'Adjust Budgets',
        actionTab: 'budgets',
      });
    }

    // 4B. Unsettled "Receivable" Debt Recovery Nudge
    const owedToMe = (data.debts || []).filter(
      (d) =>
        d.type === 'Receivable' &&
        d.status !== 'Cleared' &&
        Number(d.remainingBalance ?? d.originalAmount) > 0
    );
    if (owedToMe.length > 0) {
      const totalReceivable = owedToMe.reduce(
        (s, d) => s + Number(d.remainingBalance ?? d.originalAmount),
        0
      );
      const topDebtor = [...owedToMe].sort(
        (a, b) =>
          Number(b.remainingBalance ?? b.originalAmount) -
          Number(a.remainingBalance ?? a.originalAmount)
      )[0];
      pushItem({
        id: `debt-receivable-${todayIso}`,
        category: 'budgets',
        severity: 'opportunity',
        title: `🤝 ${fmtMad(totalReceivable)} in Uncollected Reimbursements`,
        body: `${topDebtor.contactName} owes ${fmtMad(Number(topDebtor.remainingBalance ?? topDebtor.originalAmount))}${owedToMe.length > 1 ? ` (+${owedToMe.length - 1} other split${owedToMe.length > 2 ? 's' : ''})` : ''}. Settling this boosts your daily Safe-to-Spend by +${fmtMad(totalReceivable / Math.max(1, data.daysUntilPayday || 15))}/day.`,
        metricBadge: fmtMad(totalReceivable),
        actionLabel: 'Collect in Debts',
        actionTab: 'debts',
      });
    }

    // 4C. Goal Milestone Proximity
    const activeGoals = (data.goals || []).filter((g) => Number(g.targetAmount) > 0);
    for (const g of activeGoals) {
      const pct = (Number(g.currentAmount) / Number(g.targetAmount)) * 100;
      const remaining = Math.max(0, Number(g.targetAmount) - Number(g.currentAmount));
      if (pct >= 75 && pct < 100) {
        pushItem({
          id: `goal-milestone-${todayIso}-${g.id}`,
          category: 'budgets',
          severity: 'opportunity',
          title: `🏁 Goal "${g.name}" is ${pct.toFixed(0)}% Funded!`,
          body: `Only ${fmtMad(remaining)} left to complete "${g.name}". A small transfer from your monthly surplus locks in 100% completion.`,
          metricBadge: `${pct.toFixed(0)}% Done`,
          actionLabel: 'Top Up Goal',
          actionTab: 'goals',
        });
        break;
      }
    }
  }

  // ============================================================================
  // 5. CREATIVE BEHAVIORAL & WEALTH CHALLENGES
  // ============================================================================
  if (channels.creativeEnabled) {
    const txs = data.transactions || [];
    const todayExpenses = txs.filter(
      (t) => t.type === 'Expense' && t.createdAt && t.createdAt.slice(0, 10) === todayIso
    );

    // 5A. "Zero-Spend Day" Challenge & Rollover Reward
    if (todayExpenses.length === 0 && data.dailyAllowance > 0) {
      pushItem({
        id: `creative-zero-spend-${todayIso}`,
        category: 'creative',
        severity: 'opportunity',
        title: `🔥 Active "Zero-Spend Day" Streak!`,
        body: `You've logged 0 MAD in expenses today. Completing a No-Spend Day banks +${fmtMad(data.dailyAllowance)} directly into your investable surplus or tomorrow's allowance!`,
        metricBadge: `+${fmtMad(data.dailyAllowance)} Saved`,
        actionLabel: 'Simulate Surplus Impact',
        actionTab: 'calculators',
      });
    }

    // 5B. "Micro-Leak / Coffee & Impulse Radar" (7-Day Small Expense Frequency)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const microExpenses = txs.filter((t) => {
      if (t.type !== 'Expense') return false;
      const amt = Number(t.amount);
      const dt = new Date(t.createdAt);
      return amt > 0 && amt <= 120 && dt >= sevenDaysAgo;
    });
    if (microExpenses.length >= 4) {
      const microSum = microExpenses.reduce((s, t) => s + Number(t.amount), 0);
      const monthlyRunRate = microSum * 4.33;
      const usdEq =
        monthlyRunRate / (data.investmentsData?.rates?.USD_TO_MAD || 9.82);
      pushItem({
        id: `creative-micro-leak-${todayIso}`,
        category: 'creative',
        severity: 'info',
        title: `☕ Micro-Spend Radar: ${microExpenses.length} Small Purchases This Week`,
        body: `${microExpenses.length} purchases under 120 MAD totaled ${fmtMad(microSum)} in 7 days (~${fmtMad(monthlyRunRate)}/mo run-rate). That equals ${fmtUsd(usdEq)}/mo — enough to accumulate fractional shares of VOO or NVDA every month.`,
        metricBadge: `${fmtMad(microSum)} / 7d`,
        actionLabel: 'Inspect Transactions',
        actionTab: 'transactions',
      });
    }

    // 5C. Savings Rate & Wealth Velocity Celebration
    if (data.savings > 0 && data.monthlyIncome > 0) {
      const savingsRate = Math.round((data.savings / data.monthlyIncome) * 100);
      if (savingsRate >= 15) {
        pushItem({
          id: `creative-savings-velocity-${todayIso}`,
          category: 'creative',
          severity: 'opportunity',
          title: `🚀 Wealth Velocity: ${savingsRate}% Monthly Savings Rate`,
          body: `You're retaining ${fmtMad(data.savings)} of your ${fmtMad(data.monthlyIncome)} income this month. Deploying 50% (${fmtMad(data.savings * 0.5)}) into your Funding Equities wallet accelerates your 5-year compounding curve.`,
          metricBadge: `${savingsRate}% Saved`,
          actionLabel: 'Open Predictive Forecast',
          actionTab: 'forecast',
        });
      }
    }
  }

  // Sort by severity priority: critical -> warning -> opportunity -> info
  const rank: Record<NotificationSeverity, number> = {
    critical: 0,
    warning: 1,
    opportunity: 2,
    info: 3,
  };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Pick the best notification to push via OS/Browser Notification API */
export function buildInsight(
  data: NotifData,
  channels: NotifChannelPrefs = DEFAULT_CHANNELS,
  preferredCategory?: NotificationCategory
): { id: string; title: string; body: string; category: NotificationCategory; actionTab: DashboardTab } {
  const all = generateSmartNotifications(data, channels);
  const log = getTodaySentLog();
  const filtered = preferredCategory
    ? all.filter((n) => n.category === preferredCategory)
    : all.filter((n) => !log.sentInsightIds.includes(n.id));

  const candidates = filtered.length > 0 ? filtered : all;

  if (candidates.length > 0) {
    const idx = Math.floor(Date.now() / 1000) % candidates.length;
    const chosen = candidates[preferredCategory ? idx : 0];
    return {
      id: chosen.id,
      title: chosen.title,
      body: chosen.body,
      category: chosen.category,
      actionTab: chosen.actionTab,
    };
  }

  // Fallback creative financial insight
  const fallbacks: Array<{
    id: string;
    title: string;
    body: string;
    category: NotificationCategory;
    actionTab: DashboardTab;
  }> = [
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
      id: 'fallback-cal-payday',
      title: '📅 Payday First-Mover Habit',
      body: 'Allocate 15%–20% of your salary on Day 1 of payday before discretionary calendar bills begin.',
      category: 'calendar',
      actionTab: 'calendar',
    },
  ];
  const chosen = fallbacks[Math.floor(Date.now() / 1000) % fallbacks.length];
  return chosen;
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
  const [readIds, setReadIds] = useState<Set<string>>(() => loadStringSet(KEY_READ_IDS));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() =>
    loadStringSet(KEY_DISMISSED_IDS)
  );

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

  // Generate live smart feed from the latest financial snapshot
  const smartFeed = useMemo(
    () => generateSmartNotifications(snapshot, settings.channels, readIds, dismissedIds),
    [snapshot, settings.channels, readIds, dismissedIds]
  );

  const unreadCount = useMemo(
    () => smartFeed.filter((item) => !item.read).length,
    [smartFeed]
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveStringSet(KEY_READ_IDS, next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      smartFeed.forEach((item) => next.add(item.id));
      saveStringSet(KEY_READ_IDS, next);
      return next;
    });
  }, [smartFeed]);

  const dismissNotification = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveStringSet(KEY_DISMISSED_IDS, next);
      return next;
    });
  }, []);

  const resetDismissed = useCallback(() => {
    const empty = new Set<string>();
    setDismissedIds(empty);
    saveStringSet(KEY_DISMISSED_IDS, empty);
  }, []);

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
      // Also mirror enabled & deliveryTime to local settings so local engine stays synced
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
        ? { id: `custom-${Date.now()}`, ...customPayload }
        : buildInsight(data, s.channels, preferredCategory);
      const options: NotificationOptions & { tag: string } = {
        body: insight.body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `truespend-${preferredCategory || 'smart'}-${Date.now()}`,
        requireInteraction: false,
      };

      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification(insight.title, options);
            markSentToday(s.channels.cadence, insight.id);
            return;
          }
        } catch (e) {
          console.warn('[TrueSpend] SW showNotification failed, using fallback:', e);
        }
      }

      try {
        new Notification(insight.title, options);
        markSentToday(s.channels.cadence, insight.id);
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

  const tick = useCallback(() => {
    const s = settingsRef.current;
    const p = permissionRef.current;
    if (!s.enabled || p !== 'granted' || !dataRef.current) return;

    if (isDeliveryTimePassed(s.time) && !alreadySentToday(s.channels.cadence)) {
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
    updateSettings,
    updateChannelPrefs,
    updateServerPreferences,
    requestPermission,
    scheduleDaily,
    sendNow,
  };
}
