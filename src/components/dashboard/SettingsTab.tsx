import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Bell, BellOff, Database, Download, Moon, Sun, Monitor, Upload, Send, Cloud, Clock, Check, User, ShieldCheck, LogOut, Mail, Key, Smartphone, ArrowRight, Landmark } from 'lucide-react';
import { googleSignIn, getGoogleAccessToken } from '../../lib/googleAuth';
import { uploadToGoogleDrive } from '../../lib/driveUpload';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { ThemeStudioCard } from './ThemeStudioCard';
import { parseFinancialRuleDetails } from '../../lib/auditContracts';
import { getCapacitorApiBaseUrl, setCapacitorApiBaseUrl, isNativePlatform, getPlatformName } from '../../lib/capacitorBridge';
import {
  getOfflineOutbox,
  loadDecryptedOfflineOutbox,
  flushOfflineOutbox,
  clearOfflineFinancialCachesOnLogout,
  forceDiscardOfflineOutbox,
  type OfflineOutboxItem,
} from '../../lib/offlineOutbox';
import type {
  NotifChannelPrefs,
  NotifSettings,
  NotificationCategory,
  ServerNotifSettings,
  SmartNotificationItem,
} from '../../hooks/useNotifications';
import type {
  Wallet,
  Subscription,
  Debt,
  InvestmentsData,
  DashboardTab,
  BackupValidationPreview,
  FinancialRuleItem,
  FinancialRuleLogItem,
} from '../../types';

