import React, { useState } from 'react';
import { Bell, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Button } from '../../ui/Button';
import type {
  NotifChannelPrefs,
  NotifSettings,
  NotificationCategory,
  ServerNotifSettings,
  SmartNotificationItem,
} from '../../../hooks/useNotifications';

export interface NotificationsApi {
  native?: boolean;
  supported: boolean;
  permission: NotificationPermission;
  settings: NotifSettings;
  serverSettings: ServerNotifSettings | null;
  smartFeed?: SmartNotificationItem[];
  unreadCount?: number;
  updateSettings: (patch: Partial<NotifSettings>) => void;
  updateChannelPrefs?: (patch: Partial<NotifChannelPrefs>) => void;
  updateServerPreferences: (patch: Partial<ServerNotifSettings>) => void;
  requestPermission: () => Promise<boolean>;
  sendNow: (
    data?: any,
    preferredCategory?: NotificationCategory,
    customPayload?: { title: string; body: string }
  ) => void;
  sendRandomBurst?: (count?: number) => void;
}

export interface SettingsNotificationsSectionProps {
  notifications: NotificationsApi;
  onToggleNotifications: () => void;
  onSendTest: (preferredCategory?: NotificationCategory) => void;
}

const CHANNELS = [
  {
    key: 'stocksEnabled' as const,
    serverKey: 'anomalyEnabled' as const,
    title: 'Stocks & Portfolio Statuses',
    desc: '24h movers, breakeven crossovers, watchlist triggers, and dividend dates.',
  },
  {
    key: 'subscriptionsEnabled' as const,
    serverKey: 'forecastWarningEnabled' as const,
    title: 'Subscriptions & Renewals',
    desc: 'Upcoming 24h–72h billing alerts, overdue renewals, and opportunity cost.',
  },
  {
    key: 'calendarEnabled' as const,
    serverKey: 'dailyInsightEnabled' as const,
    title: 'Calendar & Cash Flow Radar',
    desc: 'Upcoming bill clusters, payday countdowns, and Safe-to-Spend checks.',
  },
  {
    key: 'budgetsEnabled' as const,
    serverKey: 'budgetWarningEnabled' as const,
    title: 'Budgets, Debts & Goals',
    desc: 'Category limit warnings, pending split reminders, and goal milestones.',
  },
  {
    key: 'creativeEnabled' as const,
    serverKey: 'goalEnabled' as const,
    title: 'Behavioral Challenges',
    desc: 'Zero-spend streaks, micro-leak impulse alerts, and savings velocity nudges.',
  },
];

