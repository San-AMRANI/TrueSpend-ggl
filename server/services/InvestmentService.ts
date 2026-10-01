import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { investmentEvents, investmentLots, investmentLotDisposals, transactions } from '../../src/db/schema.js';
import type { InvestmentAccount, InvestmentAsset, InvestmentEvent, PortfolioSummary, RiskLevel } from '../../src/types/index.js';
import { investmentRepository } from '../repositories/InvestmentRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';

const number = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const riskLevels: RiskLevel[] = ['Low', 'Medium', 'High', 'VeryHigh'];

export interface CreateInvestmentEventInput {
  investmentAccountId: string;
  assetId?: string | null;
  type: InvestmentEvent['type'];
  tradeDate?: string;
  units?: number;
  unitPrice?: number;
  quoteCurrency?: string;
  grossAmount: number;
  feeAmount?: number;
  feeCurrency?: string;
  exchangeRateToBase?: number;
  notes?: string;
  linkedTransactionId?: string | null;
}

export class InvestmentService {
  async listAccounts(userId: string) { return investmentRepository.accounts(userId); }
  async listAssets(userId: string) { return investmentRepository.assets(userId); }
  async listEvents(userId: string) { return investmentRepository.events(userId); }

  async createAccount(userId: string, input: Omit<InvestmentAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived'>) {
    if (!input.name?.trim()) throw new Error('Investment account name is required.');
    if (!['Exchange', 'Brokerage', 'Retirement', 'PreciousMetals', 'Manual', 'Other'].includes(input.type)) throw new Error('Invalid investment account type.');
    if (!['Liquid', 'Restricted', 'Illiquid'].includes(input.liquidity)) throw new Error('Invalid liquidity profile.');
    if (input.includeInEmergencyReserve && input.liquidity !== 'Liquid') throw new Error('Only a liquid, cash-like account can be included in the emergency reserve.');
    return investmentRepository.createAccount({ userId, name: input.name.trim(), institution: input.institution?.trim() || null, type: input.type,
      baseCurrency: input.baseCurrency.toUpperCase(), liquidity: input.liquidity, includeInNetWorth: input.includeInNetWorth,
      includeInEmergencyReserve: input.includeInEmergencyReserve });
  }

  async updateAccount(userId: string, id: string, input: Partial<Omit<InvestmentAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
    const existing = await investmentRepository.account(id, userId);
    if (!existing) throw new Error('Investment account not found.');
    const liquidity = input.liquidity ?? existing.liquidity;
    const includeInEmergencyReserve = input.includeInEmergencyReserve ?? existing.includeInEmergencyReserve;
    if (includeInEmergencyReserve && liquidity !== 'Liquid') throw new Error('Only a liquid, cash-like account can be included in the emergency reserve.');
    return investmentRepository.updateAccount(id, userId, { ...input, baseCurrency: input.baseCurrency?.toUpperCase(), name: input.name?.trim(), institution: input.institution?.trim() || undefined });
  }

  async createAsset(userId: string, input: Omit<InvestmentAsset, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isActive'>) {
    if (!input.symbol?.trim() || !input.name?.trim()) throw new Error('Asset symbol and name are required.');
    if (!['Crypto', 'Stock', 'ETF', 'MutualFund', 'Bond', 'PreciousMetal', 'CashEquivalent', 'Retirement', 'Other'].includes(input.assetClass)) throw new Error('Invalid asset class.');
    if (!riskLevels.includes(input.riskLevel)) throw new Error('Invalid asset risk level.');
    if (input.assetClass === 'Crypto' && input.coinGeckoCoinId && !/^[a-z0-9-]+$/i.test(input.coinGeckoCoinId)) throw new Error('Invalid CoinGecko asset identifier.');
    return investmentRepository.createAsset({ userId, symbol: input.symbol.trim().toUpperCase(), name: input.name.trim(), assetClass: input.assetClass,
      coinGeckoCoinId: input.coinGeckoCoinId || null, quoteCurrency: input.quoteCurrency.toUpperCase(), unitsPrecision: input.unitsPrecision,
      riskLevel: input.riskLevel, marketDataProvider: input.coinGeckoCoinId ? 'CoinGecko' : null });
  }