interface NotificationsApi {
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

interface SettingsTabProps {
  userSettings: any;
  isSaving: boolean;
  isExporting?: boolean;
  isImporting?: boolean;
  handleSaveSettings: (payload: any, notifyUser?: boolean) => Promise<void>;
  handleExportSql?: () => void;
  handleImportSql?: (sql: string) => Promise<{ message: string }>;
  wallets?: Wallet[];
  subscriptions?: Subscription[];
  debts?: Debt[];
  investmentsData?: InvestmentsData | null;
  setActiveTab?: (tab: DashboardTab) => void;
  handleCreateWallet?: (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  handleUpdateWallet?: (id: string, payload: { name?: string; type?: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  handleDeleteWallet?: (id: string, reassignToWalletId?: string) => Promise<any>;
  notifications: NotificationsApi;
  onDataChange?: () => Promise<void> | void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  userSettings,
  isSaving,
  isExporting = false,
  isImporting = false,
  handleSaveSettings,
  handleExportSql,
  handleImportSql,
  wallets = [],
  setActiveTab,
  notifications,
  onDataChange,
}) => {
  const importFileRef = useRef<HTMLInputElement>(null);
  const validateFileRef = useRef<HTMLInputElement>(null);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [apiBaseInput, setApiBaseInput] = useState<string>(() => getCapacitorApiBaseUrl());
  const [backupPreview, setBackupPreview] = useState<BackupValidationPreview | null>(null);
  const [rules, setRules] = useState<FinancialRuleItem[]>([]);
  const [ruleLogs, setRuleLogs] = useState<FinancialRuleLogItem[]>([]);
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('transaction_posted');
  const [ruleCondField, setRuleCondField] = useState<'minAmount' | 'counterparty' | 'category' | 'thresholdMad' | 'pacePercent' | 'withinDays'>('minAmount');
  const [ruleCondVal, setRuleCondVal] = useState('');
  const [ruleActionType, setRuleActionType] = useState('send_notification');
  const [ruleDryRunResult, setRuleDryRunResult] = useState<{
    matched: boolean;
    matchedConditions: string[];
    failedConditions: string[];
    proposedResultSummary: string;
    requiresApproval: boolean;
  } | null>(null);
  const [outboxItems, setOutboxItems] = useState<OfflineOutboxItem[]>(() => getOfflineOutbox());
  const [confirmDiscardOutbox, setConfirmDiscardOutbox] = useState(false);
  const { user, token, signOut } = useAuth();

  const refreshOutboxState = React.useCallback(async () => {
    try {
      const decrypted = await loadDecryptedOfflineOutbox();
      setOutboxItems(decrypted);
    } catch {
      setOutboxItems(getOfflineOutbox());
    }
  }, []);

  React.useEffect(() => {
    if (token) {
      dashboardService
        .getFinancialRules(token)
        .then((res) => {
          setRules(res.rules || []);
          setRuleLogs(res.logs || []);
        })
        .catch(() => {});
    }
    refreshOutboxState();
    const onOutboxUpdate = () => {
      refreshOutboxState();
    };
    window.addEventListener('truespend:outbox-updated', onOutboxUpdate);
    return () => window.removeEventListener('truespend:outbox-updated', onOutboxUpdate);
  }, [token, refreshOutboxState]);

  const outboxCount = outboxItems.length;

  
  const handleToggleAutoBackup = async () => {
    if (userSettings?.automatedDriveBackups) {
      await handleSaveSettings({ automatedDriveBackups: false }, false);
      showNotifToast('Automated backups disabled.');
    } else {
      const accessToken = getGoogleAccessToken();
      if (!accessToken) {
        setIsDriveConnecting(true);
        try {
          const res = await googleSignIn();
          if (res && res.accessToken) {
            await handleSaveSettings({
              automatedDriveBackups: true,
              driveBackupFrequency: userSettings?.driveBackupFrequency || 'weekly',
              googleDriveToken: res.accessToken,
            }, false);
            showNotifToast('Google Drive connected and automated backups enabled!');
          }
        } catch (e) {
          console.error(e);
          alert('Failed to connect Google Drive.');
        } finally {
          setIsDriveConnecting(false);
        }
      } else {
        await handleSaveSettings({
          automatedDriveBackups: true,
          driveBackupFrequency: userSettings?.driveBackupFrequency || 'weekly',
          googleDriveToken: accessToken,
        }, false);
        showNotifToast('Automated backups enabled!');
      }
    }
  };

  const handleFrequencyChange = async (freq: 'daily' | '3days' | 'weekly') => {
    await handleSaveSettings({ driveBackupFrequency: freq }, false);
    showNotifToast(`Backup schedule updated to ${freq === 'daily' ? 'Daily' : freq === '3days' ? 'Every 3 Days' : 'Weekly'}.`);
  };

  const handleBackupToDrive = async () => {
    const performBackup = async (accessToken: string) => {
      try {
        setIsDriveBackingUp(true);
        // Try server-side backup first
        try {
          const res = await dashboardService.backupToDrive(accessToken, token);
          if (res && res.success) {
            await handleSaveSettings({ lastDriveBackupDate: res.lastDriveBackupDate }, false);
            showNotifToast('Backup saved to Google Drive successfully!');
            return;
          }
        } catch (serverErr) {
          console.warn('Server-side backup endpoint returned error, falling back to direct upload:', serverErr);
        }

        // Direct client-side fallback
        const blob = await dashboardService.getSqlBlob(token);
        const filename = `truespend_backup_${new Date().toISOString().slice(0, 10)}.sql`;
        await uploadToGoogleDrive(accessToken, blob, filename);
        await handleSaveSettings({ lastDriveBackupDate: new Date().toISOString() }, false);
        showNotifToast('Backup saved to Google Drive successfully!');
      } catch (e: any) {
        console.error(e);
        alert('Failed to backup to Google Drive: ' + (e?.message || 'Unknown error'));
      } finally {
        setIsDriveBackingUp(false);
      }
    };

    let accessToken = getGoogleAccessToken();
    if (!accessToken) {
      setIsDriveConnecting(true);
      try {
        const res = await googleSignIn();
        if (res && res.accessToken) {
          await performBackup(res.accessToken);
        }
      } catch (e) {
        console.error(e);
        alert('Google Sign-In was cancelled or failed.');
      } finally {
        setIsDriveConnecting(false);
      }
    } else {
      await performBackup(accessToken);
    }
  };
  
  const showNotifToast = (msg: string) => {
    setNotifToast(msg);
    setTimeout(() => setNotifToast(null), 3000);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !handleImportSql) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('This backup is larger than the 10 MB import limit.');
      return;
    }

    const sql = await file.text();
    if (!sql.slice(0, 500).includes('-- TrueSpend Complete PostgreSQL Database Backup')) {
      alert('Please select a SQL backup exported by TrueSpend.');
      return;
    }

    if (!confirm('Restore this backup? All current TrueSpend data will be permanently replaced. Export a new backup first if you need the current data.')) return;

    try {
      const result = await handleImportSql(sql);
      alert(result.message);
    } catch (error: any) {
      console.error('SQL import failed:', error);
      alert(error?.message || 'Could not import the SQL backup. Your existing data was not changed.');
    }
  };

