import { db } from '../../src/db/index.js';
import { transactions } from '../../src/db/schema.js';
import { investmentRepository } from '../repositories/InvestmentRepository.js';
import { marketPriceFeedService } from './MarketPriceFeedService.js';
import type { InvestmentHolding, InvestmentPortfolioSummary, SafeToInvestBreakdown } from '../../src/types/index.js';

const DEFAULT_MAD_PER_USD = 10.0;

export interface CreateHoldingDTO {
  walletId: string;
  symbol: string;
  name: string;
  assetType: 'crypto' | 'stock' | 'etf' | 'manual';
  quantity?: number;
  avgCostBasis?: number;
  currency?: string;
  notes?: string | null;
}

export interface BuyOrderDTO {
  walletId: string;       // Source cash wallet
  symbol: string;
  name?: string;
  assetType: 'crypto' | 'stock' | 'etf' | 'manual';
  holdingId?: string;     // Existing holding id (or create new)
  quantity: number;
  pricePerUnit: number;   // in MAD
  currency?: string;
  date?: string;
  notes?: string | null;
}

export interface SellOrderDTO {
  holdingId: string;
  walletId: string;       // Destination cash wallet
  quantity: number;
  pricePerUnit: number;   // in MAD
  date?: string;
  notes?: string | null;
}

export interface DividendDTO {
  holdingId: string;
  walletId: string;
  amount: number;         // in MAD
  date?: string;
  notes?: string | null;
}

export interface StakingDTO {
  holdingId: string;
  walletId: string;
  quantity?: number;      // token quantity received
  amount?: number;        // or MAD equivalent
  pricePerUnit?: number;
  date?: string;
  notes?: string | null;
}

export class InvestmentService {
  // ─── Portfolio ─────────────────────────────────────────────────────────────

  async getPortfolio(userId: string): Promise<InvestmentPortfolioSummary> {
    const rawHoldings = await investmentRepository.findHoldingsByUserId(userId);

    let totalInvestedMad = 0;
    let totalMarketValueMad = 0;
    let totalRealizedGainLoss = 0;
    let passiveIncomeMonthlyMad = 0;

    const holdings: InvestmentHolding[] = await Promise.all(
      rawHoldings.map(async (h) => {
        const qty = parseFloat(h.quantity ?? '0');
        const avgCost = parseFloat(h.avgCostBasis ?? '0');
        const madPerUsd = DEFAULT_MAD_PER_USD;

        // Cost basis in MAD
        const costBasisMad = qty * avgCost * (h.currency === 'USD' ? madPerUsd : h.currency === 'MAD' ? 1 : madPerUsd);
        totalInvestedMad += costBasisMad;

        // Get live price
        const price = await marketPriceFeedService.getPriceForHolding(h.symbol, h.assetType).catch(() => null);
        const currentPriceMad = price?.mad ?? null;
        const marketValueMad = currentPriceMad !== null ? qty * currentPriceMad : null;
        if (marketValueMad !== null) totalMarketValueMad += marketValueMad;

        const unrealizedGainLoss = marketValueMad !== null ? marketValueMad - costBasisMad : null;
        const unrealizedGainLossPct =
          costBasisMad > 0 && unrealizedGainLoss !== null
            ? (unrealizedGainLoss / costBasisMad) * 100
            : null;

        return {
          id: h.id,
          userId: h.userId,
          walletId: h.walletId,
          symbol: h.symbol,
          name: h.name,
          assetType: h.assetType as any,
          quantity: h.quantity,
          avgCostBasis: h.avgCostBasis,
          currency: h.currency,
          notes: h.notes,
          createdAt: h.createdAt.toISOString(),
          updatedAt: h.updatedAt.toISOString(),
          currentPriceUsd: price?.usd ?? undefined,
          currentPriceMad: price?.mad ?? undefined,
          currentPriceEur: price?.eur ?? undefined,
          marketValueMad: marketValueMad ?? undefined,
          unrealizedGainLoss: unrealizedGainLoss ?? undefined,
          unrealizedGainLossPct: unrealizedGainLossPct ?? undefined,
          lastPriceFetchedAt: price ? new Date().toISOString() : undefined,
        };
      }),
    );

    const totalUnrealizedGainLoss = totalMarketValueMad - totalInvestedMad;
    const totalUnrealizedGainLossPct =
      totalInvestedMad > 0 ? (totalUnrealizedGainLoss / totalInvestedMad) * 100 : 0;

    return {
      totalInvestedMad,
      totalMarketValueMad,
      totalUnrealizedGainLoss,
      totalUnrealizedGainLossPct,
      totalRealizedGainLoss,
      passiveIncomeMonthlyMad,
      holdings,
    };
  }

