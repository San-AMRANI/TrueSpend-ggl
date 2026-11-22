import { Capacitor, registerPlugin } from '@capacitor/core';
import { setApiAccessToken, setStoredNativeRefreshToken } from '../services/api/apiClient';

export interface NotificationRule {
  id: string;
  enabled: boolean;
  packageName: string;
  appLabel: string;
  keywords: string[];
  keywordMode: 'ANY' | 'ALL';
  matchFields: ('TITLE' | 'TEXT')[];
  caseSensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstalledNotificationApp {
  packageName: string;
  appName: string;
  icon?: string;
}

export interface CapturedNotificationEvent {
  eventId: string;
  ownerUserId: string;
  ruleIds: string[];
  packageName: string;
  appLabel: string;
  title: string;
  text: string;
  receivedAt: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'RETRYABLE_FAILED' | 'PERMANENT_FAILED';
  attemptCount: number;
  lastErrorCode?: string | null;
  serverTransactionId?: string | null;
}

interface NotificationCapturePlugin {
  isSupported(): Promise<{ supported: boolean }>;
  isAccessGranted(): Promise<{ granted: boolean; listenerConnected: boolean }>;
  getPermissionStatus(): Promise<{ granted: boolean; listenerConnected: boolean }>;
  openNotificationAccessSettings(): Promise<void>;
  openAccessSettings(): Promise<void>;
  getInstalledApps(): Promise<{ apps?: InstalledNotificationApp[] } | InstalledNotificationApp[]>;
  getRules(): Promise<{ rules: NotificationRule[] }>;
  saveRule(options: NotificationRule): Promise<{ rule: NotificationRule }>;
  deleteRule(options: { ruleId: string }): Promise<void>;
  setRuleEnabled(options: { ruleId: string; enabled: boolean }): Promise<void>;
  setAutomationEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  getAutomationStatus(): Promise<{ enabled: boolean }>;
  setNativeSession(options: {
    ownerUserId?: string;
    accessToken?: string;
    refreshToken?: string;
    apiBaseUrl?: string;
  }): Promise<void>;
  getQueueSummary(): Promise<{
    pending: number;
    processing: number;
    succeeded: number;
    retryableFailed: number;
    permanentFailed: number;
  }>;
  getEventHistory(options?: { limit?: number; offset?: number }): Promise<{ events: CapturedNotificationEvent[] }>;
  retryPendingEvents(): Promise<void>;
  clearCompletedHistory(): Promise<void>;
  addListener(
    eventName: 'notificationCaptured',
    listenerFunc: (notification: CapturedNotificationEvent) => void
  ): Promise<{ remove(): Promise<void> }>;
  addListener(
    eventName: 'nativeSessionRefreshed',
    listenerFunc: (session: { accessToken?: string; refreshToken?: string }) => void
  ): Promise<{ remove(): Promise<void> }>;
  setEnabledPackages(options: { packages: string[] }): Promise<{ packages: string[] }>;
  getEnabledPackages(): Promise<{ packages: string[] }>;
  getCapturedNotifications(): Promise<{ notifications: CapturedNotificationEvent[] }>;
  removeCapturedNotification(options: { idempotencyKey: string }): Promise<void>;
}

const NotificationCapture = registerPlugin<NotificationCapturePlugin>('NotificationCapture');

let listenersInitialized = false;

export async function initBankNotificationCapture(): Promise<void> {
  if (!Capacitor.isNativePlatform() || listenersInitialized) return;
  listenersInitialized = true;
  try {
    await NotificationCapture.addListener('nativeSessionRefreshed', (session) => {
      if (session?.accessToken) {
        setApiAccessToken(session.accessToken);
      }
      if (session?.refreshToken) {
        setStoredNativeRefreshToken(session.refreshToken);
      }
      if (session?.accessToken) {
        window.dispatchEvent(
          new CustomEvent('auth:refreshed', {
            detail: { token: session.accessToken, fromNative: true },
          })
        );
      }
    });
    await NotificationCapture.addListener('notificationCaptured', (notification) => {
      window.dispatchEvent(
        new CustomEvent('truespend:notification-captured', {
          detail: notification,
        })
      );
    });
  } catch {
    listenersInitialized = false;
  }
}

export async function syncNativeAuthSession(options: {
  ownerUserId?: string;
  accessToken?: string;
  refreshToken?: string | null;
  apiBaseUrl?: string;
  enableAutomation?: boolean;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await NotificationCapture.setNativeSession({
    ownerUserId: options.ownerUserId,
    accessToken: options.accessToken,
    refreshToken: options.refreshToken || undefined,
    apiBaseUrl: options.apiBaseUrl,
  });
  if (options.ownerUserId && options.enableAutomation) {
    await NotificationCapture.setAutomationEnabled({ enabled: true }).catch(() => {});
  }
}

export const bankNotificationCapture = {
  isSupported: () => NotificationCapture.isSupported(),
  isAccessGranted: () => NotificationCapture.isAccessGranted(),
  getPermissionStatus: () => NotificationCapture.getPermissionStatus(),
  openNotificationAccessSettings: () => NotificationCapture.openNotificationAccessSettings(),
  openAccessSettings: () => NotificationCapture.openAccessSettings(),
  getInstalledApps: async () => {
    const result = await NotificationCapture.getInstalledApps();
    return Array.isArray(result) ? result : (result.apps || []);
  },
  getRules: async () => {
    const result = await NotificationCapture.getRules();
    return result.rules || [];
  },
  saveRule: (rule: NotificationRule) => NotificationCapture.saveRule(rule),
  deleteRule: (ruleId: string) => NotificationCapture.deleteRule({ ruleId }),
  setRuleEnabled: (ruleId: string, enabled: boolean) =>
    NotificationCapture.setRuleEnabled({ ruleId, enabled }),
  setAutomationEnabled: (enabled: boolean) =>
    NotificationCapture.setAutomationEnabled({ enabled }),
  getAutomationStatus: () => NotificationCapture.getAutomationStatus(),
  getQueueSummary: () => NotificationCapture.getQueueSummary(),
  getEventHistory: (limit = 50, offset = 0) =>
    NotificationCapture.getEventHistory({ limit, offset }).then((result) => result.events || []),
  retryPendingEvents: () => NotificationCapture.retryPendingEvents(),
  clearCompletedHistory: () => NotificationCapture.clearCompletedHistory(),
  setEnabledPackages: (packages: string[]) =>
    NotificationCapture.setEnabledPackages({ packages }),
  getEnabledPackages: () => NotificationCapture.getEnabledPackages(),
};