  const handleToggleNotifications = async () => {
    if (!notifications.supported) {
      showNotifToast('Your browser does not support notifications.');
      return;
    }

    const isCurrentlyEnabled =
      notifications.serverSettings?.enabled ?? notifications.settings.enabled;

    if (!isCurrentlyEnabled) {
      // Turning ON
      if (notifications.permission !== 'granted') {
        const granted = await notifications.requestPermission();
        if (!granted) {
          showNotifToast('Permission denied. Please allow notifications in your browser settings.');
          return;
        }
      }
      notifications.updateSettings({ enabled: true });
      notifications.updateServerPreferences({ enabled: true });
      showNotifToast('Notifications enabled across active channels!');
    } else {
      // Turning OFF
      notifications.updateSettings({ enabled: false });
      notifications.updateServerPreferences({ enabled: false });
      showNotifToast('Notifications disabled.');
    }
  };

  const handleSendTest = async (preferredCategory?: NotificationCategory) => {
    if (notifications.permission !== 'granted') {
      const granted = await notifications.requestPermission();
      if (!granted) {
        showNotifToast('Please allow browser notifications first.');
        return;
      }
    }
    await notifications.sendNow(undefined, preferredCategory);
    const label = preferredCategory
      ? preferredCategory.charAt(0).toUpperCase() + preferredCategory.slice(1)
      : 'Smart';
    showNotifToast(`${label} notification sent to your browser!`);
  };

  const permissionLabel: Record<NotificationPermission, string> = {
    granted: '✅ Allowed',
    denied: '🚫 Blocked (change in browser settings)',
    default: '⏳ Not asked yet',
  };

  return (
    <div className="space-y-6">
      {/* ── Toast ── */}
      {notifToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 text-sm font-medium shadow-lg">
          {notifToast}
        </div>
      )}

      {/* ── Profile & Account ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Profile & Account
          </CardTitle>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Active Session
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-lg shadow-sm">
                {(user?.displayName?.[0] || user?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {user?.displayName || user?.username || user?.uid || user?.email?.split('@')[0] || 'Owner'}
                  </h4>
                  {user?.username && (
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      @{user.username}
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                  <span className="truncate">{user?.email || 'Authenticated User'}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                    {user?.role === 'owner'
                      ? 'Owner (Super Admin)'
                      : user?.role === 'admin'
                      ? 'Administrator'
                      : user?.role === 'manager'
                      ? 'Finance Manager'
                      : user?.role === 'viewer'
                      ? 'Viewer (Read-Only)'
                      : 'Standard Member'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Key className="h-3 w-3 text-amber-500" />
                    {user?.workspaceMode === 'isolated'
                      ? 'Isolated Personal Workspace'
                      : 'Shared Main Ledger'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-200 dark:border-gray-800 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 font-medium"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Theme & Frontend Style Studio (12 Themes + Architectural Controls) ── */}
      <ThemeStudioCard />

