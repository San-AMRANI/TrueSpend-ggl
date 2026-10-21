import { db } from '../../src/db/index.js';
import { stockPositions, stockOrders, wallets } from '../../src/db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface CreateStockPositionParams {
  userId: string;
  walletId?: string | null;
  ticker: string;
  companyName: string;
  market: string;
  sector: string;
  shares: string;
  avgCostPerShare: string;
  currentPrice: string;
  currency: string;
  annualDividendPerShare?: string;
  targetWeightPercent?: string;
  convictionThesis?: string | null;
  isWatchlistOnly?: boolean;
}

export interface CreateStockOrderParams {
  userId: string;
  positionId: string;
  walletId?: string | null;
  linkedTransactionId?: string | null;
  action: 'BUY' | 'SELL' | 'DIVIDEND';
  shares: string;
  pricePerShare: string;
  totalNativeAmount: string;
  totalMadAmount: string;
  exchangeRateUsed: string;
  realizedPnlMad?: string;
  notes?: string | null;
  executedAt?: Date;
}

export class InvestmentRepository {
  async findAllPositionsByUserId(userId: string) {
    const rows = await db
      .select({
        position: stockPositions,
        walletName: wallets.name,
      })
      .from(stockPositions)
      .leftJoin(wallets, eq(stockPositions.walletId, wallets.id))
      .where(eq(stockPositions.userId, userId))
      .orderBy(desc(stockPositions.createdAt));

    return rows.map((r) => ({
      ...r.position,
      walletName: r.walletName || null,
    }));
  }

  async findPositionById(id: string, userId: string) {
    const rows = await db
      .select()
      .from(stockPositions)
      .where(and(eq(stockPositions.id, id), eq(stockPositions.userId, userId)));
    return rows[0] || null;
  }

  async findPositionByTicker(ticker: string, userId: string) {
    const cleanTicker = ticker.trim().toUpperCase();
    const rows = await db
      .select()
      .from(stockPositions)
      .where(
        and(
          eq(stockPositions.userId, userId),
          sql`UPPER(${stockPositions.ticker}) = ${cleanTicker}`
        )
      );
    return rows[0] || null;
  }

  async createPosition(data: CreateStockPositionParams) {
    const inserted = await db
      .insert(stockPositions)
      .values({
        userId: data.userId,
        walletId: data.walletId || null,
        ticker: data.ticker.toUpperCase().trim(),
        companyName: data.companyName.trim(),
        market: data.market || 'US',
        sector: data.sector || 'Technology',
        shares: data.shares || '0',
        avgCostPerShare: data.avgCostPerShare || '0',
        currentPrice: data.currentPrice || data.avgCostPerShare || '0',
        currency: (data.currency || 'USD').toUpperCase(),
        annualDividendPerShare: data.annualDividendPerShare || '0',
        targetWeightPercent: data.targetWeightPercent || '0',
        convictionThesis: data.convictionThesis || null,
        isWatchlistOnly: Boolean(data.isWatchlistOnly),
      })
      .returning();
    return inserted[0];
  }

  async updatePosition(id: string, userId: string, data: Partial<CreateStockPositionParams>) {
    const updated = await db
      .update(stockPositions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(stockPositions.id, id), eq(stockPositions.userId, userId)))
      .returning();
    return updated[0] || null;
  }

  async deletePosition(id: string, userId: string) {
    await db
      .delete(stockPositions)
      .where(and(eq(stockPositions.id, id), eq(stockPositions.userId, userId)));
  }

  async findAllOrdersByUserId(userId: string) {
    const rows = await db
      .select({
        order: stockOrders,
        ticker: stockPositions.ticker,
        companyName: stockPositions.companyName,
        currency: stockPositions.currency,
        walletName: wallets.name,
      })
      .from(stockOrders)
      .leftJoin(stockPositions, eq(stockOrders.positionId, stockPositions.id))
      .leftJoin(wallets, eq(stockOrders.walletId, wallets.id))
      .where(eq(stockOrders.userId, userId))
      .orderBy(desc(stockOrders.executedAt));

    return rows.map((r) => ({
      ...r.order,
      ticker: r.ticker || undefined,
      companyName: r.companyName || undefined,
      currency: r.currency || 'USD',
      walletName: r.walletName || null,
    }));
  }

  async findOrderById(id: string, userId: string) {
    const rows = await db
      .select()
      .from(stockOrders)
      .where(and(eq(stockOrders.id, id), eq(stockOrders.userId, userId)));
    return rows[0] || null;
  }

  async createOrder(data: CreateStockOrderParams) {
    const inserted = await db
      .insert(stockOrders)
      .values({
        userId: data.userId,
        positionId: data.positionId,
        walletId: data.walletId || null,
        linkedTransactionId: data.linkedTransactionId || null,
        action: data.action,
        shares: data.shares || '0',
        pricePerShare: data.pricePerShare || '0',
        totalNativeAmount: data.totalNativeAmount,
        totalMadAmount: data.totalMadAmount,
        exchangeRateUsed: data.exchangeRateUsed || '1',
        realizedPnlMad: data.realizedPnlMad || '0',
        notes: data.notes || null,
        executedAt: data.executedAt || new Date(),
      })
      .returning();
    return inserted[0];
  }

  async deleteOrder(id: string, userId: string) {
    await db
      .delete(stockOrders)
      .where(and(eq(stockOrders.id, id), eq(stockOrders.userId, userId)));
  }
}

export const investmentRepository = new InvestmentRepository();
