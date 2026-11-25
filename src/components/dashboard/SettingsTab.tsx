import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Bell,
  Database,
  Download,
  Upload,
  Send,
  Cloud,
  Clock,
  Check,
  User,
  ShieldCheck,
  LogOut,
  Mail,
  Key,
  Smartphone,
  ArrowRight,
  Landmark,
  Sparkles,
  Layers,
  Trash2,
  Lock,
  FileText,
  RefreshCw,
  AlertTriangle,
  History,
} from 'lucide-react';
import { googleSignIn, getGoogleAccessToken } from '../../lib/googleAuth';
import { uploadToGoogleDrive } from '../../lib/driveUpload';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { ThemeStudioCard } from './ThemeStudioCard';
import { TemplatesGallery } from '../onboarding/TemplatesGallery';
import { LegalModal } from '../legal/LegalModals';
import { CycleAutomationSettingsCard } from './CycleAutomationSettingsCard';
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
import { fetchLatestAndroidRelease, getLatestAndroidApkUrl, type AndroidRelease } from '../../lib/androidRelease';
import { bankNotificationCapture, drainCapturedBankNotifications } from '../../lib/bankNotificationCapture';
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
  Goal,
  InvestmentsData,
  DashboardTab,
  BackupValidationPreview,
  FinancialRuleItem,
  FinancialRuleLogItem,
  AuthSessionInfo,
  AccountSecurityEventInfo,
  ExperienceTier,
} from '../../types';

