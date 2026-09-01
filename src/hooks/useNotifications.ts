/**
 * useNotifications
 *
 * Manages browser Web Notifications for TrueSpend.
 * Delivers at most ONE personalised financial insight per day.
 *
 * How it works:
 *   1. On every data refresh, `scheduleDaily(data)` stores the latest
 *      financial snapshot and (re)starts a periodic 30-second check.
 *   2. Every 30 s the check compares the current time to the configured
 *      delivery time. If the time has passed and we haven't sent today's
 *      notification yet, it fires immediately.
 *   3. On app launch, if the scheduled time has already passed today and
 *      no notification was sent, it fires straight away so the user
 *      never misses a daily insight regardless of when they open the app.
 *
 * Settings are persisted in localStorage:
 *   truespend_notif_enabled   – "true" | "false"
 *   truespend_notif_time      – "HH:MM"  (24-hour, default "09:00")
 *   truespend_notif_last_sent – ISO date string of the last notification date
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── types ────────────────────────────────────────────────────────────────────
export interface NotifSettings {
  enabled: boolean;
  time: string; // "HH:MM"
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
}

// ─── storage keys ─────────────────────────────────────────────────────────────
const KEY_ENABLED = 'truespend_notif_enabled';
const KEY_TIME = 'truespend_notif_time';
const KEY_LAST_SENT = 'truespend_notif_last_sent';
const DEFAULT_TIME = '09:00';

// How often to check if it's time to send (ms)
const CHECK_INTERVAL_MS = 30_000; // 30 seconds

// ─── helpers ──────────────────────────────────────────────────────────────────
function toDay(date: Date) {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function alreadySentToday(): boolean {
  const last = localStorage.getItem(KEY_LAST_SENT);
  return last === toDay(new Date());
}

function markSentToday() {
  localStorage.setItem(KEY_LAST_SENT, toDay(new Date()));
}

/**
 * Returns true if the current local time is at or past the configured
 * delivery time for today.
 */
function isDeliveryTimePassed(timeStr: string): boolean {
  const [hh, mm] = timeStr.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
  return now >= target;
}