  // ─── Holdings CRUD ─────────────────────────────────────────────────────────

  async createHolding(userId: string, dto: CreateHoldingDTO) {
    const holding = await investmentRepository.createHolding({
      userId,
      walletId: dto.walletId,
      symbol: dto.symbol,
      name: dto.name,
      assetType: dto.assetType,
      quantity: dto.quantity !== undefined ? String(dto.quantity) : '0',
      avgCostBasis: dto.avgCostBasis !== undefined ? String(dto.avgCostBasis) : '0',
      currency: dto.currency ?? 'USD',
      notes: dto.notes ?? null,
    });
    // Pre-fetch price
    marketPriceFeedService.getPriceForHolding(dto.symbol, dto.assetType).catch(() => {});
    return holding;
  }

  async updateHolding(userId: string, holdingId: string, dto: Partial<CreateHoldingDTO>) {
    const existing = await investmentRepository.findHoldingById(holdingId, userId);
    if (!existing) throw new Error('Holding not found');
    return investmentRepository.updateHolding(holdingId, userId, {
      name: dto.name,
      currency: dto.currency,
      notes: dto.notes,
    });
  }

  async deleteHolding(userId: string, holdingId: string) {
    const existing = await investmentRepository.findHoldingById(holdingId, userId);
    if (!existing) throw new Error('Holding not found');
    return investmentRepository.deleteHolding(holdingId, userId);
  }

  // ─── Trade Execution ───────────────────────────────────────────────────────

  async executeBuyOrder(userId: string, dto: BuyOrderDTO) {
    let holding = dto.holdingId
      ? await investmentRepository.findHoldingById(dto.holdingId, userId)
      : await investmentRepository.findHoldingBySymbolAndWallet(userId, dto.symbol, dto.walletId);

    if (!holding) {
      // Create a new holding
      holding = await investmentRepository.createHolding({
        userId,
        walletId: dto.walletId,
        symbol: dto.symbol,
        name: dto.name ?? dto.symbol,
        assetType: dto.assetType,
        quantity: '0',
        avgCostBasis: '0',
        currency: dto.currency ?? 'MAD',
      });
    }

    const oldQty = parseFloat(holding.quantity ?? '0');
    const oldAvg = parseFloat(holding.avgCostBasis ?? '0');
    const buyQty = dto.quantity;
    const buyPrice = dto.pricePerUnit;

    // Weighted average cost basis
    const newQty = oldQty + buyQty;
    const newAvg = newQty > 0 ? (oldQty * oldAvg + buyQty * buyPrice) / newQty : buyPrice;

    await investmentRepository.updateHolding(holding.id, userId, {
      quantity: String(newQty),
      avgCostBasis: String(newAvg),
    });

    // Create an internal transfer transaction (cash outflow from liquid wallet)
    const totalAmount = buyQty * buyPrice;
    await db.insert(transactions).values({
      userId,
      walletId: dto.walletId,
      amount: String(totalAmount),
      type: 'Expense',
      category: '📈 Investment Buy',
      notes: dto.notes ?? `Buy ${buyQty} ${dto.symbol} @ ${buyPrice} MAD`,
      createdAt: dto.date ? new Date(dto.date) : new Date(),
      investmentHoldingId: holding.id,
      investmentAction: 'Buy',
      investmentQuantity: String(buyQty),
      investmentPricePerUnit: String(buyPrice),
    });

    return investmentRepository.findHoldingById(holding.id, userId);
  }

