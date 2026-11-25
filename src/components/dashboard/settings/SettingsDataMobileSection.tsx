import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cloud,
  Database,
  Download,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import {
  getCapacitorApiBaseUrl,
  setCapacitorApiBaseUrl,
  isNativePlatform,
  getPlatformName,
} from '../../../lib/capacitorBridge';
import {
  flushOfflineOutbox,
  clearOfflineFinancialCachesOnLogout,
  forceDiscardOfflineOutbox,
  type OfflineOutboxItem,
} from '../../../lib/offlineOutbox';
import { getLatestAndroidApkUrl, type AndroidRelease } from '../../../lib/androidRelease';
import { dashboardService } from '../../../services/api/dashboardService';
import type { BackupValidationPreview, ExperienceTier } from '../../../types';

export interface SettingsDataMobileSectionProps {
  isAdvanced: boolean;
  switchingTier: boolean;
  onSwitchTier: (tier: ExperienceTier) => void;
  token: string | null;
  userSettings: any;
  isDriveConnecting: boolean;
  isDriveBackingUp: boolean;
  disconnectingDrive: boolean;
  onToggleAutoBackup: () => void;
  onFrequencyChange: (freq: 'daily' | '3days' | 'weekly') => void;
  onBackupToDrive: () => void;
  onDisconnectDrive: () => void;
  isExporting: boolean;
  isImporting: boolean;
  onExportSql?: () => void;
  importFileRef: React.RefObject<HTMLInputElement | null>;
  validateFileRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingRestoreSql: string | null;
  setPendingRestoreSql: (v: string | null) => void;
  onConfirmSqlRestore: () => void;
  backupPreview: BackupValidationPreview | null;
  setBackupPreview: (v: BackupValidationPreview | null) => void;
  outboxItems: OfflineOutboxItem[];
  onRefreshOutbox: () => Promise<void>;
  latestAndroidRelease: AndroidRelease | null;
  onDataChange?: () => Promise<void> | void;
  showToast: (msg: string) => void;
}

