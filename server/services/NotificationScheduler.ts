import cron from 'node-cron';
import { db } from '../../src/db/index.js';
import {
  debts,
  goals,
  notificationPreferences,
  payrolls,
  subscriptions,
  transactions,
  users,
} from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { PushService } from './PushService.js';
import { KpiService } from './KpiService.js';
import { settingsService } from './SettingsService.js';
import { investmentService } from './InvestmentService.js';

const pushService = new PushService();
const kpiService = new KpiService();

function projectNextBillingDate(
  rawNextBillingDate: string | Date,
  billingCycle: string,
  now: Date
): { nextDateStr: string; diffDays: number } {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const parsed = new Date(rawNextBillingDate);
  if (Number.isNaN(parsed.getTime())) {
    return { nextDateStr: String(rawNextBillingDate), diffDays: 999 };
  }

  const candidate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  let guard = 0;
  while (candidate < todayMidnight && guard < 240) {
    guard++;
    switch (billingCycle) {
      case 'weekly':
        candidate.setDate(candidate.getDate() + 7);
        break;
      case 'biweekly':
        candidate.setDate(candidate.getDate() + 14);
        break;
      case 'every_2_months':
        candidate.setMonth(candidate.getMonth() + 2);
        break;
      case 'quarterly':
        candidate.setMonth(candidate.getMonth() + 3);
        break;
      case 'every_6_months':
        candidate.setMonth(candidate.getMonth() + 6);
        break;
      case 'yearly':
        candidate.setFullYear(candidate.getFullYear() + 1);
        break;
      case 'monthly':
      default:
        candidate.setMonth(candidate.getMonth() + 1);
        break;
    }
  }

  const diffDays = Math.round(
    (candidate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );
  const nextDateStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(candidate.getDate()).padStart(2, '0')}`;
  return { nextDateStr, diffDays };
}

export class NotificationScheduler {
  start() {
    // Notification delivery run every minute
    cron.schedule('* * * * *', async () => {
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

      // Multi-window schedule so users receive diverse notifications throughout the day
      const activeWindows = new Set([
        prefs.deliveryTime || '09:00',
        '09:00',
        '12:30',
        '16:00',
        '19:30',
        '21:00',
      ]);

      if (!activeWindows.has(userTime)) {
        continue;
      }

      if (this.isQuietHours(userTime, prefs.quietHoursStart, prefs.quietHoursEnd)) {
        continue;
      }

      const todayString = now.toISOString().split('T')[0];
      const candidates: Array<{
        type: string;
        payload: { title: string; body: string; url: string };
      }> = [];

      const [userSubs, userTx, userDebts, userGoals, userPayrolls, kpis] = await Promise.all([
        db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)),
        db.select().from(transactions).where(eq(transactions.userId, user.id)),
        db.select().from(debts).where(eq(debts.userId, user.id)),
        db.select().from(goals).where(eq(goals.userId, user.id)),
        db.select().from(payrolls).where(eq(payrolls.userId, user.id)),
        kpiService.getKpisForUser(user),
      ]);

      // 1. FUTURE CALENDAR EVENTS & SUBSCRIPTION RENEWALS (with cycle projection)
      if (prefs.forecastWarningEnabled) {
        const activeSubs = userSubs
          .filter((s) => s.status === 'active')
          .map((s) => {
            const { nextDateStr, diffDays } = projectNextBillingDate(
              s.nextBillingDate,
              s.billingCycle || 'monthly',
              now
            );
            const nameLower = s.name.toLowerCase();
            const paidRecently = userTx.some((tx) => {
              if (tx.type !== 'Expense') return false;
              const daysAgo =
                (now.getTime() - new Date(tx.createdAt).getTime()) / (1000 * 60 * 60 * 24);
              if (daysAgo < 0 || daysAgo > 6) return false;
              const desc = `${tx.notes || ''} ${tx.category || ''}`.toLowerCase();
              return desc.includes(nameLower);
            });
            return {
              ...s,
              projectedDate: nextDateStr,
              diffDays: paidRecently && diffDays <= 2 ? diffDays + 30 : diffDays,
              paidRecently,
            };
          })
          .sort((a, b) => a.diffDays - b.diffDays);

        // Individual approaching calendar bill events (0 to 14 days out)
        for (const sub of activeSubs) {
          if (sub.diffDays >= 0 && sub.diffDays <= 14 && !sub.paidRecently) {
            const amt = parseFloat(sub.amount as any) || 0;
            const whenLabel =
              sub.diffDays === 0
                ? 'Today'
                : sub.diffDays === 1
                ? 'Tomorrow'
                : `in ${sub.diffDays} days`;
            candidates.push({
              type: `CALENDAR_BILL_${sub.id}_${sub.projectedDate}`,
              payload: {
                title: `📅 Calendar Event ${whenLabel}: ${sub.name} (${amt.toFixed(0)} MAD)`,
                body: `${sub.name} is scheduled on your financial calendar for ${sub.projectedDate} (${whenLabel}).`,
                url: '/dashboard',
              },
            });
          }
        }

        // Rotating spotlight for any active subscription
        if (activeSubs.length > 0) {
          const randomSub = activeSubs[Math.floor(Math.random() * activeSubs.length)];
          const amt = parseFloat(randomSub.amount as any) || 0;
          candidates.push({
            type: `SUB_SPOTLIGHT_${randomSub.id}`,
            payload: {
              title: `🔍 Subscription Check: ${randomSub.name} (${amt.toFixed(0)} MAD/cycle)`,
              body: `Next calendar renewal on ${randomSub.projectedDate} (in ${randomSub.diffDays} days). Keep only if it delivers high weekly utility.`,
              url: '/dashboard',
            },
          });
        }

        // Future Scheduled Payrolls on Calendar
        for (const pr of userPayrolls) {
          const diffDays = Math.ceil(
            (new Date(pr.scheduledFor).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays >= 0 && diffDays <= 14) {
            const amt = parseFloat(pr.amount as any) || 0;
            candidates.push({
              type: `CALENDAR_PAYROLL_${pr.id}`,
              payload: {
                title: `💰 Calendar Payday Event in ${diffDays}d: +${amt.toFixed(0)} MAD`,
                body: `Scheduled salary deposit of ${amt.toFixed(0)} MAD arrives on ${pr.scheduledFor}.`,
                url: '/dashboard',
              },
            });
          }
        }

        // Approaching Payday & Post-Payday Stock Splitter
        if (kpis.daysUntilPayday >= 0 && kpis.daysUntilPayday <= 10) {
          candidates.push({
            type: `CALENDAR_PAYDAY_${kpis.daysUntilPayday}`,
            payload: {
              title: `🗓️ Calendar Payday Countdown: ${kpis.daysUntilPayday} Days Left`,
              body: `Your next salary cycle refreshes in ${kpis.daysUntilPayday} days. Post-Payday Stock Splitter is queued for Payday + 1d.`,
              url: '/dashboard',
            },
          });
        }
      }

      // 2. STOCKS & PORTFOLIO STATUS PULSE (Movers, Breakeven & Cash Reserve)
      if (prefs.anomalyEnabled) {
        try {
          const invData: any = await investmentService.getInvestmentsData(user.id);
          const stockPositions = (invData.positions || []).filter(
            (p: any) => p.market !== 'CRYPTO' && !p.isWatchlistOnly
          );

          for (const pos of stockPositions) {
            const move = Number(pos.change24hPercent || 0);
            if (Math.abs(move) >= 0.8) {
              const isUp = move >= 0;
              candidates.push({
                type: `STOCK_STATUS_${pos.ticker}`,
                payload: {
                  title: `${isUp ? '📈' : '📉'} Stock Alert: ${pos.ticker} ${isUp ? '+' : ''}${move.toFixed(2)}% (24h)`,
                  body: `${pos.companyName} is trading at $${Number(pos.currentPrice).toFixed(2)} (Breakeven floor: $${Number(pos.breakevenPriceUsd ?? pos.avgCostNum ?? pos.avgCostPerShare).toFixed(2)}).`,
                  url: '/dashboard',
                },
              });
            }

            if (pos.aboveBreakeven) {
              candidates.push({
                type: `STOCK_BREAKEVEN_${pos.ticker}`,
                payload: {
                  title: `🟢 ${pos.ticker} Clearing Fee-Adjusted Breakeven`,
                  body: `${pos.ticker} is +${Number(pos.unrealizedPnlPercent || 0).toFixed(1)}% above its breakeven floor (+${Number(pos.unrealizedPnlMad || 0).toFixed(0)} MAD net gain).`,
                  url: '/dashboard',
                },
              });
            }
          }

          const totalMad = Number(
            invData.summary?.stockHoldingsValueMad ?? invData.totalPortfolioValueMad ?? 0
          );
          const pnlMad = Number(
            invData.summary?.stockUnrealizedPnlMad ?? invData.totalUnrealizedPnlMad ?? 0
          );
          if (totalMad > 0) {
            candidates.push({
              type: 'STOCK_PORTFOLIO_SUMMARY',
              payload: {
                title: `💼 Equity Portfolio Pulse: ${totalMad.toFixed(0)} MAD (${pnlMad >= 0 ? '+' : ''}${pnlMad.toFixed(0)} MAD)`,
                body: `Tracking ${stockPositions.length} active stock positions across US & Moroccan markets.`,
                url: '/dashboard',
              },
            });
          }
        } catch (invErr) {
          console.warn('[NotificationScheduler] Stock status check skipped:', invErr);
        }
      }

      // 3. FORECAST & BUDGET WARNINGS
      if (prefs.budgetWarningEnabled) {
        if (kpis.forecast && kpis.forecast.expected < 0) {
          candidates.push({
            type: 'FORECAST_WARNING',
            payload: {
              title: '🔴 Cash Flow Forecast Alert',
              body: `Current spending pace projects a ${Math.abs(kpis.forecast.expected).toFixed(0)} MAD shortfall by payday. Adjusting daily spend re-balances your runway.`,
              url: '/dashboard',
            },
          });
        }

        if (kpis.dailyStatus === 'critical') {
          candidates.push({
            type: 'BUDGET_WARNING',
            payload: {
              title: '⚠️ Daily Budget Pace Alert',
              body: `Today's spending has exceeded your daily Safe-to-Spend allowance.`,
              url: '/dashboard',
            },
          });
        }
      }

      // 4. DEBT & GOAL MILESTONES (Including Calendar Deadlines)
      if (prefs.debtReminderEnabled) {
        const owedToMe = userDebts.filter(
          (d) =>
            d.type === 'Receivable' &&
            d.status !== 'Cleared' &&
            parseFloat((d.remainingBalance || d.originalAmount) as any) > 0
        );
        for (const debt of owedToMe.slice(0, 3)) {
          const rem = parseFloat((debt.remainingBalance || debt.originalAmount) as any) || 0;
          candidates.push({
            type: `DEBT_REMINDER_${debt.id}`,
            payload: {
              title: `🤝 Pending Reimbursement: ${debt.contactName} (${rem.toFixed(0)} MAD)`,
              body: `${debt.contactName} owes you ${rem.toFixed(0)} MAD. Remember reimbursements are excluded from income and netted against category spend.`,
              url: '/dashboard',
            },
          });
        }
      }

      if (prefs.goalEnabled) {
        for (const g of userGoals) {
          const target = parseFloat(g.targetAmount as any) || 0;
          const curr = parseFloat(g.currentAmount as any) || 0;
          if (target > 0 && curr < target) {
            const pct = Math.round((curr / target) * 100);
            candidates.push({
              type: `GOAL_MILESTONE_${g.id}`,
              payload: {
                title: `🏁 Goal "${g.name}": ${pct}% Funded (${curr.toFixed(0)} / ${target.toFixed(0)} MAD)`,
                body: `${(target - curr).toFixed(0)} MAD remaining to reach "${g.name}".`,
                url: '/dashboard',
              },
            });
          }
        }
      }

      // 5. DAILY SAFE-TO-SPEND & CREATIVE CHALLENGES
      if (prefs.dailyInsightEnabled) {
        candidates.push({
          type: `DAILY_INSIGHT_${userTime}`,
          payload: {
            title: `📆 Daily Cash Flow & Payday Pulse`,
            body: `You have ${kpis.safeToSpend.toFixed(0)} MAD safe to spend (${kpis.daysUntilPayday} days until payday · ${kpis.dailyAllowance.toFixed(0)} MAD/day allowance).`,
            url: '/dashboard',
          },
        });

        candidates.push({
          type: `CREATIVE_MICRO_SAVE_${todayString}`,
          payload: {
            title: `💡 Creative Challenge: Keep 20 MAD Untouched Today`,
            body: `Leaving 20 MAD/day unspent in your main bank account compounds to +7,300 MAD/year in automatic savings.`,
            url: '/dashboard',
          },
        });
      }

      // Shuffle candidates randomly so every time slot picks a diverse, non-repeating notification
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }

      for (const candidate of candidates) {
        const sent = await pushService.sendNotification(
          user.id,
          candidate.type,
          todayString,
          candidate.payload
        );
        if (sent) {
          break; // Sent 1 fresh random notification for this time window
        }
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

