import cron from 'node-cron';
import webpush from 'web-push';
import { db } from '../src/db/index.js';
import { users, pushSubscriptions } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { kpiService } from './services/KpiService.js';
import { transactionRepository } from './repositories/TransactionRepository.js';
import fs from 'fs';
import path from 'path';

// Load VAPID
const vapidPath = path.join(process.cwd(), 'server', 'vapid.json');
let vapidKeys = { publicKey: '', privateKey: '' };
if (fs.existsSync(vapidPath)) {
  vapidKeys = JSON.parse(fs.readFileSync(vapidPath, 'utf8'));
  webpush.setVapidDetails(
    'mailto:amranihassan.am@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

function formatMAD(num: number) {
  return num.toFixed(0);
}

export function startPushCron() {
  if (!vapidKeys.publicKey) return;

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const mm = String(now.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;

      const optedInUsers = await db.select().from(users).where(eq(users.notificationEnabled, 1));

      for (const u of optedInUsers) {
        if (u.notificationTime === timeStr) {
          try {
            const kpis = await kpiService.getKpisForUser(u);
            
            let title = '📊 Daily Update';
            let body = `You've spent ${formatMAD(kpis.monthlyExpenses)} MAD so far this month.`;

            if (kpis.dailyRemaining < 0) {
              title = '🚨 Budget Exceeded';
              body = `You've exceeded your daily allowance by ${formatMAD(Math.abs(kpis.dailyRemaining))} MAD.`;
            } else if (kpis.dailyRemaining > 0) {
              title = '📋 Budget Recap';
              body = `You have ${formatMAD(kpis.dailyRemaining)} MAD remaining today. You're on track!`;
            }

            const payload = JSON.stringify({ title, body, icon: '/logo.png', badge: '/logo.png' });
            const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u.id));
            
            for (const sub of subs) {
              try {
                await webpush.sendNotification({
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth }
                }, payload);
              } catch (e) {
                console.error('Push failed for user', u.id, e);
              }
            }
          } catch (err) {
            console.error('Error running push for user', u.id, err);
          }
        }
      }
    } catch (err) {
      console.error('[NODE-CRON] Error during push notification check:', err);
    }
  });
}