  async createEvent(userId: string, input: CreateInvestmentEventInput) {
    const account = await investmentRepository.account(input.investmentAccountId, userId);
    if (!account) throw new Error('Investment account not found.');
    const type = input.type;
    const validTypes = ['Funding', 'Withdrawal', 'Buy', 'Sell', 'Dividend', 'Interest', 'Fee', 'Adjustment'];
    if (!validTypes.includes(type)) throw new Error('Invalid investment event type.');
    const grossAmount = number(input.grossAmount);
    const feeAmount = number(input.feeAmount);
    const units = input.units === undefined ? null : number(input.units);
    const unitPrice = input.unitPrice === undefined ? null : number(input.unitPrice);
    if (grossAmount < 0 || feeAmount < 0) throw new Error('Amounts cannot be negative.');
    const assetRequired = ['Buy', 'Sell'].includes(type);
    const asset = input.assetId ? await investmentRepository.asset(input.assetId, userId) : null;
    if (assetRequired && !asset) throw new Error('Buy and sell events require an asset you own.');
    if (assetRequired && (!units || units <= 0 || unitPrice === null || unitPrice < 0 || grossAmount <= 0)) throw new Error('Buy and sell events require positive units and gross amount, plus a non-negative execution price.');
    if (type === 'Fee' && grossAmount <= 0 && feeAmount <= 0) throw new Error('A fee event must have a positive amount.');
    if (['Funding', 'Withdrawal'].includes(type) && grossAmount <= 0) throw new Error('Funding and withdrawal amounts must be positive.');
    const rate = number(input.exchangeRateToBase || 1) || 1;
    // Buy fees are capitalized into cost basis. Account-level fees are a cash
    // outflow in their own right, so a fee-only event keeps its actual amount.
    const baseAmount = money((type === 'Fee' ? Math.max(grossAmount, feeAmount) : grossAmount + (type === 'Buy' ? feeAmount : 0)) * rate);

    const eventValues = { userId, investmentAccountId: account.id, assetId: asset?.id || null, type,
      tradeDate: input.tradeDate ? new Date(input.tradeDate) : new Date(), units: units === null ? null : String(units),
      unitPrice: unitPrice === null ? null : String(unitPrice), quoteCurrency: (input.quoteCurrency || account.baseCurrency).toUpperCase(),
      grossAmount: String(grossAmount), feeAmount: String(feeAmount), feeCurrency: (input.feeCurrency || account.baseCurrency).toUpperCase(),
      exchangeRateToBase: String(rate), baseAmount: String(baseAmount), linkedTransactionId: input.linkedTransactionId || null, notes: input.notes?.trim() || null };
    if (type === 'Sell' && asset && units) return this.createSellWithFifoDisposals(userId, account.id, asset.id, units, grossAmount, feeAmount, rate, eventValues);
    const result = await investmentRepository.createEvent(eventValues, type === 'Buy' && asset && units ? { userId, investmentAccountId: account.id, assetId: asset.id, acquiredAt: input.tradeDate ? new Date(input.tradeDate) : new Date(),
      originalUnits: String(units), remainingUnits: String(units), costBasisBase: String(baseAmount) } : undefined);
    return result.event;
  }

