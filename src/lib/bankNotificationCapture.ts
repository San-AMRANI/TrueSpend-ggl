import { Capacitor, registerPlugin } from '@capacitor/core';

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
  lastErrorCode?: string;
  serverTransactionId?: string;
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
  setEnabledPackages(options: { packages: string[] }): Promise<{ packages: string[] }>;
  getEnabledPackages(): Promise<{ packages: string[] }>;
  getCapturedNotifications(): Promise<{ notifications: CapturedNotificationEvent[] }>;
  removeCapturedNotification(options: { idempotencyKey: string }): Promise<void>;
}

const NotificationCapture = registerPlugin<NotificationCapturePlugin>('NotificationCapture');

export async function initBankNotificationCapture(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
}

export async function syncNativeAuthSession(options: {
  ownerUserId?: string;
  accessToken?: string;
  refreshToken?: string;
  apiBaseUrl?: string;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await NotificationCapture.setNativeSession(options);
  if (options.ownerUserId) {
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
