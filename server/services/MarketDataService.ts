import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  investmentDividendEvents,
  investmentSettings,
  marketDataDailyBars,
  marketDataSymbols,
  marketDataUsage,
  portfolioDailySnapshots,
} from '../../src/db/schema.js';
import type {
  DailyOhlcvBar,
  DividendEventRecord,
  InstrumentDetailPayload,
  InvestmentGoalItem,
  InvestmentSettingsConfig,
  PriceFreshnessState,
  StockPosition,
  TwelveDataBudgetStatus,
} from '../../src/types/index.js';
import {
  computeTechnicalIndicators,
  resolveInstrumentIdentity,
} from '../../src/lib/investmentIntelligence.js';
import { normalizeStockTicker } from '../../src/lib/stockCategories.js';

// ============================================================================
// TWELVE DATA ENDPOINT WEIGHT ALLOWLIST (§12.3 & §12.4)
// Unknown or unverified endpoints are strictly disabled (weight = null).
// ============================================================================
const TWELVE_DATA_ENDPOINT_WEIGHTS: Record<string, { weightPerSymbol: number; enabledOnFree: boolean; reason: string }> = {
  '/time_series': {
    weightPerSymbol: 1,
    enabledOnFree: true,
    reason: 'Primary daily OHLCV dataset (1 credit per symbol). Powers price charts, candles, SMA/EMA/RSI/MACD/Bollinger, volatility, drawdown, and correlations.',
  },
  '/quote': {
    weightPerSymbol: 1,
    enabledOnFree: false,
    reason: 'Disabled by default on Free tier to preserve daily credit budget; daily OHLCV + Yahoo live quotes are used instead.',
  },
  '/dividends': {
    weightPerSymbol: 20,
    enabledOnFree: false,
    reason: 'Disabled on Free tier due to high credit cost and plan restrictions.',
  },
  '/earnings': {
    weightPerSymbol: 20,
    enabledOnFree: false,
    reason: 'Disabled on Free tier due to high credit cost and plan restrictions.',
  },
  '/statistics': {
    weightPerSymbol: 50,
    enabledOnFree: false,
    reason: 'Disabled on Free tier due to high credit cost and plan restrictions.',
  },
  '/market_movers': {
    weightPerSymbol: 50,
    enabledOnFree: false,
    reason: 'Disabled on Free tier due to high credit cost.',
  },
  '/api_usage': {
    weightPerSymbol: 1,
    enabledOnFree: false,
    reason: 'Never polled automatically because each /api_usage call consumes 1 credit; response headers and local ledger are used instead.',
  },
};

const APP_DAILY_HARD_LIMIT = Math.min(
  250,
  Math.max(25, Number(process.env.TWELVE_DATA_DAILY_BUDGET) || 250)
);
const APP_DAILY_WARNING_THRESHOLD = Math.min(200, Math.floor(APP_DAILY_HARD_LIMIT * 0.8));
const APP_DAILY_TARGET_LIMIT = Math.min(150, Math.floor(APP_DAILY_HARD_LIMIT * 0.6));
const APP_PER_MINUTE_LIMIT = 8;
const PROVIDER_DAILY_QUOTA = 800;

// Reference baseline prices and volatility profiles for deterministic fallback bars when offline
const BASELINE_SYMBOL_PROFILES: Record<
  string,
  { price: number; currency: string; annualDividend: number; yieldPct: number; pe?: number; mktCapB?: number; desc: string }
> = {
  ORCL: {
    price: 178.4,
    currency: 'USD',
    annualDividend: 1.6,
    yieldPct: 0.9,
    pe: 38.4,
    mktCapB: 492,
    desc: 'Oracle Corporation provides enterprise database software, autonomous cloud infrastructure (OCI), and enterprise ERP applications.',
  },
  NVDA: {
    price: 138.6,
    currency: 'USD',
    annualDividend: 0.04,
    yieldPct: 0.03,
    pe: 52.1,
    mktCapB: 3390,
    desc: 'NVIDIA Corporation designs accelerated computing GPUs, AI data center clusters, and CUDA software stacks.',
  },
  JPM: {
    price: 234.5,
    currency: 'USD',
    annualDividend: 5.0,
    yieldPct: 2.13,
    pe: 12.8,
    mktCapB: 665,
    desc: 'JPMorgan Chase & Co. is a leading global financial services firm and the largest banking institution in the United States.',
  },
  USAR: {
    price: 11.8,
    currency: 'USD',
    annualDividend: 0,
    yieldPct: 0,
    desc: 'USA Rare Earth, Inc. develops domestic US rare-earth mining and sintered neodymium iron boron (NdFeB) permanent magnet manufacturing.',
  },
  AAPL: {
    price: 231.4,
    currency: 'USD',
    annualDividend: 1.0,
    yieldPct: 0.43,
    pe: 34.5,
    mktCapB: 3510,
    desc: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and subscription services.',
  },
  MSFT: {
    price: 428.5,
    currency: 'USD',
    annualDividend: 3.32,
    yieldPct: 0.77,
    pe: 35.8,
    mktCapB: 3180,
    desc: 'Microsoft Corporation develops productivity software, Azure cloud infrastructure, and enterprise AI systems.',
  },
  TSLA: {
    price: 258.5,
    currency: 'USD',
    annualDividend: 0,
    yieldPct: 0,
    pe: 68.0,
    mktCapB: 815,
    desc: 'Tesla, Inc. designs and manufactures electric vehicles, grid-scale battery energy storage systems, and autonomous driving technology.',
  },
  SPY: {
    price: 586.5,
    currency: 'USD',
    annualDividend: 7.03,
    yieldPct: 1.2,
    desc: 'SPDR S&P 500 ETF Trust tracks the price and dividend yield performance of the S&P 500 Index.',
  },
  QQQ: {
    price: 504.2,
    currency: 'USD',
    annualDividend: 2.92,
    yieldPct: 0.58,
    desc: 'Invesco QQQ Trust tracks the Nasdaq-100 Index of the 100 largest non-financial companies listed on NASDAQ.',
  },
  VOO: {
    price: 538.2,
    currency: 'USD',
    annualDividend: 6.78,
    yieldPct: 1.26,
    desc: 'Vanguard S&P 500 ETF tracks the performance of the S&P 500 Index with an ultra-low 0.03% expense ratio.',
  },
  SCHD: {
    price: 29.1,
    currency: 'USD',
    annualDividend: 1.03,
    yieldPct: 3.54,
    desc: 'Schwab U.S. Dividend Equity ETF tracks the Dow Jones U.S. Dividend 100 Index of high-quality dividend-paying equities.',
  },
  MASI: {
    price: 14820.0,
    currency: 'MAD',
    annualDividend: 0,
    yieldPct: 0,
    desc: 'Moroccan All Shares Index (MASI) tracks the performance of all companies listed on the Casablanca Stock Exchange (BVC).',
  },
};

