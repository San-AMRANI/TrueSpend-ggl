import { db } from '../../src/db/index.js';
import {
  investmentHoldings,
  assetPriceCache,
  netWorthSnapshots,
  dcaPlans,
} from '../../src/db/schema.js';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { subDays } from 'date-fns';

export class InvestmentRepository {
  // ─── Holdings ─────────────────────────────────────────────────────────────

  async findHoldingsByUserId(userId: string) {
    return db.select().from(investmentHoldings).where(eq(investmentHoldings.userId, userId));
  }

  async findHoldingById(id: string, userId: string) {
    const result = await db
      .select()
      .from(investmentHoldings)
      .where(and(eq(investmentHoldings.id, id), eq(investmentHoldings.userId, userId)))
      .limit(1);
    return result[0] || null;
  }

  async findHoldingBySymbolAndWallet(userId: string, symbol: string, walletId: string) {
    const result = await db
      .select()
      .from(investmentHoldings)
      .where(
        and(
          eq(investmentHoldings.userId, userId),
          eq(investmentHoldings.symbol, symbol.toUpperCase()),
          eq(investmentHoldings.walletId, walletId),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async createHolding(data: {
    userId: string;
    walletId: string;
    symbol: string;
    name: string;
    assetType: string;
    quantity?: string;
    avgCostBasis?: string;
    currency?: string;
    notes?: string | null;
  }) {
    const result = await db
      .insert(investmentHoldings)
      .values({
        userId: data.userId,
        walletId: data.walletId,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        assetType: data.assetType,
        quantity: data.quantity ?? '0',
        avgCostBasis: data.avgCostBasis ?? '0',
        currency: data.currency ?? 'USD',
        notes: data.notes ?? null,
      })
      .returning();
    return result[0];
  }

  async updateHolding(
    id: string,
    userId: string,
    data: Partial<{
      quantity: string;
      avgCostBasis: string;
      name: string;
      currency: string;
      notes: string | null;
    }>,
  ) {
    const result = await db
      .update(investmentHoldings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(investmentHoldings.id, id), eq(investmentHoldings.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteHolding(id: string, userId: string) {
    const result = await db
      .delete(investmentHoldings)
      .where(and(eq(investmentHoldings.id, id), eq(investmentHoldings.userId, userId)))
      .returning();
    return result[0] || null;
  }

  // ─── Asset Price Cache ─────────────────────────────────────────────────────

  async getAssetPrice(symbol: string, assetType: string) {
    const result = await db
      .select()
      .from(assetPriceCache)
      .where(
        and(
          eq(assetPriceCache.symbol, symbol.toUpperCase()),
          eq(assetPriceCache.assetType, assetType),
        ),
      )
      .limit(1);
    return result[0] || null;
  }

  async upsertAssetPrice(data: {
    symbol: string;
    assetType: string;
    priceUsd?: string | null;
    priceMad?: string | null;
    priceEur?: string | null;
    source?: string;
  }) {
    const existing = await this.getAssetPrice(data.symbol, data.assetType);
    if (existing) {
      const result = await db
        .update(assetPriceCache)
        .set({
          priceUsd: data.priceUsd ?? existing.priceUsd,
          priceMad: data.priceMad ?? existing.priceMad,
          priceEur: data.priceEur ?? existing.priceEur,
          source: data.source ?? existing.source,
          fetchedAt: new Date(),
        })
        .where(
          and(
            eq(assetPriceCache.symbol, data.symbol.toUpperCase()),
            eq(assetPriceCache.assetType, data.assetType),
          ),
        )
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(assetPriceCache)
        .values({
          symbol: data.symbol.toUpperCase(),
          assetType: data.assetType,
          priceUsd: data.priceUsd ?? null,
          priceMad: data.priceMad ?? null,
          priceEur: data.priceEur ?? null,
          source: data.source ?? 'manual',
        })
        .returning();
      return result[0];
    }
  }

  async getAllAssetPrices() {
    return db.select().from(assetPriceCache);
  }

  // ─── Net Worth Snapshots ───────────────────────────────────────────────────

  async createNetWorthSnapshot(data: {
    userId: string;
    date: string;
    liquidValue: string;
    investmentValue: string;
    debtValue: string;
    netWorth: string;
    currency?: string;
  }) {
    // Upsert by user + date
    const existing = await db
      .select()
      .from(netWorthSnapshots)
      .where(
        and(eq(netWorthSnapshots.userId, data.userId), eq(netWorthSnapshots.date, data.date)),
      )
      .limit(1);

    if (existing.length > 0) {
      const result = await db
        .update(netWorthSnapshots)
        .set({
          liquidValue: data.liquidValue,
          investmentValue: data.investmentValue,
          debtValue: data.debtValue,
          netWorth: data.netWorth,
          currency: data.currency ?? 'MAD',
        })
        .where(
          and(eq(netWorthSnapshots.userId, data.userId), eq(netWorthSnapshots.date, data.date)),
        )
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(netWorthSnapshots)
        .values({
          userId: data.userId,
          date: data.date,
          liquidValue: data.liquidValue,
          investmentValue: data.investmentValue,
          debtValue: data.debtValue,
          netWorth: data.netWorth,
          currency: data.currency ?? 'MAD',
        })
        .returning();
      return result[0];
    }
  }

  async getNetWorthHistory(userId: string, days: number) {
    const cutoff = days < 99999
      ? subDays(new Date(), days).toISOString().slice(0, 10)
      : '2000-01-01';

    return db
      .select()
      .from(netWorthSnapshots)
      .where(
        and(
          eq(netWorthSnapshots.userId, userId),
          gte(netWorthSnapshots.date, cutoff),
        ),
      )
      .orderBy(netWorthSnapshots.date);
  }

  // ─── DCA Plans ─────────────────────────────────────────────────────────────

  async findDcaPlansByUserId(userId: string) {
    return db.select().from(dcaPlans).where(eq(dcaPlans.userId, userId)).orderBy(dcaPlans.createdAt);
  }

  async findDcaPlanById(id: string, userId: string) {
    const result = await db
      .select()
      .from(dcaPlans)
      .where(and(eq(dcaPlans.id, id), eq(dcaPlans.userId, userId)))
      .limit(1);
    return result[0] || null;
  }

  async createDcaPlan(data: {
    userId: string;
    symbol: string;
    assetName: string;
    assetType: string;
    walletId?: string | null;
    amount: string;
    currency?: string;
    frequency?: string;
    nextDate: string;
    active?: boolean;
    notes?: string | null;
  }) {
    const result = await db
      .insert(dcaPlans)
      .values({
        userId: data.userId,
        symbol: data.symbol.toUpperCase(),
        assetName: data.assetName,
        assetType: data.assetType,
        walletId: data.walletId ?? null,
        amount: data.amount,
        currency: data.currency ?? 'MAD',
        frequency: (data.frequency ?? 'monthly') as any,
        nextDate: data.nextDate,
        active: data.active ?? true,
        notes: data.notes ?? null,
      })
      .returning();
    return result[0];
  }

  async updateDcaPlan(
    id: string,
    userId: string,
    data: Partial<{
      symbol: string;
      assetName: string;
      assetType: string;
      walletId: string | null;
      amount: string;
      currency: string;
      frequency: string;
      nextDate: string;
      active: boolean;
      notes: string | null;
    }>,
  ) {
    const result = await db
      .update(dcaPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(dcaPlans.id, id), eq(dcaPlans.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteDcaPlan(id: string, userId: string) {
    const result = await db
      .delete(dcaPlans)
      .where(and(eq(dcaPlans.id, id), eq(dcaPlans.userId, userId)))
      .returning();
    return result[0] || null;
  }
}

export const investmentRepository = new InvestmentRepository();
