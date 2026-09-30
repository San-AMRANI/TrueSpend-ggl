import { investmentRepository } from '../repositories/InvestmentRepository.js';

const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ATOM: 'cosmos',
  NEAR: 'near',
  FTM: 'fantom',
  ALGO: 'algorand',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  SHIB: 'shiba-inu',
  DOGE: 'dogecoin',
};

// Static FX fallback rates
const DEFAULT_MAD_PER_USD = 10.0;
const DEFAULT_EUR_PER_USD = 0.92;

export class MarketPriceFeedService {
  private madPerUsd = DEFAULT_MAD_PER_USD;
  private eurPerUsd = DEFAULT_EUR_PER_USD;

  async getLiveFxRates(): Promise<{ madPerUsd: number; eurPerUsd: number }> {
    try {
      const res = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD',
        { signal: AbortSignal.timeout(4000) },
      );
      if (res.ok) {
        const data: any = await res.json();
        const mad = data?.rates?.MAD;
        const eur = data?.rates?.EUR;
        if (mad && eur) {
          this.madPerUsd = mad;
          this.eurPerUsd = eur;
          return { madPerUsd: mad, eurPerUsd: eur };
        }
      }
    } catch (_) {
      // Use cached / default
    }
    return { madPerUsd: this.madPerUsd, eurPerUsd: this.eurPerUsd };
  }

  async fetchCryptoPrice(symbol: string): Promise<{ usd: number; mad: number; eur: number } | null> {
    const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()];
    if (!coinId) return null;
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,eur`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data: any = await res.json();
      const usd: number = data?.[coinId]?.usd;
      const eur: number = data?.[coinId]?.eur;
      if (!usd) return null;
      const { madPerUsd } = await this.getLiveFxRates();
      const mad = usd * madPerUsd;
      return { usd, mad, eur: eur || usd * this.eurPerUsd };
    } catch (_) {
      return null;
    }
  }

  async fetchStockPrice(symbol: string): Promise<{ usd: number; mad: number; eur: number } | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      const usd: number = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (!usd) return null;
      const { madPerUsd, eurPerUsd } = await this.getLiveFxRates();
      return { usd, mad: usd * madPerUsd, eur: usd * eurPerUsd };
    } catch (_) {
      return null;
    }
  }

  async getPriceForHolding(
    symbol: string,
    assetType: string,
  ): Promise<{ usd: number; mad: number; eur: number } | null> {
    // Check cache staleness: 15min for crypto, 1h for stocks, manual never auto-refresh
    const cached = await investmentRepository.getAssetPrice(symbol, assetType);
    if (cached && cached.priceUsd) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      const maxAge = cached.source === 'manual' ? Infinity : assetType === 'crypto' ? 15 * 60 * 1000 : 60 * 60 * 1000;
      if (age < maxAge) {
        return {
          usd: parseFloat(cached.priceUsd),
          mad: parseFloat(cached.priceMad ?? '0'),
          eur: parseFloat(cached.priceEur ?? '0'),
        };
      }
    }

    // Fetch live price
    let price: { usd: number; mad: number; eur: number } | null = null;
    if (assetType === 'crypto') {
      price = await this.fetchCryptoPrice(symbol);
    } else if (assetType === 'stock' || assetType === 'etf') {
      price = await this.fetchStockPrice(symbol);
    }

    if (price) {
      await investmentRepository.upsertAssetPrice({
        symbol,
        assetType,
        priceUsd: String(price.usd),
        priceMad: String(price.mad),
        priceEur: String(price.eur),
        source: assetType === 'crypto' ? 'coingecko' : 'yahoo',
      });
      return price;
    }

    // Return cached even if stale, as fallback
    if (cached && cached.priceUsd) {
      return {
        usd: parseFloat(cached.priceUsd),
        mad: parseFloat(cached.priceMad ?? '0'),
        eur: parseFloat(cached.priceEur ?? '0'),
      };
    }

    return null;
  }

  async setManualPrice(symbol: string, assetType: string, priceUsd: number): Promise<void> {
    const { madPerUsd, eurPerUsd } = await this.getLiveFxRates();
    await investmentRepository.upsertAssetPrice({
      symbol,
      assetType,
      priceUsd: String(priceUsd),
      priceMad: String(priceUsd * madPerUsd),
      priceEur: String(priceUsd * eurPerUsd),
      source: 'manual',
    });
  }
}

export const marketPriceFeedService = new MarketPriceFeedService();
