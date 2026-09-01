import { payrollRepository } from "../repositories/PayrollRepository.js";
import cron from 'node-cron';
import { db } from '../../src/db/index.js';
import { notificationPreferences, users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { PushService } from './PushService.js';
import { KpiService } from './KpiService.js';
import { InsightsService } from './InsightsService.js';

const pushService = new PushService();
const kpiService = new KpiService();
const insightsService = new InsightsService();

export class NotificationScheduler {
  start() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
      console.log(`[NotificationScheduler] Running at ${new Date().toISOString()}`);
      try {
        await this.processNotifications();
      } catch (error) {
        console.error('[NotificationScheduler] Error processing notifications:', error);
      }
    });
  }

  async processNotifications() {
    // 1. Fetch all users who have notifications enabled
    const allPrefs = await db
      .select({
        prefs: notificationPreferences,
        user: users,
      })
      .from(notificationPreferences)
      .innerJoin(users, eq(notificationPreferences.userId, users.id))
      .where(eq(notificationPreferences.enabled, true));

    for (const { prefs, user } of allPrefs) {
      // 2. Check if it's their delivery time
      // For simplicity, we just compare the HH:mm string. 
      // In a real app with different timezones, we'd use `date-fns-tz` to get the current time in `prefs.timezone`.
      const now = new Date();
      // Let's format 'now' into the user's timezone HH:mm
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: prefs.timezone || 'Africa/Casablanca',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now); // e.g. "09:00"

      if (userTime !== prefs.deliveryTime) {
        continue;
      }

      // Check quiet hours
      if (this.isQuietHours(userTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        continue;
      }

      // 3. Generate insight via KPI engine
      const todayString = now.toISOString().split('T')[0];

      // Try to send a forecast warning
      if (prefs.forecastWarningEnabled) {
        const kpis = await kpiService.getKpisForUser(user);
        if (kpis.forecast && kpis.forecast.expected < 0) {
          const sent = await pushService.sendNotification(user.id, 'FORECAST_WARNING', todayString, {
            title: 'Forecast Warning',
            body: `🔴 Your current spending pace projects a ${Math.abs(kpis.forecast.expected).toFixed(2)} MAD shortfall by the end of your financial period.`,
            url: '/dashboard'
          });
          if (sent) continue; // Only one notification per day
        }
      }

      // Try budget warning
      if (prefs.budgetWarningEnabled) {
        const payrolls = await payrollRepository.findAllByUserId(user.id);
        const insights = await insightsService.getInsights(user.id, payrolls);
        const warningInsight = insights.patterns?.find(t => t.trend === 'up' && t.threeMonthAvg > 0);
        if (warningInsight) {
          const sent = await pushService.sendNotification(user.id, 'BUDGET_WARNING', todayString, {
            title: 'Spending Warning',
            body: `⚠️ You are spending more on ${warningInsight.category} than usual.`,
            url: '/dashboard'
          });
          if (sent) continue;
        }
      }

      // Default daily insight
      if (prefs.dailyInsightEnabled) {
        const kpis = await kpiService.getKpisForUser(user);
        await pushService.sendNotification(user.id, 'DAILY_INSIGHT', todayString, {
          title: 'Daily Financial Insight',
          body: `💰 You have ${kpis.safeToSpend.toFixed(2)} MAD safe to spend today.`,
          url: '/dashboard'
        });
      }
    }
  }

  isQuietHours(currentTime: string, start: string, end: string) {
    // Extremely basic quiet hours check (assuming HH:mm string comparison)
    // E.g. start = "22:00", end = "07:00", currentTime = "23:00"
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  }
}
