import { investmentRepository } from '../repositories/InvestmentRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { subscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { kpiService } from './KpiService.js';
import { binanceService, type ExternalStockQuoteMap } from './BinanceService.js';
import { userRepository } from '../repositories/UserRepository.js';
import type {
  CapitalReconciliationSnapshot,
  PortfolioHistoryPoint,
  SmartInvestmentInsight,
  StockCatalogItem,
  StockMarketType,
  StockOrder,
  StockOrderAction,
  StockPosition,
  WalletCapitalFlowEntry,
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
    ticker: 'TSLA',
    companyName: 'Tesla, Inc.',
    market: 'US',
    sector: 'EV, Autonomy & Robotics',
    price: 258.5,
    change24hPercent: 1.85,
    currency: 'USD',
    annualDividendPerShare: 0,
    dividendYieldPercent: 0,
    thesis: 'Autonomous driving (FSD), energy storage megapacks, and humanoid robotics leader',
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
  {
    ticker: 'O',
    companyName: 'Realty Income Corporation',
    market: 'US',
    sector: 'Monthly Dividend REIT',
    price: 58.4,
    change24hPercent: 0.42,
    currency: 'USD',
    annualDividendPerShare: 3.16,
    dividendYieldPercent: 5.41,
    thesis: 'Monthly dividend company backed by 15,000+ triple-net commercial properties',
  },
  {
    ticker: 'KO',
    companyName: 'The Coca-Cola Company',
    market: 'US',
    sector: 'Consumer Staples',
    price: 65.2,
    change24hPercent: 0.31,
    currency: 'USD',
    annualDividendPerShare: 1.94,
    dividendYieldPercent: 2.98,
    thesis: '62+ consecutive years of dividend increases with global pricing power',
  },

  // Core Index & Dividend ETFs
  {
    ticker: 'SPY',
    companyName: 'SPDR S&P 500 ETF Trust',
    market: 'ETF',
    sector: 'S&P 500 Index',
    price: 584.2,
    change24hPercent: 0.72,
    currency: 'USD',
    annualDividendPerShare: 7.12,
    dividendYieldPercent: 1.22,
    thesis: 'World’s most liquid S&P 500 index fund tracking top 500 US large-cap equities',
  },
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

const COMMON_BINANCE_STOCK_TICKERS = [
  'TSLA',
  'NVDA',
  'AAPL',
  'MSFT',
  'AMZN',
  'GOOGL',
  'META',
  'SPY',
  'QQQ',
  'COIN',
  'MSTR',
  'AMD',
  'PLTR',
  'NFLX',
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
    dividendYieldPercent?: number;
    annualDividendPerShare?: number;
    lastUpdated: number;
  }
> = {};

export class InvestmentService {
  async getExchangeRates(): Promise<{ USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number }> {
    const now = Date.now();
    if (now - cachedRates.lastFetched < 5 * 60 * 1000) {
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
  async fetchLiveStockQuotes(tickers: string[], forceRefresh = false): Promise<ExternalStockQuoteMap> {
    const result: ExternalStockQuoteMap = {};
    if (!tickers || tickers.length === 0) return result;

    const uniqueTickers = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)));
    const now = Date.now();

    await Promise.all(
      uniqueTickers.map(async (ticker) => {
        const cached = quoteCache[ticker];
        if (!forceRefresh && cached && now - cached.lastUpdated < 30 * 1000) {
          result[ticker] = {
            price: cached.price,
            change24hPercent: cached.change24hPercent,
            currency: cached.currency,
            companyName: cached.companyName,
            dividendYieldPercent: cached.dividendYieldPercent,
            annualDividendPerShare: cached.annualDividendPerShare,
          };
          return;
        }

        const catalogItem = CURATED_STOCK_CATALOG.find((c) => c.ticker === ticker);
        if (catalogItem && catalogItem.market === 'BVC') {
          quoteCache[ticker] = {
            price: catalogItem.price,
            change24hPercent: catalogItem.change24hPercent,
            currency: 'MAD',
            companyName: catalogItem.companyName,
            dividendYieldPercent: catalogItem.dividendYieldPercent,
            annualDividendPerShare: catalogItem.annualDividendPerShare,
            lastUpdated: now,
          };
          result[ticker] = quoteCache[ticker];
          return;
        }

        try {
          const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
          const res = await fetch(yhUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(3000),
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
                dividendYieldPercent: catalogItem?.dividendYieldPercent || 0,
                annualDividendPerShare: catalogItem?.annualDividendPerShare || 0,
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
            dividendYieldPercent: catalogItem.dividendYieldPercent,
            annualDividendPerShare: catalogItem.annualDividendPerShare,
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
   * Complete, deeply integrated Binance Spot/Funding/Earn + Stock Intelligence + Capital Reconciliation payload
   */
  async getInvestmentsData(userId: string, options?: { forceRefresh?: boolean }) {
    const [rawPositions, rawOrders, rates, dbUser, subscriptions, allTransactions] = await Promise.all([
      investmentRepository.findAllPositionsByUserId(userId),
      investmentRepository.findAllOrdersByUserId(userId),
      this.getExchangeRates(),
      userRepository.findById(userId),
      subscriptionRepository.findAllByUserId(userId),
      transactionRepository.findAllByUserId(userId),
    ]);

    // Fetch live quotes for manual user positions AND common Binance tokenized stocks in parallel
    const userTickers = rawPositions.map((p) => p.ticker);
    const allLookupTickers = Array.from(new Set([...userTickers, ...COMMON_BINANCE_STOCK_TICKERS]));
    const liveQuotes = await this.fetchLiveStockQuotes(allLookupTickers, options?.forceRefresh);

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
    let kpiAccounts: any[] = [];

    if (dbUser) {
      try {
        const kpis = await kpiService.getKpisForUser(dbUser);
        kpiAccounts = kpis.accounts || [];
        safeToSpendMad = Math.max(0, Math.round((kpis.safeToSpend || 0) * 100) / 100);
        investmentWalletBalanceMad = Math.max(0, Math.round((kpis.investmentReserve || 0) * 100) / 100);
        monthlyIncomeMad =
          kpis.currentFinancialAmount && kpis.currentFinancialAmount > 0
            ? kpis.currentFinancialAmount
            : kpis.monthlyIncome || parseFloat((dbUser.salary as any) || '0') || 0;
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

    // Compute TrueSpend Wallet Capital Flows first so we know exact netCapitalContributedMad (e.g. 879 MAD)
    const invAccounts = kpiAccounts.filter((a) => a.type === 'Investment');
    const linkedBinanceAcc =
      invAccounts.find((a) => a.name.toLowerCase().includes('binance')) ||
      invAccounts.find((a) => a.name.toLowerCase().includes('crypto')) ||
      invAccounts[0] ||
      null;

    const walletById = new Map(kpiAccounts.map((w) => [w.id, w]));
    const invWalletIds = new Set(invAccounts.map((w) => w.id));
    const investmentCategorySet = new Set([
      '📈 Investments',
      'Investments & Brokerage',
      'Investments',
      'Investment',
      'Stocks & Crypto',
      'Investment Funding',
      'Trading',
      'Crypto Purchase',
      'Investment Returns & Capital Gains',
      '📈 Investment Returns / Dividends',
    ]);

    const walletCapitalFlows: WalletCapitalFlowEntry[] = [];
    let netCapitalContributedMad = 0;
    const netDepositedByWalletId: Record<string, number> = {};

    for (const tx of allTransactions) {
      const amt = parseFloat(String(tx.amount || '0')) || 0;
      if (amt <= 0) continue;

      const srcId = tx.walletId || null;
      const dstId = (tx as any).destinationWalletId || (tx as any).toWalletId || null;
      const srcWallet = srcId ? walletById.get(srcId) : null;
      const dstWallet = dstId ? walletById.get(dstId) : null;
      const isInvCat = investmentCategorySet.has(tx.category || '');

      if (tx.type === 'Transfer' && dstId && invWalletIds.has(dstId) && (!srcId || !invWalletIds.has(srcId))) {
        netCapitalContributedMad += amt;
        netDepositedByWalletId[dstId] = (netDepositedByWalletId[dstId] || 0) + amt;
        walletCapitalFlows.push({
          id: tx.id,
          createdAt: new Date(tx.createdAt || Date.now()).toISOString(),
          type: 'Transfer',
          direction: 'DEPOSIT_TO_INVESTMENT',
          amountMad: Math.round(amt * 100) / 100,
          amountUsd: Math.round((amt / rates.USD_TO_MAD) * 100) / 100,
          sourceWalletId: srcId,
          sourceWalletName: srcWallet?.name || tx.sourceWallet || 'Bank Account',
          destinationWalletId: dstId,
          destinationWalletName: dstWallet?.name || 'Investment Wallet',
          category: tx.category || '📈 Investments',
          notes: tx.notes || `Capital Transfer to ${dstWallet?.name || 'Investment Wallet'}`,
        });
      } else if (tx.type === 'Transfer' && srcId && invWalletIds.has(srcId) && (!dstId || !invWalletIds.has(dstId))) {
        netCapitalContributedMad -= amt;
        netDepositedByWalletId[srcId] = (netDepositedByWalletId[srcId] || 0) - amt;
        walletCapitalFlows.push({
          id: tx.id,
          createdAt: new Date(tx.createdAt || Date.now()).toISOString(),
          type: 'Transfer',
          direction: 'WITHDRAWAL_TO_BANK',
          amountMad: Math.round(amt * 100) / 100,
          amountUsd: Math.round((amt / rates.USD_TO_MAD) * 100) / 100,
          sourceWalletId: srcId,
          sourceWalletName: srcWallet?.name || 'Investment Wallet',
          destinationWalletId: dstId,
          destinationWalletName: dstWallet?.name || 'Bank Account',
          category: tx.category || '🔄 Transfer',
          notes: tx.notes || `Capital Withdrawal from ${srcWallet?.name || 'Investment Wallet'}`,
        });
      } else if (tx.type === 'Expense' && (isInvCat || (srcId && invWalletIds.has(srcId)))) {
        if (!srcId || !invWalletIds.has(srcId)) {
          netCapitalContributedMad += amt;
        }
        walletCapitalFlows.push({
          id: tx.id,
          createdAt: new Date(tx.createdAt || Date.now()).toISOString(),
          type: 'Expense',
          direction: 'DIRECT_ASSET_PURCHASE',
          amountMad: Math.round(amt * 100) / 100,
          amountUsd: Math.round((amt / rates.USD_TO_MAD) * 100) / 100,
          sourceWalletId: srcId,
          sourceWalletName: srcWallet?.name || tx.sourceWallet || 'Primary Account',
          destinationWalletId: null,
          destinationWalletName: null,
          category: tx.category || '📈 Investments',
          notes: tx.notes || 'Asset Allocation / Purchase',
        });
      } else if (tx.type === 'Income' && (isInvCat || (srcId && invWalletIds.has(srcId)))) {
        walletCapitalFlows.push({
          id: tx.id,
          createdAt: new Date(tx.createdAt || Date.now()).toISOString(),
          type: 'Income',
          direction: 'DIVIDEND_OR_YIELD',
          amountMad: Math.round(amt * 100) / 100,
          amountUsd: Math.round((amt / rates.USD_TO_MAD) * 100) / 100,
          sourceWalletId: srcId,
          sourceWalletName: srcWallet?.name || 'Investment Account',
          destinationWalletId: null,
          destinationWalletName: null,
          category: tx.category || '📈 Investment Returns / Dividends',
          notes: tx.notes || 'Investment Return / Dividend',
        });
      }
    }

    walletCapitalFlows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Determine the Initial Capital Baseline (e.g. 879 MAD reserved in Investment Wallet or Net Capital Contributed)
    const linkedWalletRecordedMad = linkedBinanceAcc ? Number(linkedBinanceAcc.balance) || 0 : 0;
    const initialCapitalBaselineMad =
      linkedWalletRecordedMad > 0
        ? linkedWalletRecordedMad
        : investmentWalletBalanceMad > 0
        ? investmentWalletBalanceMad
        : netCapitalContributedMad > 0
        ? netCapitalContributedMad
        : 0;

    // Fetch live read-only Binance overview (Spot + Funding + Earn + Wallet Balance + Trade Forensics)
    const binanceOverview = await binanceService.getAccountOverview(rates, {
      forceRefresh: options?.forceRefresh,
      linkedWallet: linkedBinanceAcc
        ? {
            id: linkedBinanceAcc.id,
            name: linkedBinanceAcc.name,
            balanceMad: linkedWalletRecordedMad,
          }
        : null,
      externalStockQuotes: liveQuotes,
      initialCapitalMad: initialCapitalBaselineMad,
    });

    const remainingInvestmentBudgetMad =
      monthlyInvestmentBudgetMad > 0
        ? Math.max(0, Math.round((monthlyInvestmentBudgetMad - investedThisCycleMad) * 100) / 100)
        : 0;

    const safeSurplusFromChecking =
      monthlyInvestmentBudgetMad > 0
        ? Math.min(remainingInvestmentBudgetMad, safeToSpendMad)
        : Math.round(safeToSpendMad * 0.5 * 100) / 100;

    // Unallocated cash available to deploy is free stablecoins + safe checking surplus
    const deployableSurplusMad = Math.max(
      0,
      Math.round(((binanceOverview.stablecoinReserveMad || 0) + safeSurplusFromChecking) * 100) / 100
    );
    const deployableSurplusUsd = Math.round((deployableSurplusMad / rates.USD_TO_MAD) * 100) / 100;

    let guidanceText = '';
    if (!emergencyBufferIntact) {
      guidanceText = `Your emergency buffer is ${emergencyDeficitMad.toLocaleString()} MAD below target. Consider topping up your Savings vault before allocating additional capital.`;
    } else if (deployableSurplusMad > 0) {
      guidanceText =
        monthlyInvestmentBudgetMad > 0
          ? `You have ${deployableSurplusMad.toLocaleString()} MAD ($${deployableSurplusUsd.toLocaleString()}) in deployable liquidity & cycle investment budget while keeping your daily allowance and emergency buffer 100% intact.`
          : `Based on your live TrueSpend cash flow, you have ${deployableSurplusMad.toLocaleString()} MAD ($${deployableSurplusUsd.toLocaleString()}) in safe investment capacity without impacting your daily allowance.`;
    } else {
      guidanceText = `Your liquid checking cash is reserved for this cycle's living expenses. Next payday is in ${daysUntilPayday} days.`;
    }

    // Process manual logged positions with deep fee, breakeven, and dividend intelligence
    let manualPortfolioValueMad = 0;
    let manualCostBasisMad = 0;
    let annualPassiveIncomeMad = 0;
    let totalAccruedDividendsMad = 0;
    let manualFeesPaidMad = 0;
    let manualEstimatedExitFeesMad = 0;
    const nowMs = Date.now();

    const positionMapById = new Map(rawPositions.map((p) => [p.id, p]));

    const enrichedManual: StockPosition[] = rawPositions.map((pos) => {
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
      const costBasisUsd = costBasisMad / rates.USD_TO_MAD;
      const marketValueUsd = marketValueMad / rates.USD_TO_MAD;
      const unrealizedPnlUsd = unrealizedPnlMad / rates.USD_TO_MAD;

      // Broker fee rate: BVC Morocco ~0.35% (brokerage + settlement), US/ETF ~0.10%
      const feeRate = pos.market === 'BVC' ? 0.0035 : 0.001;
      const feesPaidMad = costBasisMad * feeRate;
      const feesPaidUsd = feesPaidMad / rates.USD_TO_MAD;
      const estimatedExitFeeMad = marketValueMad * feeRate;
      const estimatedExitFeeUsd = estimatedExitFeeMad / rates.USD_TO_MAD;
      const totalFeeLossMad = feesPaidMad + estimatedExitFeeMad;
      const totalFeeLossUsd = totalFeeLossMad / rates.USD_TO_MAD;
      const feeDragPercent = costBasisMad > 0 ? (totalFeeLossMad / costBasisMad) * 100 : 0;

      const netPnlAfterFeesMad = unrealizedPnlMad - totalFeeLossMad;
      const netPnlAfterFeesUsd = netPnlAfterFeesMad / rates.USD_TO_MAD;
      const netPnlAfterFeesPercent =
        costBasisMad > 0 ? (netPnlAfterFeesMad / costBasisMad) * 100 : 0;

      const breakevenPriceNative =
        avgCostNum > 0 ? (avgCostNum * (1 + feeRate)) / (1 - feeRate) : currentPriceNum;
      const breakevenPriceMad = this.toMad(breakevenPriceNative, currency, rates);
      const breakevenPriceUsd = breakevenPriceMad / rates.USD_TO_MAD;
      const distanceToBreakevenPercent =
        currentPriceNum > 0
          ? ((breakevenPriceNative - currentPriceNum) / currentPriceNum) * 100
          : 0;

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
      const yieldOnCostPercent =
        avgCostNum > 0 ? (divPerShare / avgCostNum) * 100 : dividendYieldPercent;

      const createdAtMs = new Date(pos.createdAt || nowMs).getTime() || nowMs;
      const holdingDays = Math.max(1, Math.floor((nowMs - createdAtMs) / (1000 * 60 * 60 * 24)));
      const accruedDividendMad = annualDividendMad * Math.min(1, holdingDays / 365);
      const accruedDividendUsd = accruedDividendMad / rates.USD_TO_MAD;

      const totalReturnWithDividendMad = netPnlAfterFeesMad + accruedDividendMad;
      const totalReturnWithDividendUsd = totalReturnWithDividendMad / rates.USD_TO_MAD;
      const totalReturnPercent =
        costBasisMad > 0 ? (totalReturnWithDividendMad / costBasisMad) * 100 : 0;

      // 5-Year DRIP projection (assuming 8% annual capital appreciation + reinvested dividend yield)
      const annualCompoundRate = 0.08 + dividendYieldPercent / 100;
      const drip5YearProjectedValueMad = marketValueMad * Math.pow(1 + annualCompoundRate, 5);
      const drip5YearProjectedIncomeMad =
        drip5YearProjectedValueMad * (dividendYieldPercent / 100);

      const oneShareMad = this.toMad(currentPriceNum, currency, rates);
      const affordableSharesFromSurplus =
        oneShareMad > 0
          ? Math.floor((deployableSurplusMad / oneShareMad) * 100) / 100
          : 0;

      const isWatchlistOnly = Boolean(pos.isWatchlistOnly) || sharesNum <= 0;

      if (!isWatchlistOnly) {
        manualPortfolioValueMad += marketValueMad;
        manualCostBasisMad += costBasisMad;
        annualPassiveIncomeMad += annualDividendMad;
        totalAccruedDividendsMad += accruedDividendMad;
        manualFeesPaidMad += feesPaidMad;
        manualEstimatedExitFeesMad += estimatedExitFeeMad;
      }

      return {
        ...pos,
        createdAt: pos.createdAt instanceof Date ? pos.createdAt.toISOString() : String(pos.createdAt || new Date().toISOString()),
        updatedAt: pos.updatedAt instanceof Date ? pos.updatedAt.toISOString() : String(pos.updatedAt || new Date().toISOString()),
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
        costBasisUsd: Math.round(costBasisUsd * 100) / 100,
        marketValueUsd: Math.round(marketValueUsd * 100) / 100,
        unrealizedPnlUsd: Math.round(unrealizedPnlUsd * 100) / 100,
        actualWeightPercent: 0,
        annualDividendNative: Math.round(annualDividendNative * 100) / 100,
        annualDividendMad: Math.round(annualDividendMad * 100) / 100,
        dividendYieldPercent: Math.round(dividendYieldPercent * 100) / 100,
        yieldOnCostPercent: Math.round(yieldOnCostPercent * 100) / 100,
        quarterlyDividendMad: Math.round((annualDividendMad / 4) * 100) / 100,
        quarterlyDividendUsd: Math.round((annualDividendMad / 4 / rates.USD_TO_MAD) * 100) / 100,
        monthlyDividendMad: Math.round((annualDividendMad / 12) * 100) / 100,
        accruedDividendMad: Math.round(accruedDividendMad * 100) / 100,
        accruedDividendUsd: Math.round(accruedDividendUsd * 100) / 100,
        feesPaidMad: Math.round(feesPaidMad * 100) / 100,
        feesPaidUsd: Math.round(feesPaidUsd * 1000) / 1000,
        estimatedExitFeeMad: Math.round(estimatedExitFeeMad * 100) / 100,
        estimatedExitFeeUsd: Math.round(estimatedExitFeeUsd * 1000) / 1000,
        totalFeeLossMad: Math.round(totalFeeLossMad * 100) / 100,
        totalFeeLossUsd: Math.round(totalFeeLossUsd * 1000) / 1000,
        feeDragPercent: Math.round(feeDragPercent * 100) / 100,
        netPnlAfterFeesMad: Math.round(netPnlAfterFeesMad * 100) / 100,
        netPnlAfterFeesUsd: Math.round(netPnlAfterFeesUsd * 100) / 100,
        netPnlAfterFeesPercent: Math.round(netPnlAfterFeesPercent * 100) / 100,
        breakevenPriceNative: Math.round(breakevenPriceNative * 100) / 100,
        breakevenPriceMad: Math.round(breakevenPriceMad * 100) / 100,
        breakevenPriceUsd: Math.round(breakevenPriceUsd * 100) / 100,
        distanceToBreakevenPercent: Math.round(distanceToBreakevenPercent * 100) / 100,
        totalReturnWithDividendMad: Math.round(totalReturnWithDividendMad * 100) / 100,
        totalReturnWithDividendUsd: Math.round(totalReturnWithDividendUsd * 100) / 100,
        totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
        drip5YearProjectedValueMad: Math.round(drip5YearProjectedValueMad * 100) / 100,
        drip5YearProjectedIncomeMad: Math.round(drip5YearProjectedIncomeMad * 100) / 100,
        holdingDays,
        costBasisSource: 'manual',
        affordableSharesFromSurplus,
        source: 'manual' as const,
      };
    });

    // Map live Binance holdings (Spot + Funding + Earn) into unified StockPosition format with full fee, breakeven, and dividend telemetry
    const binanceDerivedPositions: StockPosition[] = binanceOverview.balances
      .filter((b) => b.valueMad >= 0.05)
      .map((b) => {
        const avgCostUsd = b.avgBuyPriceUsd ?? b.priceUsd;
        const costBasisUsd = b.costBasisUsd ?? b.valueUsd;
        const costBasisMad = b.costBasisMad ?? b.valueMad;
        const unrealizedPnlUsd = b.unrealizedPnlUsd ?? 0;
        const unrealizedPnlMad = b.unrealizedPnlMad ?? 0;
        const unrealizedPnlPercent = b.unrealizedPnlPercent ?? 0;

        const walletLabel =
          b.walletType === 'FUNDING'
            ? 'Funding Wallet'
            : b.walletType === 'BOTH'
            ? 'Spot & Funding'
            : b.walletType === 'EARN'
            ? 'Simple Earn'
            : 'Spot';

        const market: StockMarketType =
          b.category === 'Tokenized Stocks & Equities' ? 'GLOBAL' : 'BINANCE';

        const divYieldPct = b.dividendYieldPercent || 0;
        const annualDividendUsd = b.annualDividendUsd ?? b.valueUsd * (divYieldPct / 100);
        const annualDividendMad = b.annualDividendMad ?? annualDividendUsd * rates.USD_TO_MAD;
        const divPerShareUsd = b.total > 0 ? annualDividendUsd / b.total : 0;
        const yieldOnCostPercent =
          avgCostUsd > 0 ? (divPerShareUsd / avgCostUsd) * 100 : divYieldPct;

        const accruedDividendUsd = b.accruedDividendUsd ?? annualDividendUsd / 4;
        const accruedDividendMad = b.accruedDividendMad ?? accruedDividendUsd * rates.USD_TO_MAD;

        annualPassiveIncomeMad += annualDividendMad;
        totalAccruedDividendsMad += accruedDividendMad;

        const feesPaidUsd = b.feesPaidUsd ?? 0;
        const feesPaidMad = b.feesPaidMad ?? 0;
        const estimatedExitFeeUsd = b.estimatedExitFeeUsd ?? 0;
        const estimatedExitFeeMad = b.estimatedExitFeeMad ?? 0;
        const totalFeeLossUsd = b.totalFeeLossUsd ?? feesPaidUsd + estimatedExitFeeUsd;
        const totalFeeLossMad = b.totalFeeLossMad ?? feesPaidMad + estimatedExitFeeMad;
        const feeDragPercent = b.feeDragPercent ?? 0;

        const netPnlAfterFeesUsd = b.netPnlAfterFeesUsd ?? unrealizedPnlUsd - totalFeeLossUsd;
        const netPnlAfterFeesMad = b.netPnlAfterFeesMad ?? unrealizedPnlMad - totalFeeLossMad;
        const netPnlAfterFeesPercent =
          b.netPnlAfterFeesPercent ??
          (costBasisUsd > 0 ? (netPnlAfterFeesUsd / costBasisUsd) * 100 : 0);

        const breakevenPriceUsd = b.breakevenPriceUsd ?? avgCostUsd * 1.002;
        const breakevenPriceMad = b.breakevenPriceMad ?? breakevenPriceUsd * rates.USD_TO_MAD;
        const distanceToBreakevenPercent =
          b.distanceToBreakevenPercent ??
          (b.priceUsd > 0 ? ((breakevenPriceUsd - b.priceUsd) / b.priceUsd) * 100 : 0);

        const totalReturnWithDividendUsd =
          b.totalReturnWithDividendUsd ?? netPnlAfterFeesUsd + accruedDividendUsd;
        const totalReturnWithDividendMad =
          b.totalReturnWithDividendMad ?? netPnlAfterFeesMad + accruedDividendMad;
        const totalReturnPercent =
          costBasisMad > 0 ? (totalReturnWithDividendMad / costBasisMad) * 100 : 0;

        const annualCompoundRate = 0.08 + divYieldPct / 100;
        const drip5YearProjectedValueMad = b.valueMad * Math.pow(1 + annualCompoundRate, 5);
        const drip5YearProjectedIncomeMad = drip5YearProjectedValueMad * (divYieldPct / 100);

        return {
          id: `binance-${(b.walletType || 'spot').toLowerCase()}-${b.asset}`,
          userId,
          walletId: linkedBinanceAcc?.id || null,
          walletName: linkedBinanceAcc?.name || `Binance ${walletLabel}`,
          ticker: b.asset,
          companyName: `${b.assetName} (Binance ${walletLabel})`,
          market,
          sector: b.category,
          shares: b.total.toString(),
          avgCostPerShare: avgCostUsd.toFixed(4),
          currentPrice: b.priceUsd.toFixed(4),
          currency: 'USD',
          annualDividendPerShare: divPerShareUsd.toFixed(4),
          targetWeightPercent: b.portfolioWeightPercent.toFixed(1),
          convictionThesis:
            b.category === 'Tokenized Stocks & Equities'
              ? `Binance Equity Position (${b.free} free${b.locked > 0 ? `, ${b.locked} locked` : ''} in ${walletLabel})`
              : b.isStablecoinOrFiat
              ? `Binance Liquidity Reserve (${b.free} free${b.locked > 0 ? `, ${b.locked} locked` : ''} in ${walletLabel})`
              : `Live Binance Position (${b.free} free${b.locked > 0 ? `, ${b.locked} locked` : ''} in ${walletLabel})`,
          isWatchlistOnly: false,
          createdAt: binanceOverview.lastSyncedAt || new Date().toISOString(),
          updatedAt: binanceOverview.lastSyncedAt || new Date().toISOString(),
          sharesNum: b.total,
          avgCostNum: avgCostUsd,
          currentPriceNum: b.priceUsd,
          change24hPercent: b.change24hPercent,
          costBasisNative: costBasisUsd,
          marketValueNative: b.valueUsd,
          unrealizedPnlNative: unrealizedPnlUsd,
          unrealizedPnlPercent,
          costBasisMad,
          marketValueMad: b.valueMad,
          unrealizedPnlMad,
          costBasisUsd,
          marketValueUsd: b.valueUsd,
          unrealizedPnlUsd,
          actualWeightPercent: 0,
          annualDividendNative: Math.round(annualDividendUsd * 100) / 100,
          annualDividendMad: Math.round(annualDividendMad * 100) / 100,
          dividendYieldPercent: divYieldPct,
          yieldOnCostPercent: Math.round(yieldOnCostPercent * 100) / 100,
          quarterlyDividendMad: Math.round((annualDividendMad / 4) * 100) / 100,
          quarterlyDividendUsd: Math.round((annualDividendUsd / 4) * 100) / 100,
          monthlyDividendMad: Math.round((annualDividendMad / 12) * 100) / 100,
          accruedDividendMad: Math.round(accruedDividendMad * 100) / 100,
          accruedDividendUsd: Math.round(accruedDividendUsd * 100) / 100,
          feesPaidMad: Math.round(feesPaidMad * 100) / 100,
          feesPaidUsd: Math.round(feesPaidUsd * 1000) / 1000,
          estimatedExitFeeMad: Math.round(estimatedExitFeeMad * 100) / 100,
          estimatedExitFeeUsd: Math.round(estimatedExitFeeUsd * 1000) / 1000,
          totalFeeLossMad: Math.round(totalFeeLossMad * 100) / 100,
          totalFeeLossUsd: Math.round(totalFeeLossUsd * 1000) / 1000,
          feeDragPercent: Math.round(feeDragPercent * 100) / 100,
          netPnlAfterFeesMad: Math.round(netPnlAfterFeesMad * 100) / 100,
          netPnlAfterFeesUsd: Math.round(netPnlAfterFeesUsd * 100) / 100,
          netPnlAfterFeesPercent: Math.round(netPnlAfterFeesPercent * 100) / 100,
          breakevenPriceNative: Math.round(breakevenPriceUsd * 1e4) / 1e4,
          breakevenPriceUsd: Math.round(breakevenPriceUsd * 1e4) / 1e4,
          breakevenPriceMad: Math.round(breakevenPriceMad * 100) / 100,
          distanceToBreakevenPercent: Math.round(distanceToBreakevenPercent * 100) / 100,
          totalReturnWithDividendMad: Math.round(totalReturnWithDividendMad * 100) / 100,
          totalReturnWithDividendUsd: Math.round(totalReturnWithDividendUsd * 100) / 100,
          totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
          drip5YearProjectedValueMad: Math.round(drip5YearProjectedValueMad * 100) / 100,
          drip5YearProjectedIncomeMad: Math.round(drip5YearProjectedIncomeMad * 100) / 100,
          holdingDays: 14,
          costBasisSource: b.costBasisSource || 'spot_mark',
          affordableSharesFromSurplus:
            b.priceMad > 0 ? Math.floor((deployableSurplusMad / b.priceMad) * 10000) / 10000 : 0,
          source: 'binance' as const,
        };
      });

    // Combine manual active positions + live Binance positions
    const manualActive = enrichedManual.filter((p) => !p.isWatchlistOnly && p.sharesNum > 0);
    const combinedRawActive = [...binanceDerivedPositions, ...manualActive];

    const combinedGrossValueMad = combinedRawActive.reduce((s, p) => s + p.marketValueMad, 0);

    // True Current Live Portfolio Value (Binance Combined + Off-Exchange Manual Positions)
    const totalPortfolioValueMad = Math.max(
      0,
      manualPortfolioValueMad +
        (binanceOverview.connected ? binanceOverview.totalCombinedValueMad : combinedGrossValueMad)
    );
    const totalPortfolioValueUsd = totalPortfolioValueMad / rates.USD_TO_MAD;

    // Effective Initial Capital / Cost Basis
    const rawTrackedCostBasisMad =
      manualCostBasisMad +
      (binanceOverview.totalTrackedCostBasisMad > 0
        ? binanceOverview.totalTrackedCostBasisMad + binanceOverview.stablecoinReserveMad
        : binanceOverview.totalCombinedValueMad);

    const effectiveInitialCapitalMad =
      initialCapitalBaselineMad > 0
        ? initialCapitalBaselineMad + manualCostBasisMad
        : rawTrackedCostBasisMad;
    const effectiveInitialCapitalUsd = effectiveInitialCapitalMad / rates.USD_TO_MAD;

    const totalCostBasisMad = effectiveInitialCapitalMad;

    const activePositions: StockPosition[] = combinedRawActive
      .map((p) => {
        const actualWeightPercent =
          combinedGrossValueMad > 0
            ? Math.round((p.marketValueMad / combinedGrossValueMad) * 1000) / 10
            : 0;
        const targetWeight = parseFloat(p.targetWeightPercent || '0') || actualWeightPercent;
        const weightDriftPercent = Math.round((actualWeightPercent - targetWeight) * 10) / 10;
        const rebalanceActionMad =
          Math.round(((targetWeight - actualWeightPercent) / 100) * combinedGrossValueMad * 100) / 100;

        return {
          ...p,
          actualWeightPercent,
          weightDriftPercent,
          rebalanceActionMad,
        };
      })
      .sort((a, b) => b.marketValueMad - a.marketValueMad);

    const watchlistPositions = enrichedManual.filter((p) => p.isWatchlistOnly || p.sharesNum <= 0);

    // Enrich manual StockOrders with live mark-to-market open-lot P&L, fees, breakeven, and accrued dividends
    const orders: StockOrder[] = rawOrders.map((ord) => {
      const pos = positionMapById.get(ord.positionId);
      const ticker = (ord.ticker || pos?.ticker || 'EQUITY').toUpperCase();
      const live = liveQuotes[ticker];
      const catalogItem = CURATED_STOCK_CATALOG.find((c) => c.ticker === ticker);
      const currency = (ord.currency || pos?.currency || live?.currency || 'USD').toUpperCase();
      const fxRate = parseFloat(ord.exchangeRateUsed || '0') || this.rateForCurrency(currency, rates);

      const shares = parseFloat(ord.shares || '0') || 0;
      const execPrice = parseFloat(ord.pricePerShare || '0') || 0;
      const totalMad = parseFloat(ord.totalMadAmount || '0') || shares * execPrice * fxRate;
      const currentPriceNative =
        live?.price ||
        parseFloat(pos?.currentPrice || '0') ||
        catalogItem?.price ||
        execPrice;
      const currentValueMad = this.toMad(shares * currentPriceNative, currency, rates);
      const currentValueUsd = currentValueMad / rates.USD_TO_MAD;

      const feeRate = pos?.market === 'BVC' ? 0.0035 : 0.001;
      const feeMad = ord.action === 'DIVIDEND' ? 0 : totalMad * feeRate;
      const feeUsd = feeMad / rates.USD_TO_MAD;
      const exitFeeMad = ord.action === 'BUY' ? currentValueMad * feeRate : 0;
      const totalOrderFeeMad = feeMad + exitFeeMad;
      const feeDragPercent = totalMad > 0 ? (totalOrderFeeMad / totalMad) * 100 : 0;

      const executedAtMs = new Date(ord.executedAt || nowMs).getTime() || nowMs;
      const holdingDays = Math.max(1, Math.floor((nowMs - executedAtMs) / (1000 * 60 * 60 * 24)));

      let grossOrderPnlMad = 0;
      if (ord.action === 'BUY') {
        grossOrderPnlMad = currentValueMad - totalMad;
      } else if (ord.action === 'SELL') {
        grossOrderPnlMad = parseFloat(ord.realizedPnlMad || '0') || 0;
      } else {
        grossOrderPnlMad = totalMad;
      }

      const netOrderPnlMad = grossOrderPnlMad - totalOrderFeeMad;
      const netOrderPnlUsd = netOrderPnlMad / rates.USD_TO_MAD;
      const netOrderPnlPercent = totalMad > 0 ? (netOrderPnlMad / totalMad) * 100 : 0;
      const breakevenPriceNative =
        ord.action === 'BUY' ? (execPrice * (1 + feeRate)) / (1 - feeRate) : execPrice;

      const divYieldPct = catalogItem?.dividendYieldPercent || 0;
      const accruedDividendMad =
        ord.action === 'BUY'
          ? currentValueMad * (divYieldPct / 100) * Math.min(1, holdingDays / 365)
          : 0;
      const totalReturnMad = netOrderPnlMad + accruedDividendMad;

      return {
        ...ord,
        action: (ord.action || 'BUY') as 'BUY' | 'SELL' | 'DIVIDEND',
        executedAt: ord.executedAt instanceof Date ? ord.executedAt.toISOString() : String(ord.executedAt || new Date().toISOString()),
        ticker,
        companyName: ord.companyName || pos?.companyName || catalogItem?.companyName || ticker,
        currency,
        currentPriceNative: Math.round(currentPriceNative * 100) / 100,
        currentValueMad: Math.round(currentValueMad * 100) / 100,
        currentValueUsd: Math.round(currentValueUsd * 100) / 100,
        feeMad: Math.round(feeMad * 100) / 100,
        feeUsd: Math.round(feeUsd * 1000) / 1000,
        feeDragPercent: Math.round(feeDragPercent * 100) / 100,
        grossOrderPnlMad: Math.round(grossOrderPnlMad * 100) / 100,
        grossOrderPnlUsd: Math.round((grossOrderPnlMad / rates.USD_TO_MAD) * 100) / 100,
        netOrderPnlMad: Math.round(netOrderPnlMad * 100) / 100,
        netOrderPnlUsd: Math.round(netOrderPnlUsd * 100) / 100,
        netOrderPnlPercent: Math.round(netOrderPnlPercent * 100) / 100,
        breakevenPriceNative: Math.round(breakevenPriceNative * 100) / 100,
        accruedDividendMad: Math.round(accruedDividendMad * 100) / 100,
        totalReturnMad: Math.round(totalReturnMad * 100) / 100,
        isOpenLot: ord.action === 'BUY',
        holdingDays,
      };
    });

    // Sector & Market Breakdown across both Binance and manual positions
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
          combinedGrossValueMad > 0
            ? Math.round((valueMad / combinedGrossValueMad) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.valueMad - a.valueMad);

    const marketBreakdown = Object.entries(marketMap)
      .map(([market, valueMad]) => ({
        market,
        valueMad: Math.round(valueMad * 100) / 100,
        weightPercent:
          combinedGrossValueMad > 0
            ? Math.round((valueMad / combinedGrossValueMad) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.valueMad - a.valueMad);

    // Realized P&L & Dividends collected from manual order history + Binance personal trades & asset dividends
    let totalRealizedPnlMad = binanceOverview.totalRealizedPnlMad || 0;
    let totalDividendsCollectedMad = (binanceOverview.assetDividends || []).reduce(
      (s, d) => s + d.amountMad,
      0
    );
    for (const ord of orders) {
      if (ord.action === 'SELL') {
        totalRealizedPnlMad += parseFloat(ord.realizedPnlMad || '0') || 0;
      } else if (ord.action === 'DIVIDEND') {
        totalDividendsCollectedMad += parseFloat(ord.totalMadAmount || '0') || 0;
      }
    }

    // Monthly subscriptions burn in MAD for passive income coverage comparison
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

    // Compute Capital Reconciliation (e.g. Initial $879 MAD Reserve vs. Current Live ~$83 / ~826 MAD)
    const netCapitalPnlMad = totalPortfolioValueMad - effectiveInitialCapitalMad;
    const netCapitalPnlUsd = totalPortfolioValueUsd - effectiveInitialCapitalUsd;
    const netCapitalPnlPercent =
      effectiveInitialCapitalMad > 0
        ? (netCapitalPnlMad / effectiveInitialCapitalMad) * 100
        : 0;

    const totalFeesPaidMad = (binanceOverview.totalFeesPaidMad || 0) + manualFeesPaidMad;
    const totalFeesPaidUsd = totalFeesPaidMad / rates.USD_TO_MAD;
    const estimatedExitFeesMad =
      (binanceOverview.totalEstimatedExitFeesMad || 0) + manualEstimatedExitFeesMad;
    const estimatedExitFeesUsd = estimatedExitFeesMad / rates.USD_TO_MAD;
    const totalFeeDragMad = totalFeesPaidMad + estimatedExitFeesMad;
    const totalFeeDragUsd = totalFeeDragMad / rates.USD_TO_MAD;
    const feeDragPercentOfCapital =
      effectiveInitialCapitalMad > 0
        ? (totalFeeDragMad / effectiveInitialCapitalMad) * 100
        : 0;

    const trackedPositionUnrealizedMad =
      (manualPortfolioValueMad - manualCostBasisMad) +
      (binanceOverview.totalTrackedUnrealizedPnlMad || 0);

    // If total netCapitalPnlMad differs from tracked position P&L, attribute properly between market movement, fees, and FX/P2P spread
    const grossMarketPnlMad =
      Math.abs(trackedPositionUnrealizedMad) > 0.01
        ? trackedPositionUnrealizedMad + totalRealizedPnlMad
        : netCapitalPnlMad + totalFeesPaidMad;
    const grossMarketPnlUsd = grossMarketPnlMad / rates.USD_TO_MAD;

    const fxAndFundingSpreadMad =
      netCapitalPnlMad - (grossMarketPnlMad - totalFeesPaidMad);
    const fxAndFundingSpreadUsd = fxAndFundingSpreadMad / rates.USD_TO_MAD;

    const totalReturnWithDividendsMad =
      netCapitalPnlMad + totalDividendsCollectedMad + totalAccruedDividendsMad - estimatedExitFeesMad;
    const totalReturnWithDividendsUsd = totalReturnWithDividendsMad / rates.USD_TO_MAD;
    const totalReturnWithDividendsPercent =
      effectiveInitialCapitalMad > 0
        ? (totalReturnWithDividendsMad / effectiveInitialCapitalMad) * 100
        : 0;

    const breakevenPortfolioValueMad = effectiveInitialCapitalMad + totalFeeDragMad;
    const breakevenPortfolioValueUsd = breakevenPortfolioValueMad / rates.USD_TO_MAD;
    const recoveryNeededMad = Math.max(0, breakevenPortfolioValueMad - totalPortfolioValueMad);
    const recoveryNeededUsd = recoveryNeededMad / rates.USD_TO_MAD;
    const recoveryNeededPercent =
      totalPortfolioValueMad > 0 ? (recoveryNeededMad / totalPortfolioValueMad) * 100 : 0;

    const capitalReconciliation: CapitalReconciliationSnapshot = {
      initialCapitalMad: Math.round(effectiveInitialCapitalMad * 100) / 100,
      initialCapitalUsd: Math.round(effectiveInitialCapitalUsd * 100) / 100,
      currentLiveValueMad: Math.round(totalPortfolioValueMad * 100) / 100,
      currentLiveValueUsd: Math.round(totalPortfolioValueUsd * 100) / 100,
      netCapitalPnlMad: Math.round(netCapitalPnlMad * 100) / 100,
      netCapitalPnlUsd: Math.round(netCapitalPnlUsd * 100) / 100,
      netCapitalPnlPercent: Math.round(netCapitalPnlPercent * 100) / 100,
      isGain: netCapitalPnlMad >= 0,
      grossMarketPnlMad: Math.round(grossMarketPnlMad * 100) / 100,
      grossMarketPnlUsd: Math.round(grossMarketPnlUsd * 100) / 100,
      totalFeesPaidMad: Math.round(totalFeesPaidMad * 100) / 100,
      totalFeesPaidUsd: Math.round(totalFeesPaidUsd * 1000) / 1000,
      estimatedExitFeesMad: Math.round(estimatedExitFeesMad * 100) / 100,
      estimatedExitFeesUsd: Math.round(estimatedExitFeesUsd * 1000) / 1000,
      totalFeeDragMad: Math.round(totalFeeDragMad * 100) / 100,
      totalFeeDragUsd: Math.round(totalFeeDragUsd * 1000) / 1000,
      feeDragPercentOfCapital: Math.round(feeDragPercentOfCapital * 100) / 100,
      fxAndFundingSpreadMad: Math.round(fxAndFundingSpreadMad * 100) / 100,
      fxAndFundingSpreadUsd: Math.round(fxAndFundingSpreadUsd * 100) / 100,
      dividendsEarnedMad: Math.round(totalDividendsCollectedMad * 100) / 100,
      dividendsEarnedUsd: Math.round((totalDividendsCollectedMad / rates.USD_TO_MAD) * 100) / 100,
      accruedDividendsMad: Math.round(totalAccruedDividendsMad * 100) / 100,
      accruedDividendsUsd: Math.round((totalAccruedDividendsMad / rates.USD_TO_MAD) * 100) / 100,
      totalReturnWithDividendsMad: Math.round(totalReturnWithDividendsMad * 100) / 100,
      totalReturnWithDividendsUsd: Math.round(totalReturnWithDividendsUsd * 100) / 100,
      totalReturnWithDividendsPercent: Math.round(totalReturnWithDividendsPercent * 100) / 100,
      breakevenPortfolioValueMad: Math.round(breakevenPortfolioValueMad * 100) / 100,
      breakevenPortfolioValueUsd: Math.round(breakevenPortfolioValueUsd * 100) / 100,
      recoveryNeededMad: Math.round(recoveryNeededMad * 100) / 100,
      recoveryNeededUsd: Math.round(recoveryNeededUsd * 100) / 100,
      recoveryNeededPercent: Math.round(recoveryNeededPercent * 100) / 100,
    };

    // Total Unrealized P&L reflects true capital gain/loss vs Initial Capital so top KPIs never hide a loss
    const totalUnrealizedPnlMad = netCapitalPnlMad;
    const totalUnrealizedPnlPercent = netCapitalPnlPercent;
    const portfolioYieldPercent =
      combinedGrossValueMad > 0 ? (annualPassiveIncomeMad / combinedGrossValueMad) * 100 : 0;
    const yieldOnCostPercent =
      effectiveInitialCapitalMad > 0
        ? (annualPassiveIncomeMad / effectiveInitialCapitalMad) * 100
        : portfolioYieldPercent;

    // Build Portfolio History Trajectory Series (30 points up to Live Now)
    const portfolioHistory = this.buildPortfolioHistorySeries({
      initialCapitalMad: effectiveInitialCapitalMad,
      currentValueMad: totalPortfolioValueMad,
      change24hMad: binanceOverview.change24hMad || 0,
      totalFeesPaidMad,
      totalAccruedDividendsMad: totalDividendsCollectedMad + totalAccruedDividendsMad,
      rates,
      recentTrades: binanceOverview.recentTrades || [],
      capitalFlows: walletCapitalFlows,
    });

    // Generate Smart Portfolio & Stock Intelligence Insights
    const smartInsights = this.buildSmartInvestmentInsights({
      reconciliation: capitalReconciliation,
      positions: activePositions,
      binance: binanceOverview,
      deployableSurplusMad,
      annualPassiveIncomeMad,
      subscriptionCoveragePercent,
      rates,
    });

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

    // Compute per-Investment-wallet summary comparing Initial Capital Reserved vs. Live Valuation
    const investmentWallets = invAccounts.map((acc, idx) => {
      const isBinanceLinked = linkedBinanceAcc ? linkedBinanceAcc.id === acc.id : idx === 0;
      const linkedManualPositions = manualActive.filter(
        (p) => p.walletId === acc.id || (!p.walletId && idx === 0)
      );
      const initialCapitalReservedMad = Math.round((acc.balance || 0) * 100) / 100;
      const loggedPositionsValueMad =
        Math.round(linkedManualPositions.reduce((s, p) => s + p.marketValueMad, 0) * 100) / 100;
      const binanceSpotCryptoMad = isBinanceLinked ? binanceOverview.cryptoEquityMad : 0;
      const binanceStablecoinCashMad = isBinanceLinked ? binanceOverview.stablecoinReserveMad : 0;
      const binanceFundingStocksMad = isBinanceLinked ? binanceOverview.stockEquityMad : 0;

      const liveValuationMad = isBinanceLinked
        ? Math.round((binanceOverview.totalCombinedValueMad + loggedPositionsValueMad) * 100) / 100
        : Math.round((initialCapitalReservedMad + loggedPositionsValueMad) * 100) / 100;

      const baselineForPnlMad =
        initialCapitalReservedMad > 0
          ? initialCapitalReservedMad
          : netDepositedByWalletId[acc.id] || liveValuationMad;
      const netWalletPnlMad = Math.round((liveValuationMad - baselineForPnlMad) * 100) / 100;
      const netWalletPnlUsd = Math.round((netWalletPnlMad / rates.USD_TO_MAD) * 100) / 100;
      const netWalletPnlPercent =
        baselineForPnlMad > 0
          ? Math.round((netWalletPnlMad / baselineForPnlMad) * 10000) / 100
          : 0;

      return {
        walletId: acc.id,
        name: acc.name,
        type: 'Investment' as const,
        uninvestedCashMad: isBinanceLinked ? binanceStablecoinCashMad : initialCapitalReservedMad,
        investedStockValueMad: isBinanceLinked
          ? Math.round((binanceOverview.totalCombinedValueMad - binanceStablecoinCashMad + loggedPositionsValueMad) * 100) / 100
          : loggedPositionsValueMad,
        totalAccountValueMad: liveValuationMad,
        positionsCount:
          linkedManualPositions.length +
          (isBinanceLinked ? binanceOverview.balances.length : 0),
        isBinanceLinked,
        binanceSpotCryptoMad,
        binanceStablecoinCashMad,
        binanceFundingStocksMad,
        loggedPositionsValueMad,
        netCapitalDepositedMad: Math.round((netDepositedByWalletId[acc.id] || initialCapitalReservedMad) * 100) / 100,
        initialCapitalReservedMad,
        liveValuationMad,
        netWalletPnlMad,
        netWalletPnlUsd,
        netWalletPnlPercent,
      };
    });

    return {
      positions: activePositions,
      watchlistPositions,
      orders,
      catalog,
      investmentWallets,
      binance: binanceOverview,
      walletCapitalFlows: walletCapitalFlows.slice(0, 100),
      netCapitalContributedMad: Math.round(effectiveInitialCapitalMad * 100) / 100,
      capitalReconciliation,
      portfolioHistory,
      smartInsights,
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
      totalPortfolioValueUsd: Math.round(totalPortfolioValueUsd * 100) / 100,
      totalCostBasisMad: Math.round(totalCostBasisMad * 100) / 100,
      totalUnrealizedPnlMad: Math.round(totalUnrealizedPnlMad * 100) / 100,
      totalUnrealizedPnlPercent: Math.round(totalUnrealizedPnlPercent * 100) / 100,
      totalRealizedPnlMad: Math.round(totalRealizedPnlMad * 100) / 100,
      totalFeesPaidMad: Math.round(totalFeesPaidMad * 100) / 100,
      totalFeesPaidUsd: Math.round(totalFeesPaidUsd * 1000) / 1000,
      totalDividendsCollectedMad: Math.round(totalDividendsCollectedMad * 100) / 100,
      annualPassiveIncomeMad: Math.round(annualPassiveIncomeMad * 100) / 100,
      monthlyPassiveIncomeMad: Math.round(monthlyPassiveIncomeMad * 100) / 100,
      portfolioYieldPercent: Math.round(portfolioYieldPercent * 100) / 100,
      yieldOnCostPercent: Math.round(yieldOnCostPercent * 100) / 100,
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
   * Reconstructs a realistic 30-day + intraday portfolio balance trajectory anchored at:
   * - Start: Initial Capital Contributed (e.g. 879 MAD / $88.34)
   * - Intermediate: Trade executions, fees deducted, and daily market drift
   * - Yesterday (T-24h): currentValueMad - change24hMad
   * - End (Live Now): currentValueMad (~826 MAD / $83.00)
   */
  private buildPortfolioHistorySeries(params: {
    initialCapitalMad: number;
    currentValueMad: number;
    change24hMad: number;
    totalFeesPaidMad: number;
    totalAccruedDividendsMad: number;
    rates: { USD_TO_MAD: number };
    recentTrades: { time: number; symbol: string; side: 'BUY' | 'SELL'; quoteQtyMad: number }[];
    capitalFlows: WalletCapitalFlowEntry[];
  }): PortfolioHistoryPoint[] {
    const {
      initialCapitalMad,
      currentValueMad,
      change24hMad,
      totalFeesPaidMad,
      totalAccruedDividendsMad,
      rates,
      recentTrades,
    } = params;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = 30;
    const startCapMad = initialCapitalMad > 0 ? initialCapitalMad : currentValueMad;
    const endValMad = currentValueMad;
    const prev24hValMad = Math.max(0, endValMad - change24hMad);
    const totalDeltaBefore24h = prev24hValMad - startCapMad;

    // Group trades by day offset so we can annotate trade events on the chart
    const tradeEventsByDayIndex = new Map<number, string>();
    for (const t of recentTrades) {
      const daysAgo = Math.floor((now - t.time) / dayMs);
      if (daysAgo >= 0 && daysAgo <= totalDays) {
        const idx = totalDays - daysAgo;
        if (!tradeEventsByDayIndex.has(idx)) {
          tradeEventsByDayIndex.set(idx, `${t.side} ${t.symbol}`);
        }
      }
    }

    const points: PortfolioHistoryPoint[] = [];

    for (let i = 0; i <= totalDays; i++) {
      const timestamp = now - (totalDays - i) * dayMs;
      const dateObj = new Date(timestamp);
      const shortLabel =
        i === totalDays
          ? 'Live'
          : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateLabel =
        i === totalDays
          ? `Live Now (${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
          : dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });

      const progress = i / Math.max(1, totalDays - 1);
      let valMad: number;

      if (i === 0) {
        valMad = startCapMad;
      } else if (i === totalDays) {
        valMad = endValMad;
      } else if (i === totalDays - 1) {
        valMad = prev24hValMad;
      } else {
        // Smooth deterministic market path from initialCapitalMad to prev24hValMad with realistic micro-oscillation
        const ease = 1 - Math.pow(1 - Math.min(1, progress), 1.45);
        const wave =
          Math.sin(i * 0.65) * (Math.abs(totalDeltaBefore24h) * 0.14 + startCapMad * 0.004) +
          Math.cos(i * 1.3) * (startCapMad * 0.0025);
        valMad = Math.max(0, startCapMad + totalDeltaBefore24h * ease + wave);
      }

      const valUsd = valMad / rates.USD_TO_MAD;
      const initUsd = startCapMad / rates.USD_TO_MAD;
      const netPnlMad = valMad - startCapMad;
      const netPnlUsd = valUsd - initUsd;
      const netPnlPercent = startCapMad > 0 ? (netPnlMad / startCapMad) * 100 : 0;

      const feeProg = Math.min(1, i / totalDays);
      const cumulativeFeesMad = totalFeesPaidMad * feeProg;
      const cumulativeFeesUsd = cumulativeFeesMad / rates.USD_TO_MAD;
      const cumulativeDividendsMad = totalAccruedDividendsMad * feeProg;

      let eventLabel = tradeEventsByDayIndex.get(i) || null;
      if (i === 0) eventLabel = `Initial Capital (${startCapMad.toFixed(0)} MAD)`;
      if (i === totalDays) eventLabel = `Live Position ($${valUsd.toFixed(2)})`;

      points.push({
        timestamp,
        dateLabel,
        shortLabel,
        portfolioValueMad: Math.round(valMad * 100) / 100,
        portfolioValueUsd: Math.round(valUsd * 100) / 100,
        initialCapitalMad: Math.round(startCapMad * 100) / 100,
        initialCapitalUsd: Math.round(initUsd * 100) / 100,
        costBasisMad: Math.round(startCapMad * 100) / 100,
        costBasisUsd: Math.round(initUsd * 100) / 100,
        netPnlMad: Math.round(netPnlMad * 100) / 100,
        netPnlUsd: Math.round(netPnlUsd * 100) / 100,
        netPnlPercent: Math.round(netPnlPercent * 100) / 100,
        cumulativeFeesMad: Math.round(cumulativeFeesMad * 100) / 100,
        cumulativeFeesUsd: Math.round(cumulativeFeesUsd * 1000) / 1000,
        cumulativeDividendsMad: Math.round(cumulativeDividendsMad * 100) / 100,
        eventLabel,
      });
    }

    return points;
  }

  /**
   * Generates institutional-grade portfolio & equity insights from live data
   */
  private buildSmartInvestmentInsights(params: {
    reconciliation: CapitalReconciliationSnapshot;
    positions: StockPosition[];
    binance: any;
    deployableSurplusMad: number;
    annualPassiveIncomeMad: number;
    subscriptionCoveragePercent: number;
    rates: { USD_TO_MAD: number };
  }): SmartInvestmentInsight[] {
    const {
      reconciliation,
      positions,
      deployableSurplusMad,
      annualPassiveIncomeMad,
      subscriptionCoveragePercent,
      rates,
    } = params;

    const insights: SmartInvestmentInsight[] = [];

    // 1. Capital Contributed vs. Live Position Verdict
    if (reconciliation.initialCapitalMad > 0) {
      const isLoss = reconciliation.netCapitalPnlMad < 0;
      insights.push({
        id: 'capital-reconciliation',
        category: 'CAPITAL_PNL',
        severity: isLoss ? 'warning' : 'positive',
        title: isLoss
          ? 'Capital Drawdown vs. Protected Wallet Reserve'
          : 'Net Capital Profit Above Initial Reserve',
        metricLabel: `${reconciliation.netCapitalPnlMad >= 0 ? '+' : ''}${reconciliation.netCapitalPnlMad.toFixed(2)} MAD (${reconciliation.netCapitalPnlUsd >= 0 ? '+' : ''}$${reconciliation.netCapitalPnlUsd.toFixed(2)} / ${reconciliation.netCapitalPnlPercent >= 0 ? '+' : ''}${reconciliation.netCapitalPnlPercent.toFixed(2)}%)`,
        detail: isLoss
          ? `Your initial protected reserve was ${reconciliation.initialCapitalMad.toFixed(2)} MAD ($${reconciliation.initialCapitalUsd.toFixed(2)}), while your live position is ${reconciliation.currentLiveValueMad.toFixed(2)} MAD ($${reconciliation.currentLiveValueUsd.toFixed(2)}). You need +${reconciliation.recoveryNeededMad.toFixed(2)} MAD (+$${reconciliation.recoveryNeededUsd.toFixed(2)} or +${reconciliation.recoveryNeededPercent.toFixed(2)}%) to reach full breakeven including exit fees.`
          : `Your live portfolio (${reconciliation.currentLiveValueMad.toFixed(2)} MAD / $${reconciliation.currentLiveValueUsd.toFixed(2)}) is outperforming your initial ${reconciliation.initialCapitalMad.toFixed(2)} MAD reserve by +${reconciliation.netCapitalPnlMad.toFixed(2)} MAD.`,
        actionLabel: 'Inspect Capital Bridge',
      });
    }

    // 2. Fee Drag & Round-Trip Friction Analysis
    insights.push({
      id: 'fee-drag-forensics',
      category: 'FEE_DRAG',
      severity: reconciliation.feeDragPercentOfCapital > 1.0 ? 'warning' : 'neutral',
      title: 'Trading Commission & Exit Fee Drag',
      metricLabel: `-${reconciliation.totalFeeDragMad.toFixed(2)} MAD (-$${reconciliation.totalFeeDragUsd.toFixed(3)} · ${reconciliation.feeDragPercentOfCapital.toFixed(2)}% drag)`,
      detail: `Paid ${reconciliation.totalFeesPaidMad.toFixed(2)} MAD ($${reconciliation.totalFeesPaidUsd.toFixed(3)}) in entry/execution commissions plus ${reconciliation.estimatedExitFeesMad.toFixed(2)} MAD ($${reconciliation.estimatedExitFeesUsd.toFixed(3)}) in estimated liquidation fees. HoldingBNB with 25% fee discount or using Maker limit orders reduces round-trip fee drag by up to 50%.`,
      actionLabel: 'View Trade Fee Breakdown',
    });

    // 3. Breakeven Price Radar for Top Risk Position
    const riskPositions = positions.filter(
      (p) => p.sector !== 'Stablecoin / Fiat Reserve' && p.marketValueMad > 1
    );
    if (riskPositions.length > 0) {
      const topPos = riskPositions[0];
      const dist = topPos.distanceToBreakevenPercent || 0;
      insights.push({
        id: 'breakeven-radar',
        category: 'BREAKEVEN',
        severity: dist > 2 ? 'warning' : 'positive',
        title: `${topPos.ticker} Net Breakeven Target`,
        metricLabel: `Breakeven: ${topPos.currency === 'MAD' ? `${(topPos.breakevenPriceMad || 0).toFixed(2)} MAD` : `$${(topPos.breakevenPriceUsd || 0).toFixed(4)}`} (${dist >= 0 ? `+${dist.toFixed(2)}% needed` : `${Math.abs(dist).toFixed(2)}% above breakeven`})`,
        detail: `${topPos.ticker} (${topPos.companyName}) represents ${topPos.actualWeightPercent.toFixed(1)}% of your portfolio. Including entry and exit fees (-${(topPos.totalFeeLossMad || 0).toFixed(2)} MAD), its net P&L is ${(topPos.netPnlAfterFeesMad || 0) >= 0 ? '+' : ''}${(topPos.netPnlAfterFeesMad || 0).toFixed(2)} MAD.`,
        actionLabel: 'Inspect Position Telemetry',
      });
    }

    // 4. Dividend & Passive Yield Engine
    insights.push({
      id: 'dividend-engine',
      category: 'DIVIDEND',
      severity: annualPassiveIncomeMad > 0 ? 'positive' : 'neutral',
      title: 'Dividend Yield & Passive Income Projection',
      metricLabel: `${annualPassiveIncomeMad.toFixed(2)} MAD/yr ($${(annualPassiveIncomeMad / rates.USD_TO_MAD).toFixed(2)}/yr)`,
      detail:
        annualPassiveIncomeMad > 0
          ? `Your equity & yield holdings generate ${(annualPassiveIncomeMad / 12).toFixed(2)} MAD/month in projected passive income (covering ${subscriptionCoveragePercent.toFixed(1)}% of your active subscriptions), with ${reconciliation.accruedDividendsMad.toFixed(2)} MAD accrued to date.`
          : `Your current holdings are growth-focused with 0.00% cash dividend yield. Allocating surplus into high-yield dividend compounders (e.g., SCHD 3.53%, O 5.41%, IAM 4.35%, ATW 3.58%) builds recurring cash flow.`,
      actionLabel: 'Open Dividend & Stock Suite',
    });

    // 5. Stock & Asset Class Concentration Signal
    const stockPositions = positions.filter(
      (p) => p.sector === 'Tokenized Stocks & Equities' || p.market === 'US' || p.market === 'BVC' || p.market === 'ETF' || p.market === 'GLOBAL'
    );
    const totalStocksMad = stockPositions.reduce((s, p) => s + p.marketValueMad, 0);
    const stockWeightPct =
      reconciliation.currentLiveValueMad > 0
        ? (totalStocksMad / reconciliation.currentLiveValueMad) * 100
        : 0;

    insights.push({
      id: 'stock-allocation-signal',
      category: 'STOCK_SIGNAL',
      severity: stockPositions.length > 0 ? 'positive' : 'neutral',
      title: 'Stocks & Equities Portfolio Exposure',
      metricLabel: `${totalStocksMad.toFixed(2)} MAD ($${(totalStocksMad / rates.USD_TO_MAD).toFixed(2)} · ${stockWeightPct.toFixed(1)}% Weight)`,
      detail: `Tracking ${stockPositions.length} active stock/equity holding(s) across Binance Funding/Spot & local ledgers. Deployable TrueSpend surplus of ${deployableSurplusMad.toFixed(0)} MAD ($${(deployableSurplusMad / rates.USD_TO_MAD).toFixed(2)}) is available for DCA without impacting daily Safe-to-Spend.`,
      actionLabel: 'Explore Stocks Intelligence',
    });

    return insights;
  }

  /**
   * Read-only Binance account overview endpoint handler
   */
  async getBinanceAccountOverview(userId: string, forceRefresh = false) {
    const [rates, dbUser, liveQuotes] = await Promise.all([
      this.getExchangeRates(),
      userRepository.findById(userId),
      this.fetchLiveStockQuotes(COMMON_BINANCE_STOCK_TICKERS, forceRefresh),
    ]);

    let linkedWallet: { id: string; name: string; balanceMad: number } | null = null;
    if (dbUser) {
      try {
        const kpis = await kpiService.getKpisForUser(dbUser);
        const invAccounts = (kpis.accounts || []).filter((a) => a.type === 'Investment');
        const target =
          invAccounts.find((a) => a.name.toLowerCase().includes('binance')) ||
          invAccounts.find((a) => a.name.toLowerCase().includes('crypto')) ||
          invAccounts[0];
        if (target) {
          linkedWallet = {
            id: target.id,
            name: target.name,
            balanceMad: Number(target.balance) || 0,
          };
        }
      } catch {
        // Ignore KPI lookup failure
      }
    }

    return await binanceService.getAccountOverview(rates, {
      forceRefresh,
      linkedWallet,
      externalStockQuotes: liveQuotes,
      initialCapitalMad: linkedWallet?.balanceMad || 0,
    });
  }

  /**
   * Read-only personal trade & position forensics for any Spot, Funding, Stock, or Equity symbol
   */
  async getBinanceSymbolTrades(
    symbol: string,
    options?: {
      limit?: number;
      startTime?: number;
      endTime?: number;
      fromId?: number;
      forceRefresh?: boolean;
    },
    userId?: string
  ) {
    const normalizedSym = binanceService.validateSymbol(symbol);
    const { baseAsset, quoteAsset } = binanceService.splitSymbol(normalizedSym);
    const cleanBase = baseAsset.replace(/^LD/, '');

    const [rates, liveQuotes] = await Promise.all([
      this.getExchangeRates(),
      this.fetchLiveStockQuotes(
        Array.from(new Set([...COMMON_BINANCE_STOCK_TICKERS, cleanBase, baseAsset])),
        options?.forceRefresh
      ),
    ]);

    const result = await binanceService.getPersonalTradesForSymbol(normalizedSym, rates, {
      ...options,
      externalStockQuotes: liveQuotes,
    });

    if (result.trades.length > 0) {
      return result;
    }

    const now = Date.now();
    const catalogItem = CURATED_STOCK_CATALOG.find(
      (c) => c.ticker.toUpperCase() === cleanBase || c.ticker.toUpperCase() === baseAsset
    );
    const liveStock = liveQuotes[cleanBase] || liveQuotes[baseAsset];

    // Check if the user has logged positions or orders for this stock/asset
    if (userId) {
      const [rawPositions, rawOrders] = await Promise.all([
        investmentRepository.findAllPositionsByUserId(userId),
        investmentRepository.findAllOrdersByUserId(userId),
      ]);

      const matchingPos = rawPositions.find(
        (p) => p.ticker.toUpperCase() === cleanBase || p.ticker.toUpperCase() === baseAsset
      );
      const matchingOrders = rawOrders.filter(
        (o) =>
          (o.ticker || '').toUpperCase() === cleanBase ||
          (matchingPos && o.positionId === matchingPos.id)
      );

      if (matchingPos && parseFloat(matchingPos.shares || '0') > 0) {
        const shares = Math.max(0, parseFloat(matchingPos.shares || '0') || 0);
        const avgCostNative = Math.max(0, parseFloat(matchingPos.avgCostPerShare || '0') || 0);
        const currNative =
          liveStock?.price ||
          parseFloat(matchingPos.currentPrice || '0') ||
          catalogItem?.price ||
          avgCostNative;
        const currency = (matchingPos.currency || liveStock?.currency || catalogItem?.currency || 'USD').toUpperCase();
        const toUsdRate = currency === 'MAD' ? 1 / rates.USD_TO_MAD : currency === 'EUR' ? rates.EUR_TO_MAD / rates.USD_TO_MAD : 1;

        const entryPriceUsd = avgCostNative * toUsdRate;
        const livePriceUsd = currNative * toUsdRate;
        const principalUsd = shares * entryPriceUsd;
        const principalMad = principalUsd * rates.USD_TO_MAD;
        const currentLotValueUsd = shares * livePriceUsd;
        const currentLotValueMad = currentLotValueUsd * rates.USD_TO_MAD;

        const feeRate = matchingPos.market === 'BVC' ? 0.0035 : 0.001;
        const entryFeeUsd = principalUsd * feeRate;
        const exitFeeUsd = currentLotValueUsd * feeRate;
        const totalFeeLossUsd = entryFeeUsd + exitFeeUsd;
        const grossPnlUsd = currentLotValueUsd - principalUsd;
        const netPnlUsd = grossPnlUsd - totalFeeLossUsd;
        const bePriceUsd = (entryPriceUsd * (1 + feeRate)) / (1 - feeRate);
        const distBePct = livePriceUsd > 0 ? ((bePriceUsd - livePriceUsd) / livePriceUsd) * 100 : 0;

        const divYield = catalogItem?.dividendYieldPercent ?? liveStock?.dividendYieldPercent ?? 0;
        const annDivUsd = currentLotValueUsd * (divYield / 100);
        const createdMs = new Date(matchingPos.createdAt || now).getTime() || now;
        const holdingDays = Math.max(1, Math.floor((now - createdMs) / (1000 * 60 * 60 * 24)));
        const accDivUsd = annDivUsd * Math.min(1, holdingDays / 365);
        const totRetUsd = netPnlUsd + accDivUsd;

        const trades =
          matchingOrders.length > 0
            ? matchingOrders.map((ord, idx) => {
                const ordShares = parseFloat(ord.shares || '0') || shares;
                const ordPriceUsd = (parseFloat(ord.pricePerShare || '0') || avgCostNative) * toUsdRate;
                const ordPrincipalUsd = ordShares * ordPriceUsd;
                const ordFeeUsd = ordPrincipalUsd * feeRate;
                const ordExitFeeUsd = ord.action === 'BUY' ? ordShares * livePriceUsd * feeRate : 0;
                const ordFeeLossUsd = ordFeeUsd + ordExitFeeUsd;
                const ordGrossUsd =
                  ord.action === 'BUY' ? ordShares * (livePriceUsd - ordPriceUsd) : 0;
                const ordNetUsd = ordGrossUsd - ordFeeLossUsd;
                const ordTime = new Date(ord.executedAt || now).getTime() || now;
                return {
                  id: Math.floor(ordTime / 1000) + idx,
                  orderId: Math.floor(ordTime / 1000) + idx,
                  symbol: normalizedSym,
                  baseAsset: cleanBase,
                  quoteAsset,
                  side: (ord.action === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
                  price: Math.round(ordPriceUsd * 1e4) / 1e4,
                  qty: Math.round(ordShares * 1e6) / 1e6,
                  quoteQty: Math.round(ordPrincipalUsd * 100) / 100,
                  quoteQtyUsd: Math.round(ordPrincipalUsd * 100) / 100,
                  quoteQtyMad: Math.round(ordPrincipalUsd * rates.USD_TO_MAD * 100) / 100,
                  commission: Math.round(ordFeeUsd * 10000) / 10000,
                  commissionAsset: 'USD',
                  commissionUsd: Math.round(ordFeeUsd * 10000) / 10000,
                  commissionMad: Math.round(ordFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
                  time: ordTime,
                  executedAt: new Date(ordTime).toISOString(),
                  isMaker: false,
                  tradeSource: 'MANUAL' as const,
                  isCompletedTrade: ord.action === 'SELL',
                  tradeStatusLabel: (ord.action === 'SELL' ? 'CLOSED_REALIZED' : 'OPEN_LOT') as
                    | 'OPEN_LOT'
                    | 'CLOSED_REALIZED',
                  openQtyRemaining: ord.action === 'BUY' ? ordShares : 0,
                  currentMarketPriceUsd: Math.round(livePriceUsd * 1e4) / 1e4,
                  currentMarketPriceMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 100) / 100,
                  currentLotValueUsd: Math.round(ordShares * livePriceUsd * 100) / 100,
                  currentLotValueMad: Math.round(ordShares * livePriceUsd * rates.USD_TO_MAD * 100) / 100,
                  matchedCostBasisUsd: Math.round(ordPrincipalUsd * 100) / 100,
                  grossTradePnlUsd: Math.round(ordGrossUsd * 100) / 100,
                  grossTradePnlMad: Math.round(ordGrossUsd * rates.USD_TO_MAD * 100) / 100,
                  grossTradePnlPercent:
                    ordPrincipalUsd > 0 ? Math.round((ordGrossUsd / ordPrincipalUsd) * 10000) / 100 : 0,
                  estimatedExitFeeUsd: Math.round(ordExitFeeUsd * 10000) / 10000,
                  estimatedExitFeeMad: Math.round(ordExitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
                  totalFeeLossUsd: Math.round(ordFeeLossUsd * 10000) / 10000,
                  totalFeeLossMad: Math.round(ordFeeLossUsd * rates.USD_TO_MAD * 1000) / 1000,
                  feeDragPercent: Math.round(feeRate * 200 * 100) / 100,
                  netTradePnlUsd: Math.round(ordNetUsd * 100) / 100,
                  netTradePnlMad: Math.round(ordNetUsd * rates.USD_TO_MAD * 100) / 100,
                  netTradePnlPercent:
                    ordPrincipalUsd > 0 ? Math.round((ordNetUsd / ordPrincipalUsd) * 10000) / 100 : 0,
                  breakevenPriceUsd: Math.round(bePriceUsd * 1e4) / 1e4,
                  breakevenPriceMad: Math.round(bePriceUsd * rates.USD_TO_MAD * 100) / 100,
                  distanceToBreakevenPercent: Math.round(distBePct * 100) / 100,
                  holdingDays,
                  dividendYieldPercent: Math.round(divYield * 100) / 100,
                  annualDividendLotUsd: Math.round(annDivUsd * 100) / 100,
                  annualDividendLotMad: Math.round(annDivUsd * rates.USD_TO_MAD * 100) / 100,
                  accruedDividendUsd: Math.round(accDivUsd * 100) / 100,
                  accruedDividendMad: Math.round(accDivUsd * rates.USD_TO_MAD * 100) / 100,
                  totalReturnWithDividendUsd: Math.round((ordNetUsd + accDivUsd) * 100) / 100,
                  totalReturnWithDividendMad: Math.round((ordNetUsd + accDivUsd) * rates.USD_TO_MAD * 100) / 100,
                };
              })
            : [
                {
                  id: Math.floor(createdMs / 1000),
                  orderId: Math.floor(createdMs / 1000),
                  symbol: normalizedSym,
                  baseAsset: cleanBase,
                  quoteAsset,
                  side: 'BUY' as const,
                  price: Math.round(entryPriceUsd * 1e4) / 1e4,
                  qty: Math.round(shares * 1e6) / 1e6,
                  quoteQty: Math.round(principalUsd * 100) / 100,
                  quoteQtyUsd: Math.round(principalUsd * 100) / 100,
                  quoteQtyMad: Math.round(principalMad * 100) / 100,
                  commission: Math.round(entryFeeUsd * 10000) / 10000,
                  commissionAsset: 'USD',
                  commissionUsd: Math.round(entryFeeUsd * 10000) / 10000,
                  commissionMad: Math.round(entryFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
                  time: createdMs,
                  executedAt: new Date(createdMs).toISOString(),
                  isMaker: false,
                  tradeSource: 'MANUAL' as const,
                  isCompletedTrade: false,
                  tradeStatusLabel: 'OPEN_LOT' as const,
                  openQtyRemaining: Math.round(shares * 1e6) / 1e6,
                  currentMarketPriceUsd: Math.round(livePriceUsd * 1e4) / 1e4,
                  currentMarketPriceMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 100) / 100,
                  currentLotValueUsd: Math.round(currentLotValueUsd * 100) / 100,
                  currentLotValueMad: Math.round(currentLotValueMad * 100) / 100,
                  matchedCostBasisUsd: Math.round(principalUsd * 100) / 100,
                  grossTradePnlUsd: Math.round(grossPnlUsd * 100) / 100,
                  grossTradePnlMad: Math.round(grossPnlUsd * rates.USD_TO_MAD * 100) / 100,
                  grossTradePnlPercent:
                    principalUsd > 0 ? Math.round((grossPnlUsd / principalUsd) * 10000) / 100 : 0,
                  estimatedExitFeeUsd: Math.round(exitFeeUsd * 10000) / 10000,
                  estimatedExitFeeMad: Math.round(exitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
                  totalFeeLossUsd: Math.round(totalFeeLossUsd * 10000) / 10000,
                  totalFeeLossMad: Math.round(totalFeeLossUsd * rates.USD_TO_MAD * 1000) / 1000,
                  feeDragPercent: Math.round(feeRate * 200 * 100) / 100,
                  netTradePnlUsd: Math.round(netPnlUsd * 100) / 100,
                  netTradePnlMad: Math.round(netPnlUsd * rates.USD_TO_MAD * 100) / 100,
                  netTradePnlPercent:
                    principalUsd > 0 ? Math.round((netPnlUsd / principalUsd) * 10000) / 100 : 0,
                  breakevenPriceUsd: Math.round(bePriceUsd * 1e4) / 1e4,
                  breakevenPriceMad: Math.round(bePriceUsd * rates.USD_TO_MAD * 100) / 100,
                  distanceToBreakevenPercent: Math.round(distBePct * 100) / 100,
                  holdingDays,
                  dividendYieldPercent: Math.round(divYield * 100) / 100,
                  annualDividendLotUsd: Math.round(annDivUsd * 100) / 100,
                  annualDividendLotMad: Math.round(annDivUsd * rates.USD_TO_MAD * 100) / 100,
                  accruedDividendUsd: Math.round(accDivUsd * 100) / 100,
                  accruedDividendMad: Math.round(accDivUsd * rates.USD_TO_MAD * 100) / 100,
                  totalReturnWithDividendUsd: Math.round(totRetUsd * 100) / 100,
                  totalReturnWithDividendMad: Math.round(totRetUsd * rates.USD_TO_MAD * 100) / 100,
                },
              ];

        return {
          trades,
          summary: {
            symbol: normalizedSym,
            baseAsset: cleanBase,
            quoteAsset,
            tradeCount: trades.length,
            buyCount: trades.filter((t) => t.side === 'BUY').length,
            sellCount: trades.filter((t) => t.side === 'SELL').length,
            totalBoughtQty: Math.round(shares * 1e6) / 1e6,
            totalSoldQty: 0,
            netAccumulatedQty: Math.round(shares * 1e6) / 1e6,
            totalBuyVolumeUsd: Math.round(principalUsd * 100) / 100,
            totalSellVolumeUsd: 0,
            avgBuyPriceUsd: Math.round(entryPriceUsd * 1e4) / 1e4,
            avgSellPriceUsd: 0,
            realizedPnlUsd: 0,
            realizedPnlMad: 0,
            unrealizedOpenPnlUsd: Math.round(grossPnlUsd * 100) / 100,
            unrealizedOpenPnlMad: Math.round(grossPnlUsd * rates.USD_TO_MAD * 100) / 100,
            netTotalPnlAfterFeesUsd: Math.round(netPnlUsd * 100) / 100,
            netTotalPnlAfterFeesMad: Math.round(netPnlUsd * rates.USD_TO_MAD * 100) / 100,
            breakevenPriceUsd: Math.round(bePriceUsd * 1e4) / 1e4,
            totalFeesUsd: Math.round(entryFeeUsd * 1000) / 1000,
            totalFeesMad: Math.round(entryFeeUsd * rates.USD_TO_MAD * 100) / 100,
            feeDragPercent: Math.round(feeRate * 200 * 100) / 100,
            firstTradeTime: trades[trades.length - 1]?.executedAt || null,
            lastTradeTime: trades[0]?.executedAt || null,
          },
        };
      }
    }

    // If the user queried a Stock / ETF / Market ticker (e.g. TSLA, NVDA, AAPL, SPY, ATW, IAM) that has live quote or catalog info,
    // return a 1-share Read-Only Market Benchmark Forensics Lot so they can inspect live price, round-trip fee drag, breakeven price, and dividends!
    if (liveStock || catalogItem) {
      const rawPrice = liveStock?.price || catalogItem?.price || 100;
      const currency = (liveStock?.currency || catalogItem?.currency || 'USD').toUpperCase();
      const toUsdRate =
        currency === 'MAD'
          ? 1 / rates.USD_TO_MAD
          : currency === 'EUR'
          ? rates.EUR_TO_MAD / rates.USD_TO_MAD
          : 1;
      const livePriceUsd = rawPrice * toUsdRate;
      const feeRate = catalogItem?.market === 'BVC' ? 0.0035 : 0.001;
      const entryFeeUsd = livePriceUsd * feeRate;
      const exitFeeUsd = livePriceUsd * feeRate;
      const feeLossUsd = entryFeeUsd + exitFeeUsd;
      const bePriceUsd = (livePriceUsd * (1 + feeRate)) / (1 - feeRate);
      const distBePct = livePriceUsd > 0 ? ((bePriceUsd - livePriceUsd) / livePriceUsd) * 100 : 0;
      const divYield = catalogItem?.dividendYieldPercent ?? liveStock?.dividendYieldPercent ?? 0;
      const annDivUsd = livePriceUsd * (divYield / 100);
      const accDivUsd = annDivUsd / 4;
      const netAfterFeeUsd = -feeLossUsd;
      const totRetUsd = netAfterFeeUsd + accDivUsd;

      const benchmarkLot = {
        id: Math.floor(now / 1000),
        orderId: Math.floor(now / 1000),
        symbol: normalizedSym,
        baseAsset: cleanBase,
        quoteAsset,
        side: 'BUY' as const,
        price: Math.round(livePriceUsd * 1e4) / 1e4,
        qty: 1,
        quoteQty: Math.round(livePriceUsd * 100) / 100,
        quoteQtyUsd: Math.round(livePriceUsd * 100) / 100,
        quoteQtyMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 100) / 100,
        commission: Math.round(entryFeeUsd * 10000) / 10000,
        commissionAsset: 'USD',
        commissionUsd: Math.round(entryFeeUsd * 10000) / 10000,
        commissionMad: Math.round(entryFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
        time: now,
        executedAt: new Date(now).toISOString(),
        isMaker: false,
        tradeSource: 'BENCHMARK' as const,
        isCompletedTrade: false,
        tradeStatusLabel: 'OPEN_LOT' as const,
        openQtyRemaining: 1,
        currentMarketPriceUsd: Math.round(livePriceUsd * 1e4) / 1e4,
        currentMarketPriceMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 100) / 100,
        currentLotValueUsd: Math.round(livePriceUsd * 100) / 100,
        currentLotValueMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 100) / 100,
        matchedCostBasisUsd: Math.round(livePriceUsd * 100) / 100,
        grossTradePnlUsd: 0,
        grossTradePnlMad: 0,
        grossTradePnlPercent: 0,
        estimatedExitFeeUsd: Math.round(exitFeeUsd * 10000) / 10000,
        estimatedExitFeeMad: Math.round(exitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
        totalFeeLossUsd: Math.round(feeLossUsd * 10000) / 10000,
        totalFeeLossMad: Math.round(feeLossUsd * rates.USD_TO_MAD * 1000) / 1000,
        feeDragPercent: Math.round(feeRate * 200 * 100) / 100,
        netTradePnlUsd: Math.round(netAfterFeeUsd * 1000) / 1000,
        netTradePnlMad: Math.round(netAfterFeeUsd * rates.USD_TO_MAD * 100) / 100,
        netTradePnlPercent: -Math.round(feeRate * 200 * 100) / 100,
        breakevenPriceUsd: Math.round(bePriceUsd * 1e4) / 1e4,
        breakevenPriceMad: Math.round(bePriceUsd * rates.USD_TO_MAD * 100) / 100,
        distanceToBreakevenPercent: Math.round(distBePct * 100) / 100,
        holdingDays: 90,
        dividendYieldPercent: Math.round(divYield * 100) / 100,
        annualDividendLotUsd: Math.round(annDivUsd * 100) / 100,
        annualDividendLotMad: Math.round(annDivUsd * rates.USD_TO_MAD * 100) / 100,
        accruedDividendUsd: Math.round(accDivUsd * 100) / 100,
        accruedDividendMad: Math.round(accDivUsd * rates.USD_TO_MAD * 100) / 100,
        totalReturnWithDividendUsd: Math.round(totRetUsd * 100) / 100,
        totalReturnWithDividendMad: Math.round(totRetUsd * rates.USD_TO_MAD * 100) / 100,
      };

      return {
        trades: [benchmarkLot],
        summary: {
          symbol: normalizedSym,
          baseAsset: cleanBase,
          quoteAsset,
          tradeCount: 1,
          buyCount: 1,
          sellCount: 0,
          totalBoughtQty: 1,
          totalSoldQty: 0,
          netAccumulatedQty: 1,
          totalBuyVolumeUsd: Math.round(livePriceUsd * 100) / 100,
          totalSellVolumeUsd: 0,
          avgBuyPriceUsd: Math.round(livePriceUsd * 1e4) / 1e4,
          avgSellPriceUsd: 0,
          realizedPnlUsd: 0,
          realizedPnlMad: 0,
          unrealizedOpenPnlUsd: 0,
          unrealizedOpenPnlMad: 0,
          netTotalPnlAfterFeesUsd: Math.round(netAfterFeeUsd * 1000) / 1000,
          netTotalPnlAfterFeesMad: Math.round(netAfterFeeUsd * rates.USD_TO_MAD * 100) / 100,
          breakevenPriceUsd: Math.round(bePriceUsd * 1e4) / 1e4,
          totalFeesUsd: Math.round(entryFeeUsd * 1000) / 1000,
          totalFeesMad: Math.round(entryFeeUsd * rates.USD_TO_MAD * 100) / 100,
          feeDragPercent: Math.round(feeRate * 200 * 100) / 100,
          firstTradeTime: benchmarkLot.executedAt,
          lastTradeTime: benchmarkLot.executedAt,
        },
      };
    }

    return result;
  }

  /**
   * Synchronize a TrueSpend Investment Wallet with the user's live Binance balance.
   * Modes:
   *  - 'stablecoins_only': Syncs the wallet's cash reserve to match Binance Spot/Funding free Stablecoins/Fiat
   *  - 'full_spot_balance': Syncs the wallet's balance to match the entire Binance Combined account value in MAD
   */
  async syncBinanceWithWallet(
    userId: string,
    payload: {
      walletId?: string;
      mode?: 'stablecoins_only' | 'full_spot_balance';
    }
  ) {
    const [rates, dbUser, liveQuotes] = await Promise.all([
      this.getExchangeRates(),
      userRepository.findById(userId),
      this.fetchLiveStockQuotes(COMMON_BINANCE_STOCK_TICKERS, true),
    ]);
    if (!dbUser) {
      throw new Error('User record not found.');
    }

    const overview = await binanceService.getAccountOverview(rates, {
      forceRefresh: true,
      externalStockQuotes: liveQuotes,
    });
    if (!overview.isConfigured || !overview.connected) {
      throw new Error(
        overview.statusMessage ||
          'Binance API is not connected. Configure BINANCE_API_KEY and BINANCE_ED25519_PRIVATE_KEY_B64 on the server first.'
      );
    }

    const mode = payload.mode === 'full_spot_balance' ? 'full_spot_balance' : 'stablecoins_only';
    const targetBalanceMad =
      mode === 'full_spot_balance' ? overview.totalCombinedValueMad : overview.stablecoinReserveMad;

    const allWallets = await walletRepository.findAllByUserId(userId);
    let targetWallet = payload.walletId
      ? allWallets.find((w) => w.id === payload.walletId)
      : allWallets.find((w) => w.type === 'Investment' && w.name.toLowerCase().includes('binance')) ||
        allWallets.find((w) => w.type === 'Investment');

    if (!targetWallet) {
      targetWallet = await walletRepository.create({
        userId,
        name: 'Binance Spot',
        type: 'Investment',
        isMain: false,
        initialBalance: targetBalanceMad.toFixed(2),
      });
      return {
        success: true,
        wallet: targetWallet,
        syncedBalanceMad: Math.round(targetBalanceMad * 100) / 100,
        mode,
        message: `Created "Binance Spot" Investment wallet and synced to ${targetBalanceMad.toFixed(2)} MAD.`,
      };
    }

    const kpis = await kpiService.getKpisForUser(dbUser);
    const kpiAcc = (kpis.accounts || []).find((a) => a.id === targetWallet!.id);
    const currentRecordedMad = kpiAcc
      ? Number(kpiAcc.balance) || 0
      : parseFloat(targetWallet.initialBalance || '0') || 0;
    const currentInitialMad = parseFloat(targetWallet.initialBalance || '0') || 0;
    const deltaMad = targetBalanceMad - currentRecordedMad;
    const nextInitialMad = Math.round((currentInitialMad + deltaMad) * 100) / 100;

    const updatedWallet = await walletRepository.update(targetWallet.id, userId, {
      initialBalance: nextInitialMad.toFixed(2),
    });

    return {
      success: true,
      wallet: updatedWallet,
      syncedBalanceMad: Math.round(targetBalanceMad * 100) / 100,
      previousBalanceMad: Math.round(currentRecordedMad * 100) / 100,
      adjustmentMad: Math.round(deltaMad * 100) / 100,
      mode,
      message:
        mode === 'stablecoins_only'
          ? `Synced ${targetWallet.name} cash reserve to ${targetBalanceMad.toFixed(2)} MAD (Binance Stablecoins/Fiat).`
          : `Synced ${targetWallet.name} to ${targetBalanceMad.toFixed(2)} MAD ($${overview.totalCombinedValueUsd.toFixed(2)} Live Binance Value).`,
    };
  }

  async logWalletCapitalTransfer(
    userId: string,
    payload: {
      direction: 'deposit' | 'withdrawal';
      bankWalletId?: string;
      investmentWalletId?: string;
      amountMad: number;
      notes?: string;
    }
  ) {
    const amountMad = Math.round((Number(payload.amountMad) || 0) * 100) / 100;
    if (amountMad <= 0) {
      throw new Error('Please enter a valid transfer amount greater than 0 MAD.');
    }

    const direction = payload.direction === 'withdrawal' ? 'withdrawal' : 'deposit';
    if (direction === 'deposit') {
      return await this.fundInvestmentWallet(userId, {
        sourceWalletId: payload.bankWalletId,
        destinationWalletId: payload.investmentWalletId,
        amountMad,
        notes: payload.notes || 'Capital Deposit to Binance / Investment Wallet',
      });
    }

    const allWallets = await walletRepository.findAllByUserId(userId);
    let invWallet = payload.investmentWalletId
      ? allWallets.find((w) => w.id === payload.investmentWalletId)
      : allWallets.find((w) => w.type === 'Investment' && w.name.toLowerCase().includes('binance')) ||
        allWallets.find((w) => w.type === 'Investment');

    if (!invWallet) {
      invWallet = await walletRepository.create({
        userId,
        name: 'Binance Spot',
        type: 'Investment',
        isMain: false,
        initialBalance: '0',
      });
    }

    const bankWallet = payload.bankWalletId
      ? allWallets.find((w) => w.id === payload.bankWalletId)
      : allWallets.find((w) => w.type === 'Bank' && w.isMain) ||
        allWallets.find((w) => w.type === 'Bank') ||
        allWallets.find((w) => w.type === 'Cash');

    if (!bankWallet) {
      throw new Error('Destination Bank or Cash wallet not found.');
    }

    if (invWallet.id === bankWallet.id) {
      throw new Error('Source Investment wallet and destination Bank wallet must be different.');
    }

    const tx = await transactionRepository.create({
      userId,
      walletId: invWallet.id,
      destinationWalletId: bankWallet.id,
      amount: amountMad.toFixed(2),
      type: 'Transfer',
      category: '🔄 Transfer',
      notes:
        payload.notes ||
        `Capital Withdrawal: ${invWallet.name} → ${bankWallet.name}`,
    });

    return {
      success: true,
      transaction: tx,
      sourceWallet: invWallet,
      destinationWallet: bankWallet,
    };
  }

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
    const spotPrice =
      live?.price ||
      catalogItem?.price ||
      Number(payload.currentPrice || payload.avgCostPerShare || 0);
    const avgCost = Number(payload.avgCostPerShare ?? spotPrice) || spotPrice;
    const divPerShare =
      payload.annualDividendPerShare !== undefined
        ? Number(payload.annualDividendPerShare)
        : catalogItem?.annualDividendPerShare || 0;
    const isWatchlistOnly = Boolean(payload.isWatchlistOnly) || shares <= 0;

    const existing = await investmentRepository.findPositionByTicker(ticker, userId);

    if (existing) {
      if (isWatchlistOnly) {
        return existing;
      }
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
    if (payload.avgCostPerShare !== undefined)
      updateData.avgCostPerShare = String(Math.max(0, Number(payload.avgCostPerShare)));
    if (payload.currentPrice !== undefined)
      updateData.currentPrice = String(Math.max(0, Number(payload.currentPrice)));
    if (payload.currency !== undefined) updateData.currency = payload.currency.toUpperCase();
    if (payload.annualDividendPerShare !== undefined)
      updateData.annualDividendPerShare = String(Math.max(0, Number(payload.annualDividendPerShare)));
    if (payload.targetWeightPercent !== undefined)
      updateData.targetWeightPercent = String(Math.max(0, Number(payload.targetWeightPercent)));
    if (payload.convictionThesis !== undefined) updateData.convictionThesis = payload.convictionThesis;
    if (payload.walletId !== undefined) updateData.walletId = payload.walletId;
    if (payload.isWatchlistOnly !== undefined)
      updateData.isWatchlistOnly = Boolean(payload.isWatchlistOnly);

    return await investmentRepository.updatePosition(positionId, userId, updateData);
  }

  async deleteStockPosition(userId: string, positionId: string) {
    await investmentRepository.deletePosition(positionId, userId);
    return { success: true };
  }

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
    let pricePerShare = Math.max(
      0,
      Number(payload.pricePerShare || position.currentPrice || currentAvgCost || 0)
    );
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
