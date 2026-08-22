/**
 * useNotifications
 *
 * Manages browser Web Notifications for TrueSpend.
 * Delivers at most ONE personalised financial insight per day.
 * The notification is scheduled client-side (no server infra needed).
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<NotifData | null>(null);

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
    return result === 'granted';
  }, []);

  // Fire a notification immediately (for preview / debug)
  const sendNow = useCallback(async (data: NotifData) => {
    if (!supported || permission !== 'granted') return;
    const { title, body } = buildInsight(data);
    const options = {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'truespend-daily',
      requireInteraction: false,
    };

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(title, options);
          markSentToday();
          return;
        }
      } catch (e) {
        console.error('Service worker notification failed', e);
      }
    }

    // Fallback for desktop browsers without SW
    new Notification(title, options);
    markSentToday();
  }, [supported, permission]);

  // Schedule the daily notification at the configured time
  const scheduleDaily = useCallback((data: NotifData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!settings.enabled || permission !== 'granted') return;

    dataRef.current = data;

    const [hh, mm] = settings.time.split(':').map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);

    // If the target time has already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    // Check if the Notification Triggers API is supported (Chrome/Edge/Android)
    // This allows scheduling the notification at the OS level even if the app is closed.
    if ('showTrigger' in Notification.prototype && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        const isTargetToday = target.getDate() === now.getDate();
        const shouldSchedule = !isTargetToday || !alreadySentToday();
        
        if (reg && shouldSchedule && dataRef.current) {
          const { title, body } = buildInsight(dataRef.current);
          
          // First, clear any previously scheduled notification with the same tag
          reg.getNotifications({ tag: 'truespend-daily' }).then(notifications => {
            notifications.forEach(n => n.close());
            
            // Then schedule the new one
            reg.showNotification(title, {
              body,
              icon: '/logo.png',
              badge: '/logo.png',
              tag: 'truespend-daily',
              // @ts-ignore
              showTrigger: new TimestampTrigger(target.getTime()),
            }).catch(err => console.error('Failed to schedule with showTrigger', err));
          });
        }
      });
      
      // Reschedule for the next day via a loose timeout just to keep the loop going if the app stays open
      timerRef.current = setTimeout(() => {
        scheduleDaily(dataRef.current!);
      }, delay + 60000); // 1 minute after trigger
      return;
    }

    // Fallback: in-memory timeout (only works if the tab remains open)
    timerRef.current = setTimeout(() => {
      const isTargetToday = target.getDate() === new Date().getDate();
      if ((!isTargetToday || !alreadySentToday()) && dataRef.current) {
        sendNow(dataRef.current);
      }
      // After firing, reschedule for next day (keep the loop alive)
      scheduleDaily(dataRef.current!);
    }, delay);
  }, [settings, permission, sendNow]);

  // Persist settings changes
  const updateSettings = useCallback((patch: Partial<NotifSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(KEY_ENABLED, String(next.enabled));
      localStorage.setItem(KEY_TIME, next.time);
      return next;
    });
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    supported,
    permission,
    settings,
    updateSettings,
    requestPermission,
    scheduleDaily,
    sendNow,
  };
}