  async executeSellOrder(userId: string, dto: SellOrderDTO) {
    const holding = await investmentRepository.findHoldingById(dto.holdingId, userId);
    if (!holding) throw new Error('Holding not found');

    const currentQty = parseFloat(holding.quantity ?? '0');
    if (dto.quantity > currentQty) throw new Error(`Insufficient quantity. Have ${currentQty}, selling ${dto.quantity}`);

    const avgCost = parseFloat(holding.avgCostBasis ?? '0');
    const realizedGainLoss = (dto.pricePerUnit - avgCost) * dto.quantity;
    const newQty = currentQty - dto.quantity;
    const proceeds = dto.quantity * dto.pricePerUnit;

    await investmentRepository.updateHolding(holding.id, userId, {
      quantity: String(newQty),
    });

    // Income transaction (cash inflow to destination wallet)
    await db.insert(transactions).values({
      userId,
      walletId: dto.walletId,
      amount: String(proceeds),
      type: 'Income',
      category: '📉 Investment Sale',
      notes: dto.notes ?? `Sell ${dto.quantity} ${holding.symbol} @ ${dto.pricePerUnit} MAD`,
      createdAt: dto.date ? new Date(dto.date) : new Date(),
      investmentHoldingId: holding.id,
      investmentAction: 'Sell',
      investmentQuantity: String(dto.quantity),
      investmentPricePerUnit: String(dto.pricePerUnit),
      investmentRealizedGainLoss: String(realizedGainLoss),
    });

    return {
      updatedHolding: await investmentRepository.findHoldingById(holding.id, userId),
      realizedGainLoss,
      proceeds,
    };
  }

  async recordDividend(userId: string, dto: DividendDTO) {
    const holding = await investmentRepository.findHoldingById(dto.holdingId, userId);
    if (!holding) throw new Error('Holding not found');

    await db.insert(transactions).values({
      userId,
      walletId: dto.walletId,
      amount: String(dto.amount),
      type: 'Income',
      category: '💰 Dividends & Yield',
      notes: dto.notes ?? `Dividend from ${holding.symbol}`,
      createdAt: dto.date ? new Date(dto.date) : new Date(),
      investmentHoldingId: holding.id,
      investmentAction: 'Dividend',
    });

    return { success: true, amount: dto.amount };
  }

  async recordStakingYield(userId: string, dto: StakingDTO) {
    const holding = await investmentRepository.findHoldingById(dto.holdingId, userId);
    if (!holding) throw new Error('Holding not found');

    const yieldQty = dto.quantity ?? 0;
    const yieldAmount = dto.amount ?? (yieldQty * (dto.pricePerUnit ?? 0));

    // Add yield quantity to holding
    if (yieldQty > 0) {
      const currentQty = parseFloat(holding.quantity ?? '0');
      await investmentRepository.updateHolding(holding.id, userId, {
        quantity: String(currentQty + yieldQty),
      });
    }

    await db.insert(transactions).values({
      userId,
      walletId: dto.walletId,
      amount: String(yieldAmount),
      type: 'Income',
      category: '🌱 Staking Yield',
      notes: dto.notes ?? `Staking yield from ${holding.symbol}`,
      createdAt: dto.date ? new Date(dto.date) : new Date(),
      investmentHoldingId: holding.id,
      investmentAction: 'Staking',
      investmentQuantity: yieldQty > 0 ? String(yieldQty) : null,
    });

    return { success: true, quantityAdded: yieldQty, amountMad: yieldAmount };
  }

  // ─── Manual Prices ─────────────────────────────────────────────────────────