interface NotificationsApi {
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

interface SettingsTabProps {
  userSettings: any;
  isSaving: boolean;
  isExporting?: boolean;
  isImporting?: boolean;
  handleSaveSettings: (payload: any, notifyUser?: boolean) => Promise<void>;
  handleExportSql?: () => void;
  handleImportSql?: (sql: string) => Promise<{ message: string }>;
  wallets?: Wallet[];
  goals?: Goal[];
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
  goals = [],
  setActiveTab,
  notifications,
  onDataChange,
}) => {
  const importFileRef = useRef<HTMLInputElement>(null);
  const validateFileRef = useRef<HTMLInputElement>(null);
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [latestAndroidRelease, setLatestAndroidRelease] = useState<AndroidRelease | null>(null);
  const [apiBaseInput, setApiBaseInput] = useState<string>(() => getCapacitorApiBaseUrl());
  const [bankNotificationAccess, setBankNotificationAccess] = useState(false);
  const [bankNotificationPackages, setBankNotificationPackages] = useState('');
  const [bankNotificationStatus, setBankNotificationStatus] = useState<string | null>(null);
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
  const { user, token, signOut, refreshUserProfile, switchExperienceTier } = useAuth();
  const isAdvanced = user?.experienceTier === 'advanced';
  const canManageUsers =
    user?.role === 'owner' || user?.role === 'admin' || Boolean(user?.permissions?.canManageUsers);

  // Editable Profile & Regional Preferences
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [baseCurrency, setBaseCurrency] = useState(user?.baseCurrency || 'MAD');
  const [countryCode, setCountryCode] = useState(user?.countryCode || 'MA');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Casablanca');
  const [locale, setLocale] = useState(user?.locale || 'en');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Experience Tier Switching
  const [switchingTier, setSwitchingTier] = useState(false);
  const [tierFeedback, setTierFeedback] = useState<string | null>(null);
  const [preservedSummary, setPreservedSummary] = useState<{
    investmentsCount: number;
    contextsCount: number;
    rulesCount: number;
    statementBatchesCount: number;
  } | null>(null);

  // Security & Sessions
  const [sessions, setSessions] = useState<AuthSessionInfo[]>([]);
  const [securityEvents, setSecurityEvents] = useState<AccountSecurityEventInfo[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(false);
  const [currentPwForChange, setCurrentPwForChange] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [pwFeedback, setPwFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [currentPwForEmail, setCurrentPwForEmail] = useState('');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pendingEmailChangeToken, setPendingEmailChangeToken] = useState<string | null>(null);
  const [pendingEmailPreviewUrl, setPendingEmailPreviewUrl] = useState<string | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Privacy, Legal & Deletion
  const [exportingPersonalJson, setExportingPersonalJson] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'privacy' | 'terms' | null>(null);
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Inline SQL Restore Confirmation (replaces window.confirm / window.alert)
  const [pendingRestoreSql, setPendingRestoreSql] = useState<string | null>(null);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setBaseCurrency(user?.baseCurrency || 'MAD');
    setCountryCode(user?.countryCode || 'MA');
    setTimezone(user?.timezone || 'Africa/Casablanca');
    setLocale(user?.locale || 'en');
  }, [user]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    bankNotificationCapture.isAccessGranted()
      .then((result) => setBankNotificationAccess(result.granted))
      .catch(() => setBankNotificationAccess(false));
    bankNotificationCapture.getEnabledPackages()
      .then((result) => setBankNotificationPackages((result.packages || []).join(', ')))
      .catch(() => setBankNotificationPackages(''));
  }, []);

  const loadSecurityData = React.useCallback(async () => {
    if (!token) return;
    setLoadingSecurity(true);
    try {
      const [sessRes, eventsRes] = await Promise.all([
        dashboardService.getSessions(token),
        dashboardService.getSecurityEvents(token),
      ]);
      setSessions(sessRes.sessions || []);
      setSecurityEvents(eventsRes.events || []);
    } catch {
      // Ignore if session expired during logout
    } finally {
      setLoadingSecurity(false);
    }
  }, [token]);

  const refreshOutboxState = React.useCallback(async () => {
    try {
      const decrypted = await loadDecryptedOfflineOutbox();
      setOutboxItems(decrypted);
    } catch {
      setOutboxItems(getOfflineOutbox());
    }
  }, []);

  React.useEffect(() => {
    if (token && isAdvanced) {
      dashboardService
        .getFinancialRules(token)
        .then((res) => {
          setRules(res.rules || []);
          setRuleLogs(res.logs || []);
        })
        .catch(() => {});
    }
    if (token) {
      loadSecurityData();
    }
    refreshOutboxState();
    const onOutboxUpdate = () => {
      refreshOutboxState();
    };
    window.addEventListener('truespend:outbox-updated', onOutboxUpdate);
    return () => window.removeEventListener('truespend:outbox-updated', onOutboxUpdate);
  }, [token, isAdvanced, loadSecurityData, refreshOutboxState]);

  const outboxCount = outboxItems.length;

  useEffect(() => {
    let active = true;
    fetchLatestAndroidRelease().then(release => {
      if (active) setLatestAndroidRelease(release);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveProfilePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      await dashboardService.updateProfile(
        {
          displayName: displayName.trim() || undefined,
          baseCurrency: baseCurrency.trim().toUpperCase() || 'MAD',
          countryCode: countryCode.trim().toUpperCase() || 'MA',
          timezone: timezone.trim() || 'Africa/Casablanca',
          locale: locale.trim() || 'en',
        },
        token
      );
      await refreshUserProfile();
      await onDataChange?.();
      setProfileNotice('Profile & preferences saved.');
      showNotifToast('Profile & preferences updated.');
    } catch (err: any) {
      setProfileNotice(err?.message || 'Could not save profile changes.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSwitchTier = async (nextTier: ExperienceTier) => {
    if (nextTier === (user?.experienceTier || 'basic') || switchingTier) return;
    setSwitchingTier(true);
    setTierFeedback(null);
    try {
      const result = await switchExperienceTier(nextTier);
      setPreservedSummary(result?.preservedDataSummary || null);
      setTierFeedback(
        result?.message ||
          `Switched to ${nextTier === 'advanced' ? 'Advanced (Free)' : 'Basic (Free)'} mode.`
      );
      showNotifToast(
        nextTier === 'advanced'
          ? 'Switched to Advanced · Free mode.'
          : 'Switched to Basic · Free mode (all data preserved).'
      );
    } catch (err: any) {
      setTierFeedback(err?.message || 'Could not update experience tier.');
    } finally {
      setSwitchingTier(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setChangingPw(true);
    setPwFeedback(null);
    try {
      const res = await dashboardService.changePassword(
        currentPwForChange,
        newPasswordInput,
        token
      );
      setPwFeedback({ type: 'ok', text: res.message || 'Password updated cleanly.' });
      setCurrentPwForChange('');
      setNewPasswordInput('');
      await loadSecurityData();
    } catch (err: any) {
      setPwFeedback({ type: 'err', text: err?.message || 'Failed to update password.' });
    } finally {
      setChangingPw(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setChangingEmail(true);
    setEmailFeedback(null);
    setPendingEmailChangeToken(null);
    setPendingEmailPreviewUrl(null);
    try {
      const res = await dashboardService.changeEmail(currentPwForEmail, newEmailInput.trim(), token);
      if (res.devVerificationToken) {
        setPendingEmailChangeToken(res.devVerificationToken);
      }
      if (res.emailPreviewUrl) {
        setPendingEmailPreviewUrl(res.emailPreviewUrl);
      }
      const warningNote = res.emailDeliveryWarning ? ` ${res.emailDeliveryWarning}` : '';
      setEmailFeedback({
        type: 'ok',
        text: `${res.message}${warningNote}`,
      });
      setCurrentPwForEmail('');
      setNewEmailInput('');
      await refreshUserProfile();
      await loadSecurityData();
    } catch (err: any) {
      setEmailFeedback({ type: 'err', text: err?.message || 'Could not start email update.' });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleConfirmPendingEmailChange = async () => {
    if (!pendingEmailChangeToken) return;
    setChangingEmail(true);
    try {
      await dashboardService.verifyEmailToken(pendingEmailChangeToken);
      setPendingEmailChangeToken(null);
      setPendingEmailPreviewUrl(null);
      setEmailFeedback({
        type: 'ok',
        text: 'Your new account email address has been verified and activated!',
      });
      await refreshUserProfile();
      await loadSecurityData();
    } catch (err: any) {
      setEmailFeedback({
        type: 'err',
        text: err?.message || 'Could not confirm email change.',
      });
    } finally {
      setChangingEmail(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!token) return;
    setRevokingSessionId(sessionId);
    try {
      await dashboardService.revokeSession(sessionId, token);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      showNotifToast('Session revoked.');
      await loadSecurityData();
    } catch (err: any) {
      showNotifToast(err?.message || 'Could not revoke session.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!token) return;
    setLoggingOutAll(true);
    try {
      await dashboardService.logoutAllSessions(token);
      showNotifToast('Signed out from all devices.');
      await signOut();
    } catch (err: any) {
      showNotifToast(err?.message || 'Could not revoke all devices.');
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleExportPersonalJson = async () => {
    if (!token) return;
    setExportingPersonalJson(true);
    try {
      const payload = await dashboardService.exportPersonalData(token);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `truespend_personal_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotifToast('Personal JSON export downloaded.');
    } catch (err: any) {
      showNotifToast(err?.message || 'Failed to export personal data.');
    } finally {
      setExportingPersonalJson(false);
    }
  };

  const handleDeleteOwnAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setDeleteError(null);
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Type DELETE in all caps to confirm permanent deletion.');
      return;
    }
    setDeletingAccount(true);
    try {
      await dashboardService.deleteOwnAccount(deletePassword, deleteConfirmText.trim(), token);
      await signOut();
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not verify credentials or delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!token) return;
    setDisconnectingDrive(true);
    try {
      await dashboardService.disconnectGoogleDrive(token);
      await onDataChange?.();
      showNotifToast('Google Drive disconnected cleanly.');
    } catch (err: any) {
      showNotifToast(err?.message || 'Failed to disconnect Google Drive.');
    } finally {
      setDisconnectingDrive(false);
    }
  };

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
            await onDataChange?.();
            showNotifToast('Google Drive connected and automated backups enabled!');
          }
        } catch (e) {
          console.error(e);
          showNotifToast('Failed to connect Google Drive.');
        } finally {
          setIsDriveConnecting(false);
        }
      } else {
        await handleSaveSettings({
          automatedDriveBackups: true,
          driveBackupFrequency: userSettings?.driveBackupFrequency || 'weekly',
          googleDriveToken: accessToken,
        }, false);
        await onDataChange?.();
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
        showNotifToast('Failed to backup to Google Drive: ' + (e?.message || 'Unknown error'));
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
        showNotifToast('Google Sign-In was cancelled or failed.');
      } finally {
        setIsDriveConnecting(false);
      }
    } else {
      await performBackup(accessToken);
    }
  };
  
  const showNotifToast = (msg: string) => {
    setNotifToast(msg);
    setTimeout(() => setNotifToast(null), 3500);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !handleImportSql) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotifToast('This backup is larger than the 10 MB import limit.');
      return;
    }

    const sql = await file.text();
    if (!sql.slice(0, 500).includes('-- TrueSpend Complete PostgreSQL Database Backup')) {
      showNotifToast('Please select a SQL backup exported by TrueSpend.');
      return;
    }

    setPendingRestoreSql(sql);
  };

  const handleConfirmSqlRestore = async () => {
    if (!pendingRestoreSql || !handleImportSql) return;
    const sql = pendingRestoreSql;
    setPendingRestoreSql(null);
    try {
      const result = await handleImportSql(sql);
      showNotifToast(result.message || 'SQL backup restored cleanly.');
    } catch (error: any) {
      console.error('SQL import failed:', error);
      showNotifToast(error?.message || 'Could not import the SQL backup. Existing data was not changed.');
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

      {/* ── Profile, Account & Regional Preferences ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Profile &amp; Account Preferences
          </CardTitle>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              user?.emailVerified === false
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            }`}
          >
            {user?.emailVerified === false ? 'Email Verification Pending' : 'Verified Account'}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-lg shadow-sm">
                {(user?.displayName?.[0] || user?.username?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {user?.displayName || user?.username || user?.uid || user?.email?.split('@')[0] || 'Member'}
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
                {user?.pendingEmail && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                    Pending verification for new email: <strong>{user.pendingEmail}</strong>
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
                    {user?.role === 'owner'
                      ? 'Owner'
                      : user?.role === 'admin'
                      ? 'Administrator'
                      : 'Private Account Holder'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Key className="h-3 w-3 text-emerald-500" />
                    Strictly Isolated Private Ledger
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

          {/* Editable Profile & Defaults Form */}
          <form onSubmit={handleSaveProfilePreferences} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Base Currency</label>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="MAD">MAD — Moroccan Dirham</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="CAD">CAD — Canadian Dollar</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Country / Locale</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={8}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="MA"
                  className="w-16 px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                />
                <input
                  type="text"
                  maxLength={10}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  placeholder="en"
                  className="flex-1 px-2.5 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">Timezone</label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Africa/Casablanca"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={savingProfile || isSaving} className="w-full text-xs h-9">
                {savingProfile ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </form>
          {profileNotice && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">{profileNotice}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Monthly & Yearly Payday Automation ── */}
      <CycleAutomationSettingsCard
        wallets={wallets}
        goals={goals}
        onNavigateTab={setActiveTab}
      />

      {/* ── Experience Tier Selector (Basic vs Advanced · Both Free) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Experience Tier — Basic &amp; Advanced (100% Free)
            </CardTitle>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Active: {isAdvanced ? 'Advanced · Free' : 'Basic · Free'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            Both modes are completely free. Switching between Basic and Advanced changes tool complexity without deleting any of your transactions, wallets, investments, contexts, or rules.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div
              className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
                !isAdvanced
                  ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    Basic · Free
                  </span>
                  {!isAdvanced && (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Everyday tracking: Overview, Transactions, simple Wallets, Budgets, Calendar, Debts, Goals, Subscriptions, Core Reports &amp; Conversational Spex AI.
                </p>
              </div>
              <Button
                type="button"
                variant={!isAdvanced ? 'outline' : 'default'}
                size="sm"
                disabled={!isAdvanced || switchingTier}
                onClick={() => handleSwitchTier('basic')}
                className="text-xs"
              >
                {!isAdvanced ? 'Currently in Basic · Free' : switchingTier ? 'Switching...' : 'Switch to Basic · Free'}
              </Button>
            </div>

            <div
              className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${
                isAdvanced
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                  : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-white">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    Advanced · Free
                  </span>
                  {isAdvanced && (
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Full suite: AI Forecast, Calculators Hub, Equities &amp; Binance sync, Statement CSV Import, Review Inbox, Contexts, Rules Engine, Spex AI Actions &amp; Drive/SQL Backups.
                </p>
              </div>
              <Button
                type="button"
                variant={isAdvanced ? 'outline' : 'default'}
                size="sm"
                disabled={isAdvanced || switchingTier}
                onClick={() => handleSwitchTier('advanced')}
                className="text-xs"
              >
                {isAdvanced ? 'Currently in Advanced · Free' : switchingTier ? 'Switching...' : 'Unlock Advanced · Free'}
              </Button>
            </div>
          </div>

          {tierFeedback && (
            <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 px-3 py-2 text-xs text-indigo-800 dark:text-indigo-200">
              <p>{tierFeedback}</p>
              {preservedSummary && (
                <p className="mt-1 text-[11px] opacity-85">
                  Preserved safely: {preservedSummary.investmentsCount} equities/positions,{' '}
                  {preservedSummary.contextsCount} contexts, {preservedSummary.rulesCount} rules,{' '}
                  {preservedSummary.statementBatchesCount} statement batches.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Guided Setup & Starter Templates ── */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Guided Setup &amp; Starter Templates
            </CardTitle>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Relaunch the welcome setup wizard anytime or preview &amp; apply optional budget/goal starter templates.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.dispatchEvent(new CustomEvent('truespend:openOnboarding'))}
            className="text-xs shrink-0 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Relaunch Setup Wizard
          </Button>
        </CardHeader>
        <CardContent>
          <TemplatesGallery compact onApplied={() => onDataChange?.()} />
        </CardContent>
      </Card>

      {/* ── Theme & Frontend Style Studio (12 Themes + Architectural Controls) ── */}
      <ThemeStudioCard />

      {/* ── Quick Links to Dedicated Screens ── */}
      <div className={`grid grid-cols-1 ${canManageUsers ? 'md:grid-cols-2' : ''} gap-4`}>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {isAdvanced ? 'Accounts & Accounting Workbench' : 'Wallets & Balances'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isAdvanced
                    ? `Manage ${wallets.length} wallet${wallets.length === 1 ? '' : 's'}, statement CSV import, review inbox, double-entry journal & FX rates.`
                    : `Manage ${wallets.length} bank, cash, and savings wallet${wallets.length === 1 ? '' : 's'}.`}
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

        {canManageUsers && (
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
                    Manage registered accounts, invitation codes, account status &amp; role assignments.
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
        )}
      </div>

      {/* ── Security, Active Sessions & Credentials ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Security, Active Sessions &amp; Credentials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Change Password */}
            <form
              onSubmit={handleChangePassword}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4 space-y-3"
            >
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use at least 12 characters with mixed character types. Changing your password revokes other sessions.
              </p>
              <input
                type="password"
                required
                value={currentPwForChange}
                onChange={(e) => setCurrentPwForChange(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <input
                type="password"
                required
                minLength={12}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="New password (12+ characters)"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {pwFeedback && (
                <p className={`text-xs ${pwFeedback.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pwFeedback.text}
                </p>
              )}
              <Button type="submit" size="sm" disabled={changingPw} className="text-xs">
                {changingPw ? 'Updating Password...' : 'Update Password'}
              </Button>
            </form>

            {/* Change Email */}
            <form
              onSubmit={handleChangeEmail}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 p-4 space-y-3"
            >
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Change Account Email</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                We send a verification link to your new email before updating your login address.
              </p>
              <input
                type="password"
                required
                value={currentPwForEmail}
                onChange={(e) => setCurrentPwForEmail(e.target.value)}
                placeholder="Confirm current password"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <input
                type="email"
                required
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                placeholder="New email address"
                className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {emailFeedback && (
                <p className={`text-xs break-words ${emailFeedback.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {emailFeedback.text}
                </p>
              )}
              {pendingEmailChangeToken && (
                <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 text-xs space-y-2">
                  <p className="font-mono text-[11px] break-all text-emerald-900 dark:text-emerald-200">
                    Verification token ready: <strong>{pendingEmailChangeToken}</strong>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={changingEmail}
                      onClick={handleConfirmPendingEmailChange}
                      className="text-xs"
                    >
                      {changingEmail ? 'Confirming...' : 'Confirm New Email Now'}
                    </Button>
                    {pendingEmailPreviewUrl && (
                      <a
                        href={pendingEmailPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Open Webmail Preview ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
              <Button type="submit" size="sm" variant="outline" disabled={changingEmail} className="text-xs">
                {changingEmail ? 'Sending Verification...' : 'Send Email Change Link'}
              </Button>
            </form>
          </div>

          {/* Active Sessions */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Active Devices &amp; Sessions ({sessions.length})
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Revoke any unfamiliar browser or mobile refresh session immediately.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loggingOutAll}
                onClick={handleLogoutAllDevices}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
              >
                {loggingOutAll ? 'Signing Out...' : 'Log Out All Devices'}
              </Button>
            </div>

            {loadingSecurity && sessions.length === 0 ? (
              <p className="text-xs text-gray-500">Loading active sessions...</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-gray-500">No tracked refresh sessions found.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/60 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {sess.deviceLabel || 'Web Browser'}
                        </span>
                        {sess.isCurrent && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                            Current Session
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        IP: {sess.ipAddress || 'Unknown'} · Last active{' '}
                        {new Date(sess.lastUsedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revokingSessionId === sess.id}
                      onClick={() => handleRevokeSession(sess.id)}
                      className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      {revokingSessionId === sess.id ? 'Revoking...' : 'Revoke'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Security Events */}
          {securityEvents.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Recent Account Security Activity
              </h4>
              <div className="space-y-1.5 max-h-44 overflow-y-auto text-xs">
                {securityEvents.slice(0, 10).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
                  >
                    <span className="text-gray-800 dark:text-gray-200">
                      <strong className="font-mono text-[11px]">{ev.eventType}</strong> ·{' '}
                      <span className={ev.outcome === 'failure' ? 'text-rose-600' : 'text-emerald-600'}>
                        {ev.outcome}
                      </span>{' '}
                      <span className="text-gray-500">({ev.deviceSummary || ev.ipAddress || 'Web'})</span>
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Two-factor authenticator app protection (TOTP) is planned on our security roadmap; session revocation, password rotation, and email verification are active today.
          </p>
        </CardContent>
      </Card>

      {/* ── Privacy, Data Portability & Account Deletion ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FileText className="h-5 w-5 text-emerald-600" />
            Privacy &amp; Data Rights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportingPersonalJson}
              onClick={handleExportPersonalJson}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600" />
              {exportingPersonalJson ? 'Preparing JSON...' : 'Download Personal Data (JSON)'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLegalModalTab('privacy')}
              className="text-xs"
            >
              Privacy Policy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLegalModalTab('terms')}
              className="text-xs"
            >
              Terms of Service
            </Button>
          </div>

          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="h-4 w-4" />
                  Delete Account Permanently
                </h4>
                <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                  Removes your profile, wallets, transactions, budgets, goals, debts, and active sessions.
                </p>
              </div>
              {!deleteFlowOpen && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteFlowOpen(true)}
                  className="text-xs text-rose-600 border-rose-300 hover:bg-rose-100 dark:border-rose-800"
                >
                  Delete Account...
                </Button>
              )}
            </div>

            {deleteFlowOpen && (
              <form onSubmit={handleDeleteOwnAccount} className="space-y-2.5 pt-2 border-t border-rose-200 dark:border-rose-900/50">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter current password"
                    className="px-3 py-2 text-xs rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900"
                  />
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Type DELETE to confirm'
                    className="px-3 py-2 text-xs rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 font-mono"
                  />
                </div>
                {deleteError && <p className="text-xs text-rose-600 font-medium">{deleteError}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={deletingAccount}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
                  >
                    {deletingAccount ? 'Deleting Account...' : 'Permanently Delete Account'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDeleteFlowOpen(false);
                      setDeleteError(null);
                      setDeletePassword('');
                      setDeleteConfirmText('');
                    }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </CardContent>
      </Card>

      <LegalModal
        isOpen={legalModalTab !== null}
        initialTab={legalModalTab || 'privacy'}
        onClose={() => setLegalModalTab(null)}
      />

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

      {!isAdvanced ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Advanced Automation, Drive Backups &amp; SQL Portability
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
            <p>
              Automated Google Drive backups, PostgreSQL SQL backup/restore/validation, and the Automated Financial Rules Engine are included free in <strong>Advanced · Free</strong> mode.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={switchingTier}
              onClick={() => handleSwitchTier('advanced')}
              className="shrink-0 text-xs"
            >
              Switch to Advanced · Free
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Google Drive Backups ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-500" />
                  Google Drive Automated Backups
                </span>
                {userSettings?.googleDriveConnected && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Connected
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cloud Backups</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    Automatically backup your account ledger to your personal Google Drive on your chosen schedule. Tokens are encrypted at rest and never exposed in browser responses.
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
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    disabled={isDriveBackingUp || isDriveConnecting}
                    onClick={handleBackupToDrive}
                    className="flex items-center gap-2"
                  >
                    <Cloud className="h-4 w-4 text-blue-600" />
                    {isDriveBackingUp ? 'Uploading to Drive...' : isDriveConnecting ? 'Connecting Drive...' : 'Backup to Drive Now'}
                  </Button>
                  {userSettings?.googleDriveConnected && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disconnectingDrive}
                      onClick={handleDisconnectDrive}
                      className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      {disconnectingDrive ? 'Disconnecting...' : 'Disconnect Google Drive'}
                    </Button>
                  )}
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Export Scoped SQL Backup</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Download a structured SQL backup scoped strictly to your private account (<code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">transactions</code>,{' '}
                  <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">debts</code>,{' '}
                  <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">splits</code>, and <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">category_budgets</code>).
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
                    Choose a <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200">.sql</code> file exported by TrueSpend. Only your own account records are affected.
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

                  {pendingRestoreSql && (
                    <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-2">
                      <p className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        Restore this SQL backup? Current records for your account will be replaced.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isImporting}
                          onClick={handleConfirmSqlRestore}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                        >
                          Confirm Restore
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingRestoreSql(null)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {backupPreview && (
                    <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between font-bold">
                        <span className={backupPreview.valid ? 'text-emerald-600' : 'text-rose-600'}>
                          {backupPreview.valid ? '✓ Valid TrueSpend Scoped Backup' : '✕ Invalid Backup File'}
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
        </>
      )}

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
                  Download the latest GitHub release of the Capacitor Android package (<code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">TrueSpend.apk</code>, <code className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded">com.truespend.app</code>) directly to your Android phone or emulator.
                </p>
                {latestAndroidRelease && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-2">
                    Latest release: {latestAndroidRelease.name} ({latestAndroidRelease.tagName})
                  </p>
                )}
              </div>
              <a
                href={latestAndroidRelease?.apkUrl || getLatestAndroidApkUrl()}
                download="TrueSpend.apk"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors shrink-0"
              >
                <Download className="h-4 w-4" />
                Install latest APK
              </a>
            </div>

            {isNativePlatform() && (
              <div className="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Bank Notification Transaction Capture
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Grant notification access, then select only the exact Android package names of your bank apps.
                      TrueSpend parses matched notifications and creates a deduplicated transaction using Gemini with a local fallback.
                      Notification text is sent only to the authenticated TrueSpend server.
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    bankNotificationAccess
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  }`}>
                    {bankNotificationAccess ? 'Access granted' : 'Access required'}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={bankNotificationPackages}
                    onChange={(e) => setBankNotificationPackages(e.target.value)}
                    placeholder="e.g. com.example.bank, ma.example.bank"
                    className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <Button
                    size="sm"
                    onClick={async () => {
                      const packages = bankNotificationPackages
                        .split(',')
                        .map((value) => value.trim())
                        .filter(Boolean);
                      await bankNotificationCapture.setEnabledPackages(packages);
                      setBankNotificationStatus(`Saved ${packages.length} allowed app package(s).`);
                    }}
                  >
                    Save Apps
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await bankNotificationCapture.openAccessSettings();
                      setBankNotificationStatus('Choose TrueSpend in Android Notification Access settings.');
                    }}
                  >
                    Open Android Access
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const result = await drainCapturedBankNotifications();
                      setBankNotificationStatus(`Processed ${result.processed}; ${result.remaining} notification(s) remain queued.`);
                    }}
                  >
                    Sync Captures
                  </Button>
                </div>
                {bankNotificationStatus && (
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400">{bankNotificationStatus}</p>
                )}
              </div>
            )}

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