export const SettingsDataMobileSection: React.FC<SettingsDataMobileSectionProps> = ({
  isAdvanced,
  switchingTier,
  onSwitchTier,
  token,
  userSettings,
  isDriveConnecting,
  isDriveBackingUp,
  disconnectingDrive,
  onToggleAutoBackup,
  onFrequencyChange,
  onBackupToDrive,
  onDisconnectDrive,
  isExporting,
  isImporting,
  onExportSql,
  importFileRef,
  validateFileRef,
  onImportFile,
  pendingRestoreSql,
  setPendingRestoreSql,
  onConfirmSqlRestore,
  backupPreview,
  setBackupPreview,
  outboxItems,
  onRefreshOutbox,
  latestAndroidRelease,
  onDataChange,
  showToast,
}) => {
  const [apiBaseInput, setApiBaseInput] = useState<string>(() => getCapacitorApiBaseUrl());
  const [confirmDiscardOutbox, setConfirmDiscardOutbox] = useState(false);
  const [advancedMobileOpen, setAdvancedMobileOpen] = useState(outboxItems.length > 0);
  const outboxCount = outboxItems.length;

  return (
    <div className="space-y-6">
      {/* 1. Cloud & SQL Backups */}
      {!isAdvanced ? (
        <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Google Drive &amp; SQL Backups
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automated Drive backups and scoped PostgreSQL export/restore are included free in Advanced mode.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={switchingTier}
            onClick={() => onSwitchTier('advanced')}
            className="shrink-0 whitespace-nowrap text-xs"
          >
            Enable Advanced · Free
          </Button>
        </section>
      ) : (
        <>
          {/* Google Drive Automated Backups */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            <div className="p-5 sm:p-6 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Google Drive Backups
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Automatically back up your private ledger to Google Drive on a recurring schedule.
                </p>
              </div>
              <span
                className={`text-xs font-medium ${
                  userSettings?.googleDriveConnected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {userSettings?.googleDriveConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>

            <div className="p-5 sm:p-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Automated Schedule
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                  {userSettings?.lastDriveBackupDate
                    ? `Last backup: ${new Date(userSettings.lastDriveBackupDate).toLocaleString()}`
                    : 'No cloud backups recorded yet'}
                </p>
              </div>
              <button
                type="button"
                disabled={isDriveConnecting}
                onClick={onToggleAutoBackup}
                role="switch"
                aria-label="Toggle automated Google Drive backups"
                aria-checked={Boolean(userSettings?.automatedDriveBackups)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer ${
                  userSettings?.automatedDriveBackups
                    ? 'bg-indigo-600'
                    : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    userSettings?.automatedDriveBackups ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {userSettings?.automatedDriveBackups && (
              <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Backup Frequency
                </span>
                <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                  {(
                    [
                      { id: 'daily', label: 'Daily' },
                      { id: '3days', label: 'Every 3 Days' },
                      { id: 'weekly', label: 'Weekly' },
                    ] as const
                  ).map((opt) => {
                    const active = (userSettings?.driveBackupFrequency || 'weekly') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onFrequencyChange(opt.id)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-5 sm:p-6 flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDriveBackingUp || isDriveConnecting}
                onClick={onBackupToDrive}
                className="text-xs whitespace-nowrap gap-1.5"
              >
                <Cloud className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                {isDriveBackingUp
                  ? 'Uploading...'
                  : isDriveConnecting
                  ? 'Connecting...'
                  : 'Backup Now'}
              </Button>
              {userSettings?.googleDriveConnected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disconnectingDrive}
                  onClick={onDisconnectDrive}
                  className="text-xs whitespace-nowrap text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
                >
                  {disconnectingDrive ? 'Disconnecting...' : 'Disconnect Drive'}
                </Button>
              )}
            </div>
          </section>

          {/* Local SQL Backup & Restore */}
          <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Local SQL Export &amp; Restore
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Export a private PostgreSQL snapshot or validate and restore an existing `.sql` backup.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={onExportSql}
                className="text-xs whitespace-nowrap gap-1.5 shrink-0 self-start sm:self-auto"
              >
                <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                {isExporting ? 'Exporting...' : 'Export .sql'}
              </Button>
            </div>

            <div className="p-5 sm:p-6 space-y-3">
              <input
                ref={importFileRef}
                type="file"
                accept=".sql,application/sql,text/plain"
                onChange={onImportFile}
                className="hidden"
              />
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
                    showToast(
                      preview.valid
                        ? `Backup verified (${preview.totalRows} records across ${preview.tablesWithData.length} tables).`
                        : 'Backup validation found issues.'
                    );
                  } catch (err: any) {
                    showToast(err?.message || 'Backup validation failed.');
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => validateFileRef.current?.click()}
                  className="text-xs whitespace-nowrap gap-1.5"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  Validate Backup File
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isImporting}
                  onClick={() => importFileRef.current?.click()}
                  className="text-xs whitespace-nowrap gap-1.5 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {isImporting ? 'Restoring...' : 'Import & Restore SQL'}
                </Button>
              </div>

              {pendingRestoreSql && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-xs space-y-2.5">
                  <p className="font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Restore this SQL backup? Existing records in your account will be replaced.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isImporting}
                      onClick={onConfirmSqlRestore}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs whitespace-nowrap"
                    >
                      Confirm Restore
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingRestoreSql(null)}
                      className="text-xs whitespace-nowrap"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {backupPreview && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                    <span
                      className={
                        backupPreview.valid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {backupPreview.valid
                        ? 'Valid TrueSpend Scoped Backup'
                        : 'Invalid Backup File'}
                    </span>
                    <span className="font-mono text-[11px] text-gray-500 tabular-nums">
                      Schema v{backupPreview.schemaVersion} · Checksum{' '}
                      {backupPreview.checksumVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 tabular-nums">
                    {backupPreview.totalRows} records across {backupPreview.tablesWithData.length}{' '}
                    tables · Integrity:{' '}
                    <span
                      className={
                        backupPreview.referentialIntegrityOk
                          ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-amber-600 dark:text-amber-400 font-medium'
                      }
                    >
                      {backupPreview.referentialIntegrityOk
                        ? 'OK (0 orphans)'
                        : `${backupPreview.orphanRecordsDetected} orphan(s)`}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* 2. Android Mobile App & Offline Sync */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              TrueSpend Android App (.apk)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Install the latest Android build directly on your phone.
              {latestAndroidRelease
                ? ` Latest release: ${latestAndroidRelease.name} (${latestAndroidRelease.tagName}).`
                : ''}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              Runtime: {isNativePlatform() ? `Native (${getPlatformName()})` : 'Web Browser'} ·
              Offline queue: {outboxCount} pending
            </p>
          </div>
          <a
            href={latestAndroidRelease?.apkUrl || getLatestAndroidApkUrl()}
            download="TrueSpend.apk"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shrink-0 whitespace-nowrap self-start sm:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            Download APK
          </a>
        </div>

        {/* Collapsible Offline Outbox & Custom API Server Endpoint */}
        <div className="p-5 sm:p-6">
          <button
            type="button"
            onClick={() => setAdvancedMobileOpen((prev) => !prev)}
            aria-expanded={advancedMobileOpen}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {advancedMobileOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Offline Sync Queue ({outboxCount}) &amp; Mobile API Endpoint
          </button>

          {advancedMobileOpen && (
            <div className="mt-4 space-y-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              {/* Offline Outbox Controls */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                      Encrypted Offline Queue ({outboxCount} pending)
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Offline drafts are encrypted locally and synced automatically when online.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={outboxCount === 0}
                      onClick={async () => {
                        const res = await flushOfflineOutbox(token, { forceRetry: true });
                        await onRefreshOutbox();
                        if (res.synced > 0) await onDataChange?.();
                        showToast(
                          `Synced ${res.synced}, Conflicts: ${res.conflicts}, Remaining: ${res.remaining}.`
                        );
                      }}
                      className="text-xs whitespace-nowrap"
                    >
                      Sync Queue
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const res = clearOfflineFinancialCachesOnLogout();
                        onRefreshOutbox();
                        showToast(
                          `Cleared session cache; preserved ${res.preservedPendingCount} encrypted draft(s).`
                        );
                      }}
                      className="text-xs whitespace-nowrap"
                    >
                      Clear Session Cache
                    </Button>
                    {outboxCount > 0 && !confirmDiscardOutbox && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDiscardOutbox(true)}
                        className="text-xs whitespace-nowrap text-rose-600 border-rose-200 dark:border-rose-900/50"
                      >
                        Discard Pending...
                      </Button>
                    )}
                    {outboxCount > 0 && confirmDiscardOutbox && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-rose-600 hover:bg-rose-700 text-white text-xs whitespace-nowrap"
                          onClick={() => {
                            forceDiscardOfflineOutbox(true);
                            setConfirmDiscardOutbox(false);
                            onRefreshOutbox();
                            showToast('Pending offline drafts discarded.');
                          }}
                        >
                          Confirm Discard
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDiscardOutbox(false)}
                          className="text-xs whitespace-nowrap"
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {outboxItems.length > 0 && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800 max-h-40 overflow-y-auto text-xs">
                    {outboxItems.map((item) => (
                      <div
                        key={item.idempotencyKey}
                        className="py-2 flex items-center justify-between gap-3"
                      >
                        <div className="truncate">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {String(
                              item.payload?.notes ||
                                item.payload?.category ||
                                item.payload?.type ||
                                'Offline Transaction'
                            )}
                          </span>
                          <span className="text-[11px] text-gray-500 ml-2 font-mono tabular-nums">
                            {Number(item.payload?.amount || 0).toFixed(2)} MAD · Attempts:{' '}
                            {item.retryCount}
                          </span>
                          {item.lastError && (
                            <p className="text-[11px] text-rose-600 truncate">{item.lastError}</p>
                          )}
                        </div>
                        <span
                          className={`text-[11px] font-medium capitalize shrink-0 ${
                            item.status === 'conflict'
                              ? 'text-rose-600'
                              : item.status === 'failed'
                              ? 'text-amber-600'
                              : 'text-indigo-600'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile API Server Endpoint */}
              <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                <label
                  htmlFor="mobile-api-endpoint"
                  className="block text-xs font-semibold text-gray-900 dark:text-white"
                >
                  Mobile API Server Endpoint
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Backend URL used when running inside the Android Capacitor app.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    id="mobile-api-endpoint"
                    type="url"
                    value={apiBaseInput}
                    onChange={(e) => setApiBaseInput(e.target.value)}
                    placeholder="https://true-spend-ggl.vercel.app"
                    className="flex-1 h-9 px-3 text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setCapacitorApiBaseUrl(apiBaseInput);
                      showToast('Mobile API Server URL saved.');
                    }}
                    className="text-xs whitespace-nowrap h-9"
                  >
                    Save Endpoint
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCapacitorApiBaseUrl('');
                      setApiBaseInput(getCapacitorApiBaseUrl());
                      showToast('Reset to default server endpoint.');
                    }}
                    className="text-xs whitespace-nowrap h-9"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