export class MarketDataService {
  private memoryBarsCache = new Map<string, { bars: DailyOhlcvBar[]; fetchedAtMs: number }>();
  private inFlightSymbolFetches = new Map<string, Promise<DailyOhlcvBar[]>>();
  private lastProviderCreditsLeftHeader: number | null = null;
  private lastRefreshIso: string | null = null;

  private getUtcDateAndMinute(): { utcDate: string; utcMinute: string } {
    const iso = new Date().toISOString();
    return {
      utcDate: iso.slice(0, 10),
      utcMinute: iso.slice(0, 16),
    };
  }

  private isTwelveDataConfigured(): boolean {
    const key = (process.env.TWELVE_DATA_API_KEY || '').trim();
    return key.length > 8;
  }

  private isTwelveDataDisplayConfirmed(userOverride?: boolean): boolean {
    if (process.env.TWELVE_DATA_DISPLAY_LICENSE_CONFIRMED === 'true') return true;
    return Boolean(userOverride);
  }

  /**
   * Returns current Twelve Data & Market Data Cache telemetry without exposing any API keys.
   */
  async getBudgetAndCacheStatus(userDisplayApproved = false): Promise<TwelveDataBudgetStatus> {
    const { utcDate, utcMinute } = this.getUtcDateAndMinute();
    const apiKeyConfigured = this.isTwelveDataConfigured();
    const displayLicenseConfirmed = this.isTwelveDataDisplayConfirmed(userDisplayApproved);

    let creditsUsedToday = 0;
    let creditsUsedCurrentMinute = 0;
    let cachedBarsCount = 0;
    let cachedSymbolsCount = this.memoryBarsCache.size;

    try {
      const todayRows = await db
        .select({
          totalToday: sql<number>`COALESCE(SUM(${marketDataUsage.creditsReserved}), 0)`,
        })
        .from(marketDataUsage)
        .where(
          and(
            eq(marketDataUsage.utcDate, utcDate),
            eq(marketDataUsage.provider, 'twelve_data')
          )
        );
      creditsUsedToday = Number(todayRows[0]?.totalToday || 0);

      const minRows = await db
        .select({
          totalMin: sql<number>`COALESCE(SUM(${marketDataUsage.creditsReserved}), 0)`,
        })
        .from(marketDataUsage)
        .where(
          and(
            eq(marketDataUsage.utcMinute, utcMinute),
            eq(marketDataUsage.provider, 'twelve_data')
          )
        );
      creditsUsedCurrentMinute = Number(minRows[0]?.totalMin || 0);

      const barStats = await db
        .select({
          symCount: sql<number>`COUNT(DISTINCT ${marketDataDailyBars.symbol})`,
          barCount: sql<number>`COUNT(*)`,
        })
        .from(marketDataDailyBars);
      cachedSymbolsCount = Math.max(cachedSymbolsCount, Number(barStats[0]?.symCount || 0));
      cachedBarsCount = Number(barStats[0]?.barCount || 0);
    } catch {
      // Fallback to in-memory counts if table is still initializing
    }

    const creditsRemainingAppBudget = Math.max(0, APP_DAILY_HARD_LIMIT - creditsUsedToday);
    let status: TwelveDataBudgetStatus['status'] = 'nominal';
    if (!apiKeyConfigured || !displayLicenseConfirmed) {
      status = 'cache_only';
    } else if (creditsUsedToday >= APP_DAILY_HARD_LIMIT) {
      status = 'budget_reached';
    } else if (creditsUsedToday >= APP_DAILY_WARNING_THRESHOLD) {
      status = 'warning';
    }

    const licenseNotice = !apiKeyConfigured
      ? 'Twelve Data API key not configured; operating in persistent Yahoo/Binance EOD cache mode (0 Twelve Data credits used).'
      : !displayLicenseConfirmed
      ? 'Twelve Data Basic plan is labeled internal non-display usage. Visual charts are served from persistent Yahoo/Binance EOD cache until display entitlement is confirmed.'
      : `Twelve Data display gate active. Enforcing conservative ${APP_DAILY_HARD_LIMIT}/day cap (out of 800 provider quota) and ${APP_PER_MINUTE_LIMIT}/min rate limit.`;

    return {
      provider: apiKeyConfigured && displayLicenseConfirmed ? 'twelve_data' : 'hybrid_cache',
      apiKeyConfigured,
      displayLicenseConfirmed,
      licenseNotice,
      utcDate,
      dailyHardLimit: APP_DAILY_HARD_LIMIT,
      dailyTargetLimit: APP_DAILY_TARGET_LIMIT,
      dailyWarningThreshold: APP_DAILY_WARNING_THRESHOLD,
      providerDailyQuota: PROVIDER_DAILY_QUOTA,
      perMinuteLimit: APP_PER_MINUTE_LIMIT,
      creditsUsedToday,
      creditsRemainingAppBudget,
      creditsUsedCurrentMinute,
      providerCreditsLeftHeader: this.lastProviderCreditsLeftHeader,
      cachedSymbolsCount,
      cachedBarsCount,
      lastRefreshAt: this.lastRefreshIso,
      status,
    };
  }

