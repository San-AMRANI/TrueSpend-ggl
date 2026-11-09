import cron from 'node-cron';
import { db } from '../../src/db/index.js';
import {
  debts,
  goals,
  notificationPreferences,
  subscriptions,
  users,
} from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { PushService } from './PushService.js';
import { KpiService } from './KpiService.js';
import { settingsService } from './SettingsService.js';
import { investmentService } from './InvestmentService.js';

const pushService = new PushService();
const kpiService = new KpiService();

export class NotificationScheduler {
  start() {
    // Notification delivery run every minute
    cron.schedule('* * * * *', async () => {
      console.log(`[NotificationScheduler] Running at ${new Date().toISOString()}`);
      try {
        await this.processNotifications();
      } catch (error) {
        console.error('[NotificationScheduler] Error processing notifications:', error);
      }
    });

    // Automated Drive Backup check run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        await this.processAutomatedBackups();
      } catch (error) {
        console.error('[NotificationScheduler] Error checking automated backups:', error);
      }
    });
  }

  async processAutomatedBackups() {
    try {
      const backupUsers = await db
        .select()
        .from(users)
        .where(eq(users.automatedDriveBackups, 1));

      for (const user of backupUsers) {
        if (!user.googleDriveToken) continue;

        if (
          user.googleDriveTokenExpiry &&
          new Date(user.googleDriveTokenExpiry).getTime() < Date.now()
        ) {
          continue;
        }

        const lastBackup = user.lastDriveBackupDate
          ? new Date(user.lastDriveBackupDate).getTime()
          : 0;
        const frequency = user.driveBackupFrequency || 'weekly';
        const intervalMs =
          frequency === 'daily'
            ? 24 * 60 * 60 * 1000
            : frequency === '3days'
            ? 3 * 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;

        if (Date.now() - lastBackup >= intervalMs) {
          console.log(
            `[BackupScheduler] Triggering server backup for ${user.email} (frequency: ${frequency})`
          );
          try {
            const result = await settingsService.backupToGoogleDrive(user.googleDriveToken);
            await settingsService.updateSettings(user.id, {
              lastDriveBackupDate: result.lastDriveBackupDate,
            });
            console.log(`[BackupScheduler] Backup succeeded for ${user.email}`);
          } catch (err) {
            console.error(`[BackupScheduler] Error backing up user ${user.email}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[BackupScheduler] Failed to query automated backup users:', err);
    }
  }

  async processNotifications() {
    const allPrefs = await db
      .select({
        prefs: notificationPreferences,
        user: users,
      })
      .from(notificationPreferences)
      .innerJoin(users, eq(notificationPreferences.userId, users.id))
      .where(eq(notificationPreferences.enabled, true));

    for (const { prefs, user } of allPrefs) {
      const now = new Date();
      const userTime = new Intl.DateTimeFormat('en-US', {
        timeZone: prefs.timezone || 'Africa/Casablanca',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      if (userTime !== prefs.deliveryTime) {
        continue;
      }

      if (this.isQuietHours(userTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        continue;
      }

      const todayString = now.toISOString().split('T')[0];

      // 1. SUBSCRIPTION RENEWAL & CALENDAR BILL CLUSTER CHECK
      if (prefs.forecastWarningEnabled) {
        const userSubs = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, user.id));
        const activeSubs = userSubs.filter((s) => s.status === 'active');

        const imminentSubs = activeSubs.filter((s) => {
          const diffDays = Math.ceil(
            (new Date(s.nextBillingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          return diffDays >= 0 && diffDays <= 3;
        });

        if (imminentSubs.length > 0) {
          const nextSub = imminentSubs[0];
          const totalImminent = imminentSubs.reduce(
            (acc, s) => acc + parseFloat(s.amount as any),
            0
          );
          const sent = await pushService.sendNotification(
            user.id,
            'SUBSCRIPTION_RENEWAL_ALERT',
            todayString,
            {
              title:
                imminentSubs.length === 1
                  ? `🔔 ${nextSub.name} Renews Soon`
                  : `📅 ${imminentSubs.length} Calendar Bills Due in 72h`,
              body:
                imminentSubs.length === 1
                  ? `${nextSub.name} (${parseFloat(nextSub.amount as any).toFixed(0)} MAD) is scheduled on ${nextSub.nextBillingDate}.`
                  : `${imminentSubs.map((s) => s.name).join(', ')} totaling ${totalImminent.toFixed(0)} MAD renew within 72 hours.`,
              url: '/dashboard',
            }
          );
          if (sent) continue;
        }
      }

      // 2. STOCKS & PORTFOLIO STATUS PULSE (Movers, Breakeven & Watchlist)
      if (prefs.anomalyEnabled) {
        try {
          const invData = await investmentService.getInvestmentsData(user.id);
          const stockPositions = (invData.positions || []).filter(
            (p: any) => p.market !== 'CRYPTO'
          );

          if (stockPositions.length > 0) {
            const topMover = [...stockPositions].sort(
              (a: any, b: any) =>
                Math.abs(b.change24hPercent || 0) - Math.abs(a.change24hPercent || 0)
            )[0];

            if (topMover && Math.abs(topMover.change24hPercent || 0) >= 1.5) {
              const move = topMover.change24hPercent || 0;
              const isUp = move >= 0;
              const sent = await pushService.sendNotification(
                user.id,
                'STOCK_STATUS_PULSE',
                todayString,
                {
                  title: `${isUp ? '📈' : '📉'} Stock Status: ${topMover.ticker} ${isUp ? '+' : ''}${move.toFixed(2)}% (24h)`,
                  body: `${topMover.companyName} is at $${Number(topMover.currentPrice).toFixed(2)} (Breakeven floor: $${Number(topMover.breakevenPriceUsd ?? topMover.avgCostNum ?? topMover.avgCostPerShare).toFixed(2)}).`,
                  url: '/dashboard',
                }
              );
              if (sent) continue;
            }
          }
        } catch (invErr) {
          console.warn('[NotificationScheduler] Stock status check skipped:', invErr);
        }
      }

      // 3. FORECAST & BUDGET CRITICAL WARNING
      if (prefs.budgetWarningEnabled) {
        const kpis = await kpiService.getKpisForUser(user);
        if (kpis.forecast && kpis.forecast.expected < 0) {
          const sent = await pushService.sendNotification(
            user.id,
            'FORECAST_WARNING',
            todayString,
            {
              title: '🔴 Cash Flow Forecast Alert',
              body: `Current spending pace projects a ${Math.abs(kpis.forecast.expected).toFixed(0)} MAD shortfall by payday. Adjusting daily spend re-balances your runway.`,
              url: '/dashboard',
            }
          );
          if (sent) continue;
        }

        if (kpis.dailyStatus === 'critical') {
          const sent = await pushService.sendNotification(user.id, 'BUDGET_WARNING', todayString, {
            title: '⚠️ Daily Budget Pace Alert',
            body: `Today's spending has exceeded your daily Safe-to-Spend allowance.`,
            url: '/dashboard',
          });
          if (sent) continue;
        }
      }

      // 4. DEBT & GOAL MILESTONE CHECK
      if (prefs.debtReminderEnabled || prefs.goalEnabled) {
        const userDebts = await db.select().from(debts).where(eq(debts.userId, user.id));
        const owedToMe = userDebts.filter(
          (d) =>
            d.type === 'Receivable' &&
            d.status !== 'Cleared' &&
            parseFloat((d.remainingBalance || d.originalAmount) as any) > 0
        );
        if (prefs.debtReminderEnabled && owedToMe.length > 0) {
          const totalOwed = owedToMe.reduce(
            (s, d) => s + parseFloat((d.remainingBalance || d.originalAmount) as any),
            0
          );
          const sent = await pushService.sendNotification(user.id, 'DEBT_REMINDER', todayString, {
            title: `🤝 ${totalOwed.toFixed(0)} MAD in Pending Reimbursements`,
            body: `You have ${owedToMe.length} unsettled split${owedToMe.length === 1 ? '' : 's'} owed to you. Settling them boosts your liquid Safe-to-Spend.`,
            url: '/dashboard',
          });
          if (sent) continue;
        }

        const userGoals = await db.select().from(goals).where(eq(goals.userId, user.id));
        const nearGoal = userGoals.find((g) => {
          const target = parseFloat(g.targetAmount as any);
          const curr = parseFloat(g.currentAmount as any);
          return target > 0 && curr / target >= 0.75 && curr < target;
        });
        if (prefs.goalEnabled && nearGoal) {
          const pct = Math.round(
            (parseFloat(nearGoal.currentAmount as any) /
              parseFloat(nearGoal.targetAmount as any)) *
              100
          );
          const sent = await pushService.sendNotification(user.id, 'GOAL_MILESTONE', todayString, {
            title: `🏁 Goal "${nearGoal.name}" is ${pct}% Complete!`,
            body: `You're in the final stretch for "${nearGoal.name}".`,
            url: '/dashboard',
          });
          if (sent) continue;
        }
      }

      // 5. DEFAULT DAILY CALENDAR & SAFE-TO-SPEND INSIGHT
      if (prefs.dailyInsightEnabled) {
        const kpis = await kpiService.getKpisForUser(user);
        await pushService.sendNotification(user.id, 'DAILY_INSIGHT', todayString, {
          title: `📆 Daily Cash Flow & Payday Pulse`,
          body: `You have ${kpis.safeToSpend.toFixed(0)} MAD safe to spend (${kpis.daysUntilPayday} days until payday · ${kpis.dailyAllowance.toFixed(0)} MAD/day allowance).`,
          url: '/dashboard',
        });
      }
    }
  }

  isQuietHours(currentTime: string, start: string, end: string) {
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  }
}
