import { investmentRepository } from '../repositories/InvestmentRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { subscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { kpiService } from './KpiService.js';
import { userRepository } from '../repositories/UserRepository.js';
import type {
  StockCatalogItem,
  StockMarketType,
  StockOrderAction,
} from '../../src/types/index.js';

export const CURATED_STOCK_CATALOG: Omit<StockCatalogItem, 'priceInMad' | 'inPortfolio' | 'inWatchlist'>[] = [
  // US Compounders & Tech Leaders
  {
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    market: 'US',
    sector: 'Semiconductors & AI',
    price: 138.6,
    change24hPercent: 2.15,
    currency: 'USD',
    annualDividendPerShare: 0.04,
    dividendYieldPercent: 0.03,
    thesis: 'Dominant accelerated computing and AI data center infrastructure platform',
  },
  {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    market: 'US',
    sector: 'Technology',
    price: 231.4,
    change24hPercent: 0.85,
    currency: 'USD',
    annualDividendPerShare: 1.0,
    dividendYieldPercent: 0.43,
    thesis: 'Global consumer hardware ecosystem with high-margin recurring services cash flow',
  },
  {
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    market: 'US',
    sector: 'Cloud & Enterprise',
    price: 428.5,
    change24hPercent: 1.12,
    currency: 'USD',
    annualDividendPerShare: 3.32,
    dividendYieldPercent: 0.77,
    thesis: 'Enterprise cloud (Azure) & productivity compounder with durable dividend growth',
  },
  {
    ticker: 'GOOGL',
    companyName: 'Alphabet Inc.',
    market: 'US',
    sector: 'Internet & Cloud',
    price: 182.9,
    change24hPercent: 1.4,
    currency: 'USD',
    annualDividendPerShare: 0.8,
    dividendYieldPercent: 0.44,
    thesis: 'Global search, YouTube, and cloud leader trading at an attractive cash-flow multiple',
  },
  {
    ticker: 'AMZN',
    companyName: 'Amazon.com Inc.',
    market: 'US',
    sector: 'Cloud & E-Commerce',
    price: 210.3,
    change24hPercent: 1.65,
    currency: 'USD',
    annualDividendPerShare: 0,
    dividendYieldPercent: 0,
    thesis: 'AWS cloud backbone paired with high-margin advertising and global logistics',
  },
  {
    ticker: 'META',
    companyName: 'Meta Platforms Inc.',
    market: 'US',
    sector: 'Digital Advertising',
    price: 592.0,
    change24hPercent: 0.92,
    currency: 'USD',
    annualDividendPerShare: 2.0,
    dividendYieldPercent: 0.34,
    thesis: '3B+ daily active users with AI-driven ad monetization efficiency',
  },
  {
    ticker: 'AVGO',
    companyName: 'Broadcom Inc.',
    market: 'US',
    sector: 'Semiconductors & AI',
    price: 176.8,
    change24hPercent: 1.9,
    currency: 'USD',
    annualDividendPerShare: 2.12,
    dividendYieldPercent: 1.2,
    thesis: 'Custom AI silicon accelerators, networking infrastructure, and enterprise software',
  },
  {
    ticker: 'BRK-B',
    companyName: 'Berkshire Hathaway',
    market: 'US',
    sector: 'Financials & Holdings',
    price: 456.2,
    change24hPercent: 0.45,
    currency: 'USD',
    annualDividendPerShare: 0,
    dividendYieldPercent: 0,
    thesis: 'Fortress balance sheet and diversified operating businesses compounder',
  },
  {
    ticker: 'COST',
    companyName: 'Costco Wholesale',
    market: 'US',
    sector: 'Consumer Staples',
    price: 912.0,
    change24hPercent: 0.6,
    currency: 'USD',
    annualDividendPerShare: 4.64,
    dividendYieldPercent: 0.51,
    thesis: 'Membership-driven retail moat with industry-leading renewal rates',
  },
  {
    ticker: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    market: 'US',
    sector: 'Financials',
    price: 234.5,
    change24hPercent: 0.78,
    currency: 'USD',
    annualDividendPerShare: 5.0,
    dividendYieldPercent: 2.13,
    thesis: 'Tier-1 US money center bank with strong dividend yield and capital returns',
  },

  // Core Index & Dividend ETFs
  {
    ticker: 'VOO',
    companyName: 'Vanguard S&P 500 ETF',
    market: 'ETF',
    sector: 'S&P 500 Index',
    price: 538.4,
    change24hPercent: 0.72,
    currency: 'USD',
    annualDividendPerShare: 6.75,
    dividendYieldPercent: 1.25,
    thesis: 'Ultra-low-cost core exposure to the 500 largest US public companies',
  },
  {
    ticker: 'QQQ',
    companyName: 'Invesco Nasdaq-100 ETF',
    market: 'ETF',
    sector: 'Nasdaq-100 Growth',
    price: 504.2,
    change24hPercent: 1.18,
    currency: 'USD',
    annualDividendPerShare: 2.85,
    dividendYieldPercent: 0.57,
    thesis: 'High-conviction index of the top 100 non-financial Nasdaq innovators',
  },
  {
    ticker: 'SCHD',
    companyName: 'Schwab US Dividend Equity ETF',
    market: 'ETF',
    sector: 'Dividend Growth ETF',
    price: 28.9,
    change24hPercent: 0.38,
    currency: 'USD',
    annualDividendPerShare: 1.02,
    dividendYieldPercent: 3.53,
    thesis: '100 high-cash-flow US dividend payers with 10+ years of consecutive payouts',
  },
  {
    ticker: 'VTI',
    companyName: 'Vanguard Total Stock Market ETF',
    market: 'ETF',
    sector: 'Total US Market',
    price: 291.6,
    change24hPercent: 0.68,
    currency: 'USD',
    annualDividendPerShare: 3.68,
    dividendYieldPercent: 1.26,
    thesis: 'Complete US equity market coverage across large, mid, and small-cap stocks',
  },

  // Casablanca Stock Exchange (BVC Morocco)
  {
    ticker: 'ATW',
    companyName: 'Attijariwafa Bank',
    market: 'BVC',
    sector: 'Financials (Morocco)',
    price: 545.0,
    change24hPercent: 0.95,
    currency: 'MAD',
    annualDividendPerShare: 19.5,
    dividendYieldPercent: 3.58,
    thesis: 'Leading pan-African banking group and blue-chip Casablanca dividend anchor',
  },
  {
    ticker: 'IAM',
    companyName: 'Maroc Telecom (Itissalat Al-Maghrib)',
    market: 'BVC',
    sector: 'Telecom (Morocco)',
    price: 96.5,
    change24hPercent: 0.42,
    currency: 'MAD',
    annualDividendPerShare: 4.2,
    dividendYieldPercent: 4.35,
    thesis: 'High-yield telecommunications operator across Morocco and West Africa',
  },
  {
    ticker: 'BCP',
    companyName: 'Banque Centrale Populaire',
    market: 'BVC',
    sector: 'Financials (Morocco)',
    price: 302.0,
    change24hPercent: 0.65,
    currency: 'MAD',
    annualDividendPerShare: 11.5,
    dividendYieldPercent: 3.81,
    thesis: 'Core Moroccan retail and cooperative banking institution',
  },
  {
    ticker: 'TGCC',
    companyName: 'TGCC Construction',
    market: 'BVC',
    sector: 'Infrastructure (Morocco)',
    price: 415.0,
    change24hPercent: 1.85,
    currency: 'MAD',
    annualDividendPerShare: 9.5,
    dividendYieldPercent: 2.29,
    thesis: 'Direct beneficiary of Morocco 2030 stadium, hospitality, and infrastructure buildout',
  },
  {
    ticker: 'AKD',
    companyName: 'Akdital Healthcare Group',
    market: 'BVC',
    sector: 'Healthcare (Morocco)',
    price: 1020.0,
    change24hPercent: 1.5,
    currency: 'MAD',
    annualDividendPerShare: 12.0,
    dividendYieldPercent: 1.18,
    thesis: 'Fast-expanding private clinic and hospital network across Moroccan cities',
  },
  {
    ticker: 'LHM',
    companyName: 'LafargeHolcim Maroc',
    market: 'BVC',
    sector: 'Materials (Morocco)',
    price: 1890.0,
    change24hPercent: 0.35,
    currency: 'MAD',
    annualDividendPerShare: 66.0,
    dividendYieldPercent: 3.49,
    thesis: 'Dominant cement and construction materials supplier with steady cash dividends',
  },
  {
    ticker: 'TQM',
    companyName: 'Taqa Morocco',
    market: 'BVC',
    sector: 'Utilities (Morocco)',
    price: 1340.0,
    change24hPercent: 0.55,
    currency: 'MAD',
    annualDividendPerShare: 48.0,
    dividendYieldPercent: 3.58,
    thesis: 'Predictable utility cash flows and consistent dividend distribution',
  },
  {
    ticker: 'MNG',
    companyName: 'Managem Mining',
    market: 'BVC',
    sector: 'Metals & Mining (Morocco)',
    price: 2580.0,
    change24hPercent: 1.75,
    currency: 'MAD',
    annualDividendPerShare: 40.0,
    dividendYieldPercent: 1.55,
    thesis: 'Gold, copper, silver, and critical battery metals producer across Africa',
  },
];