  async updateManualPrice(symbol: string, assetType: string, priceUsd: number) {
    await marketPriceFeedService.setManualPrice(symbol, assetType, priceUsd);
    return { success: true };
  }

  async refreshPrices(userId: string) {
    const holdings = await investmentRepository.findHoldingsByUserId(userId);
    const unique = new Map<string, string>();
    for (const h of holdings) unique.set(`${h.symbol}:${h.assetType}`, h.assetType);

    const results: Record<string, any> = {};
    for (const [key, assetType] of unique.entries()) {
      const symbol = key.split(':')[0];
      const price = await marketPriceFeedService.getPriceForHolding(symbol, assetType).catch(() => null);
      results[symbol] = price;
    }
    return results;
  }

  // ─── DCA Plans ─────────────────────────────────────────────────────────────

  async getDcaPlans(userId: string) {
    return investmentRepository.findDcaPlansByUserId(userId);
  }

  async createDcaPlan(userId: string, dto: any) {
    return investmentRepository.createDcaPlan({ userId, ...dto });
  }

  async updateDcaPlan(userId: string, planId: string, dto: any) {
    const existing = await investmentRepository.findDcaPlanById(planId, userId);
    if (!existing) throw new Error('DCA plan not found');
    return investmentRepository.updateDcaPlan(planId, userId, dto);
  }

  async deleteDcaPlan(userId: string, planId: string) {
    const existing = await investmentRepository.findDcaPlanById(planId, userId);
    if (!existing) throw new Error('DCA plan not found');
    return investmentRepository.deleteDcaPlan(planId, userId);
  }

  // ─── Net Worth History ─────────────────────────────────────────────────────

  async getNetWorthHistory(userId: string, period: '6m' | '1y' | 'all') {
    const days = period === '6m' ? 180 : period === '1y' ? 365 : 99999;
    return investmentRepository.getNetWorthHistory(userId, days);
  }

  // ─── Safe-to-Invest ────────────────────────────────────────────────────────

  async computeSafeToInvest(kpiData: any, transactions: any[]): Promise<SafeToInvestBreakdown> {
    const salary = parseFloat(kpiData?.salary ?? '0') || 0;
    const emergencyBuffer = parseFloat(kpiData?.emergencyBuffer ?? '0') || 0;

    // Compute fixed bills from this month's expense transactions
    const now = new Date();
    const thisMonthTxs = transactions.filter((tx: any) => {
      if (tx.type !== 'Expense') return false;
      const d = new Date(tx.createdAt);
      return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
    });

    const fixedCategories = [
      '🔌 Utilities & Bills', '🏠 Rent & Housing', '📡 Internet & Mobile',
      '💳 Debt & Obligations', '🏦 Insurance', 'Loan', 'Debt Repayment',
    ];
    const groceryCategories = ['🛒 Groceries'];

    let fixedBills = 0;
    let groceries = 0;
    for (const tx of thisMonthTxs) {
      const amt = parseFloat(tx.amount ?? '0');
      if (fixedCategories.some(c => (tx.category ?? '').includes(c.split(' ')[1]))) {
        fixedBills += amt;
      } else if (groceryCategories.some(c => tx.category === c)) {
        groceries += amt;
      }
    }

    const loans = parseFloat(kpiData?.pendingPayables ?? '0') || 0;
    const avgDailyVar = parseFloat(kpiData?.avgDailyVariableSpend ?? '0') || 0;
    const daysRemaining = kpiData?.forecast?.daysRemaining ?? 0;
    const projectedCashNeeds = avgDailyVar * daysRemaining;

    const safeToInvest = Math.max(
      0,
      salary - fixedBills - loans - groceries - emergencyBuffer - projectedCashNeeds,
    );

    return { salary, fixedBills, loans, groceries, emergencyBuffer, projectedCashNeeds, safeToInvest };
  }
}

export const investmentService = new InvestmentService();