      {/* ── Quick Links to Dedicated Administration & Accounting Screens ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Accounts &amp; Accounting Workbench
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Manage {wallets.length} wallet{wallets.length === 1 ? '' : 's'}, statement CSV import, review inbox, double-entry journal &amp; FX rates.
                </p>
              </div>
            </div>
            {setActiveTab && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('accounts')}
                className="shrink-0 whitespace-nowrap gap-1 text-xs"
              >
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Users, Roles &amp; Access Control
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure workspace members, RBAC permissions, isolation mode &amp; audit logs.
                </p>
              </div>
            </div>
            {setActiveTab && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('users')}
                className="shrink-0 whitespace-nowrap gap-1 text-xs"
              >
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Smart Multi-Domain Notification Engine & Channels ── */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-indigo-500" />
              <span>Smart Notification Engine &amp; Multi-Domain Insights</span>
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Real-time and scheduled alerts across Stocks &amp; Equities, Subscription Renewals, Financial Calendar clusters, Budgets, and Creative Wealth Challenges.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('truespend:openNotifications'))}
            className="flex items-center gap-1.5 text-xs font-semibold shrink-0"
          >
            <Bell className="h-3.5 w-3.5 text-indigo-500" />
            <span>Open Live Alert Feed ({notifications.smartFeed?.length || 0})</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Browser support warning */}
            {!notifications.supported && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-300">
                Your browser does not support Web Notifications. You can still view all insights in the top-bar Alerts drawer.
              </div>
            )}

            {/* Top Row: Browser Permission + Master Switch */}
            <div className="grid gap-3 sm:grid-cols-2">
              {notifications.supported && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      Browser Push Permission
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {permissionLabel[notifications.permission]}
                    </p>
                  </div>
                  {notifications.permission === 'default' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => notifications.requestPermission()}
                      className="text-xs"
                    >
                      Allow Push
                    </Button>
                  )}
                </div>
              )}

              {notifications.supported && notifications.permission !== 'denied' && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 p-3.5 bg-gray-50/50 dark:bg-gray-900/40">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Master Push Delivery
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Deliver scheduled browser &amp; background push insights
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleNotifications}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer ${
                      (notifications.serverSettings?.enabled ?? notifications.settings.enabled)
                        ? 'bg-indigo-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    role="switch"
                    aria-checked={
                      notifications.serverSettings?.enabled ?? notifications.settings.enabled
                    }
                    id="notif-toggle"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                        (notifications.serverSettings?.enabled ?? notifications.settings.enabled)
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            {/* 5 Domain Intelligence Channels */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Active Notification Intelligence Channels (5 Engines)
                </h4>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    key: 'stocksEnabled' as const,
                    serverKey: 'anomalyEnabled' as const,
                    title: 'Stocks & Portfolio Statuses',
                    desc: '24h movers, fee-adjusted breakeven crossovers, watchlist buy/sell triggers, sector concentration & dividend dates.',
                  },
                  {
                    key: 'subscriptionsEnabled' as const,
                    serverKey: 'forecastWarningEnabled' as const,
                    title: 'Subscriptions & Renewals',
                    desc: 'Imminent 24h–72h billing alerts, overdue renewals, and 5-year S&P 500 compounding opportunity cost.',
                  },
                  {
                    key: 'calendarEnabled' as const,
                    serverKey: 'dailyInsightEnabled' as const,
                    title: 'Calendar & Cash Flow Radar',
                    desc: '7-day upcoming bill clusters, payday countdowns, and daily Safe-to-Spend runway checks.',
                  },
                  {
                    key: 'budgetsEnabled' as const,
                    serverKey: 'budgetWarningEnabled' as const,
                    title: 'Budgets, Debts & Goals',
                    desc: 'Category limit warnings, uncollected "Owed to Me" split nudges, and 75%+ goal completion milestones.',
                  },
                  {
                    key: 'creativeEnabled' as const,
                    serverKey: 'goalEnabled' as const,
                    title: 'Creative Behavioral Challenges',
                    desc: 'Zero-Spend Day streaks, 7-day Micro-Leak impulse radar, and monthly savings velocity rewards.',
                  },
                ].map((ch) => {
                  const isOn = notifications.settings.channels?.[ch.key] ?? true;
                  return (
                    <div
                      key={ch.key}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        isOn
                          ? 'border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/20 dark:bg-indigo-950/20'
                          : 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/40 opacity-75'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {ch.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              notifications.updateChannelPrefs?.({ [ch.key]: !isOn });
                              notifications.updateServerPreferences({ [ch.serverKey]: !isOn });
                            }}
                            role="switch"
                            aria-checked={isOn}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
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
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                          {ch.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cadence, Delivery Time & Quiet Hours */}
            <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
                <label className="text-xs font-semibold text-gray-900 dark:text-white block">
                  Delivery Cadence
                </label>
                <select
                  value={notifications.settings.channels?.cadence || 'realtime_priority'}
                  onChange={(e) =>
                    notifications.updateChannelPrefs?.({
                      cadence: e.target.value as NotifChannelPrefs['cadence'],
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
                >
                  <option value="realtime_priority">Active Random Stream (Up to 10/day)</option>
                  <option value="twice_daily">Multi-Pulse Stream (Up to 5/day)</option>
                  <option value="daily_digest">Daily Rotation (Up to 3/day)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
                <label
                  htmlFor="notif-time"
                  className="text-xs font-semibold text-gray-900 dark:text-white block"
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
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-mono"
                />
              </div>

              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1.5">
                <label className="text-xs font-semibold text-gray-900 dark:text-white block">
                  Quiet Hours (Do Not Disturb)
                </label>
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <input
                    type="time"
                    value={notifications.serverSettings?.quietHoursStart || '22:00'}
                    onChange={(e) =>
                      notifications.updateServerPreferences({ quietHoursStart: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg text-[11px]"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={notifications.serverSettings?.quietHoursEnd || '07:00'}
                    onChange={(e) =>
                      notifications.updateServerPreferences({ quietHoursEnd: e.target.value })
                    }
                    className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Instant Preview & Category Test Bar */}
            {notifications.supported && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Test Live Browser Notification by Domain:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => notifications.sendRandomBurst?.(3)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send className="h-3 w-3" />
                    <span>Burst 3 Random Alerts</span>
                  </button>
                  {(
                    [
                      { id: undefined, label: 'Random Any Domain' },
                      { id: 'calendar', label: 'Random Calendar Event' },
                      { id: 'subscriptions', label: 'Random Subscription' },
                      { id: 'stocks', label: 'Random Stock Alert' },
                      { id: 'budgets', label: 'Random Budget/Goal' },
                      { id: 'creative', label: 'Random Creative Idea' },
                    ] as Array<{ id?: NotificationCategory; label: string }>
                  ).map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => handleSendTest(btn.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Send className="h-3 w-3" />
                      <span>{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

            {/* ── Google Drive Backups ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Google Drive Automated Backups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cloud Database Backups</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                Automatically backup your full PostgreSQL database to your personal Google Drive on your chosen schedule.
                Backups are processed via server-side scheduler and cloud synchronization.
              </p>
            </div>
            
            <div className="flex items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-800 pt-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Automated Backups</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {userSettings?.lastDriveBackupDate ? `Last backup: ${new Date(userSettings.lastDriveBackupDate).toLocaleString()}` : 'No backups yet.'}
                </p>
              </div>
              <button
                type="button"
                disabled={isDriveConnecting}
                onClick={handleToggleAutoBackup}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  userSettings?.automatedDriveBackups ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={Boolean(userSettings?.automatedDriveBackups)}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    userSettings?.automatedDriveBackups ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Configurable Interval when enabled */}
            {userSettings?.automatedDriveBackups && (
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  Backup Interval
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'daily', label: 'Daily', desc: 'Every 24h' },
                    { id: '3days', label: 'Every 3 Days', desc: 'Every 72h' },
                    { id: 'weekly', label: 'Weekly', desc: 'Every 7 days' },
                  ].map((option) => {
                    const isSelected = (userSettings?.driveBackupFrequency || 'weekly') === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleFrequencyChange(option.id as 'daily' | '3days' | 'weekly')}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300 shadow-sm'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className="font-semibold">{option.label}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{option.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                  Server-side scheduler checks pending backups on schedule and syncs securely to your Google Drive.
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="outline"
                disabled={isDriveBackingUp || isDriveConnecting}
                onClick={handleBackupToDrive}
                className="flex items-center gap-2"
              >
                <Cloud className="h-4 w-4 text-blue-600" />
                {isDriveBackingUp ? 'Uploading to Drive...' : isDriveConnecting ? 'Connecting Drive...' : 'Backup to Drive Now'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* ── Data Backup ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Data Backup &amp; SQL Export
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Export Database as SQL</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Download a full TrueSpend PostgreSQL database backup, not just the current user's data.
              The export contains every stored record and table schema (<code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">users</code>,{' '}
              <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">transactions</code>,{' '}
              <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">debts</code>,{' '}
              <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">splits</code>, and <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">category_budgets</code>), custom enum types, categories, and structured INSERT statements. Restore it into a new or empty PostgreSQL database.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                disabled={isExporting}
                onClick={handleExportSql}
                className="flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white border-gray-300 dark:border-gray-700"
              >
                <Download className="h-4 w-4 text-blue-600" />
                {isExporting ? 'Generating SQL Export...' : 'Export Data as SQL (.sql)'}
              </Button>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Restore from SQL Backup</h3>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Choose a <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">.sql</code> file exported by TrueSpend. The backup is validated before a single transaction replaces the current records, so a failed import leaves your data unchanged.
              </p>
              <input ref={importFileRef} type="file" accept=".sql,application/sql,text/plain" onChange={handleImportFile} className="hidden" />
              <input
                ref={validateFileRef}
                type="file"
                accept=".sql,application/sql,text/plain"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  const sql = await f.text();
                  try {
                    const preview = await dashboardService.validateBackupSql(sql, token);
                    setBackupPreview(preview);
                    showNotifToast(
                      preview.valid
                        ? `Backup verified (${preview.totalRows} records across ${preview.tablesWithData.length} tables)!`
                        : 'Backup validation found issues.'
                    );
                  } catch (err: any) {
                    showNotifToast(err?.message || 'Backup validation failed.');
                  }
                }}
                className="hidden"
              />
              <div className="pt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => validateFileRef.current?.click()}
                  className="flex items-center gap-2 border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Validate Backup Preview (Non-Destructive)
                </Button>
                <Button
                  variant="outline"
                  disabled={isImporting}
                  onClick={() => importFileRef.current?.click()}
                  className="flex items-center gap-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? 'Restoring Backup...' : 'Import & Restore SQL Backup'}
                </Button>
              </div>

              {backupPreview && (
                <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className={backupPreview.valid ? 'text-emerald-600' : 'text-rose-600'}>
                      {backupPreview.valid ? '✓ Valid TrueSpend Full-Schema Backup' : '✕ Invalid Backup File'}
                    </span>
                    <span className="font-mono text-[11px] text-gray-500">
                      Schema v{backupPreview.schemaVersion} · Checksum {backupPreview.checksumVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    Total Records: <strong>{backupPreview.totalRows}</strong> across{' '}
                    <strong>{backupPreview.tablesWithData.length}</strong> populated tables.{' '}
                    Referential Integrity:{' '}
                    <strong className={backupPreview.referentialIntegrityOk ? 'text-emerald-600' : 'text-amber-600'}>
                      {backupPreview.referentialIntegrityOk ? 'OK (0 orphans)' : `${backupPreview.orphanRecordsDetected} orphan(s) detected`}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Item K: User-Configurable Constrained Financial Rules Engine ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Automated Financial Rules Engine (Constrained &amp; Auditable)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Define deterministic IF/THEN rules with cooldown protection. Test rules safely via Dry-Run mode before saving. Rules propose Review Inbox drafts, suggest categories, or send alerts—never silently moving money without confirmation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input
                type="text"
                placeholder="Rule name (e.g. Flag Large Spend)"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              <select
                value={ruleTrigger}
                onChange={(e) => setRuleTrigger(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="transaction_posted">On Transaction Posted</option>
                <option value="salary_confirmed">On Salary Confirmed</option>
                <option value="balance_threshold_crossed">On Balance Threshold</option>
                <option value="commitment_approaching">On Commitment Approaching</option>
                <option value="budget_pace_crossed">On Budget Pace Crossed</option>
              </select>
              <select
                value={ruleCondField}
                onChange={(e) => setRuleCondField(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <option value="minAmount">Min Amount (MAD)</option>
                <option value="counterparty">Counterparty / Text Contains</option>
                <option value="category">Category Contains</option>
                <option value="thresholdMad">Wallet Balance ≤ (MAD)</option>
                <option value="pacePercent">Budget Pace ≥ (%)</option>
                <option value="withinDays">Due Within (Days)</option>
              </select>
              <input
                type="text"
                placeholder="Value (e.g. 1000 or Uber)"
                value={ruleCondVal}
                onChange={(e) => setRuleCondVal(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              />
              <div className="flex gap-1.5">
                <select
                  value={ruleActionType}
                  onChange={(e) => setRuleActionType(e.target.value)}
                  className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 flex-1"
                >
                  <option value="send_notification">Send Notification</option>
                  <option value="create_review_draft">Create Review Draft</option>
                  <option value="suggest_category">Suggest Category</option>
                  <option value="prepare_allocation">Prepare Payday Allocation</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!ruleCondVal.trim()) return;
                    const conds: Record<string, unknown> = { cooldownHours: 24 };
                    conds[ruleCondField] = ['minAmount', 'thresholdMad', 'pacePercent', 'withinDays'].includes(ruleCondField)
                      ? Number(ruleCondVal)
                      : ruleCondVal.trim();
                    const res = await dashboardService.dryRunFinancialRule(
                      {
                        name: ruleName.trim() || 'Preview Rule',
                        triggerType: ruleTrigger,
                        conditions: conds,
                        actionType: ruleActionType,
                        actionPayload: ruleActionType === 'prepare_allocation' ? { percent: 20 } : {},
                        sampleEvent: {
                          amount: ['minAmount'].includes(ruleCondField) ? Number(ruleCondVal) : 1200,
                          walletBalanceMad: ['thresholdMad'].includes(ruleCondField) ? Number(ruleCondVal) : 5000,
                          pacePercent: ['pacePercent'].includes(ruleCondField) ? Number(ruleCondVal) : 95,
                          withinDays: ['withinDays'].includes(ruleCondField) ? Number(ruleCondVal) : 2,
                          counterparty: ruleCondField === 'counterparty' ? ruleCondVal.trim() : 'Sample Merchant',
                          category: ruleCondField === 'category' ? ruleCondVal.trim() : 'Dining',
                          description: `Dry run test event (${ruleCondVal.trim()})`,
                        },
                      },
                      token
                    );
                    setRuleDryRunResult(res);
                  }}
                >
                  Dry-Run
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!ruleName.trim() || !ruleCondVal.trim()) return;
                    const conds: Record<string, unknown> = { cooldownHours: 24 };
                    conds[ruleCondField] = ['minAmount', 'thresholdMad', 'pacePercent', 'withinDays'].includes(ruleCondField)
                      ? Number(ruleCondVal)
                      : ruleCondVal.trim();
                    const created = await dashboardService.upsertFinancialRule(
                      {
                        name: ruleName.trim(),
                        triggerType: ruleTrigger,
                        conditions: conds,
                        actionType: ruleActionType,
                        actionPayload: ruleActionType === 'prepare_allocation' ? { percent: 20, target: 'Savings' } : { amount: 500 },
                        approvalPolicy: ruleActionType === 'send_notification' ? 'notify_only' : 'draft_for_approval',
                      },
                      token
                    );
                    setRules((prev) => [created, ...prev]);
                    setRuleName('');
                    setRuleCondVal('');
                    setRuleDryRunResult(null);
                    showNotifToast('Financial rule saved!');
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {ruleDryRunResult && (
              <div className={`rounded-lg border p-2.5 text-xs ${
                ruleDryRunResult.matched
                  ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                  : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>{ruleDryRunResult.matched ? '✓ Dry-Run Matched (No Side Effects)' : '✕ Dry-Run Did Not Match'}</span>
                  <button type="button" onClick={() => setRuleDryRunResult(null)} className="text-[11px] underline">
                    Dismiss
                  </button>
                </div>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{ruleDryRunResult.proposedResultSummary}</p>
                {ruleDryRunResult.matchedConditions.length > 0 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Matched: {ruleDryRunResult.matchedConditions.join(', ')}
                  </p>
                )}
                {ruleDryRunResult.failedConditions.length > 0 && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    Failed: {ruleDryRunResult.failedConditions.join(', ')}
                  </p>
                )}
              </div>
            )}

            {rules.length > 0 && (
              <div className="space-y-2">
                {rules.map((r) => {
                  const parsed = parseFinancialRuleDetails(r);
                  return (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-gray-900 dark:text-white">{r.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              r.enabled
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {r.enabled ? 'Active' : 'Paused'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-mono">
                            {r.triggerType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {parsed.conditionChips.map((chip) => (
                            <span
                              key={chip}
                              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-[10px]"
                            >
                              {chip}
                            </span>
                          ))}
                          <span>→</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{parsed.actionSummary}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await dashboardService.upsertFinancialRule(
                              {
                                id: r.id,
                                name: r.name,
                                enabled: !r.enabled,
                                triggerType: r.triggerType,
                                conditions: parsed.conditions,
                                actionType: r.actionType,
                                actionPayload: parsed.actionPayload,
                                approvalPolicy: r.approvalPolicy,
                              },
                              token
                            );
                            setRules((prev) => prev.map((item) => (item.id === r.id ? updated : item)));
                          }}
                          className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {r.enabled ? 'Pause' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await dashboardService.deleteFinancialRule(r.id, token);
                            setRules((prev) => prev.filter((item) => item.id !== r.id));
                          }}
                          className="text-rose-600 hover:underline text-[11px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {ruleLogs.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700 dark:text-gray-300">Recent Rule Execution Audit Log:</p>
                {ruleLogs.slice(0, 6).map((l) => (
                  <div key={l.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      <strong>{l.outcomeStatus}</strong> · {l.triggerEventSummary} → {l.proposedResultSummary}
                    </span>
                    <span className="font-mono shrink-0">{new Date(l.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Android / Capacitor Mobile Runtime ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              Android / Capacitor Native Runtime &amp; Encrypted Offline Outbox
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {isNativePlatform() ? `Native (${getPlatformName()})` : 'Web / Capacitor Ready'} · Outbox: {outboxCount} Pending (AES-GCM)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200 dark:border-gray-800 text-xs">
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">
                  Encrypted Offline Outbox ({outboxCount} queued)
                </span>
                <p className="text-gray-500">
                  Queued offline drafts are AES-GCM encrypted per user, preserved across logout, retried with exponential backoff, and deduplicated via idempotency keys.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={outboxCount === 0}
                  onClick={async () => {
                    const res = await flushOfflineOutbox(token, { forceRetry: true });
                    await refreshOutboxState();
                    if (res.synced > 0) await onDataChange?.();
                    showNotifToast(`Synced ${res.synced}, Conflicts: ${res.conflicts}, Remaining: ${res.remaining}.`);
                  }}
                >
                  Sync / Retry Outbox
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Clears unlocked in-memory session cache only; encrypted offline outbox items stay safely preserved."
                  onClick={() => {
                    const res = clearOfflineFinancialCachesOnLogout();
                    refreshOutboxState();
                    showNotifToast(`Cleared session cache only; preserved ${res.preservedPendingCount} encrypted offline draft(s).`);
                  }}
                >
                  Clear Session Cache Only
                </Button>
                {outboxCount > 0 && !confirmDiscardOutbox && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 border-rose-200"
                    onClick={() => setConfirmDiscardOutbox(true)}
                  >
                    Discard Pending...
                  </Button>
                )}
                {outboxCount > 0 && confirmDiscardOutbox && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      className="bg-rose-600 hover:bg-rose-700 text-white"
                      onClick={() => {
                        forceDiscardOfflineOutbox(true);
                        setConfirmDiscardOutbox(false);
                        refreshOutboxState();
                        showNotifToast('Explicitly discarded pending offline outbox items.');
                      }}
                    >
                      Confirm Permanent Discard
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDiscardOutbox(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {outboxItems.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs pb-2 border-b border-gray-200 dark:border-gray-800">
                {outboxItems.map((item) => (
                  <div key={item.idempotencyKey} className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                    <div className="truncate">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {String(item.payload?.notes || item.payload?.category || item.payload?.type || 'Offline Transaction')}
                      </span>
                      <span className="text-[11px] text-gray-500 ml-2 font-mono">
                        {Number(item.payload?.amount || 0).toFixed(2)} MAD · Attempts: {item.retryCount}
                      </span>
                      {item.lastError && <p className="text-[10px] text-rose-600 truncate">{item.lastError}</p>}
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      item.status === 'conflict'
                        ? 'bg-rose-100 text-rose-700'
                        : item.status === 'failed'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Install TrueSpend Android App (.apk)
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Download the compiled Capacitor Android package (<code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">TrueSpend.apk</code>, <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">com.truespend.app</code>) directly to your Android phone or emulator.
                </p>
              </div>
              <a
                href="/api/download-apk"
                download="TrueSpend.apk"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors shrink-0"
              >
                <Download className="h-4 w-4" />
                Download TrueSpend.apk
              </a>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Mobile API Server Endpoint (<code className="text-xs">com.truespend.app</code>)
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                When running inside the Capacitor Android app, relative <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">/api/*</code> calls are routed to this backend server URL. Use the deployed Cloud Run URL, <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">http://10.0.2.2:3000</code> for Android Emulator, or your LAN IP when testing locally.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="url"
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                  placeholder="https://true-spend-ggl.vercel.app"
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setCapacitorApiBaseUrl(apiBaseInput);
                    showNotifToast('Mobile API Server URL saved!');
                  }}
                >
                  Save Endpoint
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCapacitorApiBaseUrl('');
                    const def = getCapacitorApiBaseUrl();
                    setApiBaseInput(def);
                    showNotifToast('Reset to default Cloud Run endpoint.');
                  }}
                >
                  Reset Default
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