let cachedRates = {
  USD_TO_MAD: 9.95,
  EUR_TO_MAD: 10.82,
  USD_TO_EUR: 0.92,
  lastFetched: 0,
};

const quoteCache: Record<
  string,
  {
    price: number;
    change24hPercent: number;
    currency: string;
    companyName?: string;
    lastUpdated: number;
  }
> = {};

export class InvestmentService {
  async getExchangeRates(): Promise<{ USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number }> {
    const now = Date.now();
    if (now - cachedRates.lastFetched < 10 * 60 * 1000) {
      return {
        USD_TO_MAD: cachedRates.USD_TO_MAD,
        EUR_TO_MAD: cachedRates.EUR_TO_MAD,
        USD_TO_EUR: cachedRates.USD_TO_EUR,
      };
    }

    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(4500),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.rates) {
          const mad = parseFloat(data.rates.MAD) || 9.95;
          const eur = parseFloat(data.rates.EUR) || 0.92;
          cachedRates = {
            USD_TO_MAD: Math.round(mad * 1000) / 1000,
            EUR_TO_MAD: Math.round((mad / eur) * 1000) / 1000,
            USD_TO_EUR: Math.round(eur * 1000) / 1000,
            lastFetched: now,
          };
        }
      }
    } catch {
      // Keep fallback rates
    }

    return {
      USD_TO_MAD: cachedRates.USD_TO_MAD,
      EUR_TO_MAD: cachedRates.EUR_TO_MAD,
      USD_TO_EUR: cachedRates.USD_TO_EUR,
    };
  }

  toMad(amount: number, currency: string, rates: { USD_TO_MAD: number; EUR_TO_MAD: number }): number {
    const c = (currency || 'USD').toUpperCase();
    if (c === 'MAD') return amount;
    if (c === 'EUR') return amount * rates.EUR_TO_MAD;
    return amount * rates.USD_TO_MAD;
  }

  rateForCurrency(currency: string, rates: { USD_TO_MAD: number; EUR_TO_MAD: number }): number {
    const c = (currency || 'USD').toUpperCase();
    if (c === 'MAD') return 1;
    if (c === 'EUR') return rates.EUR_TO_MAD;
    return rates.USD_TO_MAD;
  }

  /**
   * Fetch live stock prices from Yahoo Finance for non-BVC tickers, with instant catalog fallback
   */
  async fetchLiveStockQuotes(
    tickers: string[]
  ): Promise<Record<string, { price: number; change24hPercent: number; currency: string; companyName?: string }>> {
    const result: Record<string, { price: number; change24hPercent: number; currency: string; companyName?: string }> = {};
    if (!tickers || tickers.length === 0) return result;

    const uniqueTickers = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)));
    const now = Date.now();

    await Promise.all(
      uniqueTickers.map(async (ticker) => {
        const cached = quoteCache[ticker];
        if (cached && now - cached.lastUpdated < 90 * 1000) {
          result[ticker] = {
            price: cached.price,
            change24hPercent: cached.change24hPercent,
            currency: cached.currency,
            companyName: cached.companyName,
          };
          return;
        }

        const catalogItem = CURATED_STOCK_CATALOG.find((c) => c.ticker === ticker);
        // If it's a Casablanca BVC stock, use catalog price directly (Yahoo doesn't index BVC reliably)
        if (catalogItem && catalogItem.market === 'BVC') {
          quoteCache[ticker] = {
            price: catalogItem.price,
            change24hPercent: catalogItem.change24hPercent,
            currency: 'MAD',
            companyName: catalogItem.companyName,
            lastUpdated: now,
          };
          result[ticker] = quoteCache[ticker];
          return;
        }

        // Query Yahoo Finance chart endpoint
        try {
          const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
          const res = await fetch(yhUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(3500),
          });
          if (res.ok) {
            const ydata = await res.json();
            const meta = ydata?.chart?.result?.[0]?.meta;
            if (meta && meta.regularMarketPrice) {
              const price = parseFloat(meta.regularMarketPrice) || 0;
              const prev = parseFloat(meta.previousClose || meta.chartPreviousClose) || price;
              const change24hPercent = prev > 0 ? ((price - prev) / prev) * 100 : 0;
              const currency = (meta.currency || catalogItem?.currency || 'USD').toUpperCase();
              const companyName = meta.longName || meta.shortName || catalogItem?.companyName || ticker;

              quoteCache[ticker] = {
                price: Math.round(price * 100) / 100,
                change24hPercent: Math.round(change24hPercent * 100) / 100,
                currency,
                companyName,
                lastUpdated: now,
              };
              result[ticker] = quoteCache[ticker];
              return;
            }
          }
        } catch {
          // Ignore network timeout and use catalog fallback if available
        }

        if (catalogItem) {
          quoteCache[ticker] = {
            price: catalogItem.price,
            change24hPercent: catalogItem.change24hPercent,
            currency: catalogItem.currency,
            companyName: catalogItem.companyName,
            lastUpdated: now,
          };
          result[ticker] = quoteCache[ticker];
        }
      })
    );

    return result;
  }

  /**
   * Search curated catalog + live Yahoo Finance stocks
   */
  async searchStocks(query: string): Promise<StockCatalogItem[]> {
    const q = (query || '').trim();
    const rates = await this.getExchangeRates();

    if (!q) {
      return CURATED_STOCK_CATALOG.map((item) => ({
        ...item,
        priceInMad: Math.round(this.toMad(item.price, item.currency, rates) * 100) / 100,
      }));
    }

    const qUpper = q.toUpperCase();
    const localMatches = CURATED_STOCK_CATALOG.filter(
      (item) =>
        item.ticker.toUpperCase().includes(qUpper) ||
        item.companyName.toUpperCase().includes(qUpper) ||
        item.sector.toUpperCase().includes(qUpper)
    ).map((item) => ({
      ...item,
      priceInMad: Math.round(this.toMad(item.price, item.currency, rates) * 100) / 100,
    }));

    try {
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = await res.json();
        const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
        const equityQuotes = quotes.filter(
          (item: any) =>
            item.symbol &&
            (item.quoteType === 'EQUITY' || item.quoteType === 'ETF') &&
            !localMatches.some((m) => m.ticker === item.symbol.toUpperCase())
        );

        const symbolsToFetch = equityQuotes.slice(0, 6).map((item: any) => String(item.symbol).toUpperCase());
        const liveMap = await this.fetchLiveStockQuotes(symbolsToFetch);

        for (const eq of equityQuotes.slice(0, 6)) {
          const sym = String(eq.symbol).toUpperCase();
          const live = liveMap[sym];
          const price = live?.price || 0;
          const currency = (live?.currency || 'USD') as 'USD' | 'MAD' | 'EUR';
          const market: StockMarketType = eq.quoteType === 'ETF' ? 'ETF' : 'US';

          localMatches.push({
            ticker: sym,
            companyName: eq.longname || eq.shortname || live?.companyName || sym,
            market,
            sector: eq.sector || (eq.quoteType === 'ETF' ? 'Index / ETF' : 'Equities'),
            price,
            change24hPercent: live?.change24hPercent || 0,
            currency,
            priceInMad: Math.round(this.toMad(price, currency, rates) * 100) / 100,
            annualDividendPerShare: 0,
            dividendYieldPercent: 0,
            thesis: `${eq.exchDisp || eq.exchange || 'Global'} listed ${eq.quoteType === 'ETF' ? 'ETF' : 'equity'}`,
          });
        }
      }
    } catch {
      // Return local matches if Yahoo search fails
    }

    return localMatches;
  }

  /**
   * Complete, deeply integrated Stock Portfolio & Buying Power payload for TrueSpend
   */
  async getInvestmentsData(userId: string) {
    const [rawPositions, orders, rates, dbUser, subscriptions] = await Promise.all([
      investmentRepository.findAllPositionsByUserId(userId),
      investmentRepository.findAllOrdersByUserId(userId),
      this.getExchangeRates(),
      userRepository.findById(userId),
      subscriptionRepository.findAllByUserId(userId),
    ]);

    // Fetch live quotes for user positions + top catalog items
    const userTickers = rawPositions.map((p) => p.ticker);
    const liveQuotes = await this.fetchLiveStockQuotes(userTickers);

    // Compute TrueSpend Buying Power from KPIs, Wallets, and Category Budgets
    let safeToSpendMad = 0;
    let investmentWalletBalanceMad = 0;
    let monthlyIncomeMad = 0;
    let monthlyInvestmentBudgetMad = 0;
    let investedThisCycleMad = 0;
    let emergencyBufferIntact = true;
    let emergencyDeficitMad = 0;
    let daysUntilPayday = 0;
    let monthlyLivingExpensesMad = 3500;
    let pendingPayablesMad = 0;
    let fixedObligationsMad = 0;
    let variableSpendPaceMad = 0;

    if (dbUser) {
      try {
        const kpis = await kpiService.getKpisForUser(dbUser);
        safeToSpendMad = Math.max(0, Math.round((kpis.safeToSpend || 0) * 100) / 100);
        investmentWalletBalanceMad = Math.max(0, Math.round((kpis.investmentReserve || 0) * 100) / 100);
        monthlyIncomeMad =
          (kpis.currentFinancialAmount && kpis.currentFinancialAmount > 0
            ? kpis.currentFinancialAmount
            : kpis.monthlyIncome || parseFloat((dbUser.salary as any) || '0') || 0);
        monthlyInvestmentBudgetMad = Math.round(((kpis as any).totalInvestmentBudget || 0) * 100) / 100;
        investedThisCycleMad = Math.round(((kpis as any).monthlyInvestmentFunded || 0) * 100) / 100;
        daysUntilPayday = kpis.daysUntilPayday || 0;
        pendingPayablesMad = Math.round((kpis.pendingPayables || 0) * 100) / 100;

        const targetBuffer = parseFloat((dbUser.emergencyBuffer as any) || '0') || 0;
        emergencyDeficitMad = Math.max(0, Math.round((targetBuffer - (kpis.emergencyBuffer || 0)) * 100) / 100);
        emergencyBufferIntact = emergencyDeficitMad <= 0;

        fixedObligationsMad = Math.round(((kpis as any).totalFixedBudget || kpis.monthlyFixedExpenses || 0) * 100) / 100;
        variableSpendPaceMad = Math.round(((kpis as any).totalVariableBudget || kpis.monthlyVariableExpenses || 0) * 100) / 100;
        const computedLiving = fixedObligationsMad + variableSpendPaceMad;
        if (computedLiving > 500) {
          monthlyLivingExpensesMad = computedLiving;
        }
      } catch (err) {
        console.warn('[InvestmentService] KPI sync notice:', (err as any)?.message);
      }
    }

    const remainingInvestmentBudgetMad =
      monthlyInvestmentBudgetMad > 0
        ? Math.max(0, Math.round((monthlyInvestmentBudgetMad - investedThisCycleMad) * 100) / 100)
        : 0;

    // Deployable surplus is dedicated Investment Wallet cash + safe portion of Safe-to-Spend
    const safeSurplusFromChecking =
      monthlyInvestmentBudgetMad > 0
        ? Math.min(remainingInvestmentBudgetMad, safeToSpendMad)
        : Math.round(safeToSpendMad * 0.5 * 100) / 100;

    const deployableSurplusMad = Math.max(
      0,
      Math.round((investmentWalletBalanceMad + safeSurplusFromChecking) * 100) / 100
    );
    const deployableSurplusUsd = Math.round((deployableSurplusMad / rates.USD_TO_MAD) * 100) / 100;

    let guidanceText = '';
    if (!emergencyBufferIntact) {
      guidanceText = `Your emergency buffer is ${emergencyDeficitMad.toLocaleString()} MAD below target. Consider topping up your Savings vault before adding aggressive stock positions.`;
    } else if (deployableSurplusMad > 0) {
      guidanceText =
        monthlyInvestmentBudgetMad > 0
          ? `You have ${deployableSurplusMad.toLocaleString()} MAD ($${deployableSurplusUsd.toLocaleString()}) ready to deploy into stocks this cycle while keeping your daily allowance and emergency buffer 100% protected.`
          : `Based on your live TrueSpend cash flow, you can safely deploy up to ${deployableSurplusMad.toLocaleString()} MAD ($${deployableSurplusUsd.toLocaleString()}) into equities without impacting your daily allowance.`;
    } else {
      guidanceText = `Your liquid cash is currently reserved for this cycle's living expenses. Fund an Investment Wallet or wait for your next payday in ${daysUntilPayday} days.`;
    }

    // Separate active holdings from radar/watchlist-only items
    let totalPortfolioValueMad = 0;
    let totalCostBasisMad = 0;
    let annualPassiveIncomeMad = 0;

    const enrichedAll = rawPositions.map((pos) => {
      const ticker = pos.ticker.toUpperCase();
      const live = liveQuotes[ticker];
      const catalogItem = CURATED_STOCK_CATALOG.find((c) => c.ticker === ticker);

      const sharesNum = Math.max(0, parseFloat(pos.shares || '0') || 0);
      const avgCostNum = Math.max(0, parseFloat(pos.avgCostPerShare || '0') || 0);
      const currentPriceNum =
        live?.price ||
        parseFloat(pos.currentPrice || '0') ||
        catalogItem?.price ||
        avgCostNum;
      const change24hPercent =
        live?.change24hPercent ?? catalogItem?.change24hPercent ?? 0;

      const currency = (pos.currency || live?.currency || catalogItem?.currency || 'USD').toUpperCase();
      const costBasisNative = sharesNum * avgCostNum;
      const marketValueNative = sharesNum * currentPriceNum;
      const unrealizedPnlNative = marketValueNative - costBasisNative;
      const unrealizedPnlPercent =
        costBasisNative > 0 ? (unrealizedPnlNative / costBasisNative) * 100 : 0;

      const costBasisMad = this.toMad(costBasisNative, currency, rates);
      const marketValueMad = this.toMad(marketValueNative, currency, rates);
      const unrealizedPnlMad = marketValueMad - costBasisMad;

      const divPerShare =
        parseFloat(pos.annualDividendPerShare || '0') ||
        catalogItem?.annualDividendPerShare ||
        0;
      const annualDividendNative = sharesNum * divPerShare;
      const annualDividendMad = this.toMad(annualDividendNative, currency, rates);
      const dividendYieldPercent =
        currentPriceNum > 0
          ? (divPerShare / currentPriceNum) * 100
          : catalogItem?.dividendYieldPercent || 0;

      const oneShareMad = this.toMad(currentPriceNum, currency, rates);
      const affordableSharesFromSurplus =
        oneShareMad > 0
          ? Math.floor((deployableSurplusMad / oneShareMad) * 100) / 100
          : 0;

      const isWatchlistOnly = Boolean(pos.isWatchlistOnly) || sharesNum <= 0;

      if (!isWatchlistOnly) {
        totalPortfolioValueMad += marketValueMad;
        totalCostBasisMad += costBasisMad;
        annualPassiveIncomeMad += annualDividendMad;
      }

      return {
        ...pos,
        ticker,
        market: (pos.market || catalogItem?.market || 'US') as StockMarketType,
        sector: pos.sector || catalogItem?.sector || 'Equities',
        currentPrice: currentPriceNum.toFixed(2),
        currency,
        annualDividendPerShare: divPerShare.toString(),
        isWatchlistOnly,
        sharesNum,
        avgCostNum,
        currentPriceNum,
        change24hPercent: Math.round(change24hPercent * 100) / 100,
        costBasisNative: Math.round(costBasisNative * 100) / 100,
        marketValueNative: Math.round(marketValueNative * 100) / 100,
        unrealizedPnlNative: Math.round(unrealizedPnlNative * 100) / 100,
        unrealizedPnlPercent: Math.round(unrealizedPnlPercent * 100) / 100,
        costBasisMad: Math.round(costBasisMad * 100) / 100,
        marketValueMad: Math.round(marketValueMad * 100) / 100,
        unrealizedPnlMad: Math.round(unrealizedPnlMad * 100) / 100,
        actualWeightPercent: 0, // computed below once totalPortfolioValueMad is known
        annualDividendNative: Math.round(annualDividendNative * 100) / 100,
        annualDividendMad: Math.round(annualDividendMad * 100) / 100,
        dividendYieldPercent: Math.round(dividendYieldPercent * 100) / 100,
        affordableSharesFromSurplus,
      };
    });

    // Compute actual portfolio weights
    const activePositions = enrichedAll
      .filter((p) => !p.isWatchlistOnly && p.sharesNum > 0)
      .map((p) => ({
        ...p,
        actualWeightPercent:
          totalPortfolioValueMad > 0
            ? Math.round((p.marketValueMad / totalPortfolioValueMad) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.marketValueMad - a.marketValueMad);

    const watchlistPositions = enrichedAll.filter((p) => p.isWatchlistOnly || p.sharesNum <= 0);

    // Sector & Market Breakdown
    const sectorMap: Record<string, number> = {};
    const marketMap: Record<string, number> = {};
    for (const pos of activePositions) {
      sectorMap[pos.sector] = (sectorMap[pos.sector] || 0) + pos.marketValueMad;
      marketMap[pos.market] = (marketMap[pos.market] || 0) + pos.marketValueMad;
    }

    const sectorBreakdown = Object.entries(sectorMap)
      .map(([sector, valueMad]) => ({
        sector,
        valueMad: Math.round(valueMad * 100) / 100,
        weightPercent:
          totalPortfolioValueMad > 0
            ? Math.round((valueMad / totalPortfolioValueMad) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.valueMad - a.valueMad);

    const marketBreakdown = Object.entries(marketMap)
      .map(([market, valueMad]) => ({
        market,
        valueMad: Math.round(valueMad * 100) / 100,
        weightPercent:
          totalPortfolioValueMad > 0
            ? Math.round((valueMad / totalPortfolioValueMad) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.valueMad - a.valueMad);

    // Realized P&L & Dividends collected from order history
    let totalRealizedPnlMad = 0;
    let totalDividendsCollectedMad = 0;
    for (const ord of orders) {
      if (ord.action === 'SELL') {
        totalRealizedPnlMad += parseFloat(ord.realizedPnlMad || '0') || 0;
      } else if (ord.action === 'DIVIDEND') {
        totalDividendsCollectedMad += parseFloat(ord.totalMadAmount || '0') || 0;
      }
    }

    // Monthly subscriptions burn in MAD for dividend coverage comparison
    const monthlySubsMad = subscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => {
        const amt = parseFloat(s.amount || '0') || 0;
        const madAmt = this.toMad(amt, s.currency || 'MAD', rates);
        if (s.billingCycle === 'yearly') return sum + madAmt / 12;
        if (s.billingCycle === 'quarterly') return sum + madAmt / 3;
        if (s.billingCycle === 'weekly') return sum + (madAmt * 52) / 12;
        return sum + madAmt;
      }, 0);

    const monthlyPassiveIncomeMad = annualPassiveIncomeMad / 12;
    const subscriptionCoveragePercent =
      monthlySubsMad > 0
        ? Math.min(100, Math.round((monthlyPassiveIncomeMad / monthlySubsMad) * 1000) / 10)
        : 0;
    const livingExpenseCoveragePercent =
      monthlyLivingExpensesMad > 0
        ? Math.round((monthlyPassiveIncomeMad / monthlyLivingExpensesMad) * 1000) / 10
        : 0;

    const totalUnrealizedPnlMad = totalPortfolioValueMad - totalCostBasisMad;
    const totalUnrealizedPnlPercent =
      totalCostBasisMad > 0 ? (totalUnrealizedPnlMad / totalCostBasisMad) * 100 : 0;
    const portfolioYieldPercent =
      totalPortfolioValueMad > 0 ? (annualPassiveIncomeMad / totalPortfolioValueMad) * 100 : 0;

    // Enrich catalog with portfolio/watchlist flags
    const heldSet = new Set(activePositions.map((p) => p.ticker));
    const watchSet = new Set(watchlistPositions.map((p) => p.ticker));

    const catalog: StockCatalogItem[] = CURATED_STOCK_CATALOG.map((item) => {
      const live = quoteCache[item.ticker];
      const price = live?.price || item.price;
      const change24hPercent = live?.change24hPercent ?? item.change24hPercent;
      return {
        ...item,
        price,
        change24hPercent,
        priceInMad: Math.round(this.toMad(price, item.currency, rates) * 100) / 100,
        inPortfolio: heldSet.has(item.ticker),
        inWatchlist: watchSet.has(item.ticker),
      };
    });

    // Compute per-Investment-wallet summary (Uninvested Brokerage Cash + Linked Stock Holdings)
    let investmentWallets: {
      walletId: string;
      name: string;
      type: 'Investment';
      uninvestedCashMad: number;
      investedStockValueMad: number;
      totalAccountValueMad: number;
      positionsCount: number;
    }[] = [];

    if (dbUser) {
      try {
        const kpis = await kpiService.getKpisForUser(dbUser);
        const accounts = kpis.accounts || [];
        const invAccounts = accounts.filter((a) => a.type === 'Investment');
        investmentWallets = invAccounts.map((acc, idx) => {
          const linkedPositions = activePositions.filter(
            (p) => p.walletId === acc.id || (!p.walletId && idx === 0)
          );
          const uninvestedCashMad = Math.round((acc.balance || 0) * 100) / 100;
          const investedStockValueMad = Math.round(
            linkedPositions.reduce((s, p) => s + p.marketValueMad, 0) * 100
          ) / 100;
          return {
            walletId: acc.id,
            name: acc.name,
            type: 'Investment' as const,
            uninvestedCashMad,
            investedStockValueMad,
            totalAccountValueMad: Math.round((uninvestedCashMad + investedStockValueMad) * 100) / 100,
            positionsCount: linkedPositions.length,
          };
        });
      } catch {
        // Ignore if KPI lookup fails
      }
    }

    return {
      positions: activePositions,
      watchlistPositions,
      orders,
      catalog,
      investmentWallets,
      rates,
      buyingPower: {
        safeToSpendMad,
        investmentWalletBalanceMad,
        monthlyIncomeMad: Math.round(monthlyIncomeMad * 100) / 100,
        monthlyInvestmentBudgetMad,
        investedThisCycleMad,
        remainingInvestmentBudgetMad,
        deployableSurplusMad,
        deployableSurplusUsd,
        emergencyBufferIntact,
        emergencyDeficitMad,
        daysUntilPayday,
        guidanceText,
      },
      totalPortfolioValueMad: Math.round(totalPortfolioValueMad * 100) / 100,
      totalPortfolioValueUsd: Math.round((totalPortfolioValueMad / rates.USD_TO_MAD) * 100) / 100,
      totalCostBasisMad: Math.round(totalCostBasisMad * 100) / 100,
      totalUnrealizedPnlMad: Math.round(totalUnrealizedPnlMad * 100) / 100,
      totalUnrealizedPnlPercent: Math.round(totalUnrealizedPnlPercent * 100) / 100,
      totalRealizedPnlMad: Math.round(totalRealizedPnlMad * 100) / 100,
      totalDividendsCollectedMad: Math.round(totalDividendsCollectedMad * 100) / 100,
      annualPassiveIncomeMad: Math.round(annualPassiveIncomeMad * 100) / 100,
      monthlyPassiveIncomeMad: Math.round(monthlyPassiveIncomeMad * 100) / 100,
      portfolioYieldPercent: Math.round(portfolioYieldPercent * 100) / 100,
      subscriptionCoveragePercent,
      livingExpenseCoveragePercent,
      sectorBreakdown,
      marketBreakdown,
      fireCoveragePercent: livingExpenseCoveragePercent,
      safeToInvest: {
        monthlyIncome: Math.round(monthlyIncomeMad * 100) / 100,
        fixedObligations: fixedObligationsMad,
        variableSpendPace: variableSpendPaceMad,
        emergencyBufferDeficiency: emergencyDeficitMad,
        pendingPayables: pendingPayablesMad,
        totalInvestmentBudget: monthlyInvestmentBudgetMad,
        investedThisMonth: investedThisCycleMad,
        remainingInvestmentBudget: remainingInvestmentBudgetMad,
        safeToInvestMonthly: deployableSurplusMad,
        currentMonthlyDcaTarget: monthlyInvestmentBudgetMad,
        surplusAfterDca: deployableSurplusMad,
        recommendationText: guidanceText,
        riskAppetiteMax: deployableSurplusMad,
      },
    };
  }

  /**
   * Add a stock to the user's Portfolio or Watchlist Radar, optionally recording an initial BUY order synced with a TrueSpend wallet
   */
  async upsertStockPosition(
    userId: string,
    payload: {
      ticker: string;
      companyName?: string;
      market?: StockMarketType;
      sector?: string;
      shares?: number;
      avgCostPerShare?: number;
      currentPrice?: number;
      currency?: string;
      annualDividendPerShare?: number;
      targetWeightPercent?: number;
      convictionThesis?: string;
      isWatchlistOnly?: boolean;
      walletId?: string | null;
      syncWithWallet?: boolean;
    }
  ) {
    const ticker = (payload.ticker || '').trim().toUpperCase();
    if (!ticker) throw new Error('Stock ticker is required (e.g. NVDA, AAPL, VOO, ATW)');

    const catalogItem = CURATED_STOCK_CATALOG.find((c) => c.ticker === ticker);
    const liveMap = await this.fetchLiveStockQuotes([ticker]);
    const live = liveMap[ticker];
    const rates = await this.getExchangeRates();

    const companyName = (
      payload.companyName ||
      live?.companyName ||
      catalogItem?.companyName ||
      ticker
    ).trim();
    const market = payload.market || catalogItem?.market || 'US';
    const sector = payload.sector || catalogItem?.sector || 'Equities';
    const currency = (
      payload.currency ||
      live?.currency ||
      catalogItem?.currency ||
      (market === 'BVC' ? 'MAD' : 'USD')
    ).toUpperCase();

    const shares = Math.max(0, Number(payload.shares ?? 0));
    const spotPrice = live?.price || catalogItem?.price || Number(payload.currentPrice || payload.avgCostPerShare || 0);
    const avgCost = Number(payload.avgCostPerShare ?? spotPrice) || spotPrice;
    const divPerShare =
      payload.annualDividendPerShare !== undefined
        ? Number(payload.annualDividendPerShare)
        : catalogItem?.annualDividendPerShare || 0;
    const isWatchlistOnly = Boolean(payload.isWatchlistOnly) || shares <= 0;

    // Check if user already has this ticker
    const existing = await investmentRepository.findPositionByTicker(ticker, userId);

    if (existing) {
      if (isWatchlistOnly) {
        return existing;
      }
      // If user is adding shares to an existing position, route through executeOrder('BUY')
      return await this.executeOrder(userId, {
        positionId: existing.id,
        action: 'BUY',
        shares,
        pricePerShare: avgCost,
        walletId: payload.walletId || existing.walletId || null,
        syncWithWallet: Boolean(payload.syncWithWallet && payload.walletId),
        notes: payload.convictionThesis || 'Added shares to position',
      });
    }

    const createdPosition = await investmentRepository.createPosition({
      userId,
      walletId: payload.walletId || null,
      ticker,
      companyName,
      market,
      sector,
      shares: shares.toString(),
      avgCostPerShare: avgCost.toString(),
      currentPrice: spotPrice.toString(),
      currency,
      annualDividendPerShare: divPerShare.toString(),
      targetWeightPercent: String(payload.targetWeightPercent ?? 0),
      convictionThesis: payload.convictionThesis || catalogItem?.thesis || null,
      isWatchlistOnly,
    });

    // If shares > 0, record the opening BUY order and optionally sync with TrueSpend wallet ledger
    if (!isWatchlistOnly && shares > 0 && avgCost > 0) {
      const totalNative = shares * avgCost;
      const fxRate = this.rateForCurrency(currency, rates);
      const totalMad = totalNative * fxRate;

      let linkedTransactionId: string | null = null;
      if (payload.syncWithWallet && payload.walletId) {
        const wallet = await walletRepository.findById(payload.walletId, userId);
        if (wallet && totalMad > 0) {
          const tx = await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: totalMad.toFixed(2),
            type: 'Expense',
            category: '📈 Investments',
            notes: `Stock Buy: ${shares} sh of ${ticker} (${companyName}) @ ${avgCost.toFixed(2)} ${currency}`,
          });
          linkedTransactionId = tx.id;
        }
      }

      await investmentRepository.createOrder({
        userId,
        positionId: createdPosition.id,
        walletId: payload.walletId || null,
        linkedTransactionId,
        action: 'BUY',
        shares: shares.toString(),
        pricePerShare: avgCost.toString(),
        totalNativeAmount: totalNative.toFixed(2),
        totalMadAmount: totalMad.toFixed(2),
        exchangeRateUsed: fxRate.toFixed(4),
        realizedPnlMad: '0',
        notes: `Initial position in ${ticker}`,
      });
    }

    return createdPosition;
  }

  /**
   * Update position metadata, target weight, dividend per share, or manual price/shares override
   */
  async updateStockPosition(
    userId: string,
    positionId: string,
    payload: {
      companyName?: string;
      market?: StockMarketType;
      sector?: string;
      shares?: number;
      avgCostPerShare?: number;
      currentPrice?: number;
      currency?: string;
      annualDividendPerShare?: number;
      targetWeightPercent?: number;
      convictionThesis?: string | null;
      walletId?: string | null;
      isWatchlistOnly?: boolean;
    }
  ) {
    const existing = await investmentRepository.findPositionById(positionId, userId);
    if (!existing) throw new Error('Stock position not found');

    const updateData: Record<string, any> = {};
    if (payload.companyName !== undefined) updateData.companyName = payload.companyName.trim();
    if (payload.market !== undefined) updateData.market = payload.market;
    if (payload.sector !== undefined) updateData.sector = payload.sector;
    if (payload.shares !== undefined) {
      updateData.shares = String(Math.max(0, Number(payload.shares)));
      updateData.isWatchlistOnly = Number(payload.shares) <= 0;
    }
    if (payload.avgCostPerShare !== undefined) updateData.avgCostPerShare = String(Math.max(0, Number(payload.avgCostPerShare)));
    if (payload.currentPrice !== undefined) updateData.currentPrice = String(Math.max(0, Number(payload.currentPrice)));
    if (payload.currency !== undefined) updateData.currency = payload.currency.toUpperCase();
    if (payload.annualDividendPerShare !== undefined) updateData.annualDividendPerShare = String(Math.max(0, Number(payload.annualDividendPerShare)));
    if (payload.targetWeightPercent !== undefined) updateData.targetWeightPercent = String(Math.max(0, Number(payload.targetWeightPercent)));
    if (payload.convictionThesis !== undefined) updateData.convictionThesis = payload.convictionThesis;
    if (payload.walletId !== undefined) updateData.walletId = payload.walletId;
    if (payload.isWatchlistOnly !== undefined) updateData.isWatchlistOnly = Boolean(payload.isWatchlistOnly);

    return await investmentRepository.updatePosition(positionId, userId, updateData);
  }

  async deleteStockPosition(userId: string, positionId: string) {
    await investmentRepository.deletePosition(positionId, userId);
    return { success: true };
  }

  /**
   * Execute a BUY, SELL, or DIVIDEND order on a stock position with optional 1-click TrueSpend Wallet sync
   */
  async executeOrder(
    userId: string,
    payload: {
      positionId?: string;
      ticker?: string;
      action: StockOrderAction;
      shares?: number;
      pricePerShare?: number;
      totalNativeAmount?: number;
      walletId?: string | null;
      syncWithWallet?: boolean;
      notes?: string;
    }
  ) {
    let position = payload.positionId
      ? await investmentRepository.findPositionById(payload.positionId, userId)
      : null;

    if (!position && payload.ticker) {
      position = await investmentRepository.findPositionByTicker(payload.ticker, userId);
    }

    // If buying a brand-new stock by ticker, auto-create the position first
    if (!position && payload.ticker && payload.action === 'BUY') {
      const created = await this.upsertStockPosition(userId, {
        ticker: payload.ticker,
        shares: payload.shares || 0,
        avgCostPerShare: payload.pricePerShare,
        walletId: payload.walletId,
        syncWithWallet: payload.syncWithWallet,
        convictionThesis: payload.notes,
      });
      return { success: true, position: created };
    }

    if (!position) {
      throw new Error('Stock position not found');
    }

    const rates = await this.getExchangeRates();
    const currency = (position.currency || 'USD').toUpperCase();
    const fxRate = this.rateForCurrency(currency, rates);

    const currentShares = parseFloat(position.shares || '0') || 0;
    const currentAvgCost = parseFloat(position.avgCostPerShare || '0') || 0;
    const action = payload.action;

    let shares = Math.max(0, Number(payload.shares || 0));
    let pricePerShare = Math.max(0, Number(payload.pricePerShare || position.currentPrice || currentAvgCost || 0));
    let totalNativeAmount = Math.max(0, Number(payload.totalNativeAmount || 0));

    if (action === 'BUY' || action === 'SELL') {
      if (shares <= 0 && totalNativeAmount > 0 && pricePerShare > 0) {
        shares = totalNativeAmount / pricePerShare;
      } else if (totalNativeAmount <= 0 && shares > 0 && pricePerShare > 0) {
        totalNativeAmount = shares * pricePerShare;
      }
      if (shares <= 0 || pricePerShare <= 0) {
        throw new Error(`Please provide valid shares and price per share for ${action} order.`);
      }
    } else if (action === 'DIVIDEND') {
      if (totalNativeAmount <= 0) {
        const divPerShare = parseFloat(position.annualDividendPerShare || '0') || 0;
        if (divPerShare > 0 && currentShares > 0) {
          // Default to quarterly dividend if not specified
          totalNativeAmount = (currentShares * divPerShare) / 4;
        } else {
          throw new Error('Please specify the dividend payout amount received.');
        }
      }
      shares = currentShares;
      pricePerShare = currentShares > 0 ? totalNativeAmount / currentShares : 0;
    }

    const totalMadAmount = totalNativeAmount * fxRate;
    const targetWalletId = payload.walletId !== undefined ? payload.walletId : position.walletId;
    const shouldSyncWallet = payload.syncWithWallet !== false && Boolean(targetWalletId);

    let realizedPnlMad = 0;
    let linkedTransactionId: string | null = null;

    if (action === 'BUY') {
      const newShares = currentShares + shares;
      const newAvgCost =
        newShares > 0
          ? (currentShares * currentAvgCost + shares * pricePerShare) / newShares
          : pricePerShare;

      await investmentRepository.updatePosition(position.id, userId, {
        shares: newShares.toString(),
        avgCostPerShare: newAvgCost.toFixed(4),
        currentPrice: pricePerShare.toFixed(2),
        isWatchlistOnly: false,
        walletId: targetWalletId || position.walletId,
      });

      if (shouldSyncWallet && targetWalletId) {
        const wallet = await walletRepository.findById(targetWalletId, userId);
        if (wallet) {
          const tx = await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: totalMadAmount.toFixed(2),
            type: 'Expense',
            category: '📈 Investments',
            notes:
              payload.notes ||
              `Bought ${Number(shares.toFixed(4))} ${position.ticker} @ ${pricePerShare.toFixed(2)} ${currency}`,
          });
          linkedTransactionId = tx.id;
        }
      }
    } else if (action === 'SELL') {
      if (shares > currentShares + 0.0001) {
        throw new Error(
          `Cannot sell ${shares} shares of ${position.ticker}; you currently hold ${currentShares} shares.`
        );
      }

      const realizedNative = (pricePerShare - currentAvgCost) * shares;
      realizedPnlMad = realizedNative * fxRate;
      const remainingShares = Math.max(0, currentShares - shares);

      await investmentRepository.updatePosition(position.id, userId, {
        shares: remainingShares.toString(),
        currentPrice: pricePerShare.toFixed(2),
        isWatchlistOnly: remainingShares <= 0.00001,
      });

      if (shouldSyncWallet && targetWalletId) {
        const wallet = await walletRepository.findById(targetWalletId, userId);
        if (wallet) {
          const pnlSign = realizedPnlMad >= 0 ? '+' : '';
          const tx = await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: totalMadAmount.toFixed(2),
            type: 'Income',
            category: 'Investment Returns & Capital Gains',
            notes:
              payload.notes ||
              `Sold ${Number(shares.toFixed(4))} ${position.ticker} @ ${pricePerShare.toFixed(2)} ${currency} (${pnlSign}${realizedPnlMad.toFixed(0)} MAD P&L)`,
          });
          linkedTransactionId = tx.id;
        }
      }
    } else if (action === 'DIVIDEND') {
      if (shouldSyncWallet && targetWalletId) {
        const wallet = await walletRepository.findById(targetWalletId, userId);
        if (wallet) {
          const tx = await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: totalMadAmount.toFixed(2),
            type: 'Income',
            category: '📈 Investment Returns / Dividends',
            notes:
              payload.notes ||
              `Cash Dividend from ${position.ticker} (${position.companyName})`,
          });
          linkedTransactionId = tx.id;
        }
      }
    }

    const order = await investmentRepository.createOrder({
      userId,
      positionId: position.id,
      walletId: targetWalletId || null,
      linkedTransactionId,
      action,
      shares: shares.toFixed(4),
      pricePerShare: pricePerShare.toFixed(2),
      totalNativeAmount: totalNativeAmount.toFixed(2),
      totalMadAmount: totalMadAmount.toFixed(2),
      exchangeRateUsed: fxRate.toFixed(4),
      realizedPnlMad: realizedPnlMad.toFixed(2),
      notes: payload.notes || null,
    });

    return {
      success: true,
      order,
      linkedTransactionId,
    };
  }

  /**
   * Delete an order and optionally delete its linked TrueSpend wallet transaction
   */
  async deleteOrder(userId: string, orderId: string) {
    const order = await investmentRepository.findOrderById(orderId, userId);
    if (!order) throw new Error('Order not found');

    if (order.linkedTransactionId) {
      try {
        await transactionRepository.deleteByIdAndUserId(order.linkedTransactionId, userId);
      } catch {
        // Ignore if already deleted
      }
    }

    await investmentRepository.deleteOrder(orderId, userId);
    return { success: true };
  }

  /**
   * 1-Click Payday Stock Allocation: Splits a MAD amount across multiple stock positions
   * and syncs the purchases with the selected TrueSpend wallet.
   */
  async executePaydayBatchBuy(
    userId: string,
    payload: {
      walletId?: string | null;
      syncWithWallet?: boolean;
      allocations: { positionId: string; amountMad: number }[];
    }
  ) {
    if (!Array.isArray(payload.allocations) || payload.allocations.length === 0) {
      throw new Error('No stock allocations provided.');
    }

    const rates = await this.getExchangeRates();
    const results = [];

    for (const item of payload.allocations) {
      const amountMad = Number(item.amountMad || 0);
      if (!item.positionId || amountMad <= 0) continue;

      const position = await investmentRepository.findPositionById(item.positionId, userId);
      if (!position) continue;

      const fxRate = this.rateForCurrency(position.currency || 'USD', rates);
      const nativeAmount = amountMad / fxRate;
      const liveMap = await this.fetchLiveStockQuotes([position.ticker]);
      const pricePerShare =
        liveMap[position.ticker.toUpperCase()]?.price ||
        parseFloat(position.currentPrice || '0') ||
        parseFloat(position.avgCostPerShare || '0') ||
        100;

      const shares = nativeAmount / pricePerShare;

      const res = await this.executeOrder(userId, {
        positionId: position.id,
        action: 'BUY',
        shares,
        pricePerShare,
        totalNativeAmount: nativeAmount,
        walletId: payload.walletId || position.walletId || null,
        syncWithWallet: payload.syncWithWallet,
        notes: `Payday Portfolio Allocation (${amountMad.toFixed(0)} MAD)`,
      });
      results.push(res);
    }

    return {
      success: true,
      executedCount: results.length,
    };
  }

  /**
   * 1-Click Fund Investment Wallet (Brokerage Reserve):
   * Transfers MAD from a Bank/Cash wallet into an Investment wallet (auto-creating a
   * 'Brokerage Reserve' Investment wallet if the user doesn't have one yet), recorded
   * as type: 'Transfer' with category: '📈 Investments' so it counts toward the
   * '📈 Investments' category budget and moves cash into the protected investmentReserve.
   */
  async fundInvestmentWallet(
    userId: string,
    payload: {
      sourceWalletId?: string;
      destinationWalletId?: string;
      amountMad: number;
      notes?: string;
    }
  ) {
    const amountMad = Math.round((Number(payload.amountMad) || 0) * 100) / 100;
    if (amountMad <= 0) {
      throw new Error('Please enter a valid transfer amount greater than 0 MAD.');
    }

    const allWallets = await walletRepository.findAllByUserId(userId);
    const sourceWallet = payload.sourceWalletId
      ? allWallets.find((w) => w.id === payload.sourceWalletId)
      : allWallets.find((w) => w.type === 'Bank' && w.isMain) ||
        allWallets.find((w) => w.type === 'Bank') ||
        allWallets.find((w) => w.type === 'Cash');

    if (!sourceWallet) {
      throw new Error('Source Bank or Cash wallet not found.');
    }

    let destWallet = payload.destinationWalletId
      ? allWallets.find((w) => w.id === payload.destinationWalletId)
      : allWallets.find((w) => w.type === 'Investment');

    if (!destWallet) {
      destWallet = await walletRepository.create({
        userId,
        name: 'Brokerage Reserve',
        type: 'Investment',
        isMain: false,
        initialBalance: '0',
      });
    }

    if (sourceWallet.id === destWallet.id) {
      throw new Error('Source wallet and Investment destination wallet must be different.');
    }

    const tx = await transactionRepository.create({
      userId,
      walletId: sourceWallet.id,
      destinationWalletId: destWallet.id,
      amount: amountMad.toFixed(2),
      type: 'Transfer',
      category: '📈 Investments',
      notes:
        payload.notes ||
        `Brokerage Reserve Funding: ${sourceWallet.name} → ${destWallet.name}`,
    });

    return {
      success: true,
      transaction: tx,
      destinationWallet: destWallet,
    };
  }
}

export const investmentService = new InvestmentService();
