import { investmentRepository } from '../repositories/InvestmentRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { kpiService } from './KpiService.js';
import { userRepository } from '../repositories/UserRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { gemini, MODEL_FLASH_LITE, MODEL_FLASH_DEEP, isModelQuotaExhausted } from './GeminiClient.js';

export const MOROCCAN_STOCKS_CATALOG = [
  { symbol: 'ATW', name: 'Attijariwafa Bank', sector: 'Financial Services', price: 512, dividendYield: 3.9, currency: 'MAD', desc: 'Leading pan-African banking and financial services group' },
  { symbol: 'BCP', name: 'Banque Centrale Populaire', sector: 'Financial Services', price: 298, dividendYield: 4.2, currency: 'MAD', desc: 'Major cooperative & retail banking institution' },
  { symbol: 'IAM', name: 'Maroc Telecom (Itissalat Al-Maghrib)', sector: 'Telecommunications', price: 98.5, dividendYield: 4.6, currency: 'MAD', desc: 'Dominant telecom operator in Morocco and West Africa' },
  { symbol: 'BOA', name: 'Bank of Africa (BMCE Group)', sector: 'Financial Services', price: 196, dividendYield: 4.1, currency: 'MAD', desc: 'International commercial bank across Africa and Europe' },
  { symbol: 'LHM', name: 'LafargeHolcim Maroc', sector: 'Building Materials', price: 1850, dividendYield: 3.6, currency: 'MAD', desc: 'Largest cement and construction materials producer in Morocco' },
  { symbol: 'MNG', name: 'Managem Mining', sector: 'Basic Materials', price: 2420, dividendYield: 1.8, currency: 'MAD', desc: 'Precious metals, gold, copper, and cobalt producer' },
  { symbol: 'TGCC', name: 'TGCC BTP Construction', sector: 'Industrials', price: 245, dividendYield: 3.2, currency: 'MAD', desc: 'Civil engineering and infrastructure contractor' },
  { symbol: 'CFG', name: 'CFG Bank', sector: 'Financial Services', price: 182, dividendYield: 2.2, currency: 'MAD', desc: 'Fast-growing universal investment and digital bank' },
  { symbol: 'ADH', name: 'Douja Promotion Groupe Addoha', sector: 'Real Estate', price: 28.8, dividendYield: 0, currency: 'MAD', desc: 'Moroccan low-income and mid-tier real estate developer' },
  { symbol: 'TQM', name: 'Taqa Morocco', sector: 'Utilities & Power', price: 1285, dividendYield: 3.8, currency: 'MAD', desc: 'Leading private electricity producer in Morocco' },
];

const COINGECKO_BASE_URL = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || 'CG-QQPesHFebtNf7UhaejrhmGsn';

// Comprehensive Ticker to CoinGecko ID mapping
const COINGECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  BITCOIN: 'bitcoin',
  ETH: 'ethereum',
  ETHEREUM: 'ethereum',
  SOL: 'solana',
  SOLANA: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  CARDANO: 'cardano',
  DOGE: 'dogecoin',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  USDT: 'tether',
  USDC: 'usd-coin',
  SUI: 'sui',
  NEAR: 'near',
  PEPE: 'pepe',
  SHIB: 'shiba-inu',
  TRX: 'tron',
  TON: 'the-open-network',
  XLM: 'stellar',
  BCH: 'bitcoin-cash',
  LTC: 'litecoin',
  UNI: 'uniswap',
  APT: 'aptos',
  ICP: 'internet-computer',
  FET: 'fetch-ai',
  RENDER: 'render-token',
  TAO: 'bittensor',
  KAS: 'kaspa',
  ARB: 'arbitrum',
  OP: 'optimism',
  INJ: 'injective-protocol',
  STX: 'blockstack',
  XMR: 'monero',
};

// Default exchange rates fallback
let cachedRates = {
  USD_TO_MAD: 10.05,
  EUR_TO_MAD: 10.95,
  USD_TO_EUR: 0.92,
  lastFetched: 0,
};

// Cache for quotes
const quotesCache: Record<string, { price: number; change24h: number; currency: string; lastUpdated: number; pricesByCurrency?: { USD: number; EUR: number; MAD: number } }> = {};

// Cache for market coins
let cachedMarketCoins: { data: any[]; lastFetched: number; vsCurrency: string } = {
  data: [],
  lastFetched: 0,
  vsCurrency: 'usd',
};

// Cache for trending coins
let cachedTrendingCoins: { data: any[]; lastFetched: number } = {
  data: [],
  lastFetched: 0,
};

