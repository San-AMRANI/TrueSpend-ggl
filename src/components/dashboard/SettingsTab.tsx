import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Database,
  Lock,
  Palette,
  Repeat,
  Search,
  User,
  X,
} from 'lucide-react';
import { googleSignIn, getGoogleAccessToken } from '../../lib/googleAuth';
import { uploadToGoogleDrive } from '../../lib/driveUpload';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { ThemeStudioCard } from './ThemeStudioCard';
import { LegalModal } from '../legal/LegalModals';
import {
  getOfflineOutbox,
  loadDecryptedOfflineOutbox,
  type OfflineOutboxItem,
} from '../../lib/offlineOutbox';
import { fetchLatestAndroidRelease, type AndroidRelease } from '../../lib/androidRelease';
import {
  SETTINGS_SECTIONS,
  filterSettingsSections,
  getSettingsSectionById,
  type SettingsSectionId,
} from '../../lib/settingsNav';
import { SettingsGeneralSection } from './settings/SettingsGeneralSection';
import { SettingsAutomationSection } from './settings/SettingsAutomationSection';
import {
  SettingsNotificationsSection,
  type NotificationsApi,
} from './settings/SettingsNotificationsSection';
import { SettingsSecuritySection } from './settings/SettingsSecuritySection';
import { SettingsDataMobileSection } from './settings/SettingsDataMobileSection';
import type { NotificationCategory } from '../../hooks/useNotifications';
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
  handleCreateWallet?: (payload: {
    name: string;
    type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
    isMain?: boolean;
    initialBalance?: number;
  }) => Promise<any>;
  handleUpdateWallet?: (
    id: string,
    payload: {
      name?: string;
      type?: 'Bank' | 'Cash' | 'Savings' | 'Investment';
      isMain?: boolean;
      initialBalance?: number;
    }
  ) => Promise<any>;
  handleDeleteWallet?: (id: string, reassignToWalletId?: string) => Promise<any>;
  notifications: NotificationsApi;
  onDataChange?: () => Promise<void> | void;
}

