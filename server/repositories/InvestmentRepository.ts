import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { investmentAccounts, investmentAssets, investmentEvents, investmentLots, investmentLotDisposals, priceSnapshots } from '../../src/db/schema.js';

export type InvestmentAccountRecord = typeof investmentAccounts.$inferSelect;
export type InvestmentAssetRecord = typeof investmentAssets.$inferSelect;
export type InvestmentEventRecord = typeof investmentEvents.$inferSelect;
export type InvestmentLotRecord = typeof investmentLots.$inferSelect;
export type InvestmentLotDisposalRecord = typeof investmentLotDisposals.$inferSelect;
export type PriceSnapshotRecord = typeof priceSnapshots.$inferSelect;

export class InvestmentRepository {
  async accounts(userId: string) { return db.select().from(investmentAccounts).where(eq(investmentAccounts.userId, userId)).orderBy(desc(investmentAccounts.createdAt)); }
  async account(id: string, userId: string) {
    const rows = await db.select().from(investmentAccounts).where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.userId, userId))).limit(1);
    return rows[0] ?? null;
  }
  async createAccount(input: typeof investmentAccounts.$inferInsert) { return (await db.insert(investmentAccounts).values(input).returning())[0]; }
  async updateAccount(id: string, userId: string, input: Partial<typeof investmentAccounts.$inferInsert>) {
    return (await db.update(investmentAccounts).set({ ...input, updatedAt: new Date() }).where(and(eq(investmentAccounts.id, id), eq(investmentAccounts.userId, userId))).returning())[0] ?? null;
  }

  async assets(userId: string) { return db.select().from(investmentAssets).where(eq(investmentAssets.userId, userId)).orderBy(investmentAssets.name); }
  async asset(id: string, userId: string) {
    const rows = await db.select().from(investmentAssets).where(and(eq(investmentAssets.id, id), eq(investmentAssets.userId, userId))).limit(1);
    return rows[0] ?? null;
  }
  async createAsset(input: typeof investmentAssets.$inferInsert) { return (await db.insert(investmentAssets).values(input).returning())[0]; }

  async events(userId: string) { return db.select().from(investmentEvents).where(eq(investmentEvents.userId, userId)).orderBy(desc(investmentEvents.tradeDate)); }
  async event(id: string, userId: string) {
    const rows = await db.select().from(investmentEvents).where(and(eq(investmentEvents.id, id), eq(investmentEvents.userId, userId))).limit(1);
    return rows[0] ?? null;
  }
  async createEvent(input: typeof investmentEvents.$inferInsert, lot?: Omit<typeof investmentLots.$inferInsert, 'investmentEventId'>) {
    return db.transaction(async (tx) => {
      const event = (await tx.insert(investmentEvents).values(input).returning())[0];
      const createdLot = lot ? (await tx.insert(investmentLots).values({ ...lot, investmentEventId: event.id }).returning())[0] : null;
      return { event, lot: createdLot };
    });
  }
  async lots(userId: string) { return db.select().from(investmentLots).where(eq(investmentLots.userId, userId)); }
  async updateLot(id: string, userId: string, remainingUnits: string) {
    return (await db.update(investmentLots).set({ remainingUnits, updatedAt: new Date() }).where(and(eq(investmentLots.id, id), eq(investmentLots.userId, userId))).returning())[0] ?? null;
  }
  async disposals(userId: string) { return db.select().from(investmentLotDisposals).where(eq(investmentLotDisposals.userId, userId)); }

  async createPrice(input: typeof priceSnapshots.$inferInsert) {
    return (await db.insert(priceSnapshots).values(input).onConflictDoNothing().returning())[0] ?? null;
  }
  async latestPrices(assetIds: string[]) {
    if (assetIds.length === 0) return [];
    const rows = await db.select().from(priceSnapshots).where(inArray(priceSnapshots.assetId, assetIds)).orderBy(desc(priceSnapshots.capturedAt));
    const latest = new Map<string, PriceSnapshotRecord>();
    for (const row of rows) if (!latest.has(row.assetId)) latest.set(row.assetId, row);
    return [...latest.values()];
  }
  async priceHistory(userId: string, from?: Date, to?: Date) {
    const assets = await this.assets(userId);
    const ids = assets.map((asset) => asset.id);
    if (!ids.length) return [];
    const rows = await db.select().from(priceSnapshots).where(inArray(priceSnapshots.assetId, ids)).orderBy(priceSnapshots.capturedAt);
    return rows.filter((row) => (!from || row.capturedAt >= from) && (!to || row.capturedAt <= to));
  }
  async priceHistoryForAsset(assetId: string, from?: Date, to?: Date) {
    const rows = await db.select().from(priceSnapshots).where(eq(priceSnapshots.assetId, assetId)).orderBy(priceSnapshots.capturedAt);
    return rows.filter((row) => (!from || row.capturedAt >= from) && (!to || row.capturedAt <= to));
  }
}

export const investmentRepository = new InvestmentRepository();