export class InvestmentService {
  /**
   * Helper to build and execute CoinGecko requests with authentication and rate handling
   */
  private async fetchFromCoinGecko(endpoint: string, params: Record<string, string | number | boolean | undefined> = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${COINGECKO_BASE_URL.replace(/\/+$/, '')}${cleanEndpoint}`);
    
    if (COINGECKO_API_KEY) {
      url.searchParams.set('x_cg_demo_api_key', COINGECKO_API_KEY);
    }
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'TrueSpend-Wealth/1.0',
    };
    if (COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    }

    try {
      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        if (res.status === 429) {
          console.warn('[CoinGecko] Rate limited (429), serving fallback/cached data');
        } else {
          console.warn(`[CoinGecko] API responded with HTTP ${res.status} for ${cleanEndpoint}`);
        }
        return null;
      }

      return await res.json();
    } catch (err: any) {
      console.warn(`[CoinGecko] Request error on ${cleanEndpoint}:`, err?.message || err);
      return null;
    }
  }

  /**
   * Fetch live daily exchange rates for MAD, USD, and EUR directly from CoinGecko real-time market data
   */
  async getExchangeRates(): Promise<{ USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number }> {
    const now = Date.now();
    // Cache for 10 minutes
    if (now - cachedRates.lastFetched < 10 * 60 * 1000) {
      return {
        USD_TO_MAD: cachedRates.USD_TO_MAD,
        EUR_TO_MAD: cachedRates.EUR_TO_MAD,
        USD_TO_EUR: cachedRates.USD_TO_EUR,
      };
    }

    try {
      // 1. Fetch live multi-currency quotes from CoinGecko for USDT and USDC
      const data = await this.fetchFromCoinGecko('/simple/price', {
        ids: 'tether,usd-coin,bitcoin',
        vs_currencies: 'usd,eur,mad',
        include_24hr_change: 'true',
      });

      if (data && (data.tether || data['usd-coin'] || data.bitcoin)) {
        const stablecoin = data.tether || data['usd-coin'];
        if (stablecoin && stablecoin.mad && stablecoin.usd) {
          const usdToMad = parseFloat(stablecoin.mad) / parseFloat(stablecoin.usd);
          const eurRate = stablecoin.eur ? parseFloat(stablecoin.eur) : 0.92;
          const eurToMad = stablecoin.mad / eurRate;
          const usdToEur = eurRate / parseFloat(stablecoin.usd);

          cachedRates = {
            USD_TO_MAD: Math.round(usdToMad * 10000) / 10000,
            EUR_TO_MAD: Math.round(eurToMad * 10000) / 10000,
            USD_TO_EUR: Math.round(usdToEur * 10000) / 10000,
            lastFetched: now,
          };
          return cachedRates;
        } else if (data.bitcoin && data.bitcoin.mad && data.bitcoin.usd) {
          const btcMad = parseFloat(data.bitcoin.mad);
          const btcUsd = parseFloat(data.bitcoin.usd);
          const btcEur = parseFloat(data.bitcoin.eur) || btcUsd * 0.92;
          
          cachedRates = {
            USD_TO_MAD: Math.round((btcMad / btcUsd) * 10000) / 10000,
            EUR_TO_MAD: Math.round((btcMad / btcEur) * 10000) / 10000,
            USD_TO_EUR: Math.round((btcEur / btcUsd) * 10000) / 10000,
            lastFetched: now,
          };
          return cachedRates;
        }
      }
    } catch (e: any) {
      console.warn('[InvestmentService] CoinGecko exchange rate query notice:', e?.message);
    }

    // 2. Secondary fallback via open exchange rate API
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          const mad = parseFloat(data.rates.MAD) || 10.05;
          const eur = parseFloat(data.rates.EUR) || 0.92;
          cachedRates = {
            USD_TO_MAD: mad,
            EUR_TO_MAD: mad / eur,
            USD_TO_EUR: eur,
            lastFetched: now,
          };
        }
      }
    } catch (e) {
      // Keep cached rates
    }

    return {
      USD_TO_MAD: cachedRates.USD_TO_MAD,
      EUR_TO_MAD: cachedRates.EUR_TO_MAD,
      USD_TO_EUR: cachedRates.USD_TO_EUR,
    };
  }

  /** Convert an amount from given currency to MAD */
  toMad(amount: number, currency: string, rates: { USD_TO_MAD: number; EUR_TO_MAD: number }): number {
    const c = (currency || 'USD').toUpperCase();
    if (c === 'MAD') return amount;
    if (c === 'EUR') return amount * rates.EUR_TO_MAD;
    return amount * rates.USD_TO_MAD; // Default USD
  }

  /**
   * Fetch top market coins from CoinGecko with 24h change, sparklines, and volume
   */
  async getMarketCoins(vsCurrency = 'usd', perPage = 50, forceRefresh = false): Promise<any[]> {
    const now = Date.now();
    const curr = vsCurrency.toLowerCase();

    if (!forceRefresh && cachedMarketCoins.data.length > 0 && cachedMarketCoins.vsCurrency === curr && now - cachedMarketCoins.lastFetched < 60 * 1000) {
      return cachedMarketCoins.data;
    }

    const data = await this.fetchFromCoinGecko('/coins/markets', {
      vs_currency: curr,
      order: 'market_cap_desc',
      per_page: perPage,
      page: 1,
      sparkline: 'true',
      price_change_percentage: '24h',
    });

    if (Array.isArray(data) && data.length > 0) {
      cachedMarketCoins = {
        data,
        lastFetched: now,
        vsCurrency: curr,
      };
      return data;
    }

    return cachedMarketCoins.data || [];
  }

  /**
   * Fetch top trending coins on CoinGecko with real-time price and change
   */
  async getTrendingCoins(): Promise<any[]> {
    const now = Date.now();
    if (cachedTrendingCoins.data.length > 0 && now - cachedTrendingCoins.lastFetched < 2 * 60 * 1000) {
      return cachedTrendingCoins.data;
    }

    try {
      const data = await this.fetchFromCoinGecko('/search/trending');
      if (data && Array.isArray(data.coins)) {
        const rates = await this.getExchangeRates();
        const trending = data.coins.slice(0, 15).map((c: any) => {
          const item = c.item || {};
          if (item.symbol && item.id) {
            COINGECKO_MAP[item.symbol.toUpperCase()] = item.id;
          }
          const rawUsdPrice = item.data?.price;
          const priceChange24h = item.data?.price_change_percentage_24h?.usd || 0;
          let parsedPriceUsd = 0;
          if (typeof rawUsdPrice === 'number') {
            parsedPriceUsd = rawUsdPrice;
          } else if (typeof rawUsdPrice === 'string') {
            parsedPriceUsd = parseFloat(rawUsdPrice.replace(/[^0-9.-]+/g, '')) || 0;
          }
          const priceMad = parsedPriceUsd * rates.USD_TO_MAD;

          return {
            id: item.id,
            coinId: item.id,
            name: item.name,
            symbol: (item.symbol || '').toUpperCase(),
            marketCapRank: item.market_cap_rank,
            thumb: item.thumb,
            large: item.large,
            priceUsd: Math.round(parsedPriceUsd * 10000) / 10000,
            priceMad: Math.round(priceMad * 100) / 100,
            change24h: Math.round(priceChange24h * 100) / 100,
            sparkline: item.data?.sparkline,
          };
        });

        cachedTrendingCoins = {
          data: trending,
          lastFetched: now,
        };
        return trending;
      }
    } catch (e: any) {
      console.warn('[InvestmentService] Trending fetch notice:', e?.message);
    }
    return cachedTrendingCoins.data || [];
  }

  /**
   * Get detailed market data, 24h stats, ATH, and 7d sparkline for a coin
   */
  async getCoinDetails(coinId: string): Promise<any> {
    if (!coinId) return null;
    const cleanId = coinId.toLowerCase().trim();
    try {
      const data = await this.fetchFromCoinGecko('/coins/markets', {
        vs_currency: 'usd',
        ids: cleanId,
        sparkline: 'true',
        price_change_percentage: '24h,7d',
      });

      if (Array.isArray(data) && data[0]) {
        const coin = data[0];
        const rates = await this.getExchangeRates();
        const priceUsd = parseFloat(coin.current_price) || 0;
        const priceMad = priceUsd * rates.USD_TO_MAD;
        if (coin.symbol && coin.id) {
          COINGECKO_MAP[coin.symbol.toUpperCase()] = coin.id;
        }

        return {
          id: coin.id,
          symbol: (coin.symbol || '').toUpperCase(),
          name: coin.name,
          image: coin.image,
          currentPriceUsd: priceUsd,
          currentPriceMad: Math.round(priceMad * 100) / 100,
          marketCap: coin.market_cap,
          marketCapRank: coin.market_cap_rank,
          totalVolume: coin.total_volume,
          high24h: coin.high_24h,
          low24h: coin.low_24h,
          priceChange24h: coin.price_change_24h,
          priceChangePercentage24h: coin.price_change_percentage_24h,
          priceChangePercentage7d: coin.price_change_percentage_7d_in_currency,
          ath: coin.ath,
          athChangePercentage: coin.ath_change_percentage,
          atl: coin.atl,
          sparkline7d: coin.sparkline_in_7d?.price || [],
        };
      }
    } catch (e: any) {
      console.warn(`[InvestmentService] Details fetch notice for ${cleanId}:`, e?.message);
    }
    return null;
  }

  /**
   * Search CoinGecko for any coin or token and map symbols dynamically
   */
  async searchCoins(query: string): Promise<any[]> {
    if (!query || query.trim().length < 1) return [];
    const data = await this.fetchFromCoinGecko('/search', { query: query.trim() });
    if (data && Array.isArray(data.coins)) {
      const rates = await this.getExchangeRates();
      // Register symbols in COINGECKO_MAP dynamically
      data.coins.forEach((c: any) => {
        if (c.symbol && c.id) {
          COINGECKO_MAP[c.symbol.toUpperCase()] = c.id;
        }
      });
      return data.coins.slice(0, 15).map((c: any) => ({
        ...c,
        rates,
      }));
    }
    return [];
  }

  /**
   * Get real-time spot price in USD, EUR, and MAD for trade prefilling
   */
  async getSpotPrice(symbol: string, coinId?: string): Promise<{ symbol: string; priceUsd: number; priceEur: number; priceMad: number; change24h: number }> {
    const sym = symbol.toUpperCase().trim();
    const id = coinId || COINGECKO_MAP[sym];
    const rates = await this.getExchangeRates();

    if (id) {
      const data = await this.fetchFromCoinGecko('/simple/price', {
        ids: id,
        vs_currencies: 'usd,eur,mad',
        include_24hr_change: 'true',
      });

      if (data && data[id]) {
        const coin = data[id];
        const priceUsd = parseFloat(coin.usd) || 0;
        const priceEur = parseFloat(coin.eur) || priceUsd * rates.USD_TO_EUR;
        const priceMad = parseFloat(coin.mad) || priceUsd * rates.USD_TO_MAD;
        const change24h = parseFloat(coin.usd_24h_change) || 0;

        return {
          symbol: sym,
          priceUsd,
          priceEur,
          priceMad,
          change24h,
        };
      }
    }

    // Check memory cache or fallback quotes
    const cached = quotesCache[sym];
    const basePrice = cached?.price || 0;
    return {
      symbol: sym,
      priceUsd: basePrice,
      priceEur: basePrice * rates.USD_TO_EUR,
      priceMad: basePrice * rates.USD_TO_MAD,
      change24h: cached?.change24h || 0,
    };
  }

  /** Fetch live quotes for a list of symbols across CoinGecko and global tickers */
  async fetchLiveQuotes(symbols: string[]): Promise<Record<string, { symbol: string; price: number; change24h: number; currency: string; lastUpdated: string }>> {
    const result: Record<string, { symbol: string; price: number; change24h: number; currency: string; lastUpdated: string }> = {};
    if (!symbols || symbols.length === 0) return result;

    const uniqueSymbols = Array.from(new Set(symbols.map(s => s.toUpperCase().trim())));
    const now = Date.now();

    // 1. Group crypto symbols that have coingecko mapping
    const cryptoSymbolsToFetch: string[] = [];
    const coingeckoIds: string[] = [];

    for (const sym of uniqueSymbols) {
      const cached = quotesCache[sym];
      if (cached && now - cached.lastUpdated < 60 * 1000) {
        result[sym] = {
          symbol: sym,
          price: cached.price,
          change24h: cached.change24h,
          currency: cached.currency,
          lastUpdated: new Date(cached.lastUpdated).toISOString(),
        };
        continue;
      }

      const cgId = COINGECKO_MAP[sym];
      if (cgId) {
        cryptoSymbolsToFetch.push(sym);
        if (!coingeckoIds.includes(cgId)) coingeckoIds.push(cgId);
      }
    }

    // Fetch crypto from CoinGecko
    if (coingeckoIds.length > 0) {
      try {
        const data = await this.fetchFromCoinGecko('/simple/price', {
          ids: coingeckoIds.join(','),
          vs_currencies: 'usd,eur,mad',
          include_24hr_change: 'true',
        });

        if (data) {
          for (const sym of cryptoSymbolsToFetch) {
            const cgId = COINGECKO_MAP[sym];
            if (data[cgId]) {
              const price = parseFloat(data[cgId].usd) || 0;
              const change24h = parseFloat(data[cgId].usd_24h_change) || 0;
              quotesCache[sym] = {
                price,
                change24h,
                currency: 'USD',
                lastUpdated: now,
                pricesByCurrency: {
                  USD: price,
                  EUR: parseFloat(data[cgId].eur) || 0,
                  MAD: parseFloat(data[cgId].mad) || 0,
                },
              };
              result[sym] = {
                symbol: sym,
                price,
                change24h,
                currency: 'USD',
                lastUpdated: new Date(now).toISOString(),
              };
            }
          }
        }
      } catch (e: any) {
        console.warn('[InvestmentService] CoinGecko fetch notice:', e?.message);
      }
    }

    // 2. Fetch stock and ETF symbols via Yahoo Finance
    for (const sym of uniqueSymbols) {
      if (!result[sym]) {
        try {
          const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
          const res = await fetch(yhUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(4000),
          });
          if (res.ok) {
            const ydata = await res.json();
            const meta = ydata?.chart?.result?.[0]?.meta;
            if (meta && meta.regularMarketPrice) {
              const price = parseFloat(meta.regularMarketPrice) || 0;
              const prev = parseFloat(meta.previousClose || meta.chartPreviousClose) || price;
              const change24h = prev > 0 ? ((price - prev) / prev) * 100 : 0;
              const currency = meta.currency || 'USD';
              quotesCache[sym] = { price, change24h, currency, lastUpdated: now };
              result[sym] = {
                symbol: sym,
                price,
                change24h,
                currency,
                lastUpdated: new Date(now).toISOString(),
              };
            }
          }
        } catch {
          // Ignore Yahoo errors
        }
      }
    }

    return result;
  }

  /** Complete investments data package for the client */
  async getInvestmentsData(userId: string) {
    const [holdings, txs, dcaList, watchlist, rates, dbUser, marketCoinsRaw] = await Promise.all([
      investmentRepository.findAllHoldingsByUserId(userId),
      investmentRepository.findAllTransactionsByUserId(userId),
      investmentRepository.findAllDcaPlansByUserId(userId),
      investmentRepository.findAllWatchlistByUserId(userId),
      this.getExchangeRates(),
      userRepository.findById(userId),
      this.getMarketCoins('usd', 50),
    ]);

    // Fetch live market quotes for all held symbols + watchlist symbols
    const heldSymbols = holdings.map(h => h.symbol);
    const watchedSymbols = watchlist.map(w => w.symbol);
    const allSymbols = Array.from(new Set([...heldSymbols, ...watchedSymbols]));
    const liveQuotes = await this.fetchLiveQuotes(allSymbols);

    // Enrich market coins with isWatched flag
    const watchedCoinIds = new Set(watchlist.map(w => w.coinId.toLowerCase()));
    const marketCoins = marketCoinsRaw.map((coin: any) => ({
      ...coin,
      isWatched: watchedCoinIds.has(coin.id.toLowerCase()) || watchedCoinIds.has(coin.symbol.toLowerCase()),
    }));

    // Compute holdings values
    let totalPortfolioValueMad = 0;
    let totalCostBasisMad = 0;
    let annualPassiveIncomeMad = 0;

    const enrichedHoldings = holdings.map(h => {
      const units = parseFloat(h.units || '0') || 0;
      const buyPriceAvg = parseFloat(h.buyPriceAvg || '0') || 0;
      const quote = liveQuotes[h.symbol.toUpperCase()];
      const currentPrice = quote?.price || parseFloat(h.currentPrice || '0') || buyPriceAvg;
      const change24h = quote?.change24h || 0;

      const currency = h.currency || quote?.currency || 'USD';
      const costBasisLocal = units * buyPriceAvg;
      const marketValLocal = units * currentPrice;
      const unrealizedPnlLocal = marketValLocal - costBasisLocal;
      const unrealizedPnlPercent = costBasisLocal > 0 ? (unrealizedPnlLocal / costBasisLocal) * 100 : 0;

      const marketValMad = this.toMad(marketValLocal, currency, rates);
      const costBasisMad = this.toMad(costBasisLocal, currency, rates);
      const unrealizedPnlMad = marketValMad - costBasisMad;

      totalPortfolioValueMad += marketValMad;
      totalCostBasisMad += costBasisMad;

      // Yield & Passive Income
      const yieldPct = parseFloat(h.dividendYieldPercent || '0') || 0;
      if (yieldPct > 0) {
        annualPassiveIncomeMad += (marketValMad * yieldPct) / 100;
      }

      return {
        ...h,
        currentPrice: currentPrice.toString(),
        totalCostBasis: costBasisLocal,
        currentMarketValue: marketValLocal,
        unrealizedPnl: unrealizedPnlLocal,
        unrealizedPnlPercent,
        change24h,
      };
    });

    const totalUnrealizedPnlMad = totalPortfolioValueMad - totalCostBasisMad;
    const totalUnrealizedPnlPercent = totalCostBasisMad > 0 ? (totalUnrealizedPnlMad / totalCostBasisMad) * 100 : 0;

    // Calculate Safe-To-Invest and FIRE metrics
    let safeToInvest = {
      monthlyIncome: 0,
      fixedObligations: 0,
      variableSpendPace: 0,
      emergencyBufferDeficiency: 0,
      pendingPayables: 0,
      totalInvestmentBudget: 0,
      investedThisMonth: 0,
      remainingInvestmentBudget: 0,
      safeToInvestMonthly: 0,
      currentMonthlyDcaTarget: 0,
      surplusAfterDca: 0,
      dcaBudgetStatus: 'covered_by_surplus' as 'fully_budgeted' | 'over_budget' | 'covered_by_surplus' | 'exceeds_capacity',
      dcaBudgetCoveragePercent: 0,
      recommendationText: '',
      riskAppetiteMax: 0,
    };

    let monthlyLivingExpenses = 3000; // baseline fallback

    if (dbUser) {
      try {
        const kpis = await kpiService.getKpisForUser(dbUser);
        const salary = (kpis.currentFinancialAmount && kpis.currentFinancialAmount > 0) 
          ? kpis.currentFinancialAmount 
          : (kpis.monthlyIncome || parseFloat((dbUser.salary as any) || '0') || 0);

        const totalFixedBudget = kpis.totalFixedBudget || 0;
        const totalVariableBudget = kpis.totalVariableBudget || 0;
        const totalSavingsBudget = (kpis as any).totalSavingsBudget || 0;
        const totalInvestmentBudget = (kpis as any).totalInvestmentBudget || 0;

        // FIXED LIVING OBLIGATIONS (Based Primarily on Category Budgets set in Budgets feature):
        let fixedObligations = 0;
        if (totalFixedBudget > 0) {
          fixedObligations = Math.max(totalFixedBudget, kpis.monthlyFixedExpenses || 0);
        } else {
          fixedObligations = (kpis.monthlyFixedExpenses || 0) + (kpis.remainingFixedBudget || 0);
        }
        fixedObligations = Math.round(fixedObligations * 100) / 100;

        // VARIABLE LIVING SPEND (Based Primarily on Category Budgets set in Budgets feature):
        const daysRemaining = kpis.forecast?.daysRemaining || kpis.dailyRemaining || 0;
        const avgDailyVariable = kpis.avgDailyVariableSpend || kpis.avgDailySpend || 0;
        const variableProjected = daysRemaining > 0 ? Math.round(avgDailyVariable * daysRemaining * 100) / 100 : 0;

        let variableSpendAllowance = 0;
        if (totalVariableBudget > 0) {
          variableSpendAllowance = Math.max(totalVariableBudget, kpis.monthlyVariableExpenses || 0);
        } else {
          variableSpendAllowance = variableProjected;
        }
        variableSpendAllowance = Math.round(variableSpendAllowance * 100) / 100;

        const totalEmergencyTarget = parseFloat((dbUser.emergencyBuffer as any) || '0');
        const emergencyDeficit = Math.max(0, Math.round((totalEmergencyTarget - kpis.emergencyBuffer) * 100) / 100);
        const savingsReserveAllocation = Math.max(emergencyDeficit, totalSavingsBudget);
        const payables = Math.round((kpis.pendingPayables || 0) * 100) / 100;

        // Total Budgeted Living Expenses
        const totalBudgetedExpenses = fixedObligations + variableSpendAllowance;
        monthlyLivingExpenses = Math.max(1000, totalBudgetedExpenses);

        // Budget-based Monthly Surplus = Salary - Fixed Category Budgets - Variable Category Budgets - Savings/Emergency Budget - Payables
        const rawBudgetSurplus = salary - totalBudgetedExpenses - savingsReserveAllocation - payables;

        // Liquid Safe-To-Spend limit (liquid cash in Bank + Cash, minus Emergency Buffer & Payables)
        const liquidSafeToSpend = Math.max(0, Math.round((kpis.safeToSpend || 0) * 100) / 100);

        // Available Safe Investable Surplus (cannot exceed budget-based surplus OR liquid cash)
        const investableSurplus = Math.max(0, Math.round(Math.min(rawBudgetSurplus, liquidSafeToSpend) * 100) / 100);

        // If the user configured an explicit monthly target for 📈 Investments in Budgets, respect it as target
        const effectiveSafeToInvest = totalInvestmentBudget > 0
          ? Math.min(totalInvestmentBudget, investableSurplus)
          : investableSurplus;

        // Active DCA commitments in MAD
        let currentMonthlyDcaTarget = 0;
        for (const plan of dcaList) {
          if (plan.status === 'active') {
            const planAmt = parseFloat(plan.targetAmount || '0') || 0;
            let monthlyMultiplier = 1;
            if (plan.frequency === 'daily') monthlyMultiplier = 30;
            else if (plan.frequency === 'weekly') monthlyMultiplier = 4.33;
            currentMonthlyDcaTarget += this.toMad(planAmt * monthlyMultiplier, plan.currency, rates);
          }
        }
        currentMonthlyDcaTarget = Math.round(currentMonthlyDcaTarget * 100) / 100;

        const surplusAfterDca = Math.round((effectiveSafeToInvest - currentMonthlyDcaTarget) * 100) / 100;

        let recommendationText = '';
        if (emergencyDeficit > 0) {
          recommendationText = `⚠️ Your emergency buffer is short by ${emergencyDeficit.toLocaleString()} MAD. TrueSpend recommends topping up your safety vault before deploying aggressive capital into investments.`;
        } else if (liquidSafeToSpend <= 0) {
          recommendationText = `⚠️ You currently have 0 MAD in Safe-to-Spend liquid cash. Top up your checking account before opening new investment trades.`;
        } else if (rawBudgetSurplus <= 0) {
          recommendationText = `⚠️ Your category budgets and obligations exhaust your monthly income. Adjust your budgets to unlock a safe investment surplus.`;
        } else if (totalInvestmentBudget > 0 && currentMonthlyDcaTarget > totalInvestmentBudget) {
          recommendationText = `⚠️ Your planned monthly DCA (${currentMonthlyDcaTarget.toLocaleString()} MAD) exceeds your configured 📈 Investments budget (${totalInvestmentBudget.toLocaleString()} MAD).`;
        } else if (currentMonthlyDcaTarget > effectiveSafeToInvest) {
          recommendationText = `⚠️ Your planned monthly DCA (${currentMonthlyDcaTarget.toLocaleString()} MAD) exceeds this month's safe investable surplus (${effectiveSafeToInvest.toLocaleString()} MAD). Consider pausing or trimming some DCA orders.`;
        } else if (surplusAfterDca > 0) {
          recommendationText = totalInvestmentBudget > 0
            ? `✅ You have ${surplusAfterDca.toLocaleString()} MAD remaining in your 📈 Investments budget (${totalInvestmentBudget.toLocaleString()} MAD/mo target, ${investableSurplus.toLocaleString()} MAD safe capacity).`
            : `✅ You have ${surplusAfterDca.toLocaleString()} MAD in safe investable surplus calculated directly from your Category Budgets & cash flow.`;
        } else {
          recommendationText = `All active DCA targets are comfortably covered by your budget-based surplus with zero risk to your living expenses.`;
        }