const SECTION_ICONS: Record<SettingsSectionId, React.ComponentType<{ className?: string }>> = {
  general: User,
  appearance: Palette,
  automation: Repeat,
  notifications: Bell,
  security: Lock,
  data_mobile: Database,
};

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
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general');
  const [searchQuery, setSearchQuery] = useState('');

  const importFileRef = useRef<HTMLInputElement>(null);
  const validateFileRef = useRef<HTMLInputElement>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const [latestAndroidRelease, setLatestAndroidRelease] = useState<AndroidRelease | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupValidationPreview | null>(null);
  const [pendingRestoreSql, setPendingRestoreSql] = useState<string | null>(null);

  const [rules, setRules] = useState<FinancialRuleItem[]>([]);
  const [ruleLogs, setRuleLogs] = useState<FinancialRuleLogItem[]>([]);
  const [outboxItems, setOutboxItems] = useState<OfflineOutboxItem[]>(() => getOfflineOutbox());

  const { user, token, signOut, refreshUserProfile, switchExperienceTier } = useAuth();
  const isAdvanced = user?.experienceTier === 'advanced';
  const canManageUsers =
    user?.role === 'owner' || user?.role === 'admin' || Boolean(user?.permissions?.canManageUsers);

  // Profile & Regional Preferences
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [baseCurrency, setBaseCurrency] = useState(user?.baseCurrency || 'MAD');
  const [countryCode, setCountryCode] = useState(user?.countryCode || 'MA');
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Casablanca');
  const [locale, setLocale] = useState(user?.locale || 'en');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Experience Tier
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
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setBaseCurrency(user?.baseCurrency || 'MAD');
    setCountryCode(user?.countryCode || 'MA');
    setTimezone(user?.timezone || 'Africa/Casablanca');
    setLocale(user?.locale || 'en');
  }, [user]);

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

  useEffect(() => {
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
    const onOutboxUpdate = () => refreshOutboxState();
    window.addEventListener('truespend:outbox-updated', onOutboxUpdate);
    return () => window.removeEventListener('truespend:outbox-updated', onOutboxUpdate);
  }, [token, isAdvanced, loadSecurityData, refreshOutboxState]);

  useEffect(() => {
    let active = true;
    fetchLatestAndroidRelease().then((release) => {
      if (active) setLatestAndroidRelease(release);
    });
    return () => {
      active = false;
    };
  }, []);

  const searchMatches = useMemo(() => filterSettingsSections(searchQuery), [searchQuery]);
  const isSearching = searchQuery.trim().length > 0;
  const activeSectionMeta = useMemo(() => getSettingsSectionById(activeSection), [activeSection]);

  const workspaceSections = useMemo(
    () => SETTINGS_SECTIONS.filter((s) => s.group === 'Workspace'),
    []
  );
  const accountSections = useMemo(
    () => SETTINGS_SECTIONS.filter((s) => s.group === 'Account & System'),
    []
  );

  // ── Handlers ──
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
      showToast('Profile & preferences updated.');
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
      showToast(
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
      const res = await dashboardService.changeEmail(
        currentPwForEmail,
        newEmailInput.trim(),
        token
      );
      if (res.devVerificationToken) setPendingEmailChangeToken(res.devVerificationToken);
      if (res.emailPreviewUrl) setPendingEmailPreviewUrl(res.emailPreviewUrl);
      const warningNote = res.emailDeliveryWarning ? ` ${res.emailDeliveryWarning}` : '';
      setEmailFeedback({ type: 'ok', text: `${res.message}${warningNote}` });
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
        text: 'Your new account email address has been verified and activated.',
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
      showToast('Session revoked.');
      await loadSecurityData();
    } catch (err: any) {
      showToast(err?.message || 'Could not revoke session.');
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!token) return;
    setLoggingOutAll(true);
    try {
      await dashboardService.logoutAllSessions(token);
      showToast('Signed out from all devices.');
      await signOut();
    } catch (err: any) {
      showToast(err?.message || 'Could not revoke all devices.');
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
      showToast('Personal JSON export downloaded.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to export personal data.');
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
      showToast('Google Drive disconnected.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to disconnect Google Drive.');
    } finally {
      setDisconnectingDrive(false);
    }
  };

  const handleToggleAutoBackup = async () => {
    if (userSettings?.automatedDriveBackups) {
      await handleSaveSettings({ automatedDriveBackups: false }, false);
      showToast('Automated backups disabled.');
      return;
    }
    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      setIsDriveConnecting(true);
      try {
        const res = await googleSignIn();
        if (res && res.accessToken) {
          await handleSaveSettings(
            {
              automatedDriveBackups: true,
              driveBackupFrequency: userSettings?.driveBackupFrequency || 'weekly',
              googleDriveToken: res.accessToken,
            },
            false
          );
          await onDataChange?.();
          showToast('Google Drive connected and automated backups enabled.');
        }
      } catch (e) {
        console.error(e);
        showToast('Failed to connect Google Drive.');
      } finally {
        setIsDriveConnecting(false);
      }
    } else {
      await handleSaveSettings(
        {
          automatedDriveBackups: true,
          driveBackupFrequency: userSettings?.driveBackupFrequency || 'weekly',
          googleDriveToken: accessToken,
        },
        false
      );
      await onDataChange?.();
      showToast('Automated backups enabled.');
    }
  };

  const handleFrequencyChange = async (freq: 'daily' | '3days' | 'weekly') => {
    await handleSaveSettings({ driveBackupFrequency: freq }, false);
    showToast(
      `Backup schedule updated to ${
        freq === 'daily' ? 'Daily' : freq === '3days' ? 'Every 3 Days' : 'Weekly'
      }.`
    );
  };

  const handleBackupToDrive = async () => {
    const performBackup = async (accessToken: string) => {
      try {
        setIsDriveBackingUp(true);
        try {
          const res = await dashboardService.backupToDrive(accessToken, token);
          if (res && res.success) {
            await handleSaveSettings({ lastDriveBackupDate: res.lastDriveBackupDate }, false);
            showToast('Backup saved to Google Drive.');
            return;
          }
        } catch (serverErr) {
          console.warn('Server backup error, falling back to direct upload:', serverErr);
        }

        const blob = await dashboardService.getSqlBlob(token);
        const filename = `truespend_backup_${new Date().toISOString().slice(0, 10)}.sql`;
        await uploadToGoogleDrive(accessToken, blob, filename);
        await handleSaveSettings({ lastDriveBackupDate: new Date().toISOString() }, false);
        showToast('Backup saved to Google Drive.');
      } catch (e: any) {
        console.error(e);
        showToast('Failed to backup to Google Drive: ' + (e?.message || 'Unknown error'));
      } finally {
        setIsDriveBackingUp(false);
      }
    };

    const accessToken = getGoogleAccessToken();
    if (!accessToken) {
      setIsDriveConnecting(true);
      try {
        const res = await googleSignIn();
        if (res && res.accessToken) await performBackup(res.accessToken);
      } catch (e) {
        console.error(e);
        showToast('Google Sign-In was cancelled or failed.');
      } finally {
        setIsDriveConnecting(false);
      }
    } else {
      await performBackup(accessToken);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !handleImportSql) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('This backup exceeds the 10 MB import limit.');
      return;
    }

    const sql = await file.text();
    if (!sql.slice(0, 500).includes('-- TrueSpend Complete PostgreSQL Database Backup')) {
      showToast('Please select a SQL backup exported by TrueSpend.');
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
      showToast(result.message || 'SQL backup restored.');
    } catch (error: any) {
      console.error('SQL import failed:', error);
      showToast(error?.message || 'Could not restore SQL backup. Existing data was not changed.');
    }
  };

  const handleToggleNotifications = async () => {
    if (!notifications.supported) {
      showToast('Your browser does not support notifications.');
      return;
    }
    const isCurrentlyEnabled =
      notifications.serverSettings?.enabled ?? notifications.settings.enabled;

    if (!isCurrentlyEnabled) {
      if (notifications.permission !== 'granted') {
        const granted = await notifications.requestPermission();
        if (!granted) {
          showToast('Permission denied. Allow notifications in browser settings.');
          return;
        }
      }
      notifications.updateSettings({ enabled: true });
      notifications.updateServerPreferences({ enabled: true });
      showToast('Notifications enabled.');
    } else {
      notifications.updateSettings({ enabled: false });
      notifications.updateServerPreferences({ enabled: false });
      showToast('Notifications disabled.');
    }
  };

  const handleSendTest = async (preferredCategory?: NotificationCategory) => {
    if (notifications.permission !== 'granted') {
      const granted = await notifications.requestPermission();
      if (!granted) {
        showToast('Please allow browser notifications first.');
        return;
      }
    }
    await notifications.sendNow(undefined, preferredCategory);
    const label = preferredCategory
      ? preferredCategory.charAt(0).toUpperCase() + preferredCategory.slice(1)
      : 'Smart';
    showToast(`${label} test notification sent.`);
  };

  const jumpToSection = (id: SettingsSectionId) => {
    setActiveSection(id);
    setSearchQuery('');
  };

  const renderNavButton = (sec: (typeof SETTINGS_SECTIONS)[number]) => {
    const Icon = SECTION_ICONS[sec.id];
    const isActive = activeSection === sec.id && !isSearching;
    return (
      <button
        key={sec.id}
        type="button"
        onClick={() => jumpToSection(sec.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${
            isActive
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        />
        <span className="truncate">{sec.label}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* ── Toast ── */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 text-xs font-medium shadow-lg"
        >
          {toastMsg}
        </div>
      )}

      {/* ── Top Settings Header + Instant Search ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your profile, automation, appearance, alerts, security, and backups.
          </p>
        </div>

        <div className="relative w-full sm:w-80 shrink-0">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings (payday, theme, backup…)"
            aria-label="Search settings"
            className="w-full h-9 pl-9 pr-8 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear settings search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile Section Tabs (hidden on lg+) ── */}
      <nav
        aria-label="Settings sections"
        className="lg:hidden flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800/80 overflow-x-auto"
      >
        {SETTINGS_SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id && !isSearching;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => jumpToSection(sec.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {sec.shortLabel}
            </button>
          );
        })}
      </nav>

      {/* ── Main 2-Column Settings Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
        {/* Left Sticky Settings Rail (Desktop) */}
        <aside className="hidden lg:block sticky top-6">
          <nav aria-label="Settings navigation" className="space-y-5">
            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500">
                Workspace
              </p>
              {workspaceSections.map(renderNavButton)}
            </div>

            <div className="space-y-1 pt-3 border-t border-gray-200/80 dark:border-gray-800">
              <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500">
                Account &amp; System
              </p>
              {accountSections.map(renderNavButton)}
            </div>
          </nav>
        </aside>

        {/* Right Focused Content Panel */}
        <main className="min-w-0 space-y-5">
          {isSearching ? (
            <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              <div className="p-4 sm:px-6 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                  {searchMatches.length} matching section{searchMatches.length === 1 ? '' : 's'} for{' '}
                  <strong className="text-gray-900 dark:text-white">&ldquo;{searchQuery}&rdquo;</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Clear
                </button>
              </div>
              {searchMatches.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                  No settings matched &ldquo;{searchQuery}&rdquo;. Try keywords like{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    payday, theme, quiet hours, password, google drive, or sql
                  </span>
                  .
                </div>
              ) : (
                searchMatches.map(({ section, matchedTerms }) => {
                  const Icon = SECTION_ICONS[section.id];
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className="w-full p-4 sm:px-6 flex items-center justify-between gap-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {section.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {section.description}
                          </p>
                          {matchedTerms.length > 0 && (
                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1">
                              Matches: {matchedTerms.join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0 whitespace-nowrap">
                        Open →
                      </span>
                    </button>
                  );
                })
              )}
            </section>
          ) : (
            <>
              {/* Clean Active Section Title */}
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {activeSectionMeta.label}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {activeSectionMeta.description}
                </p>
              </div>

              {activeSection === 'general' && (
                <SettingsGeneralSection
                  user={user}
                  isAdvanced={isAdvanced}
                  canManageUsers={canManageUsers}
                  wallets={wallets}
                  displayName={displayName}
                  setDisplayName={setDisplayName}
                  baseCurrency={baseCurrency}
                  setBaseCurrency={setBaseCurrency}
                  countryCode={countryCode}
                  setCountryCode={setCountryCode}
                  timezone={timezone}
                  setTimezone={setTimezone}
                  locale={locale}
                  setLocale={setLocale}
                  savingProfile={savingProfile}
                  isSaving={isSaving}
                  profileNotice={profileNotice}
                  onSaveProfile={handleSaveProfilePreferences}
                  switchingTier={switchingTier}
                  tierFeedback={tierFeedback}
                  preservedSummary={preservedSummary}
                  onSwitchTier={handleSwitchTier}
                  onSignOut={signOut}
                  setActiveTab={setActiveTab}
                  onDataChange={onDataChange}
                />
              )}

              {activeSection === 'appearance' && <ThemeStudioCard />}

              {activeSection === 'automation' && (
                <SettingsAutomationSection
                  isAdvanced={isAdvanced}
                  switchingTier={switchingTier}
                  onSwitchTier={handleSwitchTier}
                  token={token}
                  wallets={wallets}
                  goals={goals}
                  setActiveTab={setActiveTab}
                  rules={rules}
                  setRules={setRules}
                  ruleLogs={ruleLogs}
                  showToast={showToast}
                />
              )}

              {activeSection === 'notifications' && (
                <SettingsNotificationsSection
                  notifications={notifications}
                  onToggleNotifications={handleToggleNotifications}
                  onSendTest={handleSendTest}
                />
              )}

              {activeSection === 'security' && (
                <SettingsSecuritySection
                  sessions={sessions}
                  securityEvents={securityEvents}
                  loadingSecurity={loadingSecurity}
                  currentPwForChange={currentPwForChange}
                  setCurrentPwForChange={setCurrentPwForChange}
                  newPasswordInput={newPasswordInput}
                  setNewPasswordInput={setNewPasswordInput}
                  pwFeedback={pwFeedback}
                  changingPw={changingPw}
                  onChangePassword={handleChangePassword}
                  currentPwForEmail={currentPwForEmail}
                  setCurrentPwForEmail={setCurrentPwForEmail}
                  newEmailInput={newEmailInput}
                  setNewEmailInput={setNewEmailInput}
                  emailFeedback={emailFeedback}
                  pendingEmailChangeToken={pendingEmailChangeToken}
                  pendingEmailPreviewUrl={pendingEmailPreviewUrl}
                  changingEmail={changingEmail}
                  onChangeEmail={handleChangeEmail}
                  onConfirmPendingEmailChange={handleConfirmPendingEmailChange}
                  revokingSessionId={revokingSessionId}
                  loggingOutAll={loggingOutAll}
                  onRevokeSession={handleRevokeSession}
                  onLogoutAllDevices={handleLogoutAllDevices}
                  exportingPersonalJson={exportingPersonalJson}
                  onExportPersonalJson={handleExportPersonalJson}
                  onOpenLegalModal={setLegalModalTab}
                  deleteFlowOpen={deleteFlowOpen}
                  setDeleteFlowOpen={setDeleteFlowOpen}
                  deletePassword={deletePassword}
                  setDeletePassword={setDeletePassword}
                  deleteConfirmText={deleteConfirmText}
                  setDeleteConfirmText={setDeleteConfirmText}
                  deleteError={deleteError}
                  setDeleteError={setDeleteError}
                  deletingAccount={deletingAccount}
                  onDeleteOwnAccount={handleDeleteOwnAccount}
                />
              )}

              {activeSection === 'data_mobile' && (
                <SettingsDataMobileSection
                  isAdvanced={isAdvanced}
                  switchingTier={switchingTier}
                  onSwitchTier={handleSwitchTier}
                  token={token}
                  userSettings={userSettings}
                  isDriveConnecting={isDriveConnecting}
                  isDriveBackingUp={isDriveBackingUp}
                  disconnectingDrive={disconnectingDrive}
                  onToggleAutoBackup={handleToggleAutoBackup}
                  onFrequencyChange={handleFrequencyChange}
                  onBackupToDrive={handleBackupToDrive}
                  onDisconnectDrive={handleDisconnectDrive}
                  isExporting={isExporting}
                  isImporting={isImporting}
                  onExportSql={handleExportSql}
                  importFileRef={importFileRef}
                  validateFileRef={validateFileRef}
                  onImportFile={handleImportFile}
                  pendingRestoreSql={pendingRestoreSql}
                  setPendingRestoreSql={setPendingRestoreSql}
                  onConfirmSqlRestore={handleConfirmSqlRestore}
                  backupPreview={backupPreview}
                  setBackupPreview={setBackupPreview}
                  outboxItems={outboxItems}
                  onRefreshOutbox={refreshOutboxState}
                  latestAndroidRelease={latestAndroidRelease}
                  onDataChange={onDataChange}
                  showToast={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      <LegalModal
        isOpen={legalModalTab !== null}
        initialTab={legalModalTab || 'privacy'}
        onClose={() => setLegalModalTab(null)}
      />
    </div>
  );
};
