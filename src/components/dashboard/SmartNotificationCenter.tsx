import React, { useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Repeat,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  WalletCards,
  X,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';
import type { DashboardTab } from '../../types';
import type {
  NotificationCategory,
  SmartNotificationItem,
} from '../../hooks/useNotifications';

interface SmartNotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: {
    supported: boolean;
    permission: NotificationPermission;
    smartFeed: SmartNotificationItem[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    dismissNotification: (id: string) => void;
    resetDismissed: () => void;
    requestPermission: () => Promise<boolean>;
    sendNow: (
      data?: any,
      preferredCategory?: NotificationCategory,
      customPayload?: { title: string; body: string }
    ) => Promise<void> | void;
  };
  onNavigateTab: (tab: DashboardTab) => void;
}

const CATEGORY_TABS: Array<{
  id: 'all' | NotificationCategory;
  label: string;
}> = [
  { id: 'all', label: 'All Insights' },
  { id: 'stocks', label: 'Stocks' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'budgets', label: 'Budgets & Debts' },
  { id: 'creative', label: 'Creative' },
];

export const SmartNotificationCenter: React.FC<SmartNotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onNavigateTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | NotificationCategory>('all');
  const [pushedId, setPushedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredItems =
    selectedCategory === 'all'
      ? notifications.smartFeed
      : notifications.smartFeed.filter((item) => item.category === selectedCategory);

  const getCategoryIcon = (cat: NotificationCategory) => {
    switch (cat) {
      case 'stocks':
        return <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case 'subscriptions':
        return <Repeat className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
      case 'calendar':
        return <CalendarDays className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'budgets':
        return <WalletCards className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case 'creative':
        return <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  const getSeverityBadgeStyle = (sev: SmartNotificationItem['severity']) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/70';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70';
      case 'opportunity':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70';
      default:
        return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/70';
    }
  };

  const handlePushItemToBrowser = async (item: SmartNotificationItem) => {
    if (notifications.permission !== 'granted') {
      const granted = await notifications.requestPermission();
      if (!granted) return;
    }
    await notifications.sendNow(undefined, item.category, {
      title: item.title,
      body: item.body,
    });
    setPushedId(item.id);
    setTimeout(() => setPushedId(null), 2200);
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex justify-end bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                  Smart Notifications &amp; Insights
                </h3>
                {notifications.unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-600 text-white">
                    {notifications.unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Live alerts from Stocks, Subscriptions, Calendar, Budgets &amp; Creative Radar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {notifications.unreadCount > 0 && (
              <button
                type="button"
                onClick={notifications.markAllAsRead}
                title="Mark all as read"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Mark Read</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('settings');
              }}
              title="Notification Settings & Channels"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 overflow-x-auto bg-gray-50/60 dark:bg-gray-950/50 shrink-0">
          {CATEGORY_TABS.map((tab) => {
            const count =
              tab.id === 'all'
                ? notifications.smartFeed.length
                : notifications.smartFeed.filter((i) => i.category === tab.id).length;
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-200/80 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feed Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-3 my-6">
              <div className="mx-auto h-10 w-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                <Bell className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  All Caught Up in This Channel
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                  No active alerts match this filter right now, or you have dismissed previous cards.
                </p>
              </div>
              <button
                type="button"
                onClick={notifications.resetDismissed}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore Dismissed Insights
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => notifications.markAsRead(item.id)}
                className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                  item.read
                    ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                    : 'bg-indigo-50/25 dark:bg-indigo-950/20 border-indigo-300/80 dark:border-indigo-800/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0">
                      {getCategoryIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!item.read && (
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                        )}
                        <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-snug">
                          {item.title}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums font-semibold border shrink-0 ${getSeverityBadgeStyle(
                      item.severity
                    )}`}
                  >
                    {item.metricBadge}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {item.body}
                </p>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        notifications.markAsRead(item.id);
                        onClose();
                        onNavigateTab(item.actionTab);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePushItemToBrowser(item);
                      }}
                      title="Send this alert as a browser notification now"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                      <span>{pushedId === item.id ? 'Sent!' : 'Push Alert'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      notifications.dismissNotification(item.id);
                    }}
                    className="text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/60 flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            Browser Push:{' '}
            <strong className="text-gray-900 dark:text-white">
              {notifications.permission === 'granted'
                ? 'Active'
                : notifications.permission === 'denied'
                ? 'Blocked'
                : 'Not enabled'}
            </strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={notifications.resetDismissed}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium cursor-pointer"
            >
              Reset Dismissed
            </button>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('settings');
              }}
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
            >
              Configure Channels →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
