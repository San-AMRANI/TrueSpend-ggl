import { db } from '../../src/db/index.js';
import { investmentHoldings, investmentTransactions, dcaPlans, investmentWatchlist, wallets } from '../../src/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export interface CreateHoldingParams {
  userId: string;
  walletId?: string | null;
  symbol: string;
  name: string;
  assetType: string;
  units: string;
  buyPriceAvg: string;
  currentPrice: string;
  currency?: string;
  targetAllocationPercent?: string | null;
  dividendYieldPercent?: string | null;
  notes?: string | null;
}

export interface CreateInvestmentTransactionParams {
  userId: string;
  holdingId: string;
  walletId?: string | null;
  type: string;
  units: string;
  pricePerUnit: string;
  totalAmount: string;
  currency?: string;
  fees?: string;
  realizedPnl?: string | null;
  notes?: string | null;
}

export interface CreateDcaPlanParams {
  userId: string;
  holdingId?: string | null;
  symbol: string;
  assetName: string;
  assetType: string;
  targetAmount: string;
  currency?: string;
  frequency?: string;
  dayOffsetAfterPayday?: number;
  walletId?: string | null;
  status?: string;
}

export class InvestmentRepository {
  async findAllHoldingsByUserId(userId: string) {
    const rows = await db
      .select({
        holding: investmentHoldings,
        walletName: wallets.name,
      })
      .from(investmentHoldings)
      .leftJoin(wallets, eq(investmentHoldings.walletId, wallets.id))
      .where(eq(investmentHoldings.userId, userId))
      .orderBy(desc(investmentHoldings.createdAt));

    return rows.map(r => ({
      ...r.holding,
      walletName: r.walletName || null,
    }));
  }

  async findHoldingById(id: string, userId: string) {
    const result = await db
      .select()
      .from(investmentHoldings)
      .where(and(eq(investmentHoldings.id, id), eq(investmentHoldings.userId, userId)));
    return result[0] || null;
  }

  async createHolding(data: CreateHoldingParams) {
    const inserted = await db.insert(investmentHoldings).values(data).returning();
    return inserted[0];
  }

  async updateHolding(id: string, userId: string, data: Partial<CreateHoldingParams>) {
    const updated = await db
      .update(investmentHoldings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(investmentHoldings.id, id), eq(investmentHoldings.userId, userId)))
      .returning();
    return updated[0] || null;
  }

  async deleteHolding(id: string, userId: string) {
    await db
      .delete(investmentHoldings)
      .where(and(eq(investmentHoldings.id, id), eq(investmentHoldings.userId, userId)));
  }

  async findAllTransactionsByUserId(userId: string) {
    const rows = await db
      .select({
        tx: investmentTransactions,
        holdingSymbol: investmentHoldings.symbol,
        holdingName: investmentHoldings.name,
        walletName: wallets.name,
      })
      .from(investmentTransactions)
      .leftJoin(investmentHoldings, eq(investmentTransactions.holdingId, investmentHoldings.id))
      .leftJoin(wallets, eq(investmentTransactions.walletId, wallets.id))
      .where(eq(investmentTransactions.userId, userId))
      .orderBy(desc(investmentTransactions.createdAt));

    return rows.map(r => ({
      ...r.tx,
      holdingSymbol: r.holdingSymbol || undefined,
      holdingName: r.holdingName || undefined,
      walletName: r.walletName || undefined,
    }));
  }

  async createTransaction(data: CreateInvestmentTransactionParams) {
    const inserted = await db.insert(investmentTransactions).values(data).returning();
    return inserted[0];
  }

  async deleteTransaction(id: string, userId: string) {
    await db
      .delete(investmentTransactions)
      .where(and(eq(investmentTransactions.id, id), eq(investmentTransactions.userId, userId)));
  }

  async findAllDcaPlansByUserId(userId: string) {
    const rows = await db
      .select({
        plan: dcaPlans,
        walletName: wallets.name,
      })
      .from(dcaPlans)
      .leftJoin(wallets, eq(dcaPlans.walletId, wallets.id))
      .where(eq(dcaPlans.userId, userId))
      .orderBy(desc(dcaPlans.createdAt));

    return rows.map(r => ({
      ...r.plan,
      walletName: r.walletName || null,
    }));
  }

  async findDcaPlanById(id: string, userId: string) {
    const result = await db
      .select()
      .from(dcaPlans)
      .where(and(eq(dcaPlans.id, id), eq(dcaPlans.userId, userId)));
    return result[0] || null;
  }

  async createDcaPlan(data: CreateDcaPlanParams) {
    const inserted = await db.insert(dcaPlans).values(data).returning();
    return inserted[0];
  }

  async updateDcaPlan(id: string, userId: string, data: Partial<CreateDcaPlanParams>) {
    const updated = await db
      .update(dcaPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(dcaPlans.id, id), eq(dcaPlans.userId, userId)))
      .returning();
    return updated[0] || null;
  }

  async deleteDcaPlan(id: string, userId: string) {
    await db
      .delete(dcaPlans)
      .where(and(eq(dcaPlans.id, id), eq(dcaPlans.userId, userId)));
  }

  async findAllWatchlistByUserId(userId: string) {
    return await db
      .select()
      .from(investmentWatchlist)
      .where(eq(investmentWatchlist.userId, userId))
      .orderBy(desc(investmentWatchlist.createdAt));
  }

  async addToWatchlist(data: { userId: string; coinId: string; symbol: string; name: string }) {
    // Check if already in watchlist
    const existing = await db
      .select()
      .from(investmentWatchlist)
      .where(and(eq(investmentWatchlist.userId, data.userId), eq(investmentWatchlist.coinId, data.coinId)));
    if (existing.length > 0) return existing[0];

    const inserted = await db.insert(investmentWatchlist).values(data).returning();
    return inserted[0];
  }

  async removeFromWatchlist(id: string, userId: string) {
    await db
      .delete(investmentWatchlist)
      .where(and(eq(investmentWatchlist.id, id), eq(investmentWatchlist.userId, userId)));
  }

  async removeFromWatchlistByCoinId(coinId: string, userId: string) {
    await db
      .delete(investmentWatchlist)
      .where(and(eq(investmentWatchlist.coinId, coinId), eq(investmentWatchlist.userId, userId)));
  }
}

export const investmentRepository = new InvestmentRepository();