  private async createSellWithFifoDisposals(
    userId: string, accountId: string, assetId: string, unitsToSell: number, grossAmount: number, feeAmount: number, rate: number,
    eventValues: typeof investmentEvents.$inferInsert,
  ) {
    return db.transaction(async (tx) => {
      const lots = await tx.select().from(investmentLots).where(and(eq(investmentLots.userId, userId), eq(investmentLots.investmentAccountId, accountId), eq(investmentLots.assetId, assetId))).orderBy(asc(investmentLots.acquiredAt));
    const available = lots.reduce((sum, lot) => sum + number(lot.remainingUnits), 0);
    if (available + 1e-8 < unitsToSell) throw new Error('Cannot sell more units than are held in this account.');
      const event = (await tx.insert(investmentEvents).values(eventValues).returning())[0];
      const netProceeds = money((grossAmount - feeAmount) * rate);
    let remaining = unitsToSell;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const used = Math.min(remaining, number(lot.remainingUnits));
        const costBasis = money(number(lot.costBasisBase) * used / number(lot.originalUnits));
        const proceeds = money(netProceeds * used / unitsToSell);
        await tx.update(investmentLots).set({ remainingUnits: String(number(lot.remainingUnits) - used), updatedAt: new Date() }).where(eq(investmentLots.id, lot.id));
        await tx.insert(investmentLotDisposals).values({ userId, investmentEventId: event.id, investmentLotId: lot.id, units: String(used), costBasisBase: String(costBasis), proceedsBase: String(proceeds) });
      remaining -= used;
    }
      return event;
    });
  }

  async recordManualPrice(userId: string, assetId: string, price: number, currency: string, capturedAt?: string) {
    const asset = await investmentRepository.asset(assetId, userId);
    if (!asset) throw new Error('Investment asset not found.');
    if (!Number.isFinite(price) || price < 0) throw new Error('Price must be zero or greater.');
    return investmentRepository.createPrice({ assetId, userId, price: String(price), currency: currency.toUpperCase(), exchangeRateToBase: '1',
      priceInBase: String(price), source: 'Manual', capturedAt: capturedAt ? new Date(capturedAt) : new Date() });
  }

  async fundAccount(userId: string, accountId: string, sourceWalletId: string, amount: number, date?: string, note?: string) {
    const account = await investmentRepository.account(accountId, userId);
    const wallet = await walletRepository.findById(sourceWalletId, userId);
    if (!account || !wallet) throw new Error('Investment account or source wallet was not found.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Funding amount must be greater than zero.');
    return db.transaction(async (tx) => {
      const cashTransfer = (await tx.insert(transactions).values({ userId, walletId: wallet.id, amount: String(amount), type: 'Transfer',
        category: 'Investment Funding', notes: `[Investment funding] ${account.name}`, createdAt: date ? new Date(date) : new Date() }).returning())[0];
      const event = (await tx.insert(investmentEvents).values({ userId, investmentAccountId: account.id, type: 'Funding', tradeDate: date ? new Date(date) : new Date(),
        quoteCurrency: account.baseCurrency, grossAmount: String(amount), feeAmount: '0', feeCurrency: account.baseCurrency,
        exchangeRateToBase: '1', baseAmount: String(amount), linkedTransactionId: cashTransfer.id, notes: note?.trim() || null }).returning())[0];
      return { event, transaction: cashTransfer };
    });
  }

  async withdrawAccount(userId: string, accountId: string, destinationWalletId: string, amount: number, date?: string, note?: string) {
    const account = await investmentRepository.account(accountId, userId);
    const wallet = await walletRepository.findById(destinationWalletId, userId);
    if (!account || !wallet) throw new Error('Investment account or destination wallet was not found.');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Withdrawal amount must be greater than zero.');
    const accountEvents = (await this.listEvents(userId)).filter((event) => event.investmentAccountId === account.id);
    const availableCash = money(accountEvents.reduce((cash, event) => {
      const amountInBase = number(event.baseAmount);
      const feeInBase = number(event.feeAmount) * number(event.exchangeRateToBase || '1');
      if (event.type === 'Funding' || event.type === 'Sell' || event.type === 'Dividend' || event.type === 'Interest') return cash + amountInBase - (event.type === 'Sell' || event.type === 'Dividend' || event.type === 'Interest' ? feeInBase : 0);
      if (event.type === 'Withdrawal' || event.type === 'Buy' || event.type === 'Fee') return cash - amountInBase;
      return cash;
    }, 0));
    if (amount > availableCash + 0.01) throw new Error(`Withdrawal exceeds available investment-account cash (${availableCash.toFixed(2)} ${account.baseCurrency}). Record a sale or funding first.`);
    return db.transaction(async (tx) => {
      const cashTransfer = (await tx.insert(transactions).values({ userId, walletId: wallet.id, amount: String(amount), type: 'Transfer',
        category: 'Investment Withdrawal', notes: `[Investment withdrawal] ${account.name}`, createdAt: date ? new Date(date) : new Date() }).returning())[0];
      const event = (await tx.insert(investmentEvents).values({ userId, investmentAccountId: account.id, type: 'Withdrawal', tradeDate: date ? new Date(date) : new Date(),
        quoteCurrency: account.baseCurrency, grossAmount: String(amount), feeAmount: '0', feeCurrency: account.baseCurrency,
        exchangeRateToBase: '1', baseAmount: String(amount), linkedTransactionId: cashTransfer.id, notes: note?.trim() || null }).returning())[0];
      return { event, transaction: cashTransfer };
    });
  }

  async portfolio(userId: string, baseCurrency = 'MAD'): Promise<PortfolioSummary> {
    const [accounts, assets, events, lots, disposals] = await Promise.all([this.listAccounts(userId), this.listAssets(userId), this.listEvents(userId), investmentRepository.lots(userId), investmentRepository.disposals(userId)]);
    const activeAccounts = accounts.filter((account) => !account.isArchived);
    const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
    const accountMap = new Map(activeAccounts.map((account) => [account.id, account]));
    const activeLots = lots.filter((lot) => accountMap.has(lot.investmentAccountId) && number(lot.remainingUnits) > 0);
    const prices = new Map((await investmentRepository.latestPrices([...new Set(activeLots.map((lot) => lot.assetId))])).map((price) => [price.assetId, price]));
    const grouped = new Map<string, { units: number; costBasis: number; accountId: string }>();
    for (const lot of activeLots) {
      const key = `${lot.investmentAccountId}:${lot.assetId}`;
      const prior = grouped.get(key) || { units: 0, costBasis: 0, accountId: lot.investmentAccountId };
      const fraction = number(lot.originalUnits) ? number(lot.remainingUnits) / number(lot.originalUnits) : 0;
      grouped.set(key, { ...prior, units: prior.units + number(lot.remainingUnits), costBasis: prior.costBasis + number(lot.costBasisBase) * fraction });
    }
    const holdings = [...grouped.entries()].flatMap(([key, holding]) => {
      const assetId = key.split(':')[1]; const asset = assetMap.get(assetId); if (!asset) return [];
      const latest = prices.get(assetId); const latestPrice = latest ? number(latest.priceInBase) : undefined;
      const marketValue = latestPrice === undefined ? holding.costBasis : holding.units * latestPrice;
      return [{ accountId: holding.accountId, asset: { ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString() }, units: holding.units,
        costBasis: money(holding.costBasis), marketValue: money(marketValue), unrealizedGain: money(marketValue - holding.costBasis),
        latestPrice, priceAsOf: latest?.capturedAt?.toISOString() }];
    });
    const accountCash = new Map(activeAccounts.map((account) => [account.id, 0]));
    let totalContributions = 0;
    for (const event of events.filter((event) => accountMap.has(event.investmentAccountId))) {
      const eventAmount = number(event.baseAmount); const fee = number(event.feeAmount) * number(event.exchangeRateToBase || '1');
      const prior = accountCash.get(event.investmentAccountId) || 0;
      if (event.type === 'Funding') { accountCash.set(event.investmentAccountId, prior + eventAmount); totalContributions += eventAmount; }
      if (event.type === 'Withdrawal') { accountCash.set(event.investmentAccountId, prior - eventAmount); totalContributions -= eventAmount; }
      if (event.type === 'Buy' || event.type === 'Fee') accountCash.set(event.investmentAccountId, prior - eventAmount);
      if (event.type === 'Sell' || event.type === 'Dividend' || event.type === 'Interest') accountCash.set(event.investmentAccountId, prior + eventAmount - fee);
    }
    const holdingValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
    const cashValue = [...accountCash.values()].reduce((sum, value) => sum + value, 0);
    const marketValue = money(holdingValue + cashValue);
    const includedHoldingValue = holdings.filter((holding) => accountMap.get(holding.accountId)?.includeInNetWorth).reduce((sum, holding) => sum + holding.marketValue, 0);
    const includedCashValue = [...accountCash.entries()].filter(([accountId]) => accountMap.get(accountId)?.includeInNetWorth).reduce((sum, [, cash]) => sum + cash, 0);
    const includedInNetWorthValue = money(includedHoldingValue + includedCashValue);
    const costBasis = money(holdings.reduce((sum, holding) => sum + holding.costBasis, 0));
    const byClass = new Map<string, number>(); const byAccount = new Map<string, number>(); const byRisk = new Map<RiskLevel, number>();
    for (const holding of holdings) {
      byClass.set(holding.asset.assetClass, (byClass.get(holding.asset.assetClass) || 0) + holding.marketValue);
      byAccount.set(accountMap.get(holding.accountId)?.name || 'Unknown', (byAccount.get(accountMap.get(holding.accountId)?.name || 'Unknown') || 0) + holding.marketValue);
      byRisk.set(holding.asset.riskLevel, (byRisk.get(holding.asset.riskLevel) || 0) + holding.marketValue);
    }
    for (const [accountId, value] of accountCash) if (value) byAccount.set(accountMap.get(accountId)?.name || 'Unknown', (byAccount.get(accountMap.get(accountId)?.name || 'Unknown') || 0) + value);
    const distribution = (values: Map<string, number>) => [...values.entries()].map(([name, value]) => ({ name, value: money(value), percent: marketValue ? money(value * 100 / marketValue) : 0 }));
    const dates = [...prices.values()].map((price) => price.capturedAt.getTime());
    const age = dates.length ? Date.now() - Math.max(...dates) : Infinity;
    const realizedGain = money(disposals.reduce((sum, disposal) => sum + number(disposal.proceedsBase) - number(disposal.costBasisBase), 0));
    return { baseCurrency, marketValue, includedInNetWorthValue, totalContributions: money(totalContributions), costBasis, unrealizedGain: money(holdingValue - costBasis),
      realizedGain, totalReturn: money(marketValue - totalContributions), totalReturnPercent: totalContributions ? money((marketValue - totalContributions) * 100 / totalContributions) : 0,
      holdings, allocationByAssetClass: distribution(byClass), allocationByAccount: distribution(byAccount),
      riskConcentration: [...byRisk.entries()].map(([risk, value]) => ({ risk, value: money(value), percent: marketValue ? money(value * 100 / marketValue) : 0 })),
      priceFreshness: prices.size === 0 ? 'unavailable' : age > 15 * 60_000 ? 'stale' : 'fresh' };
  }
}

export const investmentService = new InvestmentService();
