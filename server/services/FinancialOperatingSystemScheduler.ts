import cron from 'node-cron';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { marketDataService } from './MarketDataService.js';
import { financialSnapshotService } from './FinancialSnapshotService.js';

/**
 * Server-side V2 maintenance. Snapshot writes are idempotent by
 * (user_id, snapshot_date), so a restart or retry cannot duplicate history.
 * Provider failures are isolated per user; the last successful valuation is
 * intentionally retained by MarketDataService.
 */
export class FinancialOperatingSystemScheduler {
  start() {
    // Persist a dated position snapshot shortly after UTC midnight. User-local
    // display remains a client concern; the snapshot date is a stable chart key.
    cron.schedule('10 0 * * *', () => void this.captureDailySnapshots());
    // Refresh market prices independently of page visits. The service itself
    // honours cache TTLs and provider backoff, so this is safe to run hourly.
    cron.schedule('15 * * * *', () => void this.refreshPortfolioPrices());
  }

  async captureDailySnapshots() {
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
      try {
        await financialSnapshotService.saveDaily(user);
      } catch (error) {
        console.error(`[FinancialOperatingSystemScheduler] Snapshot failed for ${user.id}`, error);
      }
    }
  }

  async refreshPortfolioPrices() {
    const allUsers = await db.select().from(users);
    for (const user of allUsers) {
      try {
        const profile = await financialSnapshotService.getProfile(user.id);
        await marketDataService.refreshUserCryptoPrices(user.id, profile.baseCurrency);
      } catch (error) {
        console.error(`[FinancialOperatingSystemScheduler] Price refresh failed for ${user.id}`, error);
      }
    }
  }
}
