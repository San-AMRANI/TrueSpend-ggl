import webpush from 'web-push';
import { db } from '../../src/db/index.js';
import { pushSubscriptions, notificationDeliveries, notificationPreferences } from '../../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@truespend.example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('VAPID keys not configured in environment variables.');
}

export class PushService {
  /**
   * Save a push subscription
   */
  async saveSubscription(userId: string, subscription: any, userAgent?: string) {
    // Check if it exists
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      return db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();
    }

    return db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      })
      .returning();
  }

  /**
   * Remove a push subscription
   */
  async deleteSubscription(endpoint: string) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /**
   * Get user preferences (or create defaults)
   */
  async getPreferences(userId: string) {
    let prefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (prefs.length === 0) {
      const [newPrefs] = await db
        .insert(notificationPreferences)
        .values({ userId })
        .returning();
      return newPrefs;
    }

    return prefs[0];
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId: string, payload: any) {
    const existing = await this.getPreferences(userId);
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...payload,
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return updated;
  }

  /**
   * Send a notification if not already sent today
   */
  async sendNotification(userId: string, type: string, scheduledFor: string, payload: any) {
    // Check idempotency
    const existingDelivery = await db
      .select()
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.userId, userId),
          eq(notificationDeliveries.type, type),
          eq(notificationDeliveries.scheduledFor, scheduledFor)
        )
      )
      .limit(1);

    if (existingDelivery.length > 0) {
      console.log(`Notification ${type} already delivered to user ${userId} for ${scheduledFor}`);
      return false; // Already sent
    }

    // Get subscriptions
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return false;
    }

    let successCount = 0;
    for (const sub of subs) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        successCount++;
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          console.log('Subscription expired. Deleting endpoint:', sub.endpoint);
          await this.deleteSubscription(sub.endpoint);
        } else {
          console.error('Error sending push notification:', error);
        }
      }
    }

    if (successCount > 0) {
      // Record delivery
      await db.insert(notificationDeliveries).values({
        userId,
        type,
        scheduledFor,
        metadata: JSON.stringify(payload),
      });
      return true;
    }
    return false;
  }
}
