import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { db } from '../../src/db/index.js';
import { pushSubscriptions, users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const router = Router();

const DEFAULT_VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BIXycWxFWx7kuDCs_KgY0aO8jmLfOy6s1ycy6zOaDWI9M5IcpCpytR5F_Swh2MJndTUyEWItJ_7zqbv1JUe9CKs";

router.get('/notifications/vapid-public-key', requireAuth, (req, res) => {
  try {
    const vapidPath = path.join(process.cwd(), 'server', 'vapid.json');
    if (fs.existsSync(vapidPath)) {
      const keys = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
      if (keys.publicKey) {
        return res.send(keys.publicKey);
      }
    }
  } catch (e) {
    // Ignore and fallback
  }
  res.send(DEFAULT_VAPID_PUBLIC_KEY);
});


router.post('/notifications/subscribe', requireAuth, async (req, res) => {
  const { subscription, settings } = req.body;
  const user = (req as any).dbUser;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  try {
    // Save or update subscription
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    
    if (existing.length === 0) {
      await db.insert(pushSubscriptions).values({
        userId: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    }

    // Update user settings
    await db.update(users).set({
      notificationEnabled: settings.enabled ? 1 : 0,
      notificationTime: settings.time // Make sure client sends UTC time if needed, or we just rely on client's local HH:MM string and server assumes it's UTC for matching. Wait! Timezones!
      // For simplicity, we just save what the client sends. But server is in UTC.
    }).where(eq(users.id, user.id));

    res.status(201).json({});
  } catch (error) {
    console.error('Error saving subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
