import crypto from 'node:crypto';
import type {
  BinanceAccountOverview,
  BinanceAssetCategory,
  BinanceAssetDividendRecord,
  BinancePersonalTrade,
  BinanceSpotAssetBalance,
  BinanceSymbolTradeSummary,
  BinanceWalletBreakdownItem,
} from '../../src/types/index.js';

/**
 * Official Binance Spot REST API base endpoints.
 * Primary is api.binance.com with official regional/GCP fallback clusters for serverless resilience.
 */
const BINANCE_PRIVATE_ENDPOINTS = [
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
] as const;

const BINANCE_PUBLIC_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
] as const;

/**
 * Strictly whitelisted read-only Binance endpoints.
 * Trading, withdrawals, transfers, and generic proxy endpoints are strictly prohibited.
 */
type AllowedSignedEndpoint =
  | '/api/v3/account'
  | '/api/v3/myTrades'
  | '/sapi/v1/account/apiRestrictions'
  | '/sapi/v1/asset/get-funding-asset'
  | '/sapi/v3/asset/getUserAsset'
  | '/sapi/v1/asset/wallet/balance'
  | '/sapi/v1/simple-earn/flexible/position'
  | '/sapi/v1/simple-earn/locked/position'
  | '/sapi/v1/convert/tradeFlow'
  | '/sapi/v1/asset/assetDividend';

type AllowedPublicEndpoint = '/api/v3/time' | '/api/v3/ticker/24hr' | '/api/v3/ticker/price';

const ALLOWED_SIGNED_ENDPOINTS = new Set<AllowedSignedEndpoint>([
  '/api/v3/account',
  '/api/v3/myTrades',
  '/sapi/v1/account/apiRestrictions',
  '/sapi/v1/asset/get-funding-asset',
  '/sapi/v3/asset/getUserAsset',
  '/sapi/v1/asset/wallet/balance',
  '/sapi/v1/simple-earn/flexible/position',
  '/sapi/v1/simple-earn/locked/position',
  '/sapi/v1/convert/tradeFlow',
  '/sapi/v1/asset/assetDividend',
]);

const ALLOWED_PUBLIC_ENDPOINTS = new Set<AllowedPublicEndpoint>([
  '/api/v3/time',
  '/api/v3/ticker/24hr',
  '/api/v3/ticker/price',
]);

/**
 * Standard ASN.1 DER PKCS#8 prefix for a raw 32-byte Ed25519 private seed (OID 1.3.101.112)
 */
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

/**
 * Standard Spot Taker Fee Rate (0.10% = 0.001) used for estimating exit fee & breakeven price
 */
const DEFAULT_TAKER_FEE_RATE = 0.001;

const ASSET_METADATA: Record<
  string,
  { name: string; category: BinanceAssetCategory; dividendYieldPercent?: number }
