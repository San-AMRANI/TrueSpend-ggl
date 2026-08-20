import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Bell, BellOff, Database, Download, Moon, Sun, Monitor, Upload, Send } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import type { NotifSettings } from '../../hooks/useNotifications';

interface NotificationsApi {
  supported: boolean;
  permission: NotificationPermission;
  settings: NotifSettings;
  updateSettings: (patch: Partial<NotifSettings>) => void;
  requestPermission: () => Promise<boolean>;
  sendNow: (data: any) => void;
}

interface SettingsTabProps {
  emergencyBuffer: number;
  setEmergencyBuffer: (val: number) => void;
  payday: number;
  setPayday: (val: number) => void;
  salary: number;
  setSalary: (val: number) => void;
  isSaving: boolean;
  isExporting?: boolean;
  isImporting?: boolean;
  handleSaveSettings: (payday: number, buffer: number, salary: number) => void;
  handleExportSql?: () => void;
  handleImportSql?: (sql: string) => Promise<{ message: string }>;
  notifications: NotificationsApi;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  emergencyBuffer,
  setEmergencyBuffer,
  payday,
  setPayday,
  salary,
  setSalary,
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

    if (!notifications.settings.enabled) {
      // Turning ON
      if (notifications.permission !== 'granted') {
        const granted = await notifications.requestPermission();
        if (!granted) {
          showNotifToast('Permission denied. Please allow notifications in your browser settings.');
          return;
        }
      }
      notifications.updateSettings({ enabled: true });
      showNotifToast('✅ Notifications enabled! You\'ll get one smart insight per day.');
    } else {
      // Turning OFF
      notifications.updateSettings({ enabled: false });
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

            {/* Payroll */}
            <div className="rounded-lg border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950 p-4">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Payroll Settings</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                Set your payroll date and expected salary to automatically deposit your salary into your bank account on payday.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Payday (Date)</label>
                  <Select value={payday.toString()} onChange={(e) => setPayday(parseInt(e.target.value))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Monthly Salary Amount</label>
                  <input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-800 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                    placeholder="Salary amount"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button disabled={isSaving} onClick={() => handleSaveSettings(payday, emergencyBuffer, salary)}>
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
                    notifications.settings.enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={notifications.settings.enabled}
                  id="notif-toggle"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      notifications.settings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Time picker */}
            {notifications.settings.enabled && notifications.permission === 'granted' && (
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
                  value={notifications.settings.time}
                  onChange={e => notifications.updateSettings({ time: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Test button */}
            {notifications.settings.enabled && notifications.permission === 'granted' && (
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