export const SettingsNotificationsSection: React.FC<SettingsNotificationsSectionProps> = ({
  notifications,
  onToggleNotifications,
  onSendTest,
}) => {
  const [testPanelOpen, setTestPanelOpen] = useState(false);

  const isMasterEnabled =
    notifications.serverSettings?.enabled ?? notifications.settings.enabled;

  const permissionStatus: Record<NotificationPermission, { label: string; color: string }> = {
    granted: { label: 'Allowed', color: 'text-emerald-600 dark:text-emerald-400' },
    denied: {
      label: 'Blocked in browser settings',
      color: 'text-rose-600 dark:text-rose-400',
    },
    default: { label: 'Not requested yet', color: 'text-amber-600 dark:text-amber-400' },
  };

  return (
    <div className="space-y-6">
      {/* 1. Master Delivery & Browser Permission */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Push &amp; Alert Delivery
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Control browser push notifications and live insights across your workspace.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('truespend:openNotifications'))}
            className="text-xs whitespace-nowrap tabular-nums"
          >
            Open Alert Feed ({notifications.smartFeed?.length || 0})
          </Button>
        </div>

        {!notifications.supported ? (
          <div className="p-5 sm:p-6 text-xs text-amber-700 dark:text-amber-300">
            Your browser does not support Web Push notifications. All smart alerts remain available in the Alerts drawer.
          </div>
        ) : (
          <>
            <div className="p-4 sm:px-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Master Push Delivery
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Browser permission:{' '}
                  <span className={`font-medium ${permissionStatus[notifications.permission].color}`}>
                    {permissionStatus[notifications.permission].label}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {notifications.permission === 'default' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => notifications.requestPermission()}
                    className="text-xs whitespace-nowrap"
                  >
                    Allow Push
                  </Button>
                )}
                {notifications.permission !== 'denied' && (
                  <button
                    type="button"
                    id="notif-toggle"
                    role="switch"
                    aria-checked={isMasterEnabled}
                    aria-label="Toggle master push delivery"
                    onClick={onToggleNotifications}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer ${
                      isMasterEnabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        isMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Schedule Row: Cadence, Primary Time & Quiet Hours */}
            <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="notif-cadence"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Delivery Cadence
                </label>
                <select
                  id="notif-cadence"
                  value={notifications.settings.channels?.cadence || 'realtime_priority'}
                  onChange={(e) =>
                    notifications.updateChannelPrefs?.({
                      cadence: e.target.value as NotifChannelPrefs['cadence'],
                    })
                  }
                  className="w-full h-9 px-2.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="realtime_priority">Active Stream (up to 10/day)</option>
                  <option value="twice_daily">Multi-Pulse (up to 5/day)</option>
                  <option value="daily_digest">Daily Digest (up to 3/day)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="notif-time"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Primary Delivery Time
                </label>
                <input
                  id="notif-time"
                  type="time"
                  value={
                    notifications.serverSettings?.deliveryTime ||
                    notifications.settings.time ||
                    '09:00'
                  }
                  onChange={(e) => {
                    notifications.updateSettings({ time: e.target.value });
                    notifications.updateServerPreferences({ deliveryTime: e.target.value });
                  }}
                  className="w-full h-9 px-2.5 text-xs font-mono tabular-nums rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Quiet Hours (Do Not Disturb)
                </label>
                <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
                  <input
                    type="time"
                    aria-label="Quiet hours start"
                    value={notifications.serverSettings?.quietHoursStart || '22:00'}
                    onChange={(e) =>
                      notifications.updateServerPreferences({ quietHoursStart: e.target.value })
                    }
                    className="w-full h-9 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="time"
                    aria-label="Quiet hours end"
                    value={notifications.serverSettings?.quietHoursEnd || '07:00'}
                    onChange={(e) =>
                      notifications.updateServerPreferences({ quietHoursEnd: e.target.value })
                    }
                    className="w-full h-9 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 2. Intelligence Channels (Clean Hairline Toggle List) */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Alert Channels
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Choose which financial domains can trigger smart alerts.
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {CHANNELS.map((ch) => {
            const isOn = notifications.settings.channels?.[ch.key] ?? true;
            return (
              <div
                key={ch.key}
                className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{ch.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ch.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={`Toggle ${ch.title}`}
                  onClick={() => {
                    notifications.updateChannelPrefs?.({ [ch.key]: !isOn });
                    notifications.updateServerPreferences({ [ch.serverKey]: !isOn });
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer ${
                    isOn ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      isOn ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Collapsible Live Test Drawer (keeps normal view clutter-free) */}
        {notifications.supported && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setTestPanelOpen((prev) => !prev)}
              aria-expanded={testPanelOpen}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {testPanelOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Send Test Notification
            </button>

            {testPanelOpen && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => notifications.sendRandomBurst?.(3)}
                  className="text-xs whitespace-nowrap gap-1.5"
                >
                  <Send className="h-3 w-3" />
                  Burst 3 Alerts
                </Button>
                {(
                  [
                    { id: undefined, label: 'Any Domain' },
                    { id: 'calendar', label: 'Calendar' },
                    { id: 'subscriptions', label: 'Subscription' },
                    { id: 'stocks', label: 'Stock Alert' },
                    { id: 'budgets', label: 'Budget / Goal' },
                    { id: 'creative', label: 'Challenge' },
                  ] as Array<{ id?: NotificationCategory; label: string }>
                ).map((btn) => (
                  <Button
                    key={btn.label}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onSendTest(btn.id)}
                    className="text-xs whitespace-nowrap"
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