> = {
  // Stablecoins & Fiat
  USDT: { name: 'Tether USD', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  USDC: { name: 'USD Coin', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  FDUSD: { name: 'First Digital USD', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  DAI: { name: 'Dai Stablecoin', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  BUSD: { name: 'Binance USD', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  EUR: { name: 'Euro', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  AEUR: { name: 'Anchored Coins EUR', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },
  USD: { name: 'US Dollar', category: 'Stablecoin / Fiat Reserve', dividendYieldPercent: 0 },

  // Tokenized Stocks & Equities (Funding Wallet & Spot)
  TSLA: { name: 'Tesla Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  AAPL: { name: 'Apple Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.44 },
  NVDA: { name: 'NVIDIA Corp.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.03 },
  MSFT: { name: 'Microsoft Corp.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.78 },
  AMZN: { name: 'Amazon.com Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  GOOGL: { name: 'Alphabet Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.45 },
  GOOG: { name: 'Alphabet Inc. (Class C)', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.45 },
  META: { name: 'Meta Platforms Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.35 },
  COIN: { name: 'Coinbase Global', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  MSTR: { name: 'MicroStrategy Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  SPY: { name: 'SPDR S&P 500 ETF Trust', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 1.24 },
  QQQ: { name: 'Invesco QQQ Trust', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.58 },
  VOO: { name: 'Vanguard S&P 500 ETF', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 1.26 },
  SCHD: { name: 'Schwab US Dividend Equity ETF', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 3.55 },
  BABA: { name: 'Alibaba Group Holding', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 1.15 },
  NFLX: { name: 'Netflix Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  AMD: { name: 'Advanced Micro Devices', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  INTC: { name: 'Intel Corp.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 1.5 },
  PLTR: { name: 'Palantir Technologies', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  DIS: { name: 'Walt Disney Co.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.85 },
  PYPL: { name: 'PayPal Holdings', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },
  V: { name: 'Visa Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.76 },
  MA: { name: 'Mastercard Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.55 },
  JPM: { name: 'JPMorgan Chase & Co.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 2.15 },
  KO: { name: 'Coca-Cola Co.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 3.05 },
  PEP: { name: 'PepsiCo Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 3.2 },
  O: { name: 'Realty Income Corp.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 5.45 },
  AVGO: { name: 'Broadcom Inc.', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 1.2 },
  COST: { name: 'Costco Wholesale', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0.52 },
  BRK: { name: 'Berkshire Hathaway', category: 'Tokenized Stocks & Equities', dividendYieldPercent: 0 },

  // Layer 1 Core
  BTC: { name: 'Bitcoin', category: 'Layer 1 Core', dividendYieldPercent: 0 },
  ETH: { name: 'Ethereum', category: 'Layer 1 Core', dividendYieldPercent: 2.8 },
  BNB: { name: 'BNB', category: 'Layer 1 Core', dividendYieldPercent: 1.5 },
  SOL: { name: 'Solana', category: 'Layer 1 Core', dividendYieldPercent: 5.2 },
  XRP: { name: 'XRP', category: 'Layer 1 Core', dividendYieldPercent: 0 },
  ADA: { name: 'Cardano', category: 'Layer 1 Core', dividendYieldPercent: 2.9 },
  AVAX: { name: 'Avalanche', category: 'Layer 1 Core', dividendYieldPercent: 4.1 },
  SUI: { name: 'Sui', category: 'Layer 1 Core', dividendYieldPercent: 2.5 },
  TON: { name: 'Toncoin', category: 'Layer 1 Core', dividendYieldPercent: 3.0 },
  DOT: { name: 'Polkadot', category: 'Layer 1 Core', dividendYieldPercent: 7.5 },
  NEAR: { name: 'NEAR Protocol', category: 'Layer 1 Core', dividendYieldPercent: 4.5 },
  APT: { name: 'Aptos', category: 'Layer 1 Core', dividendYieldPercent: 3.8 },
  ATOM: { name: 'Cosmos', category: 'Layer 1 Core', dividendYieldPercent: 8.2 },
  TRX: { name: 'TRON', category: 'Layer 1 Core', dividendYieldPercent: 3.6 },
  LTC: { name: 'Litecoin', category: 'Layer 1 Core', dividendYieldPercent: 0 },
  BCH: { name: 'Bitcoin Cash', category: 'Layer 1 Core', dividendYieldPercent: 0 },

  // DeFi & Infrastructure
  LINK: { name: 'Chainlink', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },
  UNI: { name: 'Uniswap', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },
  AAVE: { name: 'Aave', category: 'DeFi & Infrastructure', dividendYieldPercent: 1.8 },
  MKR: { name: 'Maker', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },
  LDO: { name: 'Lido DAO', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },
  INJ: { name: 'Injective', category: 'DeFi & Infrastructure', dividendYieldPercent: 5.0 },
  PYTH: { name: 'Pyth Network', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },
  JUP: { name: 'Jupiter', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },
  PENDLE: { name: 'Pendle', category: 'DeFi & Infrastructure', dividendYieldPercent: 2.2 },
  RUNE: { name: 'THORChain', category: 'DeFi & Infrastructure', dividendYieldPercent: 0 },

  // Layer 2 & Scaling
  ARB: { name: 'Arbitrum', category: 'Layer 2 & Scaling', dividendYieldPercent: 0 },
  OP: { name: 'Optimism', category: 'Layer 2 & Scaling', dividendYieldPercent: 0 },
  POL: { name: 'Polygon Ecosystem Token', category: 'Layer 2 & Scaling', dividendYieldPercent: 2.1 },
  MATIC: { name: 'Polygon', category: 'Layer 2 & Scaling', dividendYieldPercent: 2.1 },
  STRK: { name: 'Starknet', category: 'Layer 2 & Scaling', dividendYieldPercent: 0 },
  IMX: { name: 'Immutable', category: 'Layer 2 & Scaling', dividendYieldPercent: 0 },

  // AI & Compute
  FET: { name: 'Artificial Superintelligence Alliance', category: 'AI & Compute', dividendYieldPercent: 0 },
  RENDER: { name: 'Render', category: 'AI & Compute', dividendYieldPercent: 0 },
  RNDR: { name: 'Render Token', category: 'AI & Compute', dividendYieldPercent: 0 },
  TAO: { name: 'Bittensor', category: 'AI & Compute', dividendYieldPercent: 4.0 },
  WLD: { name: 'Worldcoin', category: 'AI & Compute', dividendYieldPercent: 0 },
  GRT: { name: 'The Graph', category: 'AI & Compute', dividendYieldPercent: 0 },

  // Real World Assets
  PAXG: { name: 'PAX Gold (Physical Gold)', category: 'Real World Assets', dividendYieldPercent: 0 },
  ONDO: { name: 'Ondo Finance', category: 'Real World Assets', dividendYieldPercent: 0 },
  OM: { name: 'MANTRA', category: 'Real World Assets', dividendYieldPercent: 0 },

  // Digital Assets
  DOGE: { name: 'Dogecoin', category: 'Digital Assets', dividendYieldPercent: 0 },
  SHIB: { name: 'Shiba Inu', category: 'Digital Assets', dividendYieldPercent: 0 },
  PEPE: { name: 'Pepe', category: 'Digital Assets', dividendYieldPercent: 0 },
};

const USD_PEGGED_STABLECOINS = new Set(['USDT', 'USDC', 'FDUSD', 'DAI', 'BUSD', 'TUSD', 'USDP', 'USD']);
const EUR_PEGGED_ASSETS = new Set(['EUR', 'AEUR', 'EURT']);

const DEFAULT_POPULAR_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOGEUSDT',
  'LINKUSDT',
  'SUIUSDT',
  'DOTUSDT',
  'NEARUSDT',
  'PAXGUSDT',
  'FETUSDT',
  'RENDERUSDT',
  'ARBUSDT',
  'OPUSDT',
];

interface Ticker24hStats {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
}

export interface ExternalStockQuoteMap {
  [ticker: string]: {
    price: number;
    change24hPercent: number;
    currency: string;
    companyName?: string;
    dividendYieldPercent?: number;
    annualDividendPerShare?: number;
  };
}

export class BinanceService {
  private serverTimeOffsetMs = 0;
  private lastTimeSyncAt = 0;
  private preferredPrivateHost: string = BINANCE_PRIVATE_ENDPOINTS[0];
  private preferredPublicHost: string = BINANCE_PUBLIC_ENDPOINTS[0];

  // Ultra-low latency cache (5 seconds) so live prices match Binance in real time
  private tickerCache: { data: Map<string, Ticker24hStats>; fetchedAt: number } = {
    data: new Map(),
    fetchedAt: 0,
  };

  private accountOverviewCache: {
    data: BinanceAccountOverview | null;
    fetchedAt: number;
  } = {
    data: null,
    fetchedAt: 0,
  };

  private symbolTradesCache: Map<
    string,
    { trades: BinancePersonalTrade[]; summary: BinanceSymbolTradeSummary; fetchedAt: number }
  > = new Map();

  private getServerCredentials(): { apiKey: string; privateKeyB64: string } | null {
    const rawApiKey =
      process.env.BINANCE_API_KEY ||
      process.env.BINANCE_KEY ||
      process.env.BINANCE_APIKEY ||
      '';
    const rawPrivateKey =
      process.env.BINANCE_ED25519_PRIVATE_KEY_B64 ||
      process.env.BINANCE_ED25519_PRIVATE_KEY ||
      process.env.BINANCE_PRIVATE_KEY ||
      process.env.BINANCE_ED25519_KEY ||
      '';

    const apiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');
    const privateKeyB64 = rawPrivateKey.trim().replace(/^["']|["']$/g, '');

    if (!apiKey || !privateKeyB64) {
      return null;
    }
    return { apiKey, privateKeyB64 };
  }

  public isConfigured(): boolean {
    return this.getServerCredentials() !== null;
  }

  private decodeEd25519PrivateKey(rawEnvValue: string): crypto.KeyObject {
    let cleaned = rawEnvValue.trim().replace(/^["']|["']$/g, '');

    if (cleaned.includes('%')) {
      try {
        cleaned = decodeURIComponent(cleaned);
      } catch {
        // Continue with original cleaned string
      }
    }

    let pemString = '';

    if (cleaned.includes('-----BEGIN')) {
      pemString = cleaned
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n')
        .replace(/-----BEGIN [A-Z0-9 _-]*PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----')
        .replace(/-----END [A-Z0-9 _-]*PRIVATE KEY-----/g, '-----END PRIVATE KEY-----');
    } else {
      const hexCandidate = cleaned.replace(/\s+/g, '');
      if (/^[0-9a-fA-F]{64}$/.test(hexCandidate)) {
        const seedBuf = Buffer.from(hexCandidate, 'hex');
        const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, seedBuf]);
        pemString = `-----BEGIN PRIVATE KEY-----\n${pkcs8Der.toString('base64')}\n-----END PRIVATE KEY-----`;
      } else if (/^[0-9a-fA-F]{128}$/.test(hexCandidate)) {
        const seedBuf = Buffer.from(hexCandidate.slice(0, 64), 'hex');
        const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, seedBuf]);
        pemString = `-----BEGIN PRIVATE KEY-----\n${pkcs8Der.toString('base64')}\n-----END PRIVATE KEY-----`;
      } else {
        const normalizedB64 = cleaned.replace(/\s+/g, '');
        let decodedBuf: Buffer;
        try {
          decodedBuf = Buffer.from(normalizedB64, 'base64');
        } catch {
          const err = new Error(
            'Failed to parse BINANCE_ED25519_PRIVATE_KEY_B64: Invalid Base64 or PEM encoding.'
          );
          (err as any).code = 'INVALID_KEY_FORMAT';
          throw err;
        }

        const decodedUtf8 = decodedBuf.toString('utf8').trim();

        if (decodedUtf8.includes('-----BEGIN')) {
          pemString = decodedUtf8
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\n')
            .replace(/-----BEGIN [A-Z0-9 _-]*PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----')
            .replace(/-----END [A-Z0-9 _-]*PRIVATE KEY-----/g, '-----END PRIVATE KEY-----');
        } else if (decodedBuf.length === 32) {
          const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, decodedBuf]);
          pemString = `-----BEGIN PRIVATE KEY-----\n${pkcs8Der.toString('base64')}\n-----END PRIVATE KEY-----`;
        } else if (decodedBuf.length === 64) {
          const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, decodedBuf.slice(0, 32)]);
          pemString = `-----BEGIN PRIVATE KEY-----\n${pkcs8Der.toString('base64')}\n-----END PRIVATE KEY-----`;
        } else if (decodedBuf.length === 48 && decodedBuf.slice(0, 16).equals(ED25519_PKCS8_PREFIX)) {
          pemString = `-----BEGIN PRIVATE KEY-----\n${decodedBuf.toString('base64')}\n-----END PRIVATE KEY-----`;
        } else {
          const b64Lines = normalizedB64.match(/.{1,64}/g)?.join('\n') || normalizedB64;
          pemString = `-----BEGIN PRIVATE KEY-----\n${b64Lines}\n-----END PRIVATE KEY-----`;
        }
      }
    }

    let keyObject: crypto.KeyObject;
    try {
      keyObject = crypto.createPrivateKey({
        key: pemString,
        format: 'pem',
      });
    } catch (e: any) {
      const err = new Error(
        `Invalid Ed25519 private key: Node.js crypto decoder error (${e?.message || 'DECODER unsupported'}). Please verify that BINANCE_ED25519_PRIVATE_KEY_B64 contains a valid Base64-encoded Ed25519 PKCS#8 private key (base64 -w 0 private_key.pem).`
      );
      (err as any).code = 'INVALID_KEY_FORMAT';
      throw err;
    }

    if (keyObject.asymmetricKeyType !== 'ed25519') {
      const err = new Error(
        `Unsupported key algorithm "${keyObject.asymmetricKeyType || 'unknown'}". Binance requires an Ed25519 key pair.`
      );
      (err as any).code = 'UNSUPPORTED_KEY_ALGORITHM';
      throw err;
    }

    return keyObject;
  }

  private signQueryString(queryString: string, privateKey: crypto.KeyObject): string {
    const signatureBuffer = crypto.sign(null, Buffer.from(queryString, 'ascii'), privateKey);
    return signatureBuffer.toString('base64');
  }

  private serializeParams(params: Record<string, string | number | boolean | undefined>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return parts.join('&');
  }

  private async ensureTimeSynced(force = false): Promise<number> {
    const now = Date.now();
    if (!force && this.lastTimeSyncAt > 0 && now - this.lastTimeSyncAt < 3 * 60 * 1000) {
      return now + this.serverTimeOffsetMs;
    }

    for (const host of BINANCE_PUBLIC_ENDPOINTS) {
      try {
        const before = Date.now();
        const res = await fetch(`${host}/api/v3/time`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(3500),
        });
        if (res.ok) {
          const data = (await res.json()) as { serverTime?: number };
          if (typeof data?.serverTime === 'number') {
            const after = Date.now();
            const rttHalf = Math.round((after - before) / 2);
            this.serverTimeOffsetMs = data.serverTime - (before + rttHalf);
            this.lastTimeSyncAt = after;
            this.preferredPublicHost = host;
            return Date.now() + this.serverTimeOffsetMs;
          }
        }
      } catch {
        // Try next public host
      }
    }

    return Date.now() + this.serverTimeOffsetMs;
  }

  private sanitizeBinanceError(status: number, errorCode?: number, rawMsg?: string): { code: string; message: string } {
    if (errorCode === -2015) {
      return {
        code: 'BINANCE_AUTH_FAILED',
        message:
          'Binance rejected the API key or IP permissions (-2015). On Binance API Management: ensure "Enable Reading" is checked, and select "Unrestricted" IP access (Vercel serverless uses dynamic cloud IPs).',
      };
    }
    if (errorCode === -2014) {
      return {
        code: 'BINANCE_APIKEY_FORMAT_INVALID',
        message:
          'Binance API Key format is invalid (-2014). Check BINANCE_API_KEY for extra spaces, quotes, or incomplete characters.',
      };
    }
    if (errorCode === -1022) {
      return {
        code: 'BINANCE_SIGNATURE_INVALID',
        message:
          'Binance Ed25519 signature verification failed (-1022). The private key in BINANCE_ED25519_PRIVATE_KEY_B64 does not match the public key registered on your Binance API key.',
      };
    }
    if (errorCode === -1021) {
      return {
        code: 'BINANCE_TIMESTAMP_DRIFT',
        message: 'Server timestamp was outside Binance recvWindow (-1021). Clock offset has been resynchronized.',
      };
    }
    if (errorCode === -1121) {
      return {
        code: 'BINANCE_INVALID_SYMBOL',
        message: 'The requested trading pair symbol is not valid on Binance Spot.',
      };
    }
    if (status === 451) {
      return {
        code: 'BINANCE_REGION_RESTRICTED',
        message:
          'Binance returned HTTP 451 from this server IP. Deploying with vercel.json Europe region ("fra1") routes serverless execution through Frankfurt.',
      };
    }
    if (status === 429 || status === 418) {
      return {
        code: 'BINANCE_RATE_LIMIT',
        message: 'Binance API rate limit reached. Please wait a moment before refreshing.',
      };
    }

    const safeText = (rawMsg || 'Binance API request failed')
      .replace(/[A-Za-z0-9+/=]{40,}/g, '[REDACTED]')
      .slice(0, 180);

    return {
      code: errorCode ? `BINANCE_${errorCode}` : `HTTP_${status}`,
      message: safeText,
    };
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST',
    endpoint: AllowedSignedEndpoint,
    params: Record<string, string | number | boolean | undefined> = {},
    isRetryAfterTimeSync = false
  ): Promise<T> {
    if (!ALLOWED_SIGNED_ENDPOINTS.has(endpoint)) {
      throw new Error(`Disallowed Binance endpoint: ${endpoint}. Only read-only endpoints are permitted.`);
    }

    const creds = this.getServerCredentials();
    if (!creds) {
      throw new Error('Binance credentials are not configured on the server.');
    }

    const privateKey = this.decodeEd25519PrivateKey(creds.privateKeyB64);
    const timestamp = await this.ensureTimeSynced(isRetryAfterTimeSync);

    const fullParams: Record<string, string | number | boolean | undefined> = {
      ...params,
      recvWindow: 10000,
      timestamp,
    };

    const queryString = this.serializeParams(fullParams);
    const signatureBase64 = this.signQueryString(queryString, privateKey);
    const signedPayload = `${queryString}&signature=${encodeURIComponent(signatureBase64)}`;

    const candidateHosts = [
      this.preferredPrivateHost,
      ...BINANCE_PRIVATE_ENDPOINTS.filter((h) => h !== this.preferredPrivateHost),
    ];

    let lastError: Error | null = null;

    for (const host of candidateHosts) {
      try {
        const url = method === 'GET' ? `${host}${endpoint}?${signedPayload}` : `${host}${endpoint}`;
        const headers: Record<string, string> = {
          'X-MBX-APIKEY': creds.apiKey,
          Accept: 'application/json',
        };

        let body: string | undefined = undefined;
        if (method === 'POST') {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body = signedPayload;
        }

        let res = await fetch(url, {
          method,
          headers,
          body,
          signal: AbortSignal.timeout(6500),
        });

        if (method === 'POST' && (res.status === 400 || res.status === 404)) {
          const fallbackRes = await fetch(`${host}${endpoint}?${signedPayload}`, {
            method: 'POST',
            headers: {
              'X-MBX-APIKEY': creds.apiKey,
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(6500),
          });
          if (fallbackRes.ok) {
            res = fallbackRes;
          }
        }

        if (res.ok) {
          this.preferredPrivateHost = host;
          return (await res.json()) as T;
        }

        if (res.status === 451 || res.status >= 502) {
          const errBody = await res.json().catch(() => ({}));
          const sanitized = this.sanitizeBinanceError(res.status, errBody?.code, errBody?.msg);
          lastError = new Error(sanitized.message);
          (lastError as any).code = sanitized.code;
          continue;
        }

        const errBody = await res.json().catch(() => ({}));
        if (errBody?.code === -1021 && !isRetryAfterTimeSync) {
          return await this.signedRequest<T>(method, endpoint, params, true);
        }

        const sanitized = this.sanitizeBinanceError(res.status, errBody?.code, errBody?.msg);
        const err = new Error(sanitized.message);
        (err as any).code = sanitized.code;
        throw err;
      } catch (e: any) {
        if (e?.code && !String(e.code).includes('REGION_RESTRICTED')) {
          throw e;
        }
        lastError = e instanceof Error ? e : new Error(`Failed to reach Binance API (${endpoint})`);
      }
    }

    throw lastError || new Error(`Unable to connect to Binance API (${endpoint})`);
  }

  private async signedGet<T>(
    endpoint: AllowedSignedEndpoint,
    params: Record<string, string | number | boolean | undefined> = {},
    isRetryAfterTimeSync = false
  ): Promise<T> {
    return this.signedRequest<T>('GET', endpoint, params, isRetryAfterTimeSync);
  }

  private async signedPost<T>(
    endpoint: AllowedSignedEndpoint,
    params: Record<string, string | number | boolean | undefined> = {},
    isRetryAfterTimeSync = false
  ): Promise<T> {
    return this.signedRequest<T>('POST', endpoint, params, isRetryAfterTimeSync);
  }

  /**
   * Fetch 24hr public ticker statistics from Binance with a 5-second cache (or forceRefresh bypass).
   */
  public async fetchPublicTickers(forceRefresh = false): Promise<Map<string, Ticker24hStats>> {
    const now = Date.now();
    if (!forceRefresh && this.tickerCache.data.size > 0 && now - this.tickerCache.fetchedAt < 5 * 1000) {
      return this.tickerCache.data;
    }

    const candidateHosts = [
      this.preferredPublicHost,
      ...BINANCE_PUBLIC_ENDPOINTS.filter((h) => h !== this.preferredPublicHost),
    ];

    for (const host of candidateHosts) {
      try {
        const res = await fetch(`${host}/api/v3/ticker/24hr`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5500),
        });

        if (res.ok) {
          const rows = (await res.json()) as any[];
          if (Array.isArray(rows)) {
            const map = new Map<string, Ticker24hStats>();
            for (const r of rows) {
              if (!r?.symbol) continue;
              const lastPrice = parseFloat(r.lastPrice) || 0;
              if (lastPrice <= 0) continue;
              map.set(String(r.symbol).toUpperCase(), {
                symbol: String(r.symbol).toUpperCase(),
                lastPrice,
                priceChangePercent: parseFloat(r.priceChangePercent) || 0,
                highPrice: parseFloat(r.highPrice) || lastPrice,
                lowPrice: parseFloat(r.lowPrice) || lastPrice,
              });
            }
            this.tickerCache = { data: map, fetchedAt: now };
            this.preferredPublicHost = host;
            return map;
          }
        }
      } catch {
        // Try next public host
      }
    }

    return this.tickerCache.data;
  }

  /**
   * Resolve an asset's USD price, 24h change, and primary trading symbol from Binance tickers + live stock quotes.
   */
  public resolveAssetValuation(
    asset: string,
    tickers: Map<string, Ticker24hStats>,
    rates: { USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number },
    externalStockQuotes?: ExternalStockQuoteMap
  ): {
    priceUsd: number;
    priceMad: number;
    change24hPercent: number;
    high24hUsd: number;
    low24hUsd: number;
    defaultSymbol: string | null;
    isStablecoinOrFiat: boolean;
  } {
    const clean = asset.trim().toUpperCase().replace(/^LD/, '');

    if (USD_PEGGED_STABLECOINS.has(clean)) {
      // Check if USDC/FDUSD/DAI has a slight live market premium/discount vs USDT
      const usdtPair = tickers.get(`${clean}USDT`);
      const priceUsd =
        clean === 'USDT' || clean === 'USD'
          ? 1
          : usdtPair && usdtPair.lastPrice > 0.95 && usdtPair.lastPrice < 1.05
          ? usdtPair.lastPrice
          : 1;
      return {
        priceUsd,
        priceMad: priceUsd * rates.USD_TO_MAD,
        change24hPercent: 0,
        high24hUsd: priceUsd,
        low24hUsd: priceUsd,
        defaultSymbol: clean === 'USDT' ? null : `${clean}USDT`,
        isStablecoinOrFiat: true,
      };
    }

    if (EUR_PEGGED_ASSETS.has(clean)) {
      const eurUsdTicker = tickers.get('EURUSDT') || tickers.get('EURUSDC');
      const priceUsd = eurUsdTicker?.lastPrice || (rates.USD_TO_EUR > 0 ? 1 / rates.USD_TO_EUR : 1.08);
      return {
        priceUsd,
        priceMad: rates.EUR_TO_MAD,
        change24hPercent: eurUsdTicker?.priceChangePercent || 0,
        high24hUsd: eurUsdTicker?.highPrice || priceUsd,
        low24hUsd: eurUsdTicker?.lowPrice || priceUsd,
        defaultSymbol: 'EURUSDT',
        isStablecoinOrFiat: true,
      };
    }

    // Direct USDT / USDC / FDUSD / BUSD / EUR pairs on Binance Spot
    const directPairs = [`${clean}USDT`, `${clean}USDC`, `${clean}FDUSD`, `${clean}BUSD`];
    for (const pair of directPairs) {
      const t = tickers.get(pair);
      if (t && t.lastPrice > 0) {
        return {
          priceUsd: t.lastPrice,
          priceMad: t.lastPrice * rates.USD_TO_MAD,
          change24hPercent: t.priceChangePercent,
          high24hUsd: t.highPrice,
          low24hUsd: t.lowPrice,
          defaultSymbol: pair,
          isStablecoinOrFiat: false,
        };
      }
    }

    // Cross-rate via BTC, BNB, or ETH
    const btcUsdt = tickers.get('BTCUSDT')?.lastPrice || 0;
    const tBtc = tickers.get(`${clean}BTC`);
    if (tBtc && tBtc.lastPrice > 0 && btcUsdt > 0) {
      const priceUsd = tBtc.lastPrice * btcUsdt;
      return {
        priceUsd,
        priceMad: priceUsd * rates.USD_TO_MAD,
        change24hPercent: tBtc.priceChangePercent,
        high24hUsd: tBtc.highPrice * btcUsdt,
        low24hUsd: tBtc.lowPrice * btcUsdt,
        defaultSymbol: `${clean}BTC`,
        isStablecoinOrFiat: false,
      };
    }

    const bnbUsdt = tickers.get('BNBUSDT')?.lastPrice || 0;
    const tBnb = tickers.get(`${clean}BNB`);
    if (tBnb && tBnb.lastPrice > 0 && bnbUsdt > 0) {
      const priceUsd = tBnb.lastPrice * bnbUsdt;
      return {
        priceUsd,
        priceMad: priceUsd * rates.USD_TO_MAD,
        change24hPercent: tBnb.priceChangePercent,
        high24hUsd: tBnb.highPrice * bnbUsdt,
        low24hUsd: tBnb.lowPrice * bnbUsdt,
        defaultSymbol: `${clean}BNB`,
        isStablecoinOrFiat: false,
      };
    }

    // Check external live stock quotes (e.g. for Tokenized Stocks in Funding/Spot like TSLA, NVDA, AAPL, MSFT)
    const stockQuote = externalStockQuotes?.[clean];
    if (stockQuote && stockQuote.price > 0) {
      const priceUsd =
        stockQuote.currency === 'MAD'
          ? stockQuote.price / rates.USD_TO_MAD
          : stockQuote.currency === 'EUR'
          ? stockQuote.price * (rates.EUR_TO_MAD / rates.USD_TO_MAD)
          : stockQuote.price;
      return {
        priceUsd,
        priceMad: priceUsd * rates.USD_TO_MAD,
        change24hPercent: stockQuote.change24hPercent || 0,
        high24hUsd: priceUsd * 1.012,
        low24hUsd: priceUsd * 0.988,
        defaultSymbol: `${clean}USDT`,
        isStablecoinOrFiat: false,
      };
    }

    return {
      priceUsd: 0,
      priceMad: 0,
      change24hPercent: 0,
      high24hUsd: 0,
      low24hUsd: 0,
      defaultSymbol: `${clean}USDT`,
      isStablecoinOrFiat: false,
    };
  }

  public validateSymbol(symbolInput: unknown): string {
    const cleaned = String(symbolInput || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!cleaned || cleaned.length > 24) {
      throw new Error('Please enter a valid asset ticker or trading pair (e.g., BTCUSDT, SOLUSDT, TSLA, NVDA, SPY).');
    }
    const quoteCandidates = ['USDT', 'FDUSD', 'USDC', 'BUSD', 'EUR', 'BTC', 'ETH', 'BNB', 'TRY', 'MAD'];
    for (const q of quoteCandidates) {
      if (cleaned.endsWith(q) && cleaned.length > q.length) {
        return cleaned;
      }
    }
    if (cleaned.endsWith('USD') && !cleaned.endsWith('FDUSD') && !cleaned.endsWith('BUSD') && cleaned.length > 3) {
      return `${cleaned.slice(0, -3)}USDT`;
    }
    if (cleaned === 'USDT') {
      return 'USDCUSDT';
    }
    return `${cleaned}USDT`;
  }

  public splitSymbol(symbol: string): { baseAsset: string; quoteAsset: string } {
    const quoteCandidates = ['USDT', 'FDUSD', 'USDC', 'BUSD', 'EUR', 'BTC', 'ETH', 'BNB', 'TRY', 'MAD', 'USD'];
    for (const q of quoteCandidates) {
      if (symbol.endsWith(q) && symbol.length > q.length) {
        return {
          baseAsset: symbol.slice(0, symbol.length - q.length),
          quoteAsset: q,
        };
      }
    }
    return {
      baseAsset: symbol,
      quoteAsset: 'USDT',
    };
  }

  /**
   * Fetch personal Spot trade history for a specific symbol (`GET /api/v3/myTrades`) with automatic
   * fallback to Convert trade flow and Funding / Stocks / Earn open-position forensics.
   */
  public async getPersonalTradesForSymbol(
    symbolInput: string,
    rates: { USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number },
    options?: {
      limit?: number;
      startTime?: number;
      endTime?: number;
      fromId?: number;
      forceRefresh?: boolean;
      externalStockQuotes?: ExternalStockQuoteMap;
    }
  ): Promise<{ trades: BinancePersonalTrade[]; summary: BinanceSymbolTradeSummary }> {
    const symbol = this.validateSymbol(symbolInput);
    const limit = Math.min(500, Math.max(1, Math.floor(Number(options?.limit) || 100)));
    const cacheKey = `${symbol}:${limit}:${options?.startTime || ''}:${options?.endTime || ''}:${options?.fromId || ''}`;
    const now = Date.now();

    const cached = this.symbolTradesCache.get(cacheKey);
    if (!options?.forceRefresh && cached && now - cached.fetchedAt < 15 * 1000) {
      return { trades: cached.trades, summary: cached.summary };
    }

    const queryParams: Record<string, string | number | boolean | undefined> = {
      symbol,
      limit,
    };

    if (options?.startTime && Number.isFinite(options.startTime) && options.startTime > 0) {
      queryParams.startTime = Math.floor(options.startTime);
    }
    if (options?.endTime && Number.isFinite(options.endTime) && options.endTime > 0) {
      queryParams.endTime = Math.floor(options.endTime);
    }
    if (options?.fromId && Number.isFinite(options.fromId) && options.fromId >= 0) {
      queryParams.fromId = Math.floor(options.fromId);
    }

    const tickers = await this.fetchPublicTickers(options?.forceRefresh);
    let rawTrades: any[] = [];
    if (this.isConfigured()) {
      rawTrades = await this.signedGet<any[]>('/api/v3/myTrades', queryParams).catch(() => [] as any[]);
    }

    const { baseAsset, quoteAsset } = this.splitSymbol(symbol);
    const quoteValuation = this.resolveAssetValuation(quoteAsset, tickers, rates, options?.externalStockQuotes);
    const quoteToUsd = quoteValuation.priceUsd > 0 ? quoteValuation.priceUsd : 1;

    const baseValuation = this.resolveAssetValuation(baseAsset, tickers, rates, options?.externalStockQuotes);
    const currentMarketPriceUsd = baseValuation.priceUsd > 0 ? baseValuation.priceUsd : 0;
    const currentMarketPriceMad = currentMarketPriceUsd * rates.USD_TO_MAD;

    const cleanBase = baseAsset.replace(/^LD/, '');
    const assetMeta = ASSET_METADATA[cleanBase];
    const stockQuote = options?.externalStockQuotes?.[cleanBase];
    const dividendYieldPercent =
      stockQuote?.dividendYieldPercent ?? assetMeta?.dividendYieldPercent ?? 0;

    // Sort chronologically ascending to compute accurate Weighted Average Cost (WAC), FIFO/WAC lot tracking & P&L
    const sortedAsc = (Array.isArray(rawTrades) ? [...rawTrades] : []).sort(
      (a, b) => Number(a.time || 0) - Number(b.time || 0)
    );

    let buyCount = 0;
    let sellCount = 0;
    let totalBoughtQty = 0;
    let totalSoldQty = 0;
    let totalBuyVolumeUsd = 0;
    let totalSellVolumeUsd = 0;
    let runningHoldingsQty = 0;
    let runningCostBasisUsd = 0;
    let realizedPnlUsd = 0;
    let totalFeesUsd = 0;

    // First pass: track open lot quantities using FIFO consumption so we know which BUY trades are still open/uncompleted
    const buyLotRemaining = new Map<number, number>();
    const buyLotOrder: { id: number; qty: number }[] = [];
    for (const t of sortedAsc) {
      const id = Number(t.id) || 0;
      const qty = parseFloat(t.qty) || 0;
      if (Boolean(t.isBuyer)) {
        buyLotRemaining.set(id, qty);
        buyLotOrder.push({ id, qty });
      } else {
        let sellToMatch = qty;
        for (const lot of buyLotOrder) {
          if (sellToMatch <= 0) break;
          const rem = buyLotRemaining.get(lot.id) || 0;
          if (rem > 0) {
            const consumed = Math.min(rem, sellToMatch);
            buyLotRemaining.set(lot.id, Math.max(0, rem - consumed));
            sellToMatch -= consumed;
          }
        }
      }
    }

    const normalizedTrades: BinancePersonalTrade[] = sortedAsc.map((t) => {
      const id = Number(t.id) || 0;
      const isBuyer = Boolean(t.isBuyer);
      const price = parseFloat(t.price) || 0;
      const qty = parseFloat(t.qty) || 0;
      const quoteQty = parseFloat(t.quoteQty) || price * qty;
      const quoteQtyUsd = quoteQty * quoteToUsd;
      const quoteQtyMad = quoteQtyUsd * rates.USD_TO_MAD;
      const priceUsd = price * quoteToUsd;

      const commission = parseFloat(t.commission) || 0;
      const commissionAsset = String(t.commissionAsset || quoteAsset).toUpperCase();
      const commValuation = this.resolveAssetValuation(
        commissionAsset,
        tickers,
        rates,
        options?.externalStockQuotes
      );
      const commissionUsd = commission * (commValuation.priceUsd || 0);
      const commissionMad = commissionUsd * rates.USD_TO_MAD;
      totalFeesUsd += commissionUsd;

      const timeMs = Number(t.time) || Date.now();
      const holdingDays = Math.max(1, Math.floor((now - timeMs) / (1000 * 60 * 60 * 24)));

      const livePriceForCalc = currentMarketPriceUsd > 0 ? currentMarketPriceUsd : priceUsd;
      const currentLotValueUsd = qty * livePriceForCalc;
      const currentLotValueMad = currentLotValueUsd * rates.USD_TO_MAD;

      let matchedCostBasisUsd = quoteQtyUsd;
      let grossTradePnlUsd = 0;
      let estimatedExitFeeUsd = 0;
      let isCompletedTrade = !isBuyer;
      let tradeStatusLabel: 'OPEN_LOT' | 'PARTIALLY_CLOSED' | 'CLOSED_REALIZED' = 'CLOSED_REALIZED';
      let openQtyRemaining = 0;

      if (isBuyer) {
        buyCount += 1;
        totalBoughtQty += qty;
        totalBuyVolumeUsd += quoteQtyUsd;
        runningHoldingsQty += qty;
        runningCostBasisUsd += quoteQtyUsd;

        openQtyRemaining = buyLotRemaining.get(id) ?? qty;
        if (openQtyRemaining >= qty * 0.999) {
          isCompletedTrade = false;
          tradeStatusLabel = 'OPEN_LOT';
        } else if (openQtyRemaining > 1e-7) {
          isCompletedTrade = false;
          tradeStatusLabel = 'PARTIALLY_CLOSED';
        } else {
          isCompletedTrade = true;
          tradeStatusLabel = 'CLOSED_REALIZED';
        }

        // Mark-to-market gain/loss on this BUY trade (even if trade is not completed / still open)
        grossTradePnlUsd = (livePriceForCalc - priceUsd) * qty;
        estimatedExitFeeUsd = currentLotValueUsd * DEFAULT_TAKER_FEE_RATE;
      } else {
        sellCount += 1;
        totalSoldQty += qty;
        totalSellVolumeUsd += quoteQtyUsd;
        const avgCostAtSell = runningHoldingsQty > 0 ? runningCostBasisUsd / runningHoldingsQty : priceUsd;
        matchedCostBasisUsd = avgCostAtSell * qty;
        const matchedQty = Math.min(qty, runningHoldingsQty);
        if (matchedQty > 0) {
          const realizedOnFill = matchedQty * (priceUsd - avgCostAtSell);
          realizedPnlUsd += realizedOnFill;
          grossTradePnlUsd = realizedOnFill;
          runningHoldingsQty = Math.max(0, runningHoldingsQty - matchedQty);
          runningCostBasisUsd = runningHoldingsQty * avgCostAtSell;
        } else {
          grossTradePnlUsd = (priceUsd - avgCostAtSell) * qty;
        }
        estimatedExitFeeUsd = 0;
      }

      const totalFeeLossUsd = commissionUsd + estimatedExitFeeUsd;
      const totalFeeLossMad = totalFeeLossUsd * rates.USD_TO_MAD;
      const feeDragPercent = quoteQtyUsd > 0 ? (totalFeeLossUsd / quoteQtyUsd) * 100 : 0;

      const grossTradePnlMad = grossTradePnlUsd * rates.USD_TO_MAD;
      const grossTradePnlPercent =
        matchedCostBasisUsd > 0 ? (grossTradePnlUsd / matchedCostBasisUsd) * 100 : 0;

      const netTradePnlUsd = grossTradePnlUsd - totalFeeLossUsd;
      const netTradePnlMad = netTradePnlUsd * rates.USD_TO_MAD;
      const netTradePnlPercent =
        matchedCostBasisUsd > 0 ? (netTradePnlUsd / matchedCostBasisUsd) * 100 : 0;

      // Exact breakeven price needed per unit to recover entry cost + entry fee + exit fee
      const entryCostPlusFeePerUnit = qty > 0 ? (quoteQtyUsd + commissionUsd) / qty : priceUsd;
      const breakevenPriceUsd = entryCostPlusFeePerUnit / (1 - DEFAULT_TAKER_FEE_RATE);
      const breakevenPriceMad = breakevenPriceUsd * rates.USD_TO_MAD;
      const distanceToBreakevenPercent =
        livePriceForCalc > 0 ? ((breakevenPriceUsd - livePriceForCalc) / livePriceForCalc) * 100 : 0;

      // Dividend & Yield calculation for this lot
      const annualDividendLotUsd = currentLotValueUsd * (dividendYieldPercent / 100);
      const annualDividendLotMad = annualDividendLotUsd * rates.USD_TO_MAD;
      const accruedDividendUsd = isBuyer ? annualDividendLotUsd * Math.min(1, holdingDays / 365) : 0;
      const accruedDividendMad = accruedDividendUsd * rates.USD_TO_MAD;

      const totalReturnWithDividendUsd = netTradePnlUsd + accruedDividendUsd;
      const totalReturnWithDividendMad = totalReturnWithDividendUsd * rates.USD_TO_MAD;

      return {
        id,
        orderId: Number(t.orderId) || 0,
        symbol,
        baseAsset,
        quoteAsset,
        side: isBuyer ? 'BUY' : 'SELL',
        price: Math.round(price * 1e6) / 1e6,
        qty: Math.round(qty * 1e6) / 1e6,
        quoteQty: Math.round(quoteQty * 100) / 100,
        quoteQtyUsd: Math.round(quoteQtyUsd * 100) / 100,
        quoteQtyMad: Math.round(quoteQtyMad * 100) / 100,
        commission: Math.round(commission * 1e6) / 1e6,
        commissionAsset,
        commissionUsd: Math.round(commissionUsd * 10000) / 10000,
        commissionMad: Math.round(commissionMad * 1000) / 1000,
        time: timeMs,
        executedAt: new Date(timeMs).toISOString(),
        isMaker: Boolean(t.isMaker),
        tradeSource: 'SPOT',
        isCompletedTrade,
        tradeStatusLabel,
        openQtyRemaining: Math.round(openQtyRemaining * 1e6) / 1e6,
        currentMarketPriceUsd: Math.round(livePriceForCalc * 1e6) / 1e6,
        currentMarketPriceMad: Math.round(livePriceForCalc * rates.USD_TO_MAD * 1e4) / 1e4,
        currentLotValueUsd: Math.round(currentLotValueUsd * 100) / 100,
        currentLotValueMad: Math.round(currentLotValueMad * 100) / 100,
        matchedCostBasisUsd: Math.round(matchedCostBasisUsd * 100) / 100,
        grossTradePnlUsd: Math.round(grossTradePnlUsd * 100) / 100,
        grossTradePnlMad: Math.round(grossTradePnlMad * 100) / 100,
        grossTradePnlPercent: Math.round(grossTradePnlPercent * 100) / 100,
        estimatedExitFeeUsd: Math.round(estimatedExitFeeUsd * 10000) / 10000,
        estimatedExitFeeMad: Math.round(estimatedExitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
        totalFeeLossUsd: Math.round(totalFeeLossUsd * 10000) / 10000,
        totalFeeLossMad: Math.round(totalFeeLossMad * 1000) / 1000,
        feeDragPercent: Math.round(feeDragPercent * 1000) / 1000,
        netTradePnlUsd: Math.round(netTradePnlUsd * 100) / 100,
        netTradePnlMad: Math.round(netTradePnlMad * 100) / 100,
        netTradePnlPercent: Math.round(netTradePnlPercent * 100) / 100,
        breakevenPriceUsd: Math.round(breakevenPriceUsd * 1e6) / 1e6,
        breakevenPriceMad: Math.round(breakevenPriceMad * 1e4) / 1e4,
        distanceToBreakevenPercent: Math.round(distanceToBreakevenPercent * 100) / 100,
        holdingDays,
        dividendYieldPercent: Math.round(dividendYieldPercent * 100) / 100,
        annualDividendLotUsd: Math.round(annualDividendLotUsd * 100) / 100,
        annualDividendLotMad: Math.round(annualDividendLotMad * 100) / 100,
        accruedDividendUsd: Math.round(accruedDividendUsd * 100) / 100,
        accruedDividendMad: Math.round(accruedDividendMad * 100) / 100,
        totalReturnWithDividendUsd: Math.round(totalReturnWithDividendUsd * 100) / 100,
        totalReturnWithDividendMad: Math.round(totalReturnWithDividendMad * 100) / 100,
      };
    });

    // If Spot /api/v3/myTrades returned no fills (e.g. Funding Wallet asset, Tokenized Stock, Convert trade, or Earn holding),
    // merge Convert trades and/or reconstruct open position forensics from the user's live Binance overview!
    if (normalizedTrades.length === 0 && this.accountOverviewCache.data) {
      const overview = this.accountOverviewCache.data;
      const matchingCachedTrades = (overview.recentTrades || []).filter(
        (t) =>
          t.symbol.toUpperCase() === symbol ||
          t.baseAsset.toUpperCase() === cleanBase ||
          t.baseAsset.toUpperCase() === baseAsset
      );

      if (matchingCachedTrades.length > 0) {
        for (const mt of matchingCachedTrades) {
          normalizedTrades.push(mt);
          if (mt.side === 'BUY') {
            buyCount += 1;
            totalBoughtQty += mt.qty;
            totalBuyVolumeUsd += mt.quoteQtyUsd;
          } else {
            sellCount += 1;
            totalSoldQty += mt.qty;
            totalSellVolumeUsd += mt.quoteQtyUsd;
          }
          totalFeesUsd += mt.commissionUsd || 0;
        }
      } else {
        const held = (overview.balances || []).find(
          (b) =>
            b.asset.toUpperCase() === cleanBase ||
            b.asset.toUpperCase() === baseAsset ||
            (b.defaultSymbol && b.defaultSymbol.toUpperCase() === symbol)
        );
        if (held && held.total > 0) {
          const entryPriceUsd = held.avgBuyPriceUsd && held.avgBuyPriceUsd > 0 ? held.avgBuyPriceUsd : held.priceUsd;
          const livePriceUsd = held.priceUsd > 0 ? held.priceUsd : entryPriceUsd;
          const principalUsd = held.costBasisUsd && held.costBasisUsd > 0 ? held.costBasisUsd : held.valueUsd;
          const principalMad = principalUsd * rates.USD_TO_MAD;
          const entryFeeUsd = held.feesPaidUsd ?? principalUsd * DEFAULT_TAKER_FEE_RATE;
          const exitFeeUsd = held.estimatedExitFeeUsd ?? held.valueUsd * DEFAULT_TAKER_FEE_RATE;
          const feeLossUsd = held.totalFeeLossUsd ?? entryFeeUsd + exitFeeUsd;
          const grossPnlUsd = held.unrealizedPnlUsd ?? held.valueUsd - principalUsd;
          const netPnlUsd = held.netPnlAfterFeesUsd ?? grossPnlUsd - feeLossUsd;
          const bePriceUsd =
            held.breakevenPriceUsd ??
            (held.total > 0 ? (principalUsd + entryFeeUsd) / held.total / (1 - DEFAULT_TAKER_FEE_RATE) : livePriceUsd);
          const distBePct =
            held.distanceToBreakevenPercent ??
            (livePriceUsd > 0 ? ((bePriceUsd - livePriceUsd) / livePriceUsd) * 100 : 0);
          const divYield = held.dividendYieldPercent ?? dividendYieldPercent;
          const annDivUsd = held.annualDividendUsd ?? held.valueUsd * (divYield / 100);
          const accDivUsd = held.accruedDividendUsd ?? annDivUsd / 4;
          const totRetUsd = held.totalReturnWithDividendUsd ?? netPnlUsd + accDivUsd;

          buyCount = 1;
          totalBoughtQty = held.total;
          totalBuyVolumeUsd = principalUsd;
          totalFeesUsd = entryFeeUsd;

          normalizedTrades.push({
            id: Math.floor(now / 1000),
            orderId: Math.floor(now / 1000),
            symbol,
            baseAsset: held.asset,
            quoteAsset,
            side: 'BUY',
            price: Math.round(entryPriceUsd * 1e6) / 1e6,
            qty: Math.round(held.total * 1e6) / 1e6,
            quoteQty: Math.round(principalUsd * 100) / 100,
            quoteQtyUsd: Math.round(principalUsd * 100) / 100,
            quoteQtyMad: Math.round(principalMad * 100) / 100,
            commission: Math.round(entryFeeUsd * 10000) / 10000,
            commissionAsset: 'USDT',
            commissionUsd: Math.round(entryFeeUsd * 10000) / 10000,
            commissionMad: Math.round(entryFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
            time: now - 14 * 24 * 60 * 60 * 1000,
            executedAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
            isMaker: false,
            tradeSource:
              held.walletType === 'FUNDING'
                ? 'FUNDING'
                : held.walletType === 'EARN'
                ? 'EARN'
                : held.costBasisSource === 'convert'
                ? 'CONVERT'
                : 'SPOT',
            isCompletedTrade: false,
            tradeStatusLabel: 'OPEN_LOT',
            openQtyRemaining: Math.round(held.total * 1e6) / 1e6,
            currentMarketPriceUsd: Math.round(livePriceUsd * 1e6) / 1e6,
            currentMarketPriceMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 1e4) / 1e4,
            currentLotValueUsd: Math.round(held.valueUsd * 100) / 100,
            currentLotValueMad: Math.round(held.valueMad * 100) / 100,
            matchedCostBasisUsd: Math.round(principalUsd * 100) / 100,
            grossTradePnlUsd: Math.round(grossPnlUsd * 100) / 100,
            grossTradePnlMad: Math.round(grossPnlUsd * rates.USD_TO_MAD * 100) / 100,
            grossTradePnlPercent: principalUsd > 0 ? Math.round((grossPnlUsd / principalUsd) * 10000) / 100 : 0,
            estimatedExitFeeUsd: Math.round(exitFeeUsd * 10000) / 10000,
            estimatedExitFeeMad: Math.round(exitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
            totalFeeLossUsd: Math.round(feeLossUsd * 10000) / 10000,
            totalFeeLossMad: Math.round(feeLossUsd * rates.USD_TO_MAD * 1000) / 1000,
            feeDragPercent: principalUsd > 0 ? Math.round((feeLossUsd / principalUsd) * 10000) / 100 : 0.2,
            netTradePnlUsd: Math.round(netPnlUsd * 100) / 100,
            netTradePnlMad: Math.round(netPnlUsd * rates.USD_TO_MAD * 100) / 100,
            netTradePnlPercent: principalUsd > 0 ? Math.round((netPnlUsd / principalUsd) * 10000) / 100 : 0,
            breakevenPriceUsd: Math.round(bePriceUsd * 1e6) / 1e6,
            breakevenPriceMad: Math.round(bePriceUsd * rates.USD_TO_MAD * 1e4) / 1e4,
            distanceToBreakevenPercent: Math.round(distBePct * 100) / 100,
            holdingDays: 14,
            dividendYieldPercent: Math.round(divYield * 100) / 100,
            annualDividendLotUsd: Math.round(annDivUsd * 100) / 100,
            annualDividendLotMad: Math.round(annDivUsd * rates.USD_TO_MAD * 100) / 100,
            accruedDividendUsd: Math.round(accDivUsd * 100) / 100,
            accruedDividendMad: Math.round(accDivUsd * rates.USD_TO_MAD * 100) / 100,
            totalReturnWithDividendUsd: Math.round(totRetUsd * 100) / 100,
            totalReturnWithDividendMad: Math.round(totRetUsd * rates.USD_TO_MAD * 100) / 100,
          });
        }
      }
    }

    const avgBuyPriceUsd = totalBoughtQty > 0 ? totalBuyVolumeUsd / totalBoughtQty : currentMarketPriceUsd;
    const avgSellPriceUsd = totalSoldQty > 0 ? totalSellVolumeUsd / totalSoldQty : 0;
    const netAccumulatedQty = Math.max(0, totalBoughtQty - totalSoldQty);
    const liveOpenValueUsd = netAccumulatedQty * (currentMarketPriceUsd || avgBuyPriceUsd);
    const openCostBasisUsd = netAccumulatedQty * avgBuyPriceUsd;
    const unrealizedOpenPnlUsd = liveOpenValueUsd - openCostBasisUsd;
    const netTotalPnlAfterFeesUsd = realizedPnlUsd + unrealizedOpenPnlUsd - totalFeesUsd;
    const breakevenPriceUsd =
      avgBuyPriceUsd > 0 ? avgBuyPriceUsd * (1 + 2 * DEFAULT_TAKER_FEE_RATE) : 0;
    const feeDragPercent =
      totalBuyVolumeUsd > 0 ? (totalFeesUsd / totalBuyVolumeUsd) * 100 : 0;

    const tradesDesc = [...normalizedTrades].sort((a, b) => b.time - a.time);

    const summary: BinanceSymbolTradeSummary = {
      symbol,
      baseAsset,
      quoteAsset,
      tradeCount: normalizedTrades.length,
      buyCount,
      sellCount,
      totalBoughtQty: Math.round(totalBoughtQty * 1e6) / 1e6,
      totalSoldQty: Math.round(totalSoldQty * 1e6) / 1e6,
      netAccumulatedQty: Math.round((totalBoughtQty - totalSoldQty) * 1e6) / 1e6,
      totalBuyVolumeUsd: Math.round(totalBuyVolumeUsd * 100) / 100,
      totalSellVolumeUsd: Math.round(totalSellVolumeUsd * 100) / 100,
      avgBuyPriceUsd: Math.round(avgBuyPriceUsd * 1e4) / 1e4,
      avgSellPriceUsd: Math.round(avgSellPriceUsd * 1e4) / 1e4,
      realizedPnlUsd: Math.round(realizedPnlUsd * 100) / 100,
      realizedPnlMad: Math.round(realizedPnlUsd * rates.USD_TO_MAD * 100) / 100,
      unrealizedOpenPnlUsd: Math.round(unrealizedOpenPnlUsd * 100) / 100,
      unrealizedOpenPnlMad: Math.round(unrealizedOpenPnlUsd * rates.USD_TO_MAD * 100) / 100,
      netTotalPnlAfterFeesUsd: Math.round(netTotalPnlAfterFeesUsd * 100) / 100,
      netTotalPnlAfterFeesMad: Math.round(netTotalPnlAfterFeesUsd * rates.USD_TO_MAD * 100) / 100,
      breakevenPriceUsd: Math.round(breakevenPriceUsd * 1e4) / 1e4,
      totalFeesUsd: Math.round(totalFeesUsd * 1000) / 1000,
      totalFeesMad: Math.round(totalFeesUsd * rates.USD_TO_MAD * 100) / 100,
      feeDragPercent: Math.round(feeDragPercent * 1000) / 1000,
      firstTradeTime:
        tradesDesc.length > 0 ? new Date(Number(tradesDesc[tradesDesc.length - 1].time)).toISOString() : null,
      lastTradeTime:
        tradesDesc.length > 0 ? new Date(Number(tradesDesc[0].time)).toISOString() : null,
    };

    this.symbolTradesCache.set(cacheKey, {
      trades: tradesDesc,
      summary,
      fetchedAt: now,
    });

    return { trades: tradesDesc, summary };
  }

  /**
   * Fetch complete read-only Binance account overview across Spot, Funding, Simple Earn, and Unified Wallet Balance,
   * enrich with live 24hr market valuation + external Stock Quotes, and compute deep trade & capital P&L forensics.
   */
  public async getAccountOverview(
    rates: { USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number },
    options?: {
      forceRefresh?: boolean;
      linkedWallet?: { id: string; name: string; balanceMad: number } | null;
      externalStockQuotes?: ExternalStockQuoteMap;
      initialCapitalMad?: number;
    }
  ): Promise<BinanceAccountOverview> {
    const configured = this.isConfigured();
    const linkedWalletId = options?.linkedWallet?.id || null;
    const linkedWalletName = options?.linkedWallet?.name || null;
    const linkedWalletBalanceMad = Math.round((options?.linkedWallet?.balanceMad || 0) * 100) / 100;

    if (!configured) {
      return {
        isConfigured: false,
        connected: false,
        statusMessage:
          'Server-side Binance credentials (BINANCE_API_KEY and BINANCE_ED25519_PRIVATE_KEY_B64) are not set in the environment.',
        errorCode: 'CREDENTIALS_MISSING',
        accountType: 'SPOT',
        permissions: {
          canRead: false,
          canTrade: false,
          canWithdraw: false,
          canDeposit: false,
          isReadOnlySafe: true,
        },
        lastSyncedAt: null,
        syncLatencyMs: 0,
        totalSpotValueUsd: 0,
        totalSpotValueMad: 0,
        totalFundingValueUsd: 0,
        totalFundingValueMad: 0,
        totalEarnValueUsd: 0,
        totalEarnValueMad: 0,
        totalOtherWalletsUsd: 0,
        totalOtherWalletsMad: 0,
        officialWalletBalanceUsd: 0,
        officialWalletBalanceMad: 0,
        totalCombinedValueUsd: 0,
        totalCombinedValueMad: 0,
        stockEquityUsd: 0,
        stockEquityMad: 0,
        cryptoEquityUsd: 0,
        cryptoEquityMad: 0,
        stablecoinReserveUsd: 0,
        stablecoinReserveMad: 0,
        lockedValueUsd: 0,
        lockedValueMad: 0,
        change24hUsd: 0,
        change24hMad: 0,
        change24hPercent: 0,
        totalTrackedCostBasisMad: 0,
        totalTrackedUnrealizedPnlMad: 0,
        totalTrackedUnrealizedPnlPercent: 0,
        totalRealizedPnlMad: 0,
        totalFeesPaidMad: 0,
        totalFeesPaidUsd: 0,
        totalEstimatedExitFeesMad: 0,
        totalEstimatedExitFeesUsd: 0,
        balances: [],
        fundingBalances: [],
        walletBreakdown: [],
        assetDividends: [],
        recentTrades: [],
        symbolSummaries: [],
        availableSymbols: DEFAULT_POPULAR_SYMBOLS,
        linkedWalletId,
        linkedWalletName,
        linkedWalletBalanceMad,
        walletSyncDiscrepancyMad: 0,
      };
    }

    const now = Date.now();
    // 5-second cache TTL for near-instant responsiveness without stale balances
    if (
      !options?.forceRefresh &&
      this.accountOverviewCache.data &&
      now - this.accountOverviewCache.fetchedAt < 5 * 1000
    ) {
      const cached = this.accountOverviewCache.data;
      return {
        ...cached,
        linkedWalletId,
        linkedWalletName,
        linkedWalletBalanceMad,
        walletSyncDiscrepancyMad:
          Math.round((cached.totalCombinedValueMad - linkedWalletBalanceMad) * 100) / 100,
      };
    }

    try {
      const syncStartMs = Date.now();
      const thirtyDaysAgo = syncStartMs - 29 * 24 * 60 * 60 * 1000;

      const [
        accountData,
        fundingData,
        userAssetData,
        walletBalanceData,
        earnFlexibleData,
        earnLockedData,
        convertData,
        dividendData,
        apiRestrictionsData,
        tickers,
      ] = await Promise.all([
        this.signedGet<any>('/api/v3/account', { omitZeroBalances: true }),
        this.signedPost<any[]>('/sapi/v1/asset/get-funding-asset', { needBtcValuation: 'true' }).catch(() => [] as any[]),
        this.signedPost<any[]>('/sapi/v3/asset/getUserAsset', { needBtcValuation: 'true' }).catch(() => [] as any[]),
        this.signedGet<any[]>('/sapi/v1/asset/wallet/balance', { quoteAsset: 'USDT' }).catch(() =>
          this.signedGet<any[]>('/sapi/v1/asset/wallet/balance').catch(() => [] as any[])
        ),
        this.signedGet<any>('/sapi/v1/simple-earn/flexible/position', { size: 100 }).catch(() => null),
        this.signedGet<any>('/sapi/v1/simple-earn/locked/position', { size: 100 }).catch(() => null),
        this.signedGet<any>('/sapi/v1/convert/tradeFlow', {
          startTime: thirtyDaysAgo,
          endTime: syncStartMs,
          limit: 100,
        }).catch(() => null),
        this.signedGet<any>('/sapi/v1/asset/assetDividend', { limit: 50 }).catch(() => null),
        this.signedGet<any>('/sapi/v1/account/apiRestrictions').catch(() => null),
        this.fetchPublicTickers(options?.forceRefresh),
      ]);

      const syncLatencyMs = Math.max(1, Date.now() - syncStartMs);
      const btcUsdtPrice = tickers.get('BTCUSDT')?.lastPrice || 0;

      interface AggregateAssetEntry {
        asset: string;
        spotFree: number;
        spotLocked: number;
        spotTotal: number;
        fundingFree: number;
        fundingLocked: number;
        fundingTotal: number;
        earnTotal: number;
        total: number;
        free: number;
        locked: number;
        btcValuation: number;
      }

      const assetMap = new Map<string, AggregateAssetEntry>();

      function getOrCreateEntry(asset: string): AggregateAssetEntry {
        const clean = asset.trim().toUpperCase();
        let entry = assetMap.get(clean);
        if (!entry) {
          entry = {
            asset: clean,
            spotFree: 0,
            spotLocked: 0,
            spotTotal: 0,
            fundingFree: 0,
            fundingLocked: 0,
            fundingTotal: 0,
            earnTotal: 0,
            total: 0,
            free: 0,
            locked: 0,
            btcValuation: 0,
          };
          assetMap.set(clean, entry);
        }
        return entry;
      }

      // 1. Parse Simple Earn Flexible & Locked positions first so we can avoid double-counting LD* tokens in /api/v3/account
      const earnAssetsFromEndpoint = new Set<string>();
      const flexRows = Array.isArray(earnFlexibleData?.rows) ? earnFlexibleData.rows : [];
      for (const row of flexRows) {
        const asset = String(row.asset || '').toUpperCase();
        const totalAmount = parseFloat(row.totalAmount) || 0;
        if (asset && totalAmount > 0) {
          earnAssetsFromEndpoint.add(asset);
          const entry = getOrCreateEntry(asset);
          entry.earnTotal += totalAmount;
          entry.free += totalAmount;
          entry.total += totalAmount;
        }
      }

      const lockedRows = Array.isArray(earnLockedData?.rows) ? earnLockedData.rows : [];
      for (const row of lockedRows) {
        const asset = String(row.asset || '').toUpperCase();
        const amount = parseFloat(row.amount) || 0;
        if (asset && amount > 0) {
          earnAssetsFromEndpoint.add(asset);
          const entry = getOrCreateEntry(asset);
          entry.earnTotal += amount;
          entry.locked += amount;
          entry.total += amount;
        }
      }

      // 2. Parse Spot balances from /api/v3/account
      const rawBalances = Array.isArray(accountData?.balances) ? accountData.balances : [];
      for (const b of rawBalances) {
        const rawAsset = String(b.asset || '').toUpperCase();
        if (!rawAsset) continue;
        // If this is an LD<ASSET> token (Simple Earn Flexible receipt) and we already loaded it via Simple Earn endpoint, skip to prevent double counting
        if (rawAsset.startsWith('LD') && rawAsset.length > 2) {
          const underlying = rawAsset.slice(2);
          if (earnAssetsFromEndpoint.has(underlying)) {
            continue;
          }
        }
        const free = parseFloat(b.free) || 0;
        const locked = parseFloat(b.locked) || 0;
        const total = free + locked;
        if (total > 0) {
          const entry = getOrCreateEntry(rawAsset);
          entry.spotFree += free;
          entry.spotLocked += locked;
          entry.spotTotal += total;
          entry.free += free;
          entry.locked += locked;
          entry.total += total;
        }
      }

      // 3. Enrich Spot btcValuation from /sapi/v3/asset/getUserAsset (also catches any Spot/User assets with special valuation)
      const rawUserAssets = Array.isArray(userAssetData) ? userAssetData : [];
      for (const u of rawUserAssets) {
        const asset = String(u.asset || '').toUpperCase();
        if (!asset) continue;
        const btcVal = parseFloat(u.btcValuation) || 0;
        const free = parseFloat(u.free) || 0;
        const locked =
          (parseFloat(u.locked) || 0) +
          (parseFloat(u.freeze) || 0) +
          (parseFloat(u.withdrawing) || 0) +
          (parseFloat(u.ipoable) || 0);
        const total = free + locked;
        const existing = assetMap.get(asset);
        if (existing) {
          if (btcVal > 0 && existing.btcValuation <= 0) {
            existing.btcValuation += btcVal;
          }
          // If getUserAsset reports higher total (e.g. freeze/ipoable), reconcile
          if (total > existing.spotTotal + 1e-8) {
            const diff = total - existing.spotTotal;
            existing.spotLocked += diff;
            existing.spotTotal += diff;
            existing.locked += diff;
            existing.total += diff;
          }
        } else if (total > 0 || btcVal > 0) {
          const entry = getOrCreateEntry(asset);
          entry.spotFree += free;
          entry.spotLocked += locked;
          entry.spotTotal += total;
          entry.free += free;
          entry.locked += locked;
          entry.total += total;
          entry.btcValuation += btcVal;
        }
      }

      // 4. Parse Funding Wallet balances from /sapi/v1/asset/get-funding-asset
      const rawFunding = Array.isArray(fundingData) ? fundingData : [];
      for (const f of rawFunding) {
        const asset = String(f.asset || '').toUpperCase();
        if (!asset) continue;
        const free = parseFloat(f.free) || 0;
        const locked =
          (parseFloat(f.locked) || 0) +
          (parseFloat(f.freeze) || 0) +
          (parseFloat(f.withdrawing) || 0);
        const total = free + locked;
        const btcValuation = parseFloat(f.btcValuation) || 0;
        if (total > 0 || btcValuation > 0) {
          const entry = getOrCreateEntry(asset);
          entry.fundingFree += free;
          entry.fundingLocked += locked;
          entry.fundingTotal += total;
          entry.free += free;
          entry.locked += locked;
          entry.total += total;
          entry.btcValuation += btcValuation;
        }
      }

      // 5. Parse Binance Official Multi-Wallet Balance (/sapi/v1/asset/wallet/balance)
      const walletBreakdown: BinanceWalletBreakdownItem[] = [];
      let officialWalletBalanceUsd = 0;
      let officialEarnWalletUsd = 0;
      let officialOtherWalletsUsd = 0;

      if (Array.isArray(walletBalanceData)) {
        for (const w of walletBalanceData) {
          const walletName = String(w.walletName || 'Wallet');
          const activate = Boolean(w.activate);
          const rawBal = parseFloat(w.balance) || 0;
          const quoteAsset = String(w.quoteAsset || 'USDT').toUpperCase();
          const balUsd =
            quoteAsset === 'BTC' && btcUsdtPrice > 0
              ? rawBal * btcUsdtPrice
              : rawBal;
          const balMad = balUsd * rates.USD_TO_MAD;

          if (activate || balUsd > 0) {
            walletBreakdown.push({
              walletName,
              activate,
              balanceUsd: Math.round(balUsd * 100) / 100,
              balanceMad: Math.round(balMad * 100) / 100,
            });
          }

          if (balUsd > 0) {
            officialWalletBalanceUsd += balUsd;
            const lower = walletName.toLowerCase();
            if (lower.includes('earn')) {
              officialEarnWalletUsd += balUsd;
            } else if (!lower.includes('spot') && !lower.includes('funding')) {
              officialOtherWalletsUsd += balUsd;
            }
          }
        }
      }

      let totalSpotValueUsd = 0;
      let totalFundingValueUsd = 0;
      let totalEarnValueUsd = 0;
      let stockEquityUsd = 0;
      let cryptoEquityUsd = 0;
      let stablecoinReserveUsd = 0;
      let lockedValueUsd = 0;
      let weightedPrev24hUsd = 0;

      const preliminaryBalances: BinanceSpotAssetBalance[] = [];

      for (const entry of assetMap.values()) {
        if (entry.total <= 0 && entry.btcValuation <= 0) continue;

        const cleanAsset = entry.asset.replace(/^LD/, '');
        const stockQuote = options?.externalStockQuotes?.[cleanAsset];
        const meta = ASSET_METADATA[cleanAsset] || {
          name:
            stockQuote?.companyName ||
            (entry.asset.startsWith('LD') ? `${cleanAsset} (Simple Earn)` : cleanAsset),
          category: (stockQuote ? 'Tokenized Stocks & Equities' : 'Digital Assets') as BinanceAssetCategory,
          dividendYieldPercent: stockQuote?.dividendYieldPercent || 0,
        };

        let val = this.resolveAssetValuation(
          entry.asset,
          tickers,
          rates,
          options?.externalStockQuotes
        );

        // Compute Binance's own BTC valuation in USD if provided
        const binanceReportedTotalUsd =
          entry.btcValuation > 0 && btcUsdtPrice > 0 ? entry.btcValuation * btcUsdtPrice : 0;
        const binanceReportedUnitPriceUsd =
          entry.total > 0 && binanceReportedTotalUsd > 0
            ? binanceReportedTotalUsd / entry.total
            : 0;

        // If ticker was not found OR if Binance's live btcValuation is higher/more accurate (e.g. Funding/Alpha/Stock token), use it
        if (
          (val.priceUsd <= 0 && binanceReportedUnitPriceUsd > 0) ||
          (entry.fundingTotal > 0 &&
            binanceReportedUnitPriceUsd > val.priceUsd &&
            !val.isStablecoinOrFiat)
        ) {
          val = {
            priceUsd: binanceReportedUnitPriceUsd,
            priceMad: binanceReportedUnitPriceUsd * rates.USD_TO_MAD,
            change24hPercent: val.change24hPercent || 0,
            high24hUsd: Math.max(val.high24hUsd, binanceReportedUnitPriceUsd),
            low24hUsd: val.low24hUsd > 0 ? Math.min(val.low24hUsd, binanceReportedUnitPriceUsd) : binanceReportedUnitPriceUsd,
            defaultSymbol: val.defaultSymbol,
            isStablecoinOrFiat: USD_PEGGED_STABLECOINS.has(cleanAsset),
          };
        }

        const valueUsd =
          entry.total > 0
            ? entry.total * val.priceUsd
            : binanceReportedTotalUsd;
        const valueMad = valueUsd * rates.USD_TO_MAD;
        const lockedUsd = entry.locked * val.priceUsd;
        const spotValUsd = entry.spotTotal * val.priceUsd;
        const fundingValUsd = entry.fundingTotal * val.priceUsd;
        const earnValUsd = entry.earnTotal * val.priceUsd;

        totalSpotValueUsd += spotValUsd;
        totalFundingValueUsd += fundingValUsd;
        totalEarnValueUsd += earnValUsd;
        lockedValueUsd += lockedUsd;

        const isStock = meta.category === 'Tokenized Stocks & Equities';

        if (isStock) {
          stockEquityUsd += valueUsd;
        } else if (val.isStablecoinOrFiat) {
          stablecoinReserveUsd += valueUsd;
        } else {
          cryptoEquityUsd += valueUsd;
        }

        const prevPriceUsd =
          val.change24hPercent !== -100
            ? val.priceUsd / (1 + val.change24hPercent / 100)
            : val.priceUsd;
        weightedPrev24hUsd += entry.total * prevPriceUsd;

        let walletType: 'SPOT' | 'FUNDING' | 'EARN' | 'BOTH' = 'SPOT';
        if (entry.spotTotal > 0 && entry.fundingTotal > 0) {
          walletType = 'BOTH';
        } else if (entry.fundingTotal > 0) {
          walletType = 'FUNDING';
        } else if (entry.earnTotal > 0 && entry.spotTotal <= 0) {
          walletType = 'EARN';
        }

        preliminaryBalances.push({
          asset: entry.asset,
          assetName: entry.asset.startsWith('LD') ? `${meta.name} (Earn)` : meta.name,
          category: meta.category,
          isStablecoinOrFiat: val.isStablecoinOrFiat,
          walletType,
          spotFree: Math.round(entry.spotFree * 1e8) / 1e8,
          spotLocked: Math.round(entry.spotLocked * 1e8) / 1e8,
          spotTotal: Math.round(entry.spotTotal * 1e8) / 1e8,
          fundingFree: Math.round(entry.fundingFree * 1e8) / 1e8,
          fundingLocked: Math.round(entry.fundingLocked * 1e8) / 1e8,
          fundingTotal: Math.round(entry.fundingTotal * 1e8) / 1e8,
          earnTotal: Math.round(entry.earnTotal * 1e8) / 1e8,
          free: Math.round(entry.free * 1e8) / 1e8,
          locked: Math.round(entry.locked * 1e8) / 1e8,
          total: Math.round(entry.total * 1e8) / 1e8,
          priceUsd: Math.round(val.priceUsd * 1e6) / 1e6,
          priceMad: Math.round(val.priceMad * 1e4) / 1e4,
          change24hPercent: Math.round(val.change24hPercent * 100) / 100,
          high24hUsd: Math.round(val.high24hUsd * 1e6) / 1e6,
          low24hUsd: Math.round(val.low24hUsd * 1e6) / 1e6,
          valueUsd: Math.round(valueUsd * 100) / 100,
          valueMad: Math.round(valueMad * 100) / 100,
          portfolioWeightPercent: 0,
          defaultSymbol: val.defaultSymbol,
          avgBuyPriceUsd: null,
          costBasisUsd: null,
          costBasisMad: null,
          unrealizedPnlUsd: null,
          unrealizedPnlMad: null,
          unrealizedPnlPercent: null,
          realizedPnlUsd: null,
          realizedPnlMad: null,
          dividendYieldPercent: meta.dividendYieldPercent || 0,
          tradeCount: 0,
        });
      }

      // Reconcile with Binance's official `/sapi/v1/asset/wallet/balance` if there are additional balances in Earn/Margin/Futures/Bots or valuation diff (e.g. $83 vs $80.5)
      const summedAssetsUsd = totalSpotValueUsd + totalFundingValueUsd + totalEarnValueUsd;
      let totalOtherWalletsUsd = officialOtherWalletsUsd;

      if (officialWalletBalanceUsd > summedAssetsUsd + 0.05) {
        const uncapturedDiffUsd = officialWalletBalanceUsd - summedAssetsUsd;
        // Check which wallet in walletBreakdown accounts for the difference
        const spotWalletEntry = walletBreakdown.find((w) => w.walletName.toLowerCase().includes('spot'));
        const fundingWalletEntry = walletBreakdown.find((w) => w.walletName.toLowerCase().includes('funding'));
        const earnWalletEntry = walletBreakdown.find((w) => w.walletName.toLowerCase().includes('earn'));

        if (fundingWalletEntry && fundingWalletEntry.balanceUsd > totalFundingValueUsd + 0.05) {
          const fundingDiff = fundingWalletEntry.balanceUsd - totalFundingValueUsd;
          totalFundingValueUsd = fundingWalletEntry.balanceUsd;
          // If the user has stock/funding assets whose ticker was slightly undervalued vs Binance's internal index, scale funding assets proportionally
          const fundingHoldings = preliminaryBalances.filter((b) => b.fundingTotal > 0);
          if (fundingHoldings.length > 0) {
            const currentFundingSum = fundingHoldings.reduce((s, b) => s + b.valueUsd, 0);
            if (currentFundingSum > 0) {
              const scale = (currentFundingSum + fundingDiff) / currentFundingSum;
              for (const fh of fundingHoldings) {
                const addedUsd = fh.valueUsd * (scale - 1);
                fh.priceUsd = Math.round(fh.priceUsd * scale * 1e6) / 1e6;
                fh.priceMad = Math.round(fh.priceUsd * rates.USD_TO_MAD * 1e4) / 1e4;
                fh.valueUsd = Math.round(fh.valueUsd * scale * 100) / 100;
                fh.valueMad = Math.round(fh.valueUsd * rates.USD_TO_MAD * 100) / 100;
                if (fh.category === 'Tokenized Stocks & Equities') {
                  stockEquityUsd += addedUsd;
                } else if (fh.isStablecoinOrFiat) {
                  stablecoinReserveUsd += addedUsd;
                } else {
                  cryptoEquityUsd += addedUsd;
                }
              }
            }
          }
        } else if (spotWalletEntry && spotWalletEntry.balanceUsd > totalSpotValueUsd + 0.05) {
          const spotDiff = spotWalletEntry.balanceUsd - totalSpotValueUsd;
          totalSpotValueUsd = spotWalletEntry.balanceUsd;
          const spotRiskHoldings = preliminaryBalances.filter((b) => b.spotTotal > 0 && !b.isStablecoinOrFiat);
          if (spotRiskHoldings.length > 0) {
            const currentSpotRiskSum = spotRiskHoldings.reduce((s, b) => s + b.valueUsd, 0);
            if (currentSpotRiskSum > 0) {
              const scale = (currentSpotRiskSum + spotDiff) / currentSpotRiskSum;
              for (const sh of spotRiskHoldings) {
                const addedUsd = sh.valueUsd * (scale - 1);
                sh.priceUsd = Math.round(sh.priceUsd * scale * 1e6) / 1e6;
                sh.priceMad = Math.round(sh.priceUsd * rates.USD_TO_MAD * 1e4) / 1e4;
                sh.valueUsd = Math.round(sh.valueUsd * scale * 100) / 100;
                sh.valueMad = Math.round(sh.valueUsd * rates.USD_TO_MAD * 100) / 100;
                cryptoEquityUsd += addedUsd;
              }
            }
          }
        } else if (earnWalletEntry && earnWalletEntry.balanceUsd > totalEarnValueUsd + 0.05) {
          const earnDiff = earnWalletEntry.balanceUsd - totalEarnValueUsd;
          totalEarnValueUsd = earnWalletEntry.balanceUsd;
          preliminaryBalances.push({
            asset: 'EARN',
            assetName: 'Binance Simple Earn & Staking',
            category: 'DeFi & Infrastructure',
            isStablecoinOrFiat: false,
            walletType: 'EARN',
            spotFree: 0,
            spotLocked: 0,
            spotTotal: 0,
            fundingFree: 0,
            fundingLocked: 0,
            fundingTotal: 0,
            earnTotal: Math.round(earnDiff * 100) / 100,
            free: Math.round(earnDiff * 100) / 100,
            locked: 0,
            total: Math.round(earnDiff * 100) / 100,
            priceUsd: 1,
            priceMad: rates.USD_TO_MAD,
            change24hPercent: 0,
            high24hUsd: 1,
            low24hUsd: 1,
            valueUsd: Math.round(earnDiff * 100) / 100,
            valueMad: Math.round(earnDiff * rates.USD_TO_MAD * 100) / 100,
            portfolioWeightPercent: 0,
            defaultSymbol: null,
            avgBuyPriceUsd: null,
            costBasisUsd: null,
            costBasisMad: null,
            unrealizedPnlUsd: null,
            unrealizedPnlMad: null,
            unrealizedPnlPercent: null,
            realizedPnlUsd: null,
            realizedPnlMad: null,
            dividendYieldPercent: 4.5,
            tradeCount: 0,
          });
        } else {
          totalOtherWalletsUsd = Math.max(totalOtherWalletsUsd, uncapturedDiffUsd);
        }
      }

      const recomputedAssetsUsd = preliminaryBalances.reduce((s, b) => s + b.valueUsd, 0);
      const totalCombinedValueUsd = Math.max(
        recomputedAssetsUsd + totalOtherWalletsUsd,
        officialWalletBalanceUsd
      );
      const totalCombinedValueMad = totalCombinedValueUsd * rates.USD_TO_MAD;
      const totalSpotValueMad = totalSpotValueUsd * rates.USD_TO_MAD;
      const totalFundingValueMad = totalFundingValueUsd * rates.USD_TO_MAD;
      const totalEarnValueMad = totalEarnValueUsd * rates.USD_TO_MAD;
      const totalOtherWalletsMad = totalOtherWalletsUsd * rates.USD_TO_MAD;
      const stockEquityMad = stockEquityUsd * rates.USD_TO_MAD;
      const cryptoEquityMad = cryptoEquityUsd * rates.USD_TO_MAD;
      const stablecoinReserveMad = stablecoinReserveUsd * rates.USD_TO_MAD;
      const lockedValueMad = lockedValueUsd * rates.USD_TO_MAD;

      // Calculate portfolio weights and sort by USD value descending
      for (const b of preliminaryBalances) {
        b.portfolioWeightPercent =
          totalCombinedValueUsd > 0
            ? Math.round((b.valueUsd / totalCombinedValueUsd) * 10000) / 100
            : 0;
      }
      preliminaryBalances.sort((a, b) => b.valueUsd - a.valueUsd);

      // Fetch personal trade history for top non-stablecoin holdings (up to 8 assets in parallel)
      const tradeCandidateAssets = preliminaryBalances
        .filter((b) => !b.isStablecoinOrFiat && b.defaultSymbol && b.valueUsd >= 0.25)
        .slice(0, 8);

      const tradeSummariesByAsset = new Map<string, BinanceSymbolTradeSummary>();
      const allRecentTrades: BinancePersonalTrade[] = [];

      await Promise.all(
        tradeCandidateAssets.map(async (item) => {
          if (!item.defaultSymbol) return;
          try {
            const { trades, summary } = await this.getPersonalTradesForSymbol(
              item.defaultSymbol,
              rates,
              {
                limit: 100,
                forceRefresh: options?.forceRefresh,
                externalStockQuotes: options?.externalStockQuotes,
              }
            );
            if (trades.length > 0) {
              tradeSummariesByAsset.set(item.asset, summary);
              allRecentTrades.push(...trades);
            }
          } catch {
            // Ignore individual pair trade lookup failures
          }
        })
      );

      // Also parse Binance Convert trade flows (/sapi/v1/convert/tradeFlow) if present
      const convertList = Array.isArray(convertData?.list) ? convertData.list : [];
      for (const c of convertList) {
        const toAsset = String(c.toAsset || '').toUpperCase();
        const fromAsset = String(c.fromAsset || '').toUpperCase();
        const toAmount = parseFloat(c.toAmount) || 0;
        const fromAmount = parseFloat(c.fromAmount) || 0;
        const createTime = Number(c.createTime) || Date.now();
        if (!toAsset || !fromAsset || toAmount <= 0 || fromAmount <= 0) continue;

        const fromVal = this.resolveAssetValuation(fromAsset, tickers, rates, options?.externalStockQuotes);
        const toVal = this.resolveAssetValuation(toAsset, tickers, rates, options?.externalStockQuotes);
        const quoteQtyUsd = fromAmount * (fromVal.priceUsd || 1);
        const quoteQtyMad = quoteQtyUsd * rates.USD_TO_MAD;
        const execPriceUsd = toAmount > 0 ? quoteQtyUsd / toAmount : toVal.priceUsd;
        const livePriceUsd = toVal.priceUsd > 0 ? toVal.priceUsd : execPriceUsd;
        const currentLotValueUsd = toAmount * livePriceUsd;
        const grossPnlUsd = currentLotValueUsd - quoteQtyUsd;
        // Convert has an implicit spread (~0.15%)
        const implicitFeeUsd = quoteQtyUsd * 0.0015;
        const exitFeeUsd = currentLotValueUsd * DEFAULT_TAKER_FEE_RATE;
        const totalFeeLossUsd = implicitFeeUsd + exitFeeUsd;
        const netPnlUsd = grossPnlUsd - totalFeeLossUsd;
        const breakevenPriceUsd = execPriceUsd * 1.0025;
        const holdingDays = Math.max(1, Math.floor((now - createTime) / (1000 * 60 * 60 * 24)));

        allRecentTrades.push({
          id: Number(c.quoteId || createTime),
          orderId: Number(c.orderId || createTime),
          symbol: `${toAsset}${fromAsset}`,
          baseAsset: toAsset,
          quoteAsset: fromAsset,
          side: 'BUY',
          price: Math.round(execPriceUsd * 1e6) / 1e6,
          qty: Math.round(toAmount * 1e6) / 1e6,
          quoteQty: Math.round(fromAmount * 100) / 100,
          quoteQtyUsd: Math.round(quoteQtyUsd * 100) / 100,
          quoteQtyMad: Math.round(quoteQtyMad * 100) / 100,
          commission: Math.round(implicitFeeUsd * 10000) / 10000,
          commissionAsset: 'USDT',
          commissionUsd: Math.round(implicitFeeUsd * 10000) / 10000,
          commissionMad: Math.round(implicitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
          time: createTime,
          executedAt: new Date(createTime).toISOString(),
          isMaker: false,
          tradeSource: 'CONVERT',
          isCompletedTrade: false,
          tradeStatusLabel: 'OPEN_LOT',
          openQtyRemaining: Math.round(toAmount * 1e6) / 1e6,
          currentMarketPriceUsd: Math.round(livePriceUsd * 1e6) / 1e6,
          currentMarketPriceMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 1e4) / 1e4,
          currentLotValueUsd: Math.round(currentLotValueUsd * 100) / 100,
          currentLotValueMad: Math.round(currentLotValueUsd * rates.USD_TO_MAD * 100) / 100,
          matchedCostBasisUsd: Math.round(quoteQtyUsd * 100) / 100,
          grossTradePnlUsd: Math.round(grossPnlUsd * 100) / 100,
          grossTradePnlMad: Math.round(grossPnlUsd * rates.USD_TO_MAD * 100) / 100,
          grossTradePnlPercent: quoteQtyUsd > 0 ? Math.round((grossPnlUsd / quoteQtyUsd) * 10000) / 100 : 0,
          estimatedExitFeeUsd: Math.round(exitFeeUsd * 10000) / 10000,
          estimatedExitFeeMad: Math.round(exitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
          totalFeeLossUsd: Math.round(totalFeeLossUsd * 10000) / 10000,
          totalFeeLossMad: Math.round(totalFeeLossUsd * rates.USD_TO_MAD * 1000) / 1000,
          feeDragPercent: 0.25,
          netTradePnlUsd: Math.round(netPnlUsd * 100) / 100,
          netTradePnlMad: Math.round(netPnlUsd * rates.USD_TO_MAD * 100) / 100,
          netTradePnlPercent: quoteQtyUsd > 0 ? Math.round((netPnlUsd / quoteQtyUsd) * 10000) / 100 : 0,
          breakevenPriceUsd: Math.round(breakevenPriceUsd * 1e6) / 1e6,
          breakevenPriceMad: Math.round(breakevenPriceUsd * rates.USD_TO_MAD * 1e4) / 1e4,
          distanceToBreakevenPercent:
            livePriceUsd > 0 ? Math.round(((breakevenPriceUsd - livePriceUsd) / livePriceUsd) * 10000) / 100 : 0,
          holdingDays,
          dividendYieldPercent: 0,
          annualDividendLotUsd: 0,
          annualDividendLotMad: 0,
          accruedDividendUsd: 0,
          accruedDividendMad: 0,
          totalReturnWithDividendUsd: Math.round(netPnlUsd * 100) / 100,
          totalReturnWithDividendMad: Math.round(netPnlUsd * rates.USD_TO_MAD * 100) / 100,
        });
      }

      allRecentTrades.sort((a, b) => b.time - a.time);

      // Parse Binance Asset Dividends (/sapi/v1/asset/assetDividend)
      const assetDividends: BinanceAssetDividendRecord[] = [];
      const rawDivRows = Array.isArray(dividendData?.rows) ? dividendData.rows : [];
      for (const d of rawDivRows) {
        const asset = String(d.asset || '').toUpperCase();
        const amount = parseFloat(d.amount) || 0;
        if (!asset || amount <= 0) continue;
        const val = this.resolveAssetValuation(asset, tickers, rates, options?.externalStockQuotes);
        const amountUsd = amount * (val.priceUsd || 0);
        assetDividends.push({
          id: Number(d.id || d.tranId || Date.now()),
          asset,
          amount,
          amountUsd: Math.round(amountUsd * 10000) / 10000,
          amountMad: Math.round(amountUsd * rates.USD_TO_MAD * 100) / 100,
          divTime: Number(d.divTime) || Date.now(),
          enInfo: String(d.enInfo || 'Asset Distribution / Dividend'),
          tranId: Number(d.tranId || 0),
        });
      }

      let totalTrackedCostBasisMad = 0;
      let totalTrackedMarketValueMad = 0;
      let totalRealizedPnlMad = 0;
      let totalFeesPaidMad = 0;
      let totalFeesPaidUsd = 0;
      let totalEstimatedExitFeesUsd = 0;

      const symbolSummaries = Array.from(tradeSummariesByAsset.values());
      for (const s of symbolSummaries) {
        totalRealizedPnlMad += s.realizedPnlMad;
        totalFeesPaidMad += s.totalFeesMad;
        totalFeesPaidUsd += s.totalFeesUsd;
      }

      // Determine Initial Capital Baseline (e.g. $879 MAD / ~$88.34 USD from linked Investment Wallet)
      // so we can allocate implied cost basis to positions acquired via Funding/Convert/P2P that don't appear in /api/v3/myTrades
      const referenceInitialCapitalMad =
        options?.initialCapitalMad && options.initialCapitalMad > 0
          ? options.initialCapitalMad
          : linkedWalletBalanceMad > 0
          ? linkedWalletBalanceMad
          : 0;
      const referenceInitialCapitalUsd =
        referenceInitialCapitalMad > 0 ? referenceInitialCapitalMad / rates.USD_TO_MAD : 0;

      // Sum value of risk assets that lack direct /api/v3/myTrades history
      let untrackedRiskMarketValueUsd = 0;
      let trackedRiskCostBasisUsd = 0;
      for (const b of preliminaryBalances) {
        if (b.isStablecoinOrFiat) continue;
        const summary = tradeSummariesByAsset.get(b.asset);
        if (summary && summary.avgBuyPriceUsd > 0) {
          trackedRiskCostBasisUsd += b.total * summary.avgBuyPriceUsd;
        } else {
          untrackedRiskMarketValueUsd += b.valueUsd;
        }
      }

      // Remaining initial capital attributable to untracked risk assets (e.g. Funding Wallet stocks or Convert holdings)
      const remainingInitialCapitalForUntrackedUsd =
        referenceInitialCapitalUsd > 0
          ? Math.max(0, referenceInitialCapitalUsd - stablecoinReserveUsd - trackedRiskCostBasisUsd)
          : 0;

      const enrichedBalances: BinanceSpotAssetBalance[] = preliminaryBalances.map((b) => {
        const summary = tradeSummariesByAsset.get(b.asset);
        const cleanAsset = b.asset.replace(/^LD/, '');
        const meta = ASSET_METADATA[cleanAsset];
        const stockQuote = options?.externalStockQuotes?.[cleanAsset];
        const divYieldPct =
          stockQuote?.dividendYieldPercent ?? meta?.dividendYieldPercent ?? b.dividendYieldPercent ?? 0;

        let avgBuyPriceUsd: number | null = null;
        let costBasisUsd: number | null = null;
        let costBasisMad: number | null = null;
        let costBasisSource: 'trades' | 'convert' | 'capital_allocated' | 'spot_mark' = 'spot_mark';
        let unrealizedPnlUsd: number | null = null;
        let unrealizedPnlMad: number | null = null;
        let unrealizedPnlPercent: number | null = null;

        if (!b.isStablecoinOrFiat) {
          if (summary && summary.avgBuyPriceUsd > 0) {
            avgBuyPriceUsd = summary.avgBuyPriceUsd;
            costBasisUsd = b.total * avgBuyPriceUsd;
            costBasisMad = costBasisUsd * rates.USD_TO_MAD;
            costBasisSource = 'trades';
          } else if (
            remainingInitialCapitalForUntrackedUsd > 0 &&
            untrackedRiskMarketValueUsd > 0 &&
            b.valueUsd > 0
          ) {
            // Pro-rate the user's initial capital (e.g. 879 MAD) across untracked positions so true gain/loss is calculated
            const weightInUntracked = b.valueUsd / untrackedRiskMarketValueUsd;
            costBasisUsd = remainingInitialCapitalForUntrackedUsd * weightInUntracked;
            costBasisMad = costBasisUsd * rates.USD_TO_MAD;
            avgBuyPriceUsd = b.total > 0 ? costBasisUsd / b.total : b.priceUsd;
            costBasisSource = 'capital_allocated';
          }

          if (costBasisUsd !== null && costBasisMad !== null && costBasisUsd > 0) {
            unrealizedPnlUsd = b.valueUsd - costBasisUsd;
            unrealizedPnlMad = b.valueMad - costBasisMad;
            unrealizedPnlPercent = (unrealizedPnlUsd / costBasisUsd) * 100;

            totalTrackedCostBasisMad += costBasisMad;
            totalTrackedMarketValueMad += b.valueMad;
          }
        }

        // Fee & Breakeven calculations per position
        const posEntryFeesUsd = summary
          ? summary.totalFeesUsd
          : !b.isStablecoinOrFiat && (costBasisUsd || b.valueUsd) > 0
          ? (costBasisUsd || b.valueUsd) * DEFAULT_TAKER_FEE_RATE
          : 0;
        const posEntryFeesMad = posEntryFeesUsd * rates.USD_TO_MAD;
        const posExitFeeUsd = !b.isStablecoinOrFiat ? b.valueUsd * DEFAULT_TAKER_FEE_RATE : 0;
        const posExitFeeMad = posExitFeeUsd * rates.USD_TO_MAD;
        const posTotalFeeLossUsd = posEntryFeesUsd + posExitFeeUsd;
        const posTotalFeeLossMad = posTotalFeeLossUsd * rates.USD_TO_MAD;

        if (!summary && posEntryFeesUsd > 0) {
          totalFeesPaidUsd += posEntryFeesUsd;
          totalFeesPaidMad += posEntryFeesMad;
        }
        totalEstimatedExitFeesUsd += posExitFeeUsd;

        const baseForFeeDrag = costBasisUsd && costBasisUsd > 0 ? costBasisUsd : b.valueUsd;
        const feeDragPercent = baseForFeeDrag > 0 ? (posTotalFeeLossUsd / baseForFeeDrag) * 100 : 0;

        const netPnlAfterFeesUsd =
          unrealizedPnlUsd !== null ? unrealizedPnlUsd - posTotalFeeLossUsd : null;
        const netPnlAfterFeesMad =
          netPnlAfterFeesUsd !== null ? netPnlAfterFeesUsd * rates.USD_TO_MAD : null;
        const netPnlAfterFeesPercent =
          netPnlAfterFeesUsd !== null && costBasisUsd && costBasisUsd > 0
            ? (netPnlAfterFeesUsd / costBasisUsd) * 100
            : null;

        const breakevenPriceUsd =
          avgBuyPriceUsd && avgBuyPriceUsd > 0 && b.total > 0
            ? (costBasisUsd! + posEntryFeesUsd) / b.total / (1 - DEFAULT_TAKER_FEE_RATE)
            : !b.isStablecoinOrFiat && b.priceUsd > 0
            ? b.priceUsd * (1 + 2 * DEFAULT_TAKER_FEE_RATE)
            : null;
        const breakevenPriceMad =
          breakevenPriceUsd !== null ? breakevenPriceUsd * rates.USD_TO_MAD : null;
        const distanceToBreakevenPercent =
          breakevenPriceUsd !== null && b.priceUsd > 0
            ? ((breakevenPriceUsd - b.priceUsd) / b.priceUsd) * 100
            : null;

        const annualDividendUsd = b.valueUsd * (divYieldPct / 100);
        const annualDividendMad = annualDividendUsd * rates.USD_TO_MAD;
        const accruedDividendUsd =
          assetDividends
            .filter((d) => d.asset === cleanAsset)
            .reduce((s, d) => s + d.amountUsd, 0) || annualDividendUsd / 4;
        const accruedDividendMad = accruedDividendUsd * rates.USD_TO_MAD;

        const totalReturnWithDividendUsd =
          netPnlAfterFeesUsd !== null ? netPnlAfterFeesUsd + accruedDividendUsd : null;
        const totalReturnWithDividendMad =
          totalReturnWithDividendUsd !== null
            ? totalReturnWithDividendUsd * rates.USD_TO_MAD
            : null;

        return {
          ...b,
          avgBuyPriceUsd: avgBuyPriceUsd !== null ? Math.round(avgBuyPriceUsd * 1e4) / 1e4 : null,
          costBasisUsd: costBasisUsd !== null ? Math.round(costBasisUsd * 100) / 100 : null,
          costBasisMad: costBasisMad !== null ? Math.round(costBasisMad * 100) / 100 : null,
          costBasisSource,
          unrealizedPnlUsd: unrealizedPnlUsd !== null ? Math.round(unrealizedPnlUsd * 100) / 100 : null,
          unrealizedPnlMad: unrealizedPnlMad !== null ? Math.round(unrealizedPnlMad * 100) / 100 : null,
          unrealizedPnlPercent:
            unrealizedPnlPercent !== null ? Math.round(unrealizedPnlPercent * 100) / 100 : null,
          realizedPnlUsd: summary ? summary.realizedPnlUsd : null,
          realizedPnlMad: summary ? summary.realizedPnlMad : null,
          feesPaidUsd: Math.round(posEntryFeesUsd * 10000) / 10000,
          feesPaidMad: Math.round(posEntryFeesMad * 1000) / 1000,
          estimatedExitFeeUsd: Math.round(posExitFeeUsd * 10000) / 10000,
          estimatedExitFeeMad: Math.round(posExitFeeMad * 1000) / 1000,
          totalFeeLossUsd: Math.round(posTotalFeeLossUsd * 10000) / 10000,
          totalFeeLossMad: Math.round(posTotalFeeLossMad * 1000) / 1000,
          feeDragPercent: Math.round(feeDragPercent * 1000) / 1000,
          netPnlAfterFeesUsd:
            netPnlAfterFeesUsd !== null ? Math.round(netPnlAfterFeesUsd * 100) / 100 : null,
          netPnlAfterFeesMad:
            netPnlAfterFeesMad !== null ? Math.round(netPnlAfterFeesMad * 100) / 100 : null,
          netPnlAfterFeesPercent:
            netPnlAfterFeesPercent !== null ? Math.round(netPnlAfterFeesPercent * 100) / 100 : null,
          breakevenPriceUsd:
            breakevenPriceUsd !== null ? Math.round(breakevenPriceUsd * 1e6) / 1e6 : null,
          breakevenPriceMad:
            breakevenPriceMad !== null ? Math.round(breakevenPriceMad * 1e4) / 1e4 : null,
          distanceToBreakevenPercent:
            distanceToBreakevenPercent !== null
              ? Math.round(distanceToBreakevenPercent * 100) / 100
              : null,
          dividendYieldPercent: Math.round(divYieldPct * 100) / 100,
          annualDividendUsd: Math.round(annualDividendUsd * 100) / 100,
          annualDividendMad: Math.round(annualDividendMad * 100) / 100,
          accruedDividendUsd: Math.round(accruedDividendUsd * 100) / 100,
          accruedDividendMad: Math.round(accruedDividendMad * 100) / 100,
          totalReturnWithDividendUsd:
            totalReturnWithDividendUsd !== null
              ? Math.round(totalReturnWithDividendUsd * 100) / 100
              : null,
          totalReturnWithDividendMad:
            totalReturnWithDividendMad !== null
              ? Math.round(totalReturnWithDividendMad * 100) / 100
              : null,
          tradeCount: summary ? summary.tradeCount : 0,
        };
      });

      // Ensure every non-stablecoin holding (including Funding Wallet, Tokenized Stocks, and Simple Earn)
      // has an inspectable open-lot record in allRecentTrades and a summary in symbolSummaries
      for (const b of enrichedBalances) {
        if (b.isStablecoinOrFiat || b.valueUsd < 0.05) continue;
        const cleanSym = this.validateSymbol(b.defaultSymbol || `${b.asset}USDT`);
        b.defaultSymbol = cleanSym;

        const hasExistingTrade = allRecentTrades.some(
          (t) =>
            t.symbol.toUpperCase() === cleanSym ||
            t.baseAsset.toUpperCase() === b.asset.toUpperCase()
        );

        if (!hasExistingTrade) {
          const entryPriceUsd = b.avgBuyPriceUsd && b.avgBuyPriceUsd > 0 ? b.avgBuyPriceUsd : b.priceUsd;
          const livePriceUsd = b.priceUsd > 0 ? b.priceUsd : entryPriceUsd;
          const principalUsd = b.costBasisUsd && b.costBasisUsd > 0 ? b.costBasisUsd : b.valueUsd;
          const principalMad = principalUsd * rates.USD_TO_MAD;
          const entryFeeUsd = b.feesPaidUsd ?? principalUsd * DEFAULT_TAKER_FEE_RATE;
          const exitFeeUsd = b.estimatedExitFeeUsd ?? b.valueUsd * DEFAULT_TAKER_FEE_RATE;
          const feeLossUsd = b.totalFeeLossUsd ?? entryFeeUsd + exitFeeUsd;
          const grossPnlUsd = b.unrealizedPnlUsd ?? b.valueUsd - principalUsd;
          const netPnlUsd = b.netPnlAfterFeesUsd ?? grossPnlUsd - feeLossUsd;
          const bePriceUsd = b.breakevenPriceUsd ?? livePriceUsd * (1 + 2 * DEFAULT_TAKER_FEE_RATE);
          const distBePct =
            b.distanceToBreakevenPercent ??
            (livePriceUsd > 0 ? ((bePriceUsd - livePriceUsd) / livePriceUsd) * 100 : 0);
          const divYield = b.dividendYieldPercent ?? 0;
          const annDivUsd = b.annualDividendUsd ?? b.valueUsd * (divYield / 100);
          const accDivUsd = b.accruedDividendUsd ?? annDivUsd / 4;
          const totRetUsd = b.totalReturnWithDividendUsd ?? netPnlUsd + accDivUsd;
          const syntheticTime = now - 14 * 24 * 60 * 60 * 1000;

          const syntheticLot: BinancePersonalTrade = {
            id: Math.floor(syntheticTime / 1000) + allRecentTrades.length + 1,
            orderId: Math.floor(syntheticTime / 1000) + allRecentTrades.length + 1,
            symbol: cleanSym,
            baseAsset: b.asset,
            quoteAsset: 'USDT',
            side: 'BUY',
            price: Math.round(entryPriceUsd * 1e6) / 1e6,
            qty: Math.round(b.total * 1e6) / 1e6,
            quoteQty: Math.round(principalUsd * 100) / 100,
            quoteQtyUsd: Math.round(principalUsd * 100) / 100,
            quoteQtyMad: Math.round(principalMad * 100) / 100,
            commission: Math.round(entryFeeUsd * 10000) / 10000,
            commissionAsset: 'USDT',
            commissionUsd: Math.round(entryFeeUsd * 10000) / 10000,
            commissionMad: Math.round(entryFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
            time: syntheticTime,
            executedAt: new Date(syntheticTime).toISOString(),
            isMaker: false,
            tradeSource:
              b.walletType === 'FUNDING'
                ? 'FUNDING'
                : b.walletType === 'EARN'
                ? 'EARN'
                : b.costBasisSource === 'convert'
                ? 'CONVERT'
                : 'SPOT',
            isCompletedTrade: false,
            tradeStatusLabel: 'OPEN_LOT',
            openQtyRemaining: Math.round(b.total * 1e6) / 1e6,
            currentMarketPriceUsd: Math.round(livePriceUsd * 1e6) / 1e6,
            currentMarketPriceMad: Math.round(livePriceUsd * rates.USD_TO_MAD * 1e4) / 1e4,
            currentLotValueUsd: Math.round(b.valueUsd * 100) / 100,
            currentLotValueMad: Math.round(b.valueMad * 100) / 100,
            matchedCostBasisUsd: Math.round(principalUsd * 100) / 100,
            grossTradePnlUsd: Math.round(grossPnlUsd * 100) / 100,
            grossTradePnlMad: Math.round(grossPnlUsd * rates.USD_TO_MAD * 100) / 100,
            grossTradePnlPercent: principalUsd > 0 ? Math.round((grossPnlUsd / principalUsd) * 10000) / 100 : 0,
            estimatedExitFeeUsd: Math.round(exitFeeUsd * 10000) / 10000,
            estimatedExitFeeMad: Math.round(exitFeeUsd * rates.USD_TO_MAD * 1000) / 1000,
            totalFeeLossUsd: Math.round(feeLossUsd * 10000) / 10000,
            totalFeeLossMad: Math.round(feeLossUsd * rates.USD_TO_MAD * 1000) / 1000,
            feeDragPercent: principalUsd > 0 ? Math.round((feeLossUsd / principalUsd) * 10000) / 100 : 0.2,
            netTradePnlUsd: Math.round(netPnlUsd * 100) / 100,
            netTradePnlMad: Math.round(netPnlUsd * rates.USD_TO_MAD * 100) / 100,
            netTradePnlPercent: principalUsd > 0 ? Math.round((netPnlUsd / principalUsd) * 10000) / 100 : 0,
            breakevenPriceUsd: Math.round(bePriceUsd * 1e6) / 1e6,
            breakevenPriceMad: Math.round(bePriceUsd * rates.USD_TO_MAD * 1e4) / 1e4,
            distanceToBreakevenPercent: Math.round(distBePct * 100) / 100,
            holdingDays: 14,
            dividendYieldPercent: Math.round(divYield * 100) / 100,
            annualDividendLotUsd: Math.round(annDivUsd * 100) / 100,
            annualDividendLotMad: Math.round(annDivUsd * rates.USD_TO_MAD * 100) / 100,
            accruedDividendUsd: Math.round(accDivUsd * 100) / 100,
            accruedDividendMad: Math.round(accDivUsd * rates.USD_TO_MAD * 100) / 100,
            totalReturnWithDividendUsd: Math.round(totRetUsd * 100) / 100,
            totalReturnWithDividendMad: Math.round(totRetUsd * rates.USD_TO_MAD * 100) / 100,
          };

          allRecentTrades.push(syntheticLot);
          b.tradeCount = 1;

          if (!symbolSummaries.some((s) => s.symbol === cleanSym)) {
            symbolSummaries.push({
              symbol: cleanSym,
              baseAsset: b.asset,
              quoteAsset: 'USDT',
              tradeCount: 1,
              buyCount: 1,
              sellCount: 0,
              totalBoughtQty: Math.round(b.total * 1e6) / 1e6,
              totalSoldQty: 0,
              netAccumulatedQty: Math.round(b.total * 1e6) / 1e6,
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
              feeDragPercent: principalUsd > 0 ? Math.round((feeLossUsd / principalUsd) * 1000) / 1000 : 0.2,
              firstTradeTime: syntheticLot.executedAt,
              lastTradeTime: syntheticLot.executedAt,
            });
          }
        }
      }

      const change24hUsd = totalCombinedValueUsd - weightedPrev24hUsd;
      const change24hMad = change24hUsd * rates.USD_TO_MAD;
      const change24hPercent =
        weightedPrev24hUsd > 0 ? (change24hUsd / weightedPrev24hUsd) * 100 : 0;

      const totalTrackedUnrealizedPnlMad = totalTrackedMarketValueMad - totalTrackedCostBasisMad;
      const totalTrackedUnrealizedPnlPercent =
        totalTrackedCostBasisMad > 0
          ? (totalTrackedUnrealizedPnlMad / totalTrackedCostBasisMad) * 100
          : 0;

      const heldSymbols = enrichedBalances
        .map((b) => b.defaultSymbol)
        .filter((s): s is string => Boolean(s));
      const availableSymbols = Array.from(new Set([...heldSymbols, ...DEFAULT_POPULAR_SYMBOLS]));

      let isReadOnlySafe = true;
      let apiKeyReadingEnabled = true;
      let apiKeyTradingEnabled = false;
      let apiKeyWithdrawalsEnabled = false;
      let apiKeyUniversalTransferEnabled = false;
      let ipRestrict = false;

      if (apiRestrictionsData && typeof apiRestrictionsData === 'object') {
        apiKeyReadingEnabled = Boolean(apiRestrictionsData.enableReading);
        apiKeyTradingEnabled = Boolean(
          apiRestrictionsData.enableSpotAndMarginTrading ||
            apiRestrictionsData.enableMargin ||
            apiRestrictionsData.enableFutures
        );
        apiKeyWithdrawalsEnabled = Boolean(apiRestrictionsData.enableWithdrawals);
        apiKeyUniversalTransferEnabled = Boolean(apiRestrictionsData.permitsUniversalTransfer);
        ipRestrict = Boolean(apiRestrictionsData.ipRestrict);

        isReadOnlySafe =
          !apiKeyTradingEnabled && !apiKeyWithdrawalsEnabled && !apiKeyUniversalTransferEnabled;
      }

      const overview: BinanceAccountOverview = {
        isConfigured: true,
        connected: true,
        statusMessage:
          'Connected to Binance Spot, Funding & Earn Wallets via server-side Ed25519 signature authentication.',
        errorCode: null,
        accountType: String(accountData?.accountType || 'SPOT'),
        permissions: {
          canRead: true,
          canTrade: Boolean(accountData?.canTrade),
          canWithdraw: Boolean(accountData?.canWithdraw),
          canDeposit: Boolean(accountData?.canDeposit),
          isReadOnlySafe,
          apiKeyReadingEnabled,
          apiKeyTradingEnabled,
          apiKeyWithdrawalsEnabled,
          apiKeyUniversalTransferEnabled,
          ipRestrict,
        },
        lastSyncedAt: new Date().toISOString(),
        syncLatencyMs,
        totalSpotValueUsd: Math.round(totalSpotValueUsd * 100) / 100,
        totalSpotValueMad: Math.round(totalSpotValueMad * 100) / 100,
        totalFundingValueUsd: Math.round(totalFundingValueUsd * 100) / 100,
        totalFundingValueMad: Math.round(totalFundingValueMad * 100) / 100,
        totalEarnValueUsd: Math.round(totalEarnValueUsd * 100) / 100,
        totalEarnValueMad: Math.round(totalEarnValueMad * 100) / 100,
        totalOtherWalletsUsd: Math.round(totalOtherWalletsUsd * 100) / 100,
        totalOtherWalletsMad: Math.round(totalOtherWalletsMad * 100) / 100,
        officialWalletBalanceUsd: Math.round(officialWalletBalanceUsd * 100) / 100,
        officialWalletBalanceMad: Math.round(officialWalletBalanceUsd * rates.USD_TO_MAD * 100) / 100,
        totalCombinedValueUsd: Math.round(totalCombinedValueUsd * 100) / 100,
        totalCombinedValueMad: Math.round(totalCombinedValueMad * 100) / 100,
        stockEquityUsd: Math.round(stockEquityUsd * 100) / 100,
        stockEquityMad: Math.round(stockEquityMad * 100) / 100,
        cryptoEquityUsd: Math.round(cryptoEquityUsd * 100) / 100,
        cryptoEquityMad: Math.round(cryptoEquityMad * 100) / 100,
        stablecoinReserveUsd: Math.round(stablecoinReserveUsd * 100) / 100,
        stablecoinReserveMad: Math.round(stablecoinReserveMad * 100) / 100,
        lockedValueUsd: Math.round(lockedValueUsd * 100) / 100,
        lockedValueMad: Math.round(lockedValueMad * 100) / 100,
        change24hUsd: Math.round(change24hUsd * 100) / 100,
        change24hMad: Math.round(change24hMad * 100) / 100,
        change24hPercent: Math.round(change24hPercent * 100) / 100,
        totalTrackedCostBasisMad: Math.round(totalTrackedCostBasisMad * 100) / 100,
        totalTrackedUnrealizedPnlMad: Math.round(totalTrackedUnrealizedPnlMad * 100) / 100,
        totalTrackedUnrealizedPnlPercent: Math.round(totalTrackedUnrealizedPnlPercent * 100) / 100,
        totalRealizedPnlMad: Math.round(totalRealizedPnlMad * 100) / 100,
        totalFeesPaidMad: Math.round(totalFeesPaidMad * 100) / 100,
        totalFeesPaidUsd: Math.round(totalFeesPaidUsd * 1000) / 1000,
        totalEstimatedExitFeesMad: Math.round(totalEstimatedExitFeesUsd * rates.USD_TO_MAD * 100) / 100,
        totalEstimatedExitFeesUsd: Math.round(totalEstimatedExitFeesUsd * 1000) / 1000,
        balances: enrichedBalances,
        fundingBalances: enrichedBalances.filter((b) => b.fundingTotal > 0),
        walletBreakdown,
        assetDividends,
        recentTrades: allRecentTrades.slice(0, 120),
        symbolSummaries,
        availableSymbols,
        linkedWalletId,
        linkedWalletName,
        linkedWalletBalanceMad,
        walletSyncDiscrepancyMad:
          Math.round((totalCombinedValueMad - linkedWalletBalanceMad) * 100) / 100,
      };

      this.accountOverviewCache = {
        data: overview,
        fetchedAt: now,
      };

      return overview;
    } catch (err: any) {
      console.error('[BinanceService] Connection error:', err?.message, err?.code || 'NO_CODE');
      return {
        isConfigured: true,
        connected: false,
        statusMessage: err?.message || 'Unable to authenticate with Binance API.',
        errorCode: err?.code || 'BINANCE_CONNECTION_ERROR',
        accountType: 'SPOT',
        permissions: {
          canRead: false,
          canTrade: false,
          canWithdraw: false,
          canDeposit: false,
          isReadOnlySafe: true,
        },
        lastSyncedAt: new Date().toISOString(),
        syncLatencyMs: 0,
        totalSpotValueUsd: 0,
        totalSpotValueMad: 0,
        totalFundingValueUsd: 0,
        totalFundingValueMad: 0,
        totalEarnValueUsd: 0,
        totalEarnValueMad: 0,
        totalOtherWalletsUsd: 0,
        totalOtherWalletsMad: 0,
        officialWalletBalanceUsd: 0,
        officialWalletBalanceMad: 0,
        totalCombinedValueUsd: 0,
        totalCombinedValueMad: 0,
        stockEquityUsd: 0,
        stockEquityMad: 0,
        cryptoEquityUsd: 0,
        cryptoEquityMad: 0,
        stablecoinReserveUsd: 0,
        stablecoinReserveMad: 0,
        lockedValueUsd: 0,
        lockedValueMad: 0,
        change24hUsd: 0,
        change24hMad: 0,
        change24hPercent: 0,
        totalTrackedCostBasisMad: 0,
        totalTrackedUnrealizedPnlMad: 0,
        totalTrackedUnrealizedPnlPercent: 0,
        totalRealizedPnlMad: 0,
        totalFeesPaidMad: 0,
        totalFeesPaidUsd: 0,
        totalEstimatedExitFeesMad: 0,
        totalEstimatedExitFeesUsd: 0,
        balances: [],
        fundingBalances: [],
        walletBreakdown: [],
        assetDividends: [],
        recentTrades: [],
        symbolSummaries: [],
        availableSymbols: DEFAULT_POPULAR_SYMBOLS,
        linkedWalletId,
        linkedWalletName,
        linkedWalletBalanceMad,
        walletSyncDiscrepancyMad: 0,
      };
    }
  }
}

export const binanceService = new BinanceService();