  /**
   * Atomically checks and reserves Twelve Data credits before making a request (§12.4).
   */
  private async tryReserveTwelveDataCredits(
    endpoint: string,
    symbolsCount: number,
    userDisplayApproved = false
  ): Promise<{ allowed: boolean; reason?: string; usageRecordId?: string }> {
    const endpointRule = TWELVE_DATA_ENDPOINT_WEIGHTS[endpoint];
    if (!endpointRule || !endpointRule.enabledOnFree) {
      return {
        allowed: false,
        reason: endpointRule?.reason || `Endpoint ${endpoint} is not on the verified allowlist.`,
      };
    }

    if (!this.isTwelveDataConfigured()) {
      return { allowed: false, reason: 'TWELVE_DATA_API_KEY not configured.' };
    }

    if (!this.isTwelveDataDisplayConfirmed(userDisplayApproved)) {
      return {
        allowed: false,
        reason: 'Twelve Data display license gate is not confirmed; using persistent cache.',
      };
    }

    const creditsNeeded = endpointRule.weightPerSymbol * Math.max(1, symbolsCount);
    const status = await this.getBudgetAndCacheStatus(userDisplayApproved);

    if (status.creditsUsedToday + creditsNeeded > APP_DAILY_HARD_LIMIT) {
      return {
        allowed: false,
        reason: `Application daily credit budget reached (${status.creditsUsedToday}/${APP_DAILY_HARD_LIMIT} credits used today).`,
      };
    }

    if (status.creditsUsedCurrentMinute + creditsNeeded > APP_PER_MINUTE_LIMIT) {
      return {
        allowed: false,
        reason: `Per-minute credit limit reached (${status.creditsUsedCurrentMinute}/${APP_PER_MINUTE_LIMIT} credits in current UTC minute).`,
      };
    }

    const { utcDate, utcMinute } = this.getUtcDateAndMinute();
    try {
      const inserted = await db
        .insert(marketDataUsage)
        .values({
          utcDate,
          utcMinute,
          provider: 'twelve_data',
          endpoint,
          creditWeight: endpointRule.weightPerSymbol,
          symbolsCount,
          creditsReserved: creditsNeeded,
          status: 'reserved',
          requestId: `td-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        })
        .returning({ id: marketDataUsage.id });
      return { allowed: true, usageRecordId: inserted[0]?.id };
    } catch {
      return { allowed: false, reason: 'Could not reserve credit in usage ledger.' };
    }
  }

  /**
   * Retrieves daily OHLCV bars for a symbol using a strict Cache-First strategy:
   * 1. In-memory cache (if fresh today)
   * 2. PostgreSQL `market_data_daily_bars` (if latest trading session is present)
   * 3. Deduplicated fetch from Twelve Data `/time_series` (if licensed & within budget) OR Yahoo Finance `/v8/finance/chart`
   * 4. Deterministic historical series reconstruction anchored to current verified price if offline
   */
  async getDailyBarsForSymbol(
    rawSymbol: string,
    options?: {
      forceRefresh?: boolean;
      currentLivePrice?: number;
      currency?: string;
      userDisplayApproved?: boolean;
    }
  ): Promise<DailyOhlcvBar[]> {
    const cleanSymbol = normalizeStockTicker(rawSymbol) || rawSymbol.trim().toUpperCase();
    if (!cleanSymbol) return [];

    const todayStr = new Date().toISOString().slice(0, 10);
    const memCached = this.memoryBarsCache.get(cleanSymbol);
    if (
      memCached &&
      !options?.forceRefresh &&
      memCached.bars.length >= 30 &&
      Date.now() - memCached.fetchedAtMs < 6 * 60 * 60 * 1000
    ) {
      return memCached.bars;
    }

    // Deduplicate concurrent requests for the same symbol
    const existingFlight = this.inFlightSymbolFetches.get(cleanSymbol);
    if (existingFlight) {
      return existingFlight;
    }

    const task = this._loadOrFetchBarsInternal(cleanSymbol, todayStr, options).finally(() => {
      this.inFlightSymbolFetches.delete(cleanSymbol);
    });
    this.inFlightSymbolFetches.set(cleanSymbol, task);
    return task;
  }

  private async _loadOrFetchBarsInternal(
    symbol: string,
    todayStr: string,
    options?: {
      forceRefresh?: boolean;
      currentLivePrice?: number;
      currency?: string;
      userDisplayApproved?: boolean;
    }
  ): Promise<DailyOhlcvBar[]> {
    // 1. Check PostgreSQL persistent cache (`market_data_daily_bars`)
    let dbBars: DailyOhlcvBar[] = [];
    try {
      const rows = await db
        .select()
        .from(marketDataDailyBars)
        .where(eq(marketDataDailyBars.symbol, symbol))
        .orderBy(desc(marketDataDailyBars.barDate))
        .limit(260);

      if (rows.length > 0) {
        dbBars = rows
          .map((r) => ({
            date: r.barDate,
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            volume: Number(r.volume) || 0,
            currency: r.currency || 'USD',
            provider: r.provider || 'cached_eod',
            isAdjusted: r.isAdjusted,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    } catch {
      // Ignore if table not yet migrated
    }

    // Check if the cached DB bars are already fresh enough (within last 2 calendar days or weekend)
    const latestBarDate = dbBars.length > 0 ? dbBars[dbBars.length - 1].date : null;
    const dayOfWeek = new Date().getUTCDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const ageDays = latestBarDate
      ? (new Date(todayStr).getTime() - new Date(latestBarDate).getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    if (
      dbBars.length >= 30 &&
      !options?.forceRefresh &&
      (ageDays <= 1.5 || (isWeekend && ageDays <= 3.5))
    ) {
      this.memoryBarsCache.set(symbol, { bars: dbBars, fetchedAtMs: Date.now() });
      return dbBars;
    }

    // 2. Try Twelve Data `/time_series` if API key + display gate + budget allow
    let fetchedBars: DailyOhlcvBar[] = [];
    if (symbol !== 'MASI') {
      const reservation = await this.tryReserveTwelveDataCredits(
        '/time_series',
        1,
        options?.userDisplayApproved
      );
      if (reservation.allowed) {
        try {
          const apiKey = (process.env.TWELVE_DATA_API_KEY || '').trim();
          const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
            symbol
          )}&interval=1day&outputsize=120&apikey=${encodeURIComponent(apiKey)}`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6500);
          const resp = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);

          const usedHeader = Number(resp.headers.get('api-credits-used'));
          const leftHeader = Number(resp.headers.get('api-credits-left'));
          if (Number.isFinite(leftHeader)) {
            this.lastProviderCreditsLeftHeader = leftHeader;
          }

          if (resp.ok) {
            const payload: any = await resp.json();
            if (Array.isArray(payload?.values) && payload.values.length > 0) {
              const curr = payload?.meta?.currency || options?.currency || 'USD';
              fetchedBars = payload.values
                .map((v: any) => ({
                  date: String(v.datetime || '').slice(0, 10),
                  open: Number(v.open) || 0,
                  high: Number(v.high) || 0,
                  low: Number(v.low) || 0,
                  close: Number(v.close) || 0,
                  volume: Number(v.volume) || 0,
                  currency: curr,
                  provider: 'twelve_data',
                  isAdjusted: true,
                }))
                .filter((b: DailyOhlcvBar) => b.date && b.close > 0)
                .sort((a: DailyOhlcvBar, b: DailyOhlcvBar) => a.date.localeCompare(b.date));

              if (reservation.usageRecordId) {
                await db
                  .update(marketDataUsage)
                  .set({
                    status: 'success',
                    creditsUsedHeader: Number.isFinite(usedHeader) ? usedHeader : null,
                    creditsLeftHeader: Number.isFinite(leftHeader) ? leftHeader : null,
                  })
                  .where(eq(marketDataUsage.id, reservation.usageRecordId))
                  .catch(() => {});
              }
            }
          }
        } catch {
          // Proceed to Yahoo Finance fallback
        }
      }
    }

    // 3. Fallback to Yahoo Finance 6-month daily chart endpoint (0 Twelve Data credits)
    if (fetchedBars.length === 0 && symbol !== 'MASI') {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          symbol
        )}?interval=1d&range=6mo`;
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data: any = await resp.json();
          const result = data?.chart?.result?.[0];
          const timestamps: number[] = result?.timestamp || [];
          const quote = result?.indicators?.quote?.[0] || {};
          const curr = result?.meta?.currency || options?.currency || 'USD';

          if (timestamps.length > 0 && Array.isArray(quote.close)) {
            const barsMap = new Map<string, DailyOhlcvBar>();
            for (let i = 0; i < timestamps.length; i++) {
              const c = Number(quote.close[i]);
              if (!Number.isFinite(c) || c <= 0) continue;
              const o = Number(quote.open?.[i]) || c;
              const h = Number(quote.high?.[i]) || Math.max(o, c);
              const l = Number(quote.low?.[i]) || Math.min(o, c);
              const v = Number(quote.volume?.[i]) || 0;
              const dt = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
              barsMap.set(dt, {
                date: dt,
                open: Number(o.toFixed(4)),
                high: Number(h.toFixed(4)),
                low: Number(l.toFixed(4)),
                close: Number(c.toFixed(4)),
                volume: Math.round(v),
                currency: curr,
                provider: 'yahoo_eod_cache',
                isAdjusted: true,
              });
            }
            fetchedBars = Array.from(barsMap.values()).sort((a, b) =>
              a.date.localeCompare(b.date)
            );
          }
        }
      } catch {
        // Ignore network error, preserve existing dbBars if present
      }
    }

    // 4. Persist newly fetched bars into PostgreSQL `market_data_daily_bars`
    if (fetchedBars.length > 0) {
      this.lastRefreshIso = new Date().toISOString();
      try {
        for (const b of fetchedBars.slice(-90)) {
          await db
            .insert(marketDataDailyBars)
            .values({
              symbol,
              barDate: b.date,
              open: String(b.open),
              high: String(b.high),
              low: String(b.low),
              close: String(b.close),
              volume: String(b.volume),
              currency: b.currency,
              provider: b.provider,
              isAdjusted: true,
            })
            .onConflictDoUpdate({
              target: [marketDataDailyBars.symbol, marketDataDailyBars.barDate],
              set: {
                open: String(b.open),
                high: String(b.high),
                low: String(b.low),
                close: String(b.close),
                volume: String(b.volume),
                provider: b.provider,
                fetchedAt: new Date(),
              },
            });
        }
      } catch {
        // Non-fatal if DB insert fails
      }
      this.memoryBarsCache.set(symbol, { bars: fetchedBars, fetchedAtMs: Date.now() });
      return fetchedBars;
    }

    // 5. If provider fetch failed, return last known good dbBars
    if (dbBars.length > 0) {
      this.memoryBarsCache.set(symbol, { bars: dbBars, fetchedAtMs: Date.now() });
      return dbBars;
    }

    // 6. For benchmark MASI or offline environment where external network is blocked,
    // generate clearly labeled estimated reference bars anchored to the verified current price.
    const anchorPrice =
      options?.currentLivePrice && options.currentLivePrice > 0
        ? options.currentLivePrice
        : BASELINE_SYMBOL_PROFILES[symbol]?.price || 100;
    const anchorCurrency =
      options?.currency || BASELINE_SYMBOL_PROFILES[symbol]?.currency || 'USD';
    const fallbackBars = this.buildAnchoredReferenceSeries(symbol, anchorPrice, anchorCurrency, 90);
    this.memoryBarsCache.set(symbol, { bars: fallbackBars, fetchedAtMs: Date.now() });
    return fallbackBars;
  }

  /**
   * Builds a deterministic, date-aligned reference series anchored at the instrument's verified current price
   * when external provider history is unreachable, explicitly marked with provider = 'estimated_reference'.
   */
  private buildAnchoredReferenceSeries(
    symbol: string,
    currentPrice: number,
    currency: string,
    tradingDaysCount = 90
  ): DailyOhlcvBar[] {
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) {
      seed = (seed * 31 + symbol.charCodeAt(i)) % 100000;
    }
    const nextRand = () => {
      seed = (seed * 16807 + 11) % 2147483647;
      return (seed % 10000) / 10000;
    };

    // Walk backward from today's verified price so the last bar matches currentPrice 100%
    const dates: string[] = [];
    const cursor = new Date();
    while (dates.length < tradingDaysCount) {
      const dow = cursor.getUTCDay();
      if (dow !== 0 && dow !== 6) {
        dates.unshift(cursor.toISOString().slice(0, 10));
      }
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const dailyVol = symbol === 'MASI' ? 0.0045 : symbol === 'SPY' || symbol === 'VOO' ? 0.0075 : 0.014;
    const closes = new Array<number>(dates.length);
    closes[dates.length - 1] = currentPrice;
    for (let i = dates.length - 2; i >= 0; i--) {
      const step = (nextRand() - 0.485) * 2 * dailyVol;
      closes[i] = Math.max(0.5, closes[i + 1] / (1 + step));
    }

    return dates.map((d, idx) => {
      const c = Number(closes[idx].toFixed(4));
      const o = idx > 0 ? Number(closes[idx - 1].toFixed(4)) : c;
      const spread = c * (0.004 + nextRand() * 0.008);
      const h = Number((Math.max(o, c) + spread).toFixed(4));
      const l = Number(Math.max(0.01, Math.min(o, c) - spread).toFixed(4));
      const v = Math.round(1200000 + nextRand() * 8500000);
      return {
        date: d,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
        currency,
        provider: 'estimated_reference',
        isAdjusted: true,
      };
    });
  }

  /**
   * Builds complete Individual Instrument Detail payload (§3.2) from cached bars and local indicators.
   */
  async getInstrumentDetail(
    rawSymbol: string,
    position?: StockPosition | null
  ): Promise<InstrumentDetailPayload> {
    const identity = resolveInstrumentIdentity({
      rawTicker: position?.rawHeldTicker || rawSymbol,
      companyName: position?.companyName,
      market: position?.market,
      sector: position?.sector,
      source: position?.source,
    });

    const canonical = identity.canonicalTicker;
    const bars = await this.getDailyBarsForSymbol(canonical, {
      currentLivePrice: position?.currentPriceNum,
      currency: position?.currency,
    });
    const indicators = computeTechnicalIndicators(bars);
    const profile = BASELINE_SYMBOL_PROFILES[canonical];
    const lastBar = bars[bars.length - 1];

    const provider = lastBar?.provider || 'cached_eod';
    const freshnessState: PriceFreshnessState =
      provider === 'twelve_data' || provider === 'yahoo_eod_cache'
        ? 'EOD_CACHED'
        : provider === 'estimated_reference'
        ? 'ESTIMATED'
        : 'LIVE';

    return {
      symbol: canonical,
      rawHeldSymbol: identity.rawHeldTicker,
      underlyingSymbol: identity.underlyingTicker || canonical,
      displayName: identity.companyName,
      instrumentType: identity.instrumentType,
      exchange: identity.exchange,
      country: identity.country,
      sector: identity.sector,
      industry: null,
      currency: position?.currency || profile?.currency || 'USD',
      provider,
      freshnessState,
      lastUpdatedAt: this.lastRefreshIso || new Date().toISOString(),
      bars,
      indicators,
      fundamentals: {
        description:
          profile?.desc ||
          position?.convictionThesis ||
          `${identity.companyName} (${canonical}) traded in ${position?.currency || 'USD'} within the ${identity.sector} sector.`,
        marketCapUsd: profile?.mktCapB ? profile.mktCapB * 1e9 : null,
        peRatio: profile?.pe ?? null,
        eps: profile?.pe && profile?.price ? Number((profile.price / profile.pe).toFixed(2)) : null,
        dividendYieldPercent:
          position?.dividendYieldPercent ?? profile?.yieldPct ?? null,
        payoutRatioPercent: null,
        isLicensedAvailable: Boolean(profile),
        unavailableReason: !profile
          ? 'Detailed fundamental statements (P/E, EPS, Payout Ratio) are not automatically queried on the Twelve Data Free plan to preserve your daily credit budget. You can edit thesis and dividend parameters manually.'
          : undefined,
      },
    };
  }

  /**
   * Retrieves (and seeds if empty) verified/estimated Dividend Calendar & Ledger records (`investment_dividend_events`).
   */
  async getDividendEventsForUser(
    userId: string,
    positions: StockPosition[],
    usdToMadRate: number
  ): Promise<DividendEventRecord[]> {
    try {
      const existing = await db
        .select()
        .from(investmentDividendEvents)
        .where(eq(investmentDividendEvents.userId, userId))
        .orderBy(desc(investmentDividendEvents.paymentDate));

      // Auto-seed estimated quarterly dividend events for dividend-paying positions if not yet tracked
      const existingTickers = new Set(existing.map((e) => e.ticker.toUpperCase()));
      const dividendPositions = positions.filter(
        (p) => !p.isWatchlistOnly && p.sharesNum > 0 && (Number(p.annualDividendPerShare) > 0 || (p.dividendYieldPercent || 0) > 0)
      );

      for (const pos of dividendPositions) {
        const cleanTicker = normalizeStockTicker(pos.ticker) || pos.ticker;
        if (existingTickers.has(cleanTicker)) continue;

        const annualDps =
          Number(pos.annualDividendPerShare) > 0
            ? Number(pos.annualDividendPerShare)
            : (pos.currentPriceNum * (pos.dividendYieldPercent || 0)) / 100;
        if (annualDps <= 0) continue;

        const quarterlyDps = Number((annualDps / 4).toFixed(4));
        const gross = Number((quarterlyDps * pos.sharesNum).toFixed(4));
        const tax = pos.market === 'US' ? Number((gross * 0.15).toFixed(4)) : 0; // 15% US-Morocco treaty withholding estimate
        const net = Number(Math.max(0, gross - tax).toFixed(4));
        const fx = pos.currency === 'MAD' ? 1 : usdToMadRate;
        const netMad = Number((net * fx).toFixed(2));

        // Next quarterly payment date estimate
        const nextPayDate = new Date();
        nextPayDate.setUTCDate(nextPayDate.getUTCDate() + 28);
        const exDate = new Date(nextPayDate);
        exDate.setUTCDate(exDate.getUTCDate() - 14);

        const inserted = await db
          .insert(investmentDividendEvents)
          .values({
            userId,
            positionId: pos.id.startsWith('binance-') ? null : pos.id,
            ticker: cleanTicker,
            companyName: pos.companyName,
            declarationDate: new Date().toISOString().slice(0, 10),
            exDividendDate: exDate.toISOString().slice(0, 10),
            recordDate: exDate.toISOString().slice(0, 10),
            paymentDate: nextPayDate.toISOString().slice(0, 10),
            dividendPerShare: String(quarterlyDps),
            eligibleShares: String(pos.sharesNum),
            currency: pos.currency || 'USD',
            grossAmount: String(gross),
            withholdingTax: String(tax),
            feeAmount: '0',
            netAmount: String(net),
            netAmountMad: String(netMad),
            fxRateUsed: String(fx),
            status: 'estimated',
            source: 'auto_schedule_estimate',
            notes: `Estimated quarterly dividend for ${cleanTicker} (${pos.sharesNum} shares @ $${quarterlyDps}/sh, 15% treaty withholding estimated).`,
          })
          .returning();

        if (inserted[0]) {
          existing.unshift(inserted[0]);
        }
      }

      return existing.map((r) => ({
        id: r.id,
        userId: r.userId,
        positionId: r.positionId,
        ticker: r.ticker,
        companyName: r.companyName,
        declarationDate: r.declarationDate,
        exDividendDate: r.exDividendDate,
        recordDate: r.recordDate,
        paymentDate: r.paymentDate,
        dividendPerShare: Number(r.dividendPerShare) || 0,
        eligibleShares: Number(r.eligibleShares) || 0,
        currency: r.currency || 'USD',
        grossAmount: Number(r.grossAmount) || 0,
        withholdingTax: Number(r.withholdingTax) || 0,
        feeAmount: Number(r.feeAmount) || 0,
        netAmount: Number(r.netAmount) || 0,
        netAmountMad: Number(r.netAmountMad) || 0,
        fxRateUsed: Number(r.fxRateUsed) || usdToMadRate,
        status: (r.status as DividendEventRecord['status']) || 'confirmed',
        source: r.source || 'manual',
        notes: r.notes,
        verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async createDividendEvent(
    userId: string,
    payload: Partial<DividendEventRecord>,
    usdToMadRate: number
  ): Promise<DividendEventRecord> {
    const ticker = normalizeStockTicker(payload.ticker || '') || (payload.ticker || 'STOCK').toUpperCase();
    const companyName = payload.companyName || ticker;
    const dps = Math.max(0, Number(payload.dividendPerShare) || 0);
    const shares = Math.max(0, Number(payload.eligibleShares) || 0);
    const gross =
      payload.grossAmount !== undefined && Number(payload.grossAmount) > 0
        ? Number(payload.grossAmount)
        : Number((dps * shares).toFixed(4));
    const tax = Math.max(0, Number(payload.withholdingTax) || 0);
    const fee = Math.max(0, Number(payload.feeAmount) || 0);
    const net =
      payload.netAmount !== undefined && Number(payload.netAmount) >= 0
        ? Number(payload.netAmount)
        : Number(Math.max(0, gross - tax - fee).toFixed(4));
    const curr = (payload.currency || 'USD').toUpperCase();
    const fx = curr === 'MAD' ? 1 : Number(payload.fxRateUsed) || usdToMadRate;
    const netMad = Number((net * fx).toFixed(2));

    const [inserted] = await db
      .insert(investmentDividendEvents)
      .values({
        userId,
        positionId: payload.positionId || null,
        ticker,
        companyName,
        declarationDate: payload.declarationDate || null,
        exDividendDate: payload.exDividendDate || null,
        recordDate: payload.recordDate || null,
        paymentDate: payload.paymentDate || new Date().toISOString().slice(0, 10),
        dividendPerShare: String(dps),
        eligibleShares: String(shares),
        currency: curr,
        grossAmount: String(gross),
        withholdingTax: String(tax),
        feeAmount: String(fee),
        netAmount: String(net),
        netAmountMad: String(netMad),
        fxRateUsed: String(fx),
        status: payload.status || 'manual',
        source: payload.source || 'manual_entry',
        notes: payload.notes || null,
      })
      .returning();

    return {
      id: inserted.id,
      userId: inserted.userId,
      positionId: inserted.positionId,
      ticker: inserted.ticker,
      companyName: inserted.companyName,
      declarationDate: inserted.declarationDate,
      exDividendDate: inserted.exDividendDate,
      recordDate: inserted.recordDate,
      paymentDate: inserted.paymentDate,
      dividendPerShare: Number(inserted.dividendPerShare),
      eligibleShares: Number(inserted.eligibleShares),
      currency: inserted.currency,
      grossAmount: Number(inserted.grossAmount),
      withholdingTax: Number(inserted.withholdingTax),
      feeAmount: Number(inserted.feeAmount),
      netAmount: Number(inserted.netAmount),
      netAmountMad: Number(inserted.netAmountMad),
      fxRateUsed: Number(inserted.fxRateUsed),
      status: inserted.status as DividendEventRecord['status'],
      source: inserted.source,
      notes: inserted.notes,
      verifiedAt: new Date(inserted.verifiedAt).toISOString(),
    };
  }

  async deleteDividendEvent(userId: string, eventId: string): Promise<{ deleted: boolean }> {
    await db
      .delete(investmentDividendEvents)
      .where(
        and(
          eq(investmentDividendEvents.id, eventId),
          eq(investmentDividendEvents.userId, userId)
        )
      );
    return { deleted: true };
  }

  /**
   * Retrieves or initializes user Investment Intelligence Settings (`investment_settings`).
   */
  async getUserInvestmentSettings(userId: string): Promise<InvestmentSettingsConfig> {
    const defaultGoals: InvestmentGoalItem[] = [
      {
        id: 'goal-portfolio-val',
        type: 'PORTFOLIO_VALUE',
        title: 'Build 25,000 MAD Equities Portfolio',
        targetAmountMad: 25000,
        currentAmountMad: 0,
        assumedAnnualReturnPercent: 10,
        monthlyContributionMad: 1000,
        targetDate: '2028-12-31',
      },
      {
        id: 'goal-annual-div',
        type: 'ANNUAL_DIVIDEND',
        title: 'Reach 1,200 MAD/yr Passive Dividend Cash Flow',
        targetAmountMad: 1200,
        currentAmountMad: 0,
        assumedAnnualReturnPercent: 8,
        monthlyContributionMad: 500,
        targetDate: '2028-12-31',
      },
    ];

    const defaultTargets = [
      { category: 'AI & Semiconductors', targetPercent: 25 },
      { category: 'Technology & Cloud', targetPercent: 25 },
      { category: 'Banking & Financials', targetPercent: 20 },
      { category: 'Mechanics, Automotive & Industrials', targetPercent: 15 },
      { category: 'Index & Dividend ETFs', targetPercent: 15 },
    ];

    try {
      const rows = await db
        .select()
        .from(investmentSettings)
        .where(eq(investmentSettings.userId, userId))
        .limit(1);

      if (rows[0]) {
        const r = rows[0];
        let benchmarks = ['SPY', 'QQQ', 'MASI'];
        let targetAllocations = defaultTargets;
        let goals = defaultGoals;
        try {
          if (r.selectedBenchmarks) benchmarks = JSON.parse(r.selectedBenchmarks);
        } catch {}
        try {
          if (r.targetAllocationsJson) targetAllocations = JSON.parse(r.targetAllocationsJson);
        } catch {}
        try {
          if (r.goalsJson) goals = JSON.parse(r.goalsJson);
        } catch {}

        return {
          reportingCurrency: (r.reportingCurrency as 'MAD' | 'USD' | 'EUR') || 'MAD',
          selectedBenchmarks: benchmarks,
          riskFreeRatePercent: Number(r.riskFreeRatePercent) || 3.5,
          manualUsdMadRate: r.manualUsdMadRate ? Number(r.manualUsdMadRate) : null,
          twelveDataDisplayApproved: Boolean(r.twelveDataDisplayApproved),
          targetAllocations,
          goals,
        };
      }
    } catch {}

    return {
      reportingCurrency: 'MAD',
      selectedBenchmarks: ['SPY', 'QQQ', 'MASI'],
      riskFreeRatePercent: 3.5,
      manualUsdMadRate: null,
      twelveDataDisplayApproved: false,
      targetAllocations: defaultTargets,
      goals: defaultGoals,
    };
  }

  async updateUserInvestmentSettings(
    userId: string,
    payload: Partial<InvestmentSettingsConfig>
  ): Promise<InvestmentSettingsConfig> {
    const current = await this.getUserInvestmentSettings(userId);
    const merged: InvestmentSettingsConfig = {
      reportingCurrency: payload.reportingCurrency || current.reportingCurrency,
      selectedBenchmarks: Array.isArray(payload.selectedBenchmarks)
        ? payload.selectedBenchmarks
        : current.selectedBenchmarks,
      riskFreeRatePercent:
        payload.riskFreeRatePercent !== undefined
          ? Math.max(0, Math.min(20, Number(payload.riskFreeRatePercent)))
          : current.riskFreeRatePercent,
      manualUsdMadRate:
        payload.manualUsdMadRate !== undefined ? payload.manualUsdMadRate : current.manualUsdMadRate,
      twelveDataDisplayApproved:
        payload.twelveDataDisplayApproved !== undefined
          ? Boolean(payload.twelveDataDisplayApproved)
          : current.twelveDataDisplayApproved,
      targetAllocations: Array.isArray(payload.targetAllocations)
        ? payload.targetAllocations
        : current.targetAllocations,
      goals: Array.isArray(payload.goals) ? payload.goals : current.goals,
    };

    try {
      await db
        .insert(investmentSettings)
        .values({
          userId,
          reportingCurrency: merged.reportingCurrency,
          selectedBenchmarks: JSON.stringify(merged.selectedBenchmarks),
          riskFreeRatePercent: String(merged.riskFreeRatePercent),
          manualUsdMadRate:
            merged.manualUsdMadRate !== null && merged.manualUsdMadRate !== undefined
              ? String(merged.manualUsdMadRate)
              : null,
          twelveDataDisplayApproved: merged.twelveDataDisplayApproved,
          targetAllocationsJson: JSON.stringify(merged.targetAllocations),
          goalsJson: JSON.stringify(merged.goals),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [investmentSettings.userId],
          set: {
            reportingCurrency: merged.reportingCurrency,
            selectedBenchmarks: JSON.stringify(merged.selectedBenchmarks),
            riskFreeRatePercent: String(merged.riskFreeRatePercent),
            manualUsdMadRate:
              merged.manualUsdMadRate !== null && merged.manualUsdMadRate !== undefined
                ? String(merged.manualUsdMadRate)
                : null,
            twelveDataDisplayApproved: merged.twelveDataDisplayApproved,
            targetAllocationsJson: JSON.stringify(merged.targetAllocations),
            goalsJson: JSON.stringify(merged.goals),
            updatedAt: new Date(),
          },
        });
    } catch {}

    return merged;
  }

  /**
   * Persists a daily portfolio snapshot for historical reconstruction (§13.5).
   */
  async recordDailyPortfolioSnapshot(params: {
    userId: string;
    totalMarketValueMad: number;
    investmentCashMad: number;
    netContributionsMad: number;
    costBasisMad: number;
    unrealizedPnlMad: number;
    realizedPnlMad: number;
    dividendsReceivedMad: number;
    usdToMadRate: number;
    positions: StockPosition[];
  }): Promise<void> {
    const snapshotDate = new Date().toISOString().slice(0, 10);
    try {
      const compactPositions = params.positions.map((p) => ({
        ticker: p.ticker,
        shares: p.sharesNum,
        price: p.currentPriceNum,
        valMad: p.marketValueMad,
      }));
      await db
        .insert(portfolioDailySnapshots)
        .values({
          userId: params.userId,
          snapshotDate,
          baseCurrency: 'MAD',
          totalMarketValueMad: String(Number(params.totalMarketValueMad.toFixed(2))),
          investmentCashMad: String(Number(params.investmentCashMad.toFixed(2))),
          netContributionsMad: String(Number(params.netContributionsMad.toFixed(2))),
          costBasisMad: String(Number(params.costBasisMad.toFixed(2))),
          unrealizedPnlMad: String(Number(params.unrealizedPnlMad.toFixed(2))),
          realizedPnlMad: String(Number(params.realizedPnlMad.toFixed(2))),
          dividendsReceivedMad: String(Number(params.dividendsReceivedMad.toFixed(2))),
          usdToMadRate: String(Number(params.usdToMadRate.toFixed(4))),
          isEstimated: false,
          positionsJson: JSON.stringify(compactPositions),
        })
        .onConflictDoUpdate({
          target: [portfolioDailySnapshots.userId, portfolioDailySnapshots.snapshotDate],
          set: {
            totalMarketValueMad: String(Number(params.totalMarketValueMad.toFixed(2))),
            investmentCashMad: String(Number(params.investmentCashMad.toFixed(2))),
            netContributionsMad: String(Number(params.netContributionsMad.toFixed(2))),
            costBasisMad: String(Number(params.costBasisMad.toFixed(2))),
            unrealizedPnlMad: String(Number(params.unrealizedPnlMad.toFixed(2))),
            realizedPnlMad: String(Number(params.realizedPnlMad.toFixed(2))),
            dividendsReceivedMad: String(Number(params.dividendsReceivedMad.toFixed(2))),
            usdToMadRate: String(Number(params.usdToMadRate.toFixed(4))),
            positionsJson: JSON.stringify(compactPositions),
          },
        });
    } catch {}
  }
}

export const marketDataService = new MarketDataService();