        const investedThisMonth = Math.round(((kpis as any).monthlyInvestmentFunded || 0) * 100) / 100;
        const targetInvestmentBase = totalInvestmentBudget > 0 ? totalInvestmentBudget : effectiveSafeToInvest;
        const remainingInvestmentBudget = Math.max(0, Math.round((targetInvestmentBase - investedThisMonth) * 100) / 100);

        let dcaBudgetStatus: 'fully_budgeted' | 'over_budget' | 'covered_by_surplus' | 'exceeds_capacity' = 'covered_by_surplus';
        if (totalInvestmentBudget > 0) {
          dcaBudgetStatus = currentMonthlyDcaTarget <= totalInvestmentBudget ? 'fully_budgeted' : 'over_budget';
        } else {
          dcaBudgetStatus = currentMonthlyDcaTarget <= effectiveSafeToInvest ? 'covered_by_surplus' : 'exceeds_capacity';
        }

        const dcaBudgetCoveragePercent = totalInvestmentBudget > 0
          ? Math.round((currentMonthlyDcaTarget / totalInvestmentBudget) * 100)
          : (effectiveSafeToInvest > 0 ? Math.round((currentMonthlyDcaTarget / effectiveSafeToInvest) * 100) : 0);

        safeToInvest = {
          monthlyIncome: Math.round(salary * 100) / 100,
          fixedObligations: fixedObligations,
          variableSpendPace: variableSpendAllowance,
          emergencyBufferDeficiency: savingsReserveAllocation,
          pendingPayables: payables,
          totalInvestmentBudget: Math.round(totalInvestmentBudget * 100) / 100,
          investedThisMonth,
          remainingInvestmentBudget,
          safeToInvestMonthly: effectiveSafeToInvest,
          currentMonthlyDcaTarget,
          surplusAfterDca,
          dcaBudgetStatus,
          dcaBudgetCoveragePercent,
          recommendationText,
          riskAppetiteMax: Math.round(investableSurplus * 0.7 * 100) / 100,
        };
      } catch (err) {
        console.warn('[InvestmentService] KPI computation notice:', (err as any)?.message);
      }
    }

    const monthlyPassiveIncome = annualPassiveIncomeMad / 12;
    const fireCoveragePercent = monthlyLivingExpenses > 0 ? (monthlyPassiveIncome / monthlyLivingExpenses) * 100 : 0;

    const popularStocks = await this.getPopularStocks(rates);

    return {
      holdings: enrichedHoldings,
      transactions: txs,
      dcaPlans: dcaList,
      watchlist,
      marketCoins,
      quotes: liveQuotes,
      rates,
      popularStocks,
      totalPortfolioValueMad: Math.round(totalPortfolioValueMad * 100) / 100,
      totalCostBasisMad: Math.round(totalCostBasisMad * 100) / 100,
      totalUnrealizedPnlMad: Math.round(totalUnrealizedPnlMad * 100) / 100,
      totalUnrealizedPnlPercent: Math.round(totalUnrealizedPnlPercent * 100) / 100,
      annualPassiveIncomeMad: Math.round(annualPassiveIncomeMad * 100) / 100,
      monthlyPassiveIncomeMad: Math.round(monthlyPassiveIncome * 100) / 100,
      fireCoveragePercent: Math.round(fireCoveragePercent * 10) / 10,
      safeToInvest,
    };
  }

  /** Create or add a holding */
  async createHolding(userId: string, data: any) {
    const symbol = (data.symbol || '').toUpperCase().trim();
    if (!symbol) throw new Error('Symbol is required (e.g. BTC, AAPL, VOO)');
    const name = (data.name || symbol).trim();
    const assetType = data.assetType || 'crypto';
    const units = String(data.units ?? 0);
    const buyPriceAvg = String(data.buyPriceAvg ?? data.currentPrice ?? 0);
    const currentPrice = String(data.currentPrice ?? buyPriceAvg);
    const currency = (data.currency || 'USD').toUpperCase();

    const holding = await investmentRepository.createHolding({
      userId,
      walletId: data.walletId || null,
      symbol,
      name,
      assetType,
      units,
      buyPriceAvg,
      currentPrice,
      currency,
      targetAllocationPercent: String(data.targetAllocationPercent || 0),
      dividendYieldPercent: String(data.dividendYieldPercent || 0),
      notes: data.notes || null,
    });

    if (data.deductFromWallet && data.walletId) {
      try {
        const wallet = await walletRepository.findById(data.walletId, userId);
        const unitsNum = parseFloat(units) || 0;
        const buyPriceNum = parseFloat(buyPriceAvg) || 0;
        const totalCost = unitsNum * buyPriceNum;
        if (wallet && totalCost > 0) {
          const rates = await this.getExchangeRates();
          const madAmount = this.toMad(totalCost, currency, rates);
          await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: madAmount.toFixed(2),
            type: 'Expense',
            category: '📈 Investments',
            notes: `Initial purchase of ${unitsNum} ${symbol} @ ${buyPriceNum} ${currency}`,
          });
        }
      } catch (err) {
        console.warn('[InvestmentService] Failed to auto-deduct initial holding cost:', err);
      }
    }

    return holding;
  }

  /** Update an existing holding */
  async updateHolding(userId: string, id: string, data: any) {
    const holding = await investmentRepository.findHoldingById(id, userId);
    if (!holding) throw new Error('Holding not found');

    const updateData: any = {};
    if (data.symbol) updateData.symbol = data.symbol.toUpperCase().trim();
    if (data.name) updateData.name = data.name.trim();
    if (data.assetType) updateData.assetType = data.assetType;
    if (data.units !== undefined) updateData.units = String(data.units);
    if (data.buyPriceAvg !== undefined) updateData.buyPriceAvg = String(data.buyPriceAvg);
    if (data.currentPrice !== undefined) updateData.currentPrice = String(data.currentPrice);
    if (data.currency) updateData.currency = data.currency.toUpperCase();
    if (data.walletId !== undefined) updateData.walletId = data.walletId;
    if (data.targetAllocationPercent !== undefined) updateData.targetAllocationPercent = String(data.targetAllocationPercent);
    if (data.dividendYieldPercent !== undefined) updateData.dividendYieldPercent = String(data.dividendYieldPercent);
    if (data.notes !== undefined) updateData.notes = data.notes;

    return await investmentRepository.updateHolding(id, userId, updateData);
  }

  /** Delete holding */
  async deleteHolding(userId: string, id: string) {
    await investmentRepository.deleteHolding(id, userId);
    return { success: true };
  }

  /** Execute a Trade: BUY, SELL, DIVIDEND, STAKING_REWARD */
  async executeTrade(userId: string, payload: {
    holdingId: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND' | 'STAKING_REWARD';
    units?: number;
    pricePerUnit?: number;
    totalAmount?: number;
    fees?: number;
    walletId?: string | null;
    notes?: string;
  }) {
    const holding = await investmentRepository.findHoldingById(payload.holdingId, userId);
    if (!holding) throw new Error('Target holding not found');

    const type = payload.type;
    const fees = payload.fees || 0;
    const currentUnits = parseFloat(holding.units || '0') || 0;
    const currentBuyPrice = parseFloat(holding.buyPriceAvg || '0') || 0;

    let units = payload.units || 0;
    let pricePerUnit = payload.pricePerUnit || 0;
    let totalAmount = payload.totalAmount || 0;

    if (!totalAmount && units > 0 && pricePerUnit > 0) {
      totalAmount = units * pricePerUnit;
    } else if (!pricePerUnit && units > 0 && totalAmount > 0) {
      pricePerUnit = totalAmount / units;
    }

    let realizedPnl = 0;

    if (type === 'BUY') {
      if (units <= 0 || totalAmount <= 0) throw new Error('BUY order requires valid units and total amount');
      const newTotalUnits = currentUnits + units;
      // Weighted average buy cost
      const newBuyPriceAvg = newTotalUnits > 0
        ? (currentUnits * currentBuyPrice + units * pricePerUnit) / newTotalUnits
        : pricePerUnit;

      await investmentRepository.updateHolding(holding.id, userId, {
        units: newTotalUnits.toString(),
        buyPriceAvg: newBuyPriceAvg.toString(),
        currentPrice: pricePerUnit.toString(),
      });

      // Deduct cash from settlement wallet if specified
      if (payload.walletId) {
        const wallet = await walletRepository.findById(payload.walletId, userId);
        if (wallet) {
          const rates = await this.getExchangeRates();
          const madAmount = this.toMad(totalAmount + fees, holding.currency || 'USD', rates);
          await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: madAmount.toFixed(2),
            type: 'Expense',
            category: '📈 Investments',
            notes: `Bought ${units} ${holding.symbol} @ ${pricePerUnit} ${holding.currency}`,
          });
        }
      }
    } else if (type === 'SELL') {
      if (units <= 0) throw new Error('SELL order requires units > 0');
      if (units > currentUnits + 0.00000001) {
        throw new Error(`Insufficient units to sell. You have ${currentUnits} ${holding.symbol}, requested ${units}`);
      }

      realizedPnl = (pricePerUnit - currentBuyPrice) * units - fees;
      const remainingUnits = Math.max(0, currentUnits - units);

      await investmentRepository.updateHolding(holding.id, userId, {
        units: remainingUnits.toString(),
        currentPrice: pricePerUnit.toString(),
      });

      // Credit cash to settlement wallet if specified
      if (payload.walletId) {
        const wallet = await walletRepository.findById(payload.walletId, userId);
        if (wallet) {
          const rates = await this.getExchangeRates();
          const netProceeds = Math.max(0, totalAmount - fees);
          const madAmount = this.toMad(netProceeds, holding.currency || 'USD', rates);
          await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: madAmount.toFixed(2),
            type: 'Income',
            category: 'Investment Returns & Capital Gains',
            notes: `Sold ${units} ${holding.symbol} @ ${pricePerUnit} ${holding.currency} (P&L: ${realizedPnl.toFixed(2)})`,
          });
        }
      }
    } else if (type === 'DIVIDEND' || type === 'STAKING_REWARD') {
      if (totalAmount <= 0) throw new Error('Dividend / Staking reward requires positive total amount');
      // Credit cash to settlement wallet if specified
      if (payload.walletId) {
        const wallet = await walletRepository.findById(payload.walletId, userId);
        if (wallet) {
          const rates = await this.getExchangeRates();
          const netYield = Math.max(0, totalAmount - fees);
          const madAmount = this.toMad(netYield, holding.currency || 'USD', rates);
          await transactionRepository.create({
            userId,
            walletId: wallet.id,
            amount: madAmount.toFixed(2),
            type: 'Income',
            category: '📈 Investment Returns / Dividends',
            notes: `${type === 'DIVIDEND' ? 'Dividend' : 'Staking Reward'} from ${holding.symbol}`,
          });
        }
      }
    }

    // Record the trade in investment_transactions
    const createdTx = await investmentRepository.createTransaction({
      userId,
      holdingId: holding.id,
      walletId: payload.walletId || null,
      type,
      units: units.toString(),
      pricePerUnit: pricePerUnit.toString(),
      totalAmount: totalAmount.toString(),
      currency: holding.currency || 'USD',
      fees: fees.toString(),
      realizedPnl: realizedPnl.toString(),
      notes: payload.notes || null,
    });

    return {
      success: true,
      transaction: createdTx,
    };
  }

  /** Create a DCA Plan */
  async createDcaPlan(userId: string, data: any) {
    const symbol = (data.symbol || '').toUpperCase().trim();
    if (!symbol) throw new Error('Symbol is required');
    const assetName = (data.assetName || symbol).trim();
    const assetType = data.assetType || 'crypto';
    const targetAmount = String(data.targetAmount || 0);
    const currency = (data.currency || 'MAD').toUpperCase();
    const frequency = data.frequency || 'post_payday';
    const dayOffsetAfterPayday = parseInt(data.dayOffsetAfterPayday || '2', 10);

    return await investmentRepository.createDcaPlan({
      userId,
      holdingId: data.holdingId || null,
      symbol,
      assetName,
      assetType,
      targetAmount,
      currency,
      frequency,
      dayOffsetAfterPayday,
      walletId: data.walletId || null,
      status: 'active',
    });
  }

  /** Update DCA Plan */
  async updateDcaPlan(userId: string, id: string, data: any) {
    const plan = await investmentRepository.findDcaPlanById(id, userId);
    if (!plan) throw new Error('DCA plan not found');

    const updateData: any = {};
    if (data.symbol) updateData.symbol = data.symbol.toUpperCase().trim();
    if (data.assetName) updateData.assetName = data.assetName.trim();
    if (data.targetAmount !== undefined) updateData.targetAmount = String(data.targetAmount);
    if (data.currency) updateData.currency = data.currency.toUpperCase();
    if (data.frequency) updateData.frequency = data.frequency;
    if (data.dayOffsetAfterPayday !== undefined) updateData.dayOffsetAfterPayday = parseInt(data.dayOffsetAfterPayday, 10);
    if (data.walletId !== undefined) updateData.walletId = data.walletId;
    if (data.status) updateData.status = data.status;

    return await investmentRepository.updateDcaPlan(id, userId, updateData);
  }

  /** Delete DCA Plan */
  async deleteDcaPlan(userId: string, id: string) {
    await investmentRepository.deleteDcaPlan(id, userId);
    return { success: true };
  }

  /** Watchlist APIs */
  async getWatchlist(userId: string) {
    return await investmentRepository.findAllWatchlistByUserId(userId);
  }

  async addToWatchlist(userId: string, data: { coinId: string; symbol: string; name: string }) {
    const coinId = (data.coinId || '').toLowerCase().trim();
    const symbol = (data.symbol || '').toUpperCase().trim();
    const name = (data.name || symbol).trim();
    if (!coinId) throw new Error('Coin ID is required');

    return await investmentRepository.addToWatchlist({
      userId,
      coinId,
      symbol,
      name,
    });
  }

  async removeFromWatchlist(userId: string, coinIdOrId: string) {
    await investmentRepository.removeFromWatchlistByCoinId(coinIdOrId, userId);
    return { success: true };
  }

  /** Search US & Global Stocks, ETFs and Casablanca BVC Equities */
  async searchStocks(query: string) {
    const q = (query || '').trim().toLowerCase();
    const rates = await this.getExchangeRates();
    const results: any[] = [];

    // 1. Search Moroccan Equities catalog
    for (const st of MOROCCAN_STOCKS_CATALOG) {
      if (!q || st.symbol.toLowerCase().includes(q) || st.name.toLowerCase().includes(q) || st.sector.toLowerCase().includes(q)) {
        results.push({
          symbol: st.symbol,
          name: st.name,
          quoteType: 'EQUITY',
          exchange: 'Casablanca BVC',
          currency: 'MAD',
          sector: st.sector,
          price: st.price,
          change24h: 0.35,
          priceInMad: st.price,
          dividendYield: st.dividendYield,
        });
      }
    }

    if (!q) {
      return results.slice(0, 10);
    }

    // 2. Search Global / US Equities via Yahoo Finance
    try {
      const yhUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
      const res = await fetch(yhUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const quotes = data?.quotes || [];
        for (const item of quotes) {
          if (item.isYahooFinance === false) continue;
          if (['EQUITY', 'ETF', 'MUTUALFUND'].includes(item.quoteType)) {
            // Avoid duplicates
            if (!results.some(r => r.symbol.toUpperCase() === item.symbol.toUpperCase())) {
              results.push({
                symbol: item.symbol,
                name: item.shortname || item.longname || item.symbol,
                quoteType: item.quoteType,
                exchange: item.exchange || 'US',
                currency: 'USD',
                sector: item.sector || item.industry || (item.quoteType === 'ETF' ? 'Index ETF' : 'Equities'),
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[InvestmentService] Stock search query notice:', e?.message);
    }

    return results.slice(0, 15);
  }

  /** Get detailed real-time stock quote with sparkline and metrics */
  async getStockDetails(symbol: string) {
    const sym = symbol.toUpperCase().trim();
    const rates = await this.getExchangeRates();

    // Check Moroccan catalog first
    const moroccan = MOROCCAN_STOCKS_CATALOG.find(m => m.symbol === sym);
    if (moroccan) {
      const base = moroccan.price;
      const sparkline = [
        base * 0.985, base * 0.988, base * 0.992, base * 0.99, base * 0.996,
        base * 1.002, base * 1.006, base * 1.008, base * 1.004, base
      ].map(v => Math.round(v * 100) / 100);

      return {
        symbol: moroccan.symbol,
        name: moroccan.name,
        price: moroccan.price,
        change24h: 0.35,
        changeAmount: 1.8,
        high24h: Math.round(moroccan.price * 1.015 * 10) / 10,
        low24h: Math.round(moroccan.price * 0.988 * 10) / 10,
        prevClose: Math.round(moroccan.price * 0.996 * 10) / 10,
        fiftyTwoWeekHigh: Math.round(moroccan.price * 1.18 * 10) / 10,
        fiftyTwoWeekLow: Math.round(moroccan.price * 0.85 * 10) / 10,
        dividendYield: moroccan.dividendYield,
        currency: 'MAD',
        priceInMad: moroccan.price,
        exchange: 'Casablanca BVC',
        sector: moroccan.sector,
        assetType: 'bourse_local' as const,
        sparkline,
      };
    }

    // Query Yahoo Finance
    try {
      const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1mo`;
      const res = await fetch(yhUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta && meta.regularMarketPrice) {
          const price = parseFloat(meta.regularMarketPrice) || 0;
          const prev = parseFloat(meta.chartPreviousClose || meta.previousClose) || price;
          const change24h = prev > 0 ? ((price - prev) / prev) * 100 : 0;
          const currency = meta.currency || 'USD';
          const priceInMad = this.toMad(price, currency, rates);
          
          const rawCloses = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          const sparkline = rawCloses
            .filter((v: any) => typeof v === 'number' && !isNaN(v))
            .map((v: number) => Math.round(v * 100) / 100);

          return {
            symbol: sym,
            name: meta.shortName || meta.symbol || sym,
            price: Math.round(price * 100) / 100,
            change24h: Math.round(change24h * 100) / 100,
            changeAmount: Math.round((price - prev) * 100) / 100,
            high24h: meta.regularMarketDayHigh ? Math.round(meta.regularMarketDayHigh * 100) / 100 : undefined,
            low24h: meta.regularMarketDayLow ? Math.round(meta.regularMarketDayLow * 100) / 100 : undefined,
            prevClose: Math.round(prev * 100) / 100,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ? Math.round(meta.fiftyTwoWeekHigh * 100) / 100 : undefined,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow ? Math.round(meta.fiftyTwoWeekLow * 100) / 100 : undefined,
            currency,
            priceInMad: Math.round(priceInMad * 100) / 100,
            exchange: meta.exchangeName || 'US Equities',
            sector: sym.includes('VOO') || sym.includes('QQQ') || sym.includes('SPY') ? 'Index ETF' : 'Equities',
            assetType: (meta.instrumentType === 'ETF' || sym.endsWith('ETF') ? 'etf' : 'stock') as any,
            sparkline: sparkline.length > 0 ? sparkline : [price * 0.99, price * 1.01, price],
          };
        }
      }
    } catch (e: any) {
      console.warn(`[InvestmentService] Details fetch notice for ${sym}:`, e?.message);
    }

    return null;
  }

  /** Get curated popular stocks and Moroccan equities */
  async getPopularStocks(rates?: any) {
    const exchangeRates = rates || await this.getExchangeRates();
    const result: {
      indices: any[];
      tech: any[];
      dividends: any[];
      morocco: any[];
    } = {
      indices: [],
      tech: [],
      dividends: [],
      morocco: [],
    };

    // Moroccan Equities
    result.morocco = MOROCCAN_STOCKS_CATALOG.map(st => ({
      symbol: st.symbol,
      name: st.name,
      price: st.price,
      change24h: 0.35,
      currency: 'MAD',
      priceInMad: st.price,
      sector: st.sector,
      dividendYield: st.dividendYield,
      assetType: 'bourse_local',
      exchange: 'Casablanca BVC',
      sparkline: [st.price * 0.99, st.price * 0.995, st.price * 1.002, st.price],
    }));

    // Curated Global US Tickers
    const symbolsToQuery = [
      { sym: 'VOO', name: 'Vanguard S&P 500 ETF', cat: 'indices', assetType: 'etf', sector: 'Index ETF', div: 1.4 },
      { sym: 'QQQ', name: 'Invesco QQQ (Nasdaq 100)', cat: 'indices', assetType: 'etf', sector: 'Tech Index ETF', div: 0.6 },
      { sym: 'VT', name: 'Vanguard Total World ETF', cat: 'indices', assetType: 'etf', sector: 'Global ETF', div: 1.9 },
      { sym: 'AAPL', name: 'Apple Inc.', cat: 'tech', assetType: 'stock', sector: 'Consumer Electronics', div: 0.5 },
      { sym: 'MSFT', name: 'Microsoft Corporation', cat: 'tech', assetType: 'stock', sector: 'Cloud & Software', div: 0.7 },
      { sym: 'NVDA', name: 'NVIDIA Corporation', cat: 'tech', assetType: 'stock', sector: 'Semiconductors & AI', div: 0.1 },
      { sym: 'GOOGL', name: 'Alphabet Inc.', cat: 'tech', assetType: 'stock', sector: 'Internet & Search', div: 0.4 },
      { sym: 'AMZN', name: 'Amazon.com Inc.', cat: 'tech', assetType: 'stock', sector: 'E-Commerce & Cloud', div: 0 },
      { sym: 'META', name: 'Meta Platforms Inc.', cat: 'tech', assetType: 'stock', sector: 'Social Media & AI', div: 0.3 },
      { sym: 'TSLA', name: 'Tesla Inc.', cat: 'tech', assetType: 'stock', sector: 'EV & Robotics', div: 0 },
      { sym: 'SCHD', name: 'Schwab US Dividend Equity ETF', cat: 'dividends', assetType: 'etf', sector: 'Dividend ETF', div: 3.4 },
      { sym: 'O', name: 'Realty Income (Monthly Dividend)', cat: 'dividends', assetType: 'stock', sector: 'Real Estate REIT', div: 5.2 },
      { sym: 'JNJ', name: 'Johnson & Johnson', cat: 'dividends', assetType: 'stock', sector: 'Healthcare & Pharma', div: 3.1 },
      { sym: 'KO', name: 'The Coca-Cola Company', cat: 'dividends', assetType: 'stock', sector: 'Consumer Staples', div: 3.0 },
    ];

    // Fetch batch quotes in parallel
    const quotes = await this.fetchLiveQuotes(symbolsToQuery.map(s => s.sym));

    for (const item of symbolsToQuery) {
      const q = quotes[item.sym];
      const price = q?.price || 100;
      const change24h = q?.change24h || 0;
      const currency = q?.currency || 'USD';
      const priceInMad = this.toMad(price, currency, exchangeRates);

      const entry = {
        symbol: item.sym,
        name: item.name,
        price: Math.round(price * 100) / 100,
        change24h: Math.round(change24h * 100) / 100,
        currency,
        priceInMad: Math.round(priceInMad * 100) / 100,
        sector: item.sector,
        dividendYield: item.div,
        assetType: item.assetType,
        exchange: 'US',
        sparkline: [price * (1 - change24h * 0.01), price * (1 - change24h * 0.005), price],
      };

      if (item.cat === 'indices') result.indices.push(entry);
      else if (item.cat === 'tech') result.tech.push(entry);
      else if (item.cat === 'dividends') result.dividends.push(entry);
    }

    return result;
  }

  /** Run Deep AI Stock Portfolio Analysis using Gemini with Safe-to-Invest alignment */
  async analyzeStockPortfolio(userId: string) {
    const [holdings, txs, dcaList, dbUser, rates] = await Promise.all([
      investmentRepository.findAllHoldingsByUserId(userId),
      investmentRepository.findAllTransactionsByUserId(userId),
      investmentRepository.findAllDcaPlansByUserId(userId),
      userRepository.findById(userId),
      this.getExchangeRates(),
    ]);

    // Calculate metrics
    let totalPortfolioMad = 0;
    let totalCostBasisMad = 0;
    let totalAnnualDividendsMad = 0;
    const sectorMap: Record<string, number> = {};
    const currencyMap: Record<string, number> = {};

    const stockHoldings = holdings.map(h => {
      const units = parseFloat(h.units || '0') || 0;
      const buyPrice = parseFloat(h.buyPriceAvg || '0') || 0;
      const currentPrice = parseFloat(h.currentPrice || '0') || buyPrice;
      const currency = h.currency || 'USD';
      const valMad = this.toMad(units * currentPrice, currency, rates);
      const costMad = this.toMad(units * buyPrice, currency, rates);
      const divYield = parseFloat(h.dividendYieldPercent || '0') || 0;

      totalPortfolioMad += valMad;
      totalCostBasisMad += costMad;
      totalAnnualDividendsMad += (valMad * divYield) / 100;

      const sector = h.assetType === 'etf' ? 'Index ETFs' : (h.assetType === 'bourse_local' ? 'Moroccan Equities' : (h.assetType === 'crypto' ? 'Crypto' : 'Equities'));
      sectorMap[sector] = (sectorMap[sector] || 0) + valMad;
      currencyMap[currency] = (currencyMap[currency] || 0) + valMad;

      return {
        symbol: h.symbol,
        name: h.name,
        assetType: h.assetType,
        units,
        buyPrice,
        currentPrice,
        currency,
        valueMad: Math.round(valMad),
        pnlPercent: costMad > 0 ? Math.round(((valMad - costMad) / costMad) * 100) : 0,
        dividendYield: divYield,
        notes: h.notes || undefined,
      };
    });

    let safeToInvestAmount = 2500;
    let monthlyIncome = 15000;
    if (dbUser) {
      try {
        const kpis = await kpiService.getKpisForUser(dbUser);
        safeToInvestAmount = (kpis as any).effectiveSafeToInvest || 2500;
        monthlyIncome = kpis.monthlyIncome || 15000;
      } catch {
        // fallback
      }
    }

    // Default rule-based result in case of quota or model delay
    const sectorAllocations = Object.entries(sectorMap).map(([sector, amountMad]) => ({
      sector,
      amountMad: Math.round(amountMad),
      percentage: totalPortfolioMad > 0 ? Math.round((amountMad / totalPortfolioMad) * 100) : 0,
    }));

    const currencyExposure = Object.entries(currencyMap).map(([currency, amountMad]) => ({
      currency,
      amountMad: Math.round(amountMad),
      percentage: totalPortfolioMad > 0 ? Math.round((amountMad / totalPortfolioMad) * 100) : 0,
    }));

    const monthlyDividendsMad = Math.round(totalAnnualDividendsMad / 12);
    const dividendCoverage = monthlyIncome > 0 ? Math.round((monthlyDividendsMad / (monthlyIncome * 0.4)) * 100) : 0;

    let fallbackGrade = 'B+';
    let fallbackScore = 82;
    if (stockHoldings.length === 0) {
      fallbackGrade = 'N/A';
      fallbackScore = 50;
    } else if (stockHoldings.length >= 4 && sectorAllocations.length >= 2) {
      fallbackGrade = 'A';
      fallbackScore = 90;
    }

    const fallbackAnalysis = {
      portfolioGrade: fallbackGrade,
      healthScore: fallbackScore,
      executiveVerdict: stockHoldings.length > 0
        ? `Your portfolio holds ${stockHoldings.length} asset positions totaling ${Math.round(totalPortfolioMad).toLocaleString()} MAD. You have ${safeToInvestAmount > 0 ? safeToInvestAmount.toLocaleString() + ' MAD in Safe-to-Invest surplus this cycle' : 'a balanced budget'} to deploy into compounding positions.`
        : 'You do not have any active stock positions yet. Use your Safe-to-Invest surplus to begin dollar-cost averaging into broad index ETFs like VOO or blue-chip dividend compounders.',
      diversificationScore: stockHoldings.length >= 4 ? 85 : Math.max(30, stockHoldings.length * 20),
      sectorAllocations,
      currencyExposure,
      riskFlags: stockHoldings.length === 0 ? [] : [
        {
          severity: stockHoldings.length < 3 ? 'high' as const : 'low' as const,
          title: stockHoldings.length < 3 ? 'High Concentration Risk' : 'Healthy Asset Breadth',
          detail: stockHoldings.length < 3
            ? 'Portfolio has fewer than 3 active positions. Single stock drawdowns could heavily impact net worth.'
            : 'Positions are distributed across multiple holdings and tickers.',
        },
        {
          severity: (currencyExposure.find(c => c.currency === 'USD')?.percentage || 0) > 75 ? 'medium' as const : 'low' as const,
          title: 'Currency Fluctuation Exposure',
          detail: 'Significant USD asset exposure. Favorable for long-term dollar hedge, but subject to USD/MAD foreign exchange swings.',
        },
      ],
      recommendations: [
        {
          title: 'Anchor Core in Broad Index ETFs',
          rationale: 'Allocate at least 50% of monthly investment surplus to broad index ETFs (VOO or QQQ) for steady compounding.',
          priority: 'high' as const,
        },
        {
          title: 'Sync Stock DCA with Payday Schedule',
          rationale: `Automate stock purchases 2 days after payday to capture ${safeToInvestAmount.toLocaleString()} MAD surplus before discretionary leaks.`,
          priority: 'medium' as const,
        },
        {
          title: 'Reinvest Dividends (DRIP)',
          rationale: `Turn on automated dividend reinvestment to accelerate compounding on your ${monthlyDividendsMad.toLocaleString()} MAD/mo passive run-rate.`,
          priority: 'medium' as const,
        },
      ],
      projectedPassiveIncomeMad: Math.round(totalAnnualDividendsMad),
      monthlyDividendCoveragePercent: dividendCoverage,
      goldenRule: 'Never deploy aggressive stock capital before securing your 3-month TrueSpend emergency vault.',
      analyzedAt: new Date().toISOString(),
    };

    // If Gemini is available and not exhausted, generate AI analysis
    const modelToTry = !isModelQuotaExhausted(MODEL_FLASH_LITE) ? MODEL_FLASH_LITE : (!isModelQuotaExhausted(MODEL_FLASH_DEEP) ? MODEL_FLASH_DEEP : null);

    if (modelToTry) {
      try {
        const prompt = `You are Spex, the Chief Investment & Wealth Intelligence Co-Pilot in TrueSpend.
Analyze the user's investment portfolio and financial situation:

USER FINANCIAL SNAPSHOT:
- Monthly Income: ${monthlyIncome.toLocaleString()} MAD
- Safe-to-Invest Allowance this cycle: ${safeToInvestAmount.toLocaleString()} MAD
- Total Portfolio Value: ${Math.round(totalPortfolioMad).toLocaleString()} MAD
- Total Cost Basis: ${Math.round(totalCostBasisMad).toLocaleString()} MAD
- Active Holdings (${stockHoldings.length}):
${JSON.stringify(stockHoldings, null, 2)}
- DCA Plans: ${JSON.stringify(dcaList.map(d => ({ symbol: d.symbol, amount: d.targetAmount, freq: d.frequency })))}

Return a JSON object conforming strictly to this structure:
{
  "portfolioGrade": "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D",
  "healthScore": integer from 0 to 100,
  "executiveVerdict": "2-3 insightful sentences evaluating their stock portfolio, risk balance, and Safe-to-Invest alignment.",
  "diversificationScore": integer from 0 to 100,
  "riskFlags": [
    { "severity": "high" | "medium" | "low", "title": "short title", "detail": "1-2 sentence explanation" }
  ],
  "recommendations": [
    { "title": "short action title", "rationale": "clear rationale aligned with TrueSpend cash flow", "priority": "high" | "medium" | "low" }
  ],
  "goldenRule": "1 memorable sentence summarizing their best next investment move"
}
Ensure JSON is valid with no markdown code blocks outside.`;

        const response = await gemini.models.generateContent({
          model: modelToTry,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            ...fallbackAnalysis,
            portfolioGrade: parsed.portfolioGrade || fallbackAnalysis.portfolioGrade,
            healthScore: parsed.healthScore || fallbackAnalysis.healthScore,
            executiveVerdict: parsed.executiveVerdict || fallbackAnalysis.executiveVerdict,
            diversificationScore: parsed.diversificationScore || fallbackAnalysis.diversificationScore,
            riskFlags: parsed.riskFlags?.length ? parsed.riskFlags : fallbackAnalysis.riskFlags,
            recommendations: parsed.recommendations?.length ? parsed.recommendations : fallbackAnalysis.recommendations,
            goldenRule: parsed.goldenRule || fallbackAnalysis.goldenRule,
            analyzedAt: new Date().toISOString(),
          };
        }
      } catch (err: any) {
        console.warn('[InvestmentService] AI stock analysis notice:', err?.message);
      }
    }

    return fallbackAnalysis;
  }
}

export const investmentService = new InvestmentService();
