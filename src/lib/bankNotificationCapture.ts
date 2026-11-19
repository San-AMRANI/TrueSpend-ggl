import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiClient, getApiAccessToken } from '../services/api/apiClient';

interface BankNotification {
  idempotencyKey: string;
  packageName: string;
  title: string;
  text: string;
  postedAt: number;
}

interface NotificationCapturePlugin {
  isAccessGranted(): Promise<{ granted: boolean }>;
  openAccessSettings(): Promise<void>;
  setEnabledPackages(options: { packages: string[] }): Promise<{ packages: string[] }>;
  getEnabledPackages(): Promise<{ packages: string[] }>;
  getCapturedNotifications(): Promise<{ notifications: BankNotification[] }>;
  removeCapturedNotification(options: { idempotencyKey: string }): Promise<void>;
  addListener(
    eventName: 'notificationCaptured',
    listenerFunc: (notification: BankNotification) => void
  ): Promise<{ remove(): Promise<void> }>;
}

const NotificationCapture = registerPlugin<NotificationCapturePlugin>('NotificationCapture');

let listenerRegistered = false;
let draining = false;

async function processNotification(notification: BankNotification): Promise<boolean> {
  try {
    await apiClient.post(
      '/api/transactions/from-bank-notification',
      notification,
      getApiAccessToken()
    );
    await NotificationCapture.removeCapturedNotification({
      idempotencyKey: notification.idempotencyKey,
    });
    window.dispatchEvent(new CustomEvent('truespend:bank-notification-imported', {
      detail: notification,
    }));
    return true;
  } catch (error: any) {
    if (error?.status === 422) {
      await NotificationCapture.removeCapturedNotification({
        idempotencyKey: notification.idempotencyKey,
      });
    }
    return false;
  }
}

export async function drainCapturedBankNotifications(): Promise<{ processed: number; remaining: number }> {
  if (!Capacitor.isNativePlatform() || draining) return { processed: 0, remaining: 0 };
  draining = true;
  let processed = 0;
  try {
    const result = await NotificationCapture.getCapturedNotifications();
    for (const notification of result.notifications || []) {
      if (await processNotification(notification)) processed++;
    }
    const remaining = await NotificationCapture.getCapturedNotifications();
    return { processed, remaining: remaining.notifications?.length || 0 };
  } finally {
    draining = false;
  }
}

export async function initBankNotificationCapture(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!listenerRegistered) {
    listenerRegistered = true;
    await NotificationCapture.addListener('notificationCaptured', (notification) => {
      processNotification(notification).catch(() => {});
    });
  }
  await drainCapturedBankNotifications();
  window.addEventListener('online', () => {
    drainCapturedBankNotifications().catch(() => {});
  });
}

export const bankNotificationCapture = {
  isAccessGranted: () => NotificationCapture.isAccessGranted(),
  openAccessSettings: () => NotificationCapture.openAccessSettings(),
  setEnabledPackages: (packages: string[]) =>
    NotificationCapture.setEnabledPackages({ packages }),
  getEnabledPackages: () => NotificationCapture.getEnabledPackages(),
};
