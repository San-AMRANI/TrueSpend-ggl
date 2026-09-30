import { investmentRepository } from '../repositories/InvestmentRepository.js';

type CoinSearchResult = { id: string; name: string; symbol: string; market_cap_rank?: number; thumb?: string };
export type MarketAssetSearchResult = { id: string; name: string; symbol: string; marketCapRank: number | null; image: string | null };
export type LatestMarketPrice = { assetId: string; price: number; currency: string; capturedAt: string };
export type HistoricalPricePoint = { capturedAt: string; price: number; currency: string };
/** Provider boundary: no CoinGecko response shape leaks into the rest of V2. */
export interface MarketDataProvider {
  searchAssets(query: string): Promise<MarketAssetSearchResult[]>;
  getAssetDetails(assetId: string, currency: string): Promise<{ id: string; name: string; symbol: string; image: string | null; currentPrice: number | null; currency: string; marketCap: number | null; priceChange24h: number | null; fetchedAt: string }>;
  getLatestPrices(assetIds: string[], vsCurrency: string): Promise<Array<{ id: string; price: number; providerTimestamp: Date | null }>>;
  getHistoricalPrices(assetId: string, vsCurrency: string, from: Date, to: Date): Promise<HistoricalPricePoint[]>;
}
const baseUrl = () => (process.env.COINGECKO_API_BASE_URL || 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
const ttl = () => Math.max(60, Number(process.env.COINGECKO_PRICE_TTL_SECONDS || 300) || 300) * 1000;
const historyTtl = () => Math.max(300, Number(process.env.COINGECKO_HISTORY_TTL_SECONDS || 21_600) || 21_600) * 1000;

export class CoinGeckoMarketDataProvider implements MarketDataProvider {
  private failureCount = 0;
  private retryAfter = 0;
  public lastFailure: string | null = null;
  public lastSuccessfulRequest: Date | null = null;

  private headers() {
    const key = process.env.COINGECKO_API_KEY;
    if (!key) return {};
    return baseUrl().includes('pro-api') ? { 'x-cg-pro-api-key': key } : { 'x-cg-demo-api-key': key };
  }

  private async request(path: string) {
    if (Date.now() < this.retryAfter) throw new Error('Market-data provider is in a temporary backoff period.');
    try {
      const response = await fetch(`${baseUrl()}${path}`, { headers: this.headers() });
      if (!response.ok) throw new Error(`Provider returned ${response.status}`);
      this.failureCount = 0;
      this.retryAfter = 0;
      this.lastFailure = null;
      this.lastSuccessfulRequest = new Date();
      return response;
    } catch (error) {
      this.failureCount += 1;
      // 30s, 60s, 120s ... capped at 30 minutes. The persisted snapshots
      // remain available during backoff.
      this.retryAfter = Date.now() + Math.min(1_800_000, 30_000 * 2 ** Math.min(this.failureCount - 1, 6));
      this.lastFailure = error instanceof Error ? error.message : 'Provider request failed';
      throw error;
    }
  }

  async searchAssets(query: string): Promise<MarketAssetSearchResult[]> {
    const response = await this.request(`/search?query=${encodeURIComponent(query)}`);
    const data = await response.json() as { coins?: CoinSearchResult[] };
    return (data.coins || []).slice(0, 12).map((coin) => ({ id: coin.id, name: coin.name, symbol: coin.symbol.toUpperCase(), marketCapRank: coin.market_cap_rank ?? null, image: coin.thumb ?? null }));
  }

  async getAssetDetails(assetId: string, currency: string) {
    const response = await this.request(`/coins/${encodeURIComponent(assetId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`);
    const data = await response.json() as { id: string; name: string; symbol: string; image?: { small?: string }; market_data?: { current_price?: Record<string, number>; market_cap?: Record<string, number>; price_change_percentage_24h?: number } };
    return {
      id: data.id,
      name: data.name,
      symbol: data.symbol.toUpperCase(),
      image: data.image?.small ?? null,
      currentPrice: data.market_data?.current_price?.[currency.toLowerCase()] ?? null,
      currency: currency.toUpperCase(),
      marketCap: data.market_data?.market_cap?.[currency.toLowerCase()] ?? null,
      priceChange24h: data.market_data?.price_change_percentage_24h ?? null,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getLatestPrices(assetIds: string[], vsCurrency: string) {
    if (!assetIds.length) return [];
    const ids = assetIds.slice(0, 100).join(',');
    const currency = vsCurrency.toLowerCase();
    const response = await this.request(`/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(currency)}&include_last_updated_at=true`);
    const data = await response.json() as Record<string, Record<string, number>>;
    return assetIds.slice(0, 100).flatMap((id) => {
      const price = data[id]?.[currency];
      return Number.isFinite(price) ? [{ id, price, providerTimestamp: data[id]?.last_updated_at ? new Date(data[id].last_updated_at * 1000) : null }] : [];
    });
  }

  async getHistoricalPrices(assetId: string, vsCurrency: string, from: Date, to: Date): Promise<HistoricalPricePoint[]> {
    const response = await this.request(`/coins/${encodeURIComponent(assetId)}/market_chart/range?vs_currency=${encodeURIComponent(vsCurrency.toLowerCase())}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
    const data = await response.json() as { prices?: Array<[number, number]> };
    return (data.prices || []).flatMap(([timestamp, price]) => Number.isFinite(timestamp) && Number.isFinite(price)
      ? [{ capturedAt: new Date(timestamp).toISOString(), price, currency: vsCurrency.toUpperCase() }]
      : []);
  }
}

export class MarketDataService {
  private readonly provider: MarketDataProvider & { lastFailure?: string | null; lastSuccessfulRequest?: Date | null };
  private lastFailure: string | null = null;
  private lastSuccessfulRefresh: Date | null = null;

  constructor(provider: MarketDataProvider = new CoinGeckoMarketDataProvider()) { this.provider = provider; }

  async search(query: string) {
    const normalized = query.trim();
    if (!normalized) return [];
    return this.provider.searchAssets(normalized);
  }

  async asset(coinId: string, currency = 'mad') {
    if (!/^[a-z0-9-]+$/i.test(coinId)) throw new Error('Invalid CoinGecko asset identifier.');
    return this.provider.getAssetDetails(coinId, currency);
  }

  async refreshUserCryptoPrices(userId: string, currency = 'mad') {
    const assets = (await investmentRepository.assets(userId)).filter((asset) => asset.assetClass === 'Crypto' && asset.coinGeckoCoinId && asset.isActive);
    if (!assets.length) return { refreshed: 0, stale: false, message: 'No CoinGecko-linked crypto assets to refresh.' };
    const latest = new Map((await investmentRepository.latestPrices(assets.map((asset) => asset.id))).map((price) => [price.assetId, price]));
    const due = assets.filter((asset) => {
      const price = latest.get(asset.id);
      return !price || Date.now() - price.capturedAt.getTime() >= ttl();
    });
    if (!due.length) return { refreshed: 0, stale: false, message: 'Prices are already fresh.' };
    try {
      const byId = new Map<string, { price: number; providerTimestamp: Date | null }>();
      for (let index = 0; index < due.length; index += 100) {
        const batch = due.slice(index, index + 100);
        const data = await this.provider.getLatestPrices(batch.map((asset) => asset.coinGeckoCoinId!), currency);
        for (const price of data) byId.set(price.id, price);
      }
      let refreshed = 0;
      for (const asset of due) {
        const providerId = asset.coinGeckoCoinId!;
        const latest = byId.get(providerId);
        if (!latest) continue;
        const timestamp = latest.providerTimestamp || new Date();
        await investmentRepository.createPrice({ assetId: asset.id, userId, price: String(latest.price), currency: currency.toUpperCase(), exchangeRateToBase: '1', priceInBase: String(latest.price),
          source: 'Provider', provider: 'CoinGecko', providerAssetId: providerId, providerPriceTimestamp: timestamp, capturedAt: new Date() });
        refreshed += 1;
      }
      this.lastFailure = null; this.lastSuccessfulRefresh = new Date();
      return { refreshed, stale: false, message: refreshed ? 'Prices refreshed.' : 'No provider prices were available for active assets.' };
    } catch (error) {
      this.lastFailure = error instanceof Error ? error.message : 'Provider request failed';
      return { refreshed: 0, stale: true, message: 'Using the last successful price data; market-data refresh is temporarily unavailable.' };
    }
  }

  async history(userId: string, coinId: string, from?: string, to?: string, currency = 'MAD') {
    const asset = (await investmentRepository.assets(userId)).find((item) => item.coinGeckoCoinId === coinId);
    if (!asset) throw new Error('That crypto asset is not in your portfolio.');
    const now = new Date();
    const requestedFrom = from ? new Date(from) : new Date(now.getTime() - 90 * 86_400_000);
    const requestedTo = to ? new Date(to) : now;
    if (Number.isNaN(requestedFrom.getTime()) || Number.isNaN(requestedTo.getTime()) || requestedFrom > requestedTo) throw new Error('Invalid market history range.');
    if (requestedTo.getTime() - requestedFrom.getTime() > 366 * 86_400_000) throw new Error('Market history is limited to a one-year range per request.');
    let cached = await investmentRepository.priceHistoryForAsset(asset.id, requestedFrom, requestedTo);
    const coverage = cached.length >= 2 && cached[0].capturedAt <= requestedFrom && cached[cached.length - 1].capturedAt >= requestedTo;
    // Historical points are immutable. If the requested range is already
    // covered, keep serving the persisted series without another provider call.
    if (!coverage || cached.length === 0) {
      try {
        const points = await this.provider.getHistoricalPrices(coinId, currency, requestedFrom, requestedTo);
        for (const point of points) {
          await investmentRepository.createPrice({ assetId: asset.id, userId, price: String(point.price), currency: point.currency, exchangeRateToBase: '1', priceInBase: String(point.price),
            source: 'Provider', provider: 'CoinGecko', providerAssetId: coinId, providerPriceTimestamp: new Date(point.capturedAt), capturedAt: new Date(point.capturedAt) });
        }
        cached = await investmentRepository.priceHistoryForAsset(asset.id, requestedFrom, requestedTo);
      } catch (error) {
        this.lastFailure = error instanceof Error ? error.message : 'Provider history request failed';
        if (!cached.length) throw error;
      }
    }
    return cached.map((price) => ({ id: price.id, assetId: price.assetId, price: price.price, priceInBase: price.priceInBase, currency: price.currency, source: price.source, capturedAt: price.capturedAt.toISOString(), providerPriceTimestamp: price.providerPriceTimestamp?.toISOString() || null }));
  }

  status() {
    return { available: Boolean(process.env.COINGECKO_API_BASE_URL || process.env.COINGECKO_API_KEY), provider: 'CoinGecko',
      lastSuccessfulRefresh: this.lastSuccessfulRefresh?.toISOString() ?? this.provider.lastSuccessfulRequest?.toISOString() ?? null, lastFailure: this.lastFailure || this.provider.lastFailure || null,
      priceTtlSeconds: Math.round(ttl() / 1000), historyTtlSeconds: Math.round(historyTtl() / 1000), fallback: 'Last successful provider or manual price is retained when refresh fails.' };
  }
}

export const marketDataService = new MarketDataService();