/** Pick a personalised insight from the user's real financial data */
function buildInsight(data: NotifData): { title: string; body: string } {
  const fmt = (n: number) =>
    n.toLocaleString('fr-MA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const candidates: { title: string; body: string }[] = [];

  // ── Daily allowance ────────────────────────────────────────────────────────
  if (data.dailyAllowance > 0) {
    if (data.dailyRemaining < 0) {
      candidates.push({
        title: '⚠️ Over budget today',
        body: `You've exceeded today's allowance by ${fmt(Math.abs(data.dailyRemaining))} MAD. Try to hold back for the rest of the day!`,
      });
    } else {
      candidates.push({
        title: '💰 Daily budget check',
        body: `You have ${fmt(data.dailyRemaining)} MAD left to spend today (allowance: ${fmt(data.dailyAllowance)} MAD). Stay on track!`,
      });
    }
  }

  // ── Payday countdown ───────────────────────────────────────────────────────
  if (data.daysUntilPayday <= 3 && data.daysUntilPayday > 0) {
    candidates.push({
      title: '🗓️ Payday is almost here!',
      body: `${data.daysUntilPayday} day${data.daysUntilPayday !== 1 ? 's' : ''} until your next paycheck. Stretch your budget a little more!`,
    });
  }

  // ── Overspent categories ───────────────────────────────────────────────────
  if (data.overspentCategories.length > 0) {
    const cat = data.overspentCategories[0];
    candidates.push({
      title: '🚨 Budget exceeded',
      body: `You've gone over budget in "${cat}" this month. Consider adjusting your limit or cutting back.`,
    });
  }

  // ── Savings congratulation ─────────────────────────────────────────────────
  if (data.savings > 0 && data.monthlyIncome > 0) {
    const pct = Math.round((data.savings / data.monthlyIncome) * 100);
    if (pct >= 10) {
      candidates.push({
        title: '🎉 Great savings rate!',
        body: `You've saved ${fmt(data.savings)} MAD (${pct}% of income) this month. Keep it up!`,
      });
    }
  }

  // ── Generic spending recap ─────────────────────────────────────────────────
  if (data.monthlyExpenses > 0) {
    candidates.push({
      title: '📊 Monthly spending update',
      body: `You've spent ${fmt(data.monthlyExpenses)} MAD so far this month. Your income this month: ${fmt(data.monthlyIncome)} MAD.`,
    });
  }

  // ── Budget remaining ──────────────────────────────────────────────────────
  if (data.totalBudget > 0) {
    const rem = data.totalBudget - data.totalSpent;
    if (rem > 0) {
      candidates.push({
        title: '📋 Budget recap',
        body: `${fmt(rem)} MAD remaining from your ${fmt(data.totalBudget)} MAD monthly budget. You're doing great!`,
      });
    } else if (rem < 0) {
      candidates.push({
        title: '📋 Over monthly budget',
        body: `You've exceeded your monthly budget by ${fmt(Math.abs(rem))} MAD. Review your biggest categories.`,
      });
    }
  }

  // ── Fallback tip ──────────────────────────────────────────────────────────
  const tips = [
    { title: '💡 Financial tip', body: 'Automate savings: set up a standing order on payday so you save before you spend.' },
    { title: '💡 Did you know?', body: 'The 50/30/20 rule: 50% needs, 30% wants, 20% savings. TrueSpend\'s Auto-Budget does this automatically!' },
    { title: '💡 Spending insight', body: 'Reviewing your transactions weekly takes just 5 minutes and prevents budget surprises at month-end.' },
    { title: '💡 Smart habit', body: 'Track every dirham, no matter how small. Small daily expenses add up to hundreds by month-end.' },
  ];
  candidates.push(...tips);

  // Rotate through candidates based on day-of-year so it feels "fresh" each day
  const dayOfYear = Math.floor(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
  );
  return candidates[dayOfYear % candidates.length];
}

// ─── hook ─────────────────────────────────────────────────────────────────────
export function useNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<NotifSettings>({
    enabled: localStorage.getItem(KEY_ENABLED) === 'true',
    time: localStorage.getItem(KEY_TIME) ?? DEFAULT_TIME,
  });
  const [serverSettings, setServerSettings] = useState<ServerNotifSettings | null>(null);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<NotifData | null>(null);
  // Keep a ref of settings so the interval callback always reads fresh values
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;

  // Check browser support
  useEffect(() => {
    if ('Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request permission when user enables notifications
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      await subscribeToServer();
    }
    return result === 'granted';
  }, []);

  const subscribeToServer = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        const response = await fetch('/api/notifications/vapid-public-key');
        const { publicKey } = await response.json();
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    } catch (err) {
      console.error('Failed to subscribe to push service', err);
    }
  };

  const fetchServerPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        setServerSettings({
          enabled: data.enabled,
          dailyInsightEnabled: data.dailyInsightEnabled,
          budgetWarningEnabled: data.budgetWarningEnabled,
          forecastWarningEnabled: data.forecastWarningEnabled,
          debtReminderEnabled: data.debtReminderEnabled,
          anomalyEnabled: data.anomalyEnabled,
          goalEnabled: data.goalEnabled,
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

  const updateServerPreferences = useCallback(async (patch: Partial<ServerNotifSettings>) => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setServerSettings(prev => ({ ...prev, ...data }));
        if (patch.enabled && permission === 'granted') {
          await subscribeToServer();
        }
      }
    } catch (err) {
      console.error('Failed to update server preferences', err);
    }
  }, [permission]);

  useEffect(() => {
    fetchServerPreferences();
  }, [fetchServerPreferences]);

  /**
   * Actually fire a notification. Tries the service worker first (works
   * even when the tab is in the background for installed PWAs), then falls
   * back to the Notification constructor.
   */
  const fireNotification = useCallback(async (data: NotifData) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const { title, body } = buildInsight(data);
    const options: NotificationOptions & { tag: string } = {
      body,
      icon: '/app-icon.png',
      badge: '/app-icon.png',
      tag: 'truespend-daily',
      requireInteraction: false,
    };

    // Try service-worker showNotification first (visible even when tab is bg)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(title, options);
          markSentToday();
          return;
        }
      } catch (e) {
        console.warn('[TrueSpend] SW showNotification failed, using fallback:', e);
      }
    }

    // Fallback: plain Notification constructor
    try {
      new Notification(title, options);
      markSentToday();
    } catch (e) {
      console.error('[TrueSpend] Notification constructor failed:', e);
    }
  }, []);

  // Fire a notification immediately (for preview / debug from Settings)
  const sendNow = useCallback(async (data: NotifData) => {
    if (!supported || permission !== 'granted') return;
    await fireNotification(data);
  }, [supported, permission, fireNotification]);

  /**
   * The core periodic check. Called every CHECK_INTERVAL_MS.
   * Reads from refs so the interval closure always has the latest values.
   */
  const tick = useCallback(() => {
    const s = settingsRef.current;
    const p = permissionRef.current;
    if (!s.enabled || p !== 'granted' || !dataRef.current) return;

    // Is the delivery time already past for today, and we haven't sent yet?
    if (isDeliveryTimePassed(s.time) && !alreadySentToday()) {
      console.log('[TrueSpend] Notification delivery time reached, firing now.');
      fireNotification(dataRef.current);
    }
  }, [fireNotification]);

  /**
   * Start (or restart) the periodic check interval.
   * Called by `scheduleDaily` and also when settings change.
   */
  const startInterval = useCallback(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const s = settingsRef.current;
    const p = permissionRef.current;
    if (!s.enabled || p !== 'granted') return;

    // Run one immediate check (catches the case where the user just opened
    // the app and the delivery time already passed today)
    tick();

    // Then run every 30 seconds
    intervalRef.current = setInterval(tick, CHECK_INTERVAL_MS);
  }, [tick]);

  /**
   * Called by the dashboard whenever fresh KPI / transaction data arrives.
   * Stores the latest financial snapshot and (re)starts the periodic check.
   */
  const scheduleDaily = useCallback((data: NotifData) => {
    dataRef.current = data;
    startInterval();
  }, [startInterval]);

  // Re-start the interval when settings or permission changes
  useEffect(() => {
    startInterval();
  }, [settings.enabled, settings.time, permission, startInterval]);

  // Persist settings changes
  const updateSettings = useCallback((patch: Partial<NotifSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(KEY_ENABLED, String(next.enabled));
      localStorage.setItem(KEY_TIME, next.time);
      return next;
    });
  }, []);

  // Also check when the document becomes visible (user switches back to app)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [tick]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    supported,
    permission,
    settings,
    serverSettings,
    updateSettings,
    updateServerPreferences,
    requestPermission,
    scheduleDaily,
    sendNow,
  };
}
