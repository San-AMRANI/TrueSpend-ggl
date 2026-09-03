import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Bell, BellOff, Database, Download, Moon, Sun, Monitor, Upload, Send, Cloud, Clock, Check } from 'lucide-react';
import { googleSignIn, getGoogleAccessToken } from '../../lib/googleAuth';
import { uploadToGoogleDrive } from '../../lib/driveUpload';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { NotifSettings, ServerNotifSettings } from '../../hooks/useNotifications';

interface NotificationsApi {
  supported: boolean;
  permission: NotificationPermission;
  settings: NotifSettings;
  serverSettings: ServerNotifSettings | null;
  updateSettings: (patch: Partial<NotifSettings>) => void;
  updateServerPreferences: (patch: Partial<ServerNotifSettings>) => void;
  requestPermission: () => Promise<boolean>;
  sendNow: (data: any) => void;
}

interface SettingsTabProps {
  userSettings: any;
  emergencyBuffer: number;
  setEmergencyBuffer: (val: number) => void;
  isSaving: boolean;
  isExporting?: boolean;
  isImporting?: boolean;
  handleSaveSettings: (payload: any, notifyUser?: boolean) => Promise<void>;
  handleExportSql?: () => void;
  handleImportSql?: (sql: string) => Promise<{ message: string }>;
  notifications: NotificationsApi;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  userSettings,
  emergencyBuffer,
  setEmergencyBuffer,
  isSaving,
  isExporting = false,
  isImporting = false,
  handleSaveSettings,
  handleExportSql,
  handleImportSql,
  notifications,
}) => {
  const { theme, setTheme } = useTheme();
  const importFileRef = useRef<HTMLInputElement>(null);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const { token } = useAuth();

  
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

    if (!notifications.serverSettings?.enabled) {
      // Turning ON
      if (notifications.permission !== 'granted') {
        const granted = await notifications.requestPermission();
        if (!granted) {
          showNotifToast('Permission denied. Please allow notifications in your browser settings.');
          return;
        }
      }
      notifications.updateServerPreferences({ enabled: true });
      showNotifToast('✅ Notifications enabled!');
    } else {
      // Turning OFF
      notifications.updateServerPreferences({ enabled: false });
      showNotifToast('🔕 Notifications disabled.');
    }
  };

  const handleSendTest = () => {
    if (notifications.permission !== 'granted') {
      showNotifToast('Please enable notifications first.');
      return;
    }
    // Fire a test notification using empty data (will hit the tips fallback)
    notifications.sendNow({
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
    });
    showNotifToast('📬 Test notification sent! Check your notifications.');
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

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Appearance */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Appearance</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose between light and dark mode, or sync with your system.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Sun className="h-4 w-4" />
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Moon className="h-4 w-4" />
                  Dark
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme === 'system'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  System
                </button>
              </div>
            </div>

            {/* Emergency buffer */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Emergency Liquidity Buffer</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Keep a safety cushion. This amount will be excluded from your daily allowance calculation.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={emergencyBuffer}
                  onChange={(e) => setEmergencyBuffer(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Buffer amount"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={isSaving} onClick={() => handleSaveSettings({ emergencyBuffer })}>
                {isSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Notifications ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-500" />
            Daily Financial Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Receive one personalised financial insight per day — budget alerts, payday countdowns, savings milestones, and smart spending tips — delivered as a browser notification at the time you choose.
            </p>

            {/* Browser support warning */}
            {!notifications.supported && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-700 dark:text-amber-300">
                ⚠️ Your browser does not support Web Notifications. Try Chrome, Edge, or Firefox.
              </div>
            )}

            {/* Permission status */}
            {notifications.supported && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Browser permission</p>
                  <p className="text-sm font-medium">{permissionLabel[notifications.permission]}</p>
                </div>
                {notifications.permission === 'denied' && (
                  <p className="text-xs text-red-500">Click the lock icon in your browser address bar to allow notifications.</p>
                )}
              </div>
            )}

            {/* Enable/disable toggle */}
            {notifications.supported && notifications.permission !== 'denied' && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable daily notifications</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Max 1 per day. Never annoying.</p>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    notifications.serverSettings?.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={notifications.serverSettings?.enabled || false}
                  id="notif-toggle"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      notifications.serverSettings?.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Time picker */}
            {notifications.serverSettings?.enabled && notifications.permission === 'granted' && (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex-1">
                  <label htmlFor="notif-time" className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-1">
                    Delivery time
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">When should we send your daily insight?</p>
                </div>
                <input
                  id="notif-time"
                  type="time"
                  value={notifications.serverSettings?.deliveryTime || '09:00'}
                  onChange={e => notifications.updateServerPreferences({ deliveryTime: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Test button */}
            {notifications.serverSettings?.enabled && notifications.permission === 'granted' && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleSendTest}
                  className="flex items-center gap-2 text-indigo-600 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                >
                  <Send className="h-4 w-4" />
                  Send test notification now
                </Button>
                <p className="text-xs text-gray-400">Tap this to preview what a notification looks like.</p>
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
              <div className="pt-3">
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
