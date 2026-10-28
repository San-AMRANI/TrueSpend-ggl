import crypto from 'node:crypto';
import type {
  BinanceAccountOverview,
  BinanceAssetCategory,
  BinancePersonalTrade,
  BinanceSpotAssetBalance,
  BinanceSymbolTradeSummary,
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
type AllowedSignedEndpoint = '/api/v3/account' | '/api/v3/myTrades';
type AllowedPublicEndpoint = '/api/v3/time' | '/api/v3/ticker/24hr' | '/api/v3/ticker/price';

const ALLOWED_SIGNED_ENDPOINTS = new Set<AllowedSignedEndpoint>([
  '/api/v3/account',
  '/api/v3/myTrades',
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

const ASSET_METADATA: Record<string, { name: string; category: BinanceAssetCategory }> = {
  USDT: { name: 'Tether USD', category: 'Stablecoin / Fiat Reserve' },
  USDC: { name: 'USD Coin', category: 'Stablecoin / Fiat Reserve' },
  FDUSD: { name: 'First Digital USD', category: 'Stablecoin / Fiat Reserve' },
  DAI: { name: 'Dai Stablecoin', category: 'Stablecoin / Fiat Reserve' },
  BUSD: { name: 'Binance USD', category: 'Stablecoin / Fiat Reserve' },
  EUR: { name: 'Euro', category: 'Stablecoin / Fiat Reserve' },
  AEUR: { name: 'Anchored Coins EUR', category: 'Stablecoin / Fiat Reserve' },
  USD: { name: 'US Dollar', category: 'Stablecoin / Fiat Reserve' },
  BTC: { name: 'Bitcoin', category: 'Layer 1 Core' },
  ETH: { name: 'Ethereum', category: 'Layer 1 Core' },
  BNB: { name: 'BNB', category: 'Layer 1 Core' },
  SOL: { name: 'Solana', category: 'Layer 1 Core' },
  XRP: { name: 'XRP', category: 'Layer 1 Core' },
  ADA: { name: 'Cardano', category: 'Layer 1 Core' },
  AVAX: { name: 'Avalanche', category: 'Layer 1 Core' },
  SUI: { name: 'Sui', category: 'Layer 1 Core' },
  TON: { name: 'Toncoin', category: 'Layer 1 Core' },
  DOT: { name: 'Polkadot', category: 'Layer 1 Core' },
  NEAR: { name: 'NEAR Protocol', category: 'Layer 1 Core' },
  APT: { name: 'Aptos', category: 'Layer 1 Core' },
  ATOM: { name: 'Cosmos', category: 'Layer 1 Core' },
  TRX: { name: 'TRON', category: 'Layer 1 Core' },
  LTC: { name: 'Litecoin', category: 'Layer 1 Core' },
  BCH: { name: 'Bitcoin Cash', category: 'Layer 1 Core' },
  LINK: { name: 'Chainlink', category: 'DeFi & Infrastructure' },
  UNI: { name: 'Uniswap', category: 'DeFi & Infrastructure' },
  AAVE: { name: 'Aave', category: 'DeFi & Infrastructure' },
  MKR: { name: 'Maker', category: 'DeFi & Infrastructure' },
  LDO: { name: 'Lido DAO', category: 'DeFi & Infrastructure' },
  INJ: { name: 'Injective', category: 'DeFi & Infrastructure' },
  PYTH: { name: 'Pyth Network', category: 'DeFi & Infrastructure' },
  JUP: { name: 'Jupiter', category: 'DeFi & Infrastructure' },
  PENDLE: { name: 'Pendle', category: 'DeFi & Infrastructure' },
  RUNE: { name: 'THORChain', category: 'DeFi & Infrastructure' },
  ARB: { name: 'Arbitrum', category: 'Layer 2 & Scaling' },
  OP: { name: 'Optimism', category: 'Layer 2 & Scaling' },
  POL: { name: 'Polygon Ecosystem Token', category: 'Layer 2 & Scaling' },
  MATIC: { name: 'Polygon', category: 'Layer 2 & Scaling' },
  STRK: { name: 'Starknet', category: 'Layer 2 & Scaling' },
  IMX: { name: 'Immutable', category: 'Layer 2 & Scaling' },
  FET: { name: 'Artificial Superintelligence Alliance', category: 'AI & Compute' },
  RENDER: { name: 'Render', category: 'AI & Compute' },
  RNDR: { name: 'Render Token', category: 'AI & Compute' },
  TAO: { name: 'Bittensor', category: 'AI & Compute' },
  WLD: { name: 'Worldcoin', category: 'AI & Compute' },
  GRT: { name: 'The Graph', category: 'AI & Compute' },
  PAXG: { name: 'PAX Gold (Physical Gold)', category: 'Real World Assets' },
  ONDO: { name: 'Ondo Finance', category: 'Real World Assets' },
  OM: { name: 'MANTRA', category: 'Real World Assets' },
  DOGE: { name: 'Dogecoin', category: 'Digital Assets' },
  SHIB: { name: 'Shiba Inu', category: 'Digital Assets' },
  PEPE: { name: 'Pepe', category: 'Digital Assets' },
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

export class BinanceService {
  private serverTimeOffsetMs = 0;
  private lastTimeSyncAt = 0;
  private preferredPrivateHost: string = BINANCE_PRIVATE_ENDPOINTS[0];
  private preferredPublicHost: string = BINANCE_PUBLIC_ENDPOINTS[0];

  // Short-lived in-memory caches to respect Binance rate weights during rapid tab switches
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

  /**
   * Read server-side credentials exclusively from environment variables.
   * Tolerates fallback variable names, quotes, whitespace, and escaped newlines.
   * Never expose, log, or return these values.
   */
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

  /**
   * Decode BINANCE_ED25519_PRIVATE_KEY_B64 into PEM format and construct a verified Ed25519 KeyObject.
   * Resiliently handles:
   *  1. Base64-encoded PKCS#8 PEM (output of `base64 -w 0 private_key.pem`)
   *  2. OpenSSL-style `BEGIN ED25519 PRIVATE KEY` -> normalized to PKCS#8 `BEGIN PRIVATE KEY`
   *  3. Raw PEM strings with escaped (`\n` / `\r\n`) or unescaped newlines
   *  4. URL-encoded strings (%2B, %2F, %3D)
   *  5. Raw 32-byte Ed25519 seed (base64-encoded, wrapped with standard ASN.1 PKCS#8 prefix)
   *  6. Raw 64-byte secret key (seed + pubkey, standard in sodium/PyNaCl, first 32 bytes extracted)
   *  7. Raw 48-byte PKCS#8 DER binary (base64-encoded)
   *  8. Hex-encoded seed (64 or 128 hex characters)
   */
  private decodeEd25519PrivateKey(rawEnvValue: string): crypto.KeyObject {
    let cleaned = rawEnvValue.trim().replace(/^["']|["']$/g, '');

    // Handle potential URL-encoded strings
    if (cleaned.includes('%')) {
      try {
        cleaned = decodeURIComponent(cleaned);
      } catch {
        // Continue with original cleaned string
      }
    }

    let pemString = '';

    // Check if it already contains PEM boundaries
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

  /**
   * Sign an ASCII query string using Ed25519 per Binance's official Spot API specification:
   * 1. Payload is the exact ASCII query string (e.g. "omitZeroBalances=true&recvWindow=10000&timestamp=1730000000000")
   * 2. Sign with crypto.sign(null, Buffer.from(queryString, 'ascii'), privateKey)
   * 3. Encode signature as Base64
   */
  private signQueryString(queryString: string, privateKey: crypto.KeyObject): string {
    const signatureBuffer = crypto.sign(null, Buffer.from(queryString, 'ascii'), privateKey);
    return signatureBuffer.toString('base64');
  }

  /**
   * Deterministic query serialization following Binance's specification.
   */
  private serializeParams(params: Record<string, string | number | boolean | undefined>): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return parts.join('&');
  }

  /**
   * Synchronize server time offset with Binance (/api/v3/time) to prevent -1021 recvWindow errors on serverless cold starts.
   */
  private async ensureTimeSynced(force = false): Promise<number> {
    const now = Date.now();
    if (!force && this.lastTimeSyncAt > 0 && now - this.lastTimeSyncAt < 5 * 60 * 1000) {
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

  /**
   * Sanitize Binance API errors so credentials, signatures, or sensitive account details are never leaked.
   */
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
          'Binance returned HTTP 451 from this server IP. Deploying with vercel.json Europe regions ("fra1", "cdg1") routes serverless execution through Frankfurt/Paris.',
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

  /**
   * Execute a signed GET request to a strictly whitelisted read-only Binance USER_DATA endpoint.
   */
  private async signedGet<T>(
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
    const signedQuery = `${queryString}&signature=${encodeURIComponent(signatureBase64)}`;

    const candidateHosts = [
      this.preferredPrivateHost,
      ...BINANCE_PRIVATE_ENDPOINTS.filter((h) => h !== this.preferredPrivateHost),
    ];

    let lastError: Error | null = null;

    for (const host of candidateHosts) {
      try {
        const res = await fetch(`${host}${endpoint}?${signedQuery}`, {
          method: 'GET',
          headers: {
            'X-MBX-APIKEY': creds.apiKey,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(7000),
        });

        if (res.ok) {
          this.preferredPrivateHost = host;
          return (await res.json()) as T;
        }

        // If 451 or 5xx on this host, try the next official Binance cluster
        if (res.status === 451 || res.status >= 502) {
          const errBody = await res.json().catch(() => ({}));
          const sanitized = this.sanitizeBinanceError(res.status, errBody?.code, errBody?.msg);
          lastError = new Error(sanitized.message);
          (lastError as any).code = sanitized.code;
          continue;
        }

        const errBody = await res.json().catch(() => ({}));
        // Automatic retry once if timestamp drifted (-1021)
        if (errBody?.code === -1021 && !isRetryAfterTimeSync) {
          return await this.signedGet<T>(endpoint, params, true);
        }

        const sanitized = this.sanitizeBinanceError(res.status, errBody?.code, errBody?.msg);
        const err = new Error(sanitized.message);
        (err as any).code = sanitized.code;
        throw err;
      } catch (e: any) {
        if (e?.code && !String(e.code).includes('REGION_RESTRICTED')) {
          throw e;
        }
        lastError = e instanceof Error ? e : new Error('Failed to reach Binance Spot API');
      }
    }

    throw lastError || new Error('Unable to connect to Binance Spot API');
  }

  /**
   * Fetch 24hr public ticker statistics from Binance for accurate USD/USDT valuation of Spot assets.
   */
  public async fetchPublicTickers(): Promise<Map<string, Ticker24hStats>> {
    const now = Date.now();
    if (this.tickerCache.data.size > 0 && now - this.tickerCache.fetchedAt < 45 * 1000) {
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
          signal: AbortSignal.timeout(6000),
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
   * Resolve an asset's USD price, 24h change, and primary trading symbol from Binance tickers.
   */
  public resolveAssetValuation(
    asset: string,
    tickers: Map<string, Ticker24hStats>,
    rates: { USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number }
  ): {
    priceUsd: number;
    priceMad: number;
    change24hPercent: number;
    high24hUsd: number;
    low24hUsd: number;
    defaultSymbol: string | null;
    isStablecoinOrFiat: boolean;
  } {
    const clean = asset.trim().toUpperCase().replace(/^LD/, ''); // Handle Simple Earn flexible LD* prefix if present

    if (USD_PEGGED_STABLECOINS.has(clean)) {
      return {
        priceUsd: 1,
        priceMad: rates.USD_TO_MAD,
        change24hPercent: 0,
        high24hUsd: 1,
        low24hUsd: 1,
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

    // Direct USDT / USDC / FDUSD pairs
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

    // Cross-rate via BTC or BNB
    const btcPair = `${clean}BTC`;
    const btcUsdt = tickers.get('BTCUSDT')?.lastPrice || 0;
    const tBtc = tickers.get(btcPair);
    if (tBtc && tBtc.lastPrice > 0 && btcUsdt > 0) {
      const priceUsd = tBtc.lastPrice * btcUsdt;
      return {
        priceUsd,
        priceMad: priceUsd * rates.USD_TO_MAD,
        change24hPercent: tBtc.priceChangePercent,
        high24hUsd: tBtc.highPrice * btcUsdt,
        low24hUsd: tBtc.lowPrice * btcUsdt,
        defaultSymbol: btcPair,
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

  /**
   * Validate and normalize a Binance trading pair symbol (e.g. BTCUSDT).
   */
  public validateSymbol(symbolInput: unknown): string {
    const sym = String(symbolInput || '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(sym)) {
      throw new Error('Invalid trading pair symbol. Use uppercase alphanumeric format such as BTCUSDT or ETHUSDT.');
    }
    return sym;
  }

  /**
   * Parse base and quote asset from a Binance symbol (e.g. BTCUSDT -> BTC / USDT).
   */
  public splitSymbol(symbol: string): { baseAsset: string; quoteAsset: string } {
    const quoteCandidates = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'EUR', 'BTC', 'ETH', 'BNB', 'TRY'];
    for (const q of quoteCandidates) {
      if (symbol.endsWith(q) && symbol.length > q.length) {
        return {
          baseAsset: symbol.slice(0, symbol.length - q.length),
          quoteAsset: q,
        };
      }
    }
    return {
      baseAsset: symbol.slice(0, Math.max(3, symbol.length - 4)),
      quoteAsset: symbol.slice(Math.max(3, symbol.length - 4)),
    };
  }

  /**
   * Fetch personal Spot trade history for a specific symbol (`GET /api/v3/myTrades`) and compute WAC cost basis & P&L.
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
    }
  ): Promise<{ trades: BinancePersonalTrade[]; summary: BinanceSymbolTradeSummary }> {
    const symbol = this.validateSymbol(symbolInput);
    const limit = Math.min(500, Math.max(1, Math.floor(Number(options?.limit) || 100)));
    const cacheKey = `${symbol}:${limit}:${options?.startTime || ''}:${options?.endTime || ''}:${options?.fromId || ''}`;
    const now = Date.now();

    const cached = this.symbolTradesCache.get(cacheKey);
    if (!options?.forceRefresh && cached && now - cached.fetchedAt < 45 * 1000) {
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

    const [rawTrades, tickers] = await Promise.all([
      this.signedGet<any[]>('/api/v3/myTrades', queryParams),
      this.fetchPublicTickers(),
    ]);

    const { baseAsset, quoteAsset } = this.splitSymbol(symbol);
    const quoteValuation = this.resolveAssetValuation(quoteAsset, tickers, rates);
    const quoteToUsd = quoteValuation.priceUsd > 0 ? quoteValuation.priceUsd : 1;

    // Sort chronologically ascending to compute accurate Weighted Average Cost (WAC) & realized P&L
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

    const normalizedTrades: BinancePersonalTrade[] = sortedAsc.map((t) => {
      const isBuyer = Boolean(t.isBuyer);
      const price = parseFloat(t.price) || 0;
      const qty = parseFloat(t.qty) || 0;
      const quoteQty = parseFloat(t.quoteQty) || price * qty;
      const quoteQtyUsd = quoteQty * quoteToUsd;
      const quoteQtyMad = quoteQtyUsd * rates.USD_TO_MAD;
      const priceUsd = price * quoteToUsd;

      const commission = parseFloat(t.commission) || 0;
      const commissionAsset = String(t.commissionAsset || quoteAsset).toUpperCase();
      const commValuation = this.resolveAssetValuation(commissionAsset, tickers, rates);
      const commissionUsd = commission * (commValuation.priceUsd || 0);
      totalFeesUsd += commissionUsd;

      if (isBuyer) {
        buyCount += 1;
        totalBoughtQty += qty;
        totalBuyVolumeUsd += quoteQtyUsd;
        runningHoldingsQty += qty;
        runningCostBasisUsd += quoteQtyUsd;
      } else {
        sellCount += 1;
        totalSoldQty += qty;
        totalSellVolumeUsd += quoteQtyUsd;
        const avgCostAtSell = runningHoldingsQty > 0 ? runningCostBasisUsd / runningHoldingsQty : priceUsd;
        const matchedQty = Math.min(qty, runningHoldingsQty);
        if (matchedQty > 0) {
          realizedPnlUsd += matchedQty * (priceUsd - avgCostAtSell);
          runningHoldingsQty = Math.max(0, runningHoldingsQty - matchedQty);
          runningCostBasisUsd = runningHoldingsQty * avgCostAtSell;
        }
      }

      const timeMs = Number(t.time) || Date.now();

      return {
        id: Number(t.id) || 0,
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
        commissionUsd: Math.round(commissionUsd * 1000) / 1000,
        time: timeMs,
        executedAt: new Date(timeMs).toISOString(),
        isMaker: Boolean(t.isMaker),
      };
    });

    const avgBuyPriceUsd = totalBoughtQty > 0 ? totalBuyVolumeUsd / totalBoughtQty : 0;
    const avgSellPriceUsd = totalSoldQty > 0 ? totalSellVolumeUsd / totalSoldQty : 0;

    // Return trades newest-first for UI display
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
      totalFeesUsd: Math.round(totalFeesUsd * 100) / 100,
      totalFeesMad: Math.round(totalFeesUsd * rates.USD_TO_MAD * 100) / 100,
      firstTradeTime: sortedAsc.length > 0 ? new Date(Number(sortedAsc[0].time)).toISOString() : null,
      lastTradeTime:
        sortedAsc.length > 0 ? new Date(Number(sortedAsc[sortedAsc.length - 1].time)).toISOString() : null,
    };

    this.symbolTradesCache.set(cacheKey, {
      trades: tradesDesc,
      summary,
      fetchedAt: now,
    });

    return { trades: tradesDesc, summary };
  }

  /**
   * Fetch complete read-only Binance Spot account overview (`GET /api/v3/account?omitZeroBalances=true`),
   * enrich with live 24hr market valuation, and compute trade-based cost basis for top held assets.
   */
  public async getAccountOverview(
    rates: { USD_TO_MAD: number; EUR_TO_MAD: number; USD_TO_EUR: number },
    options?: {
      forceRefresh?: boolean;
      linkedWallet?: { id: string; name: string; balanceMad: number } | null;
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
        totalSpotValueUsd: 0,
        totalSpotValueMad: 0,
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
        balances: [],
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
    if (
      !options?.forceRefresh &&
      this.accountOverviewCache.data &&
      now - this.accountOverviewCache.fetchedAt < 30 * 1000
    ) {
      const cached = this.accountOverviewCache.data;
      return {
        ...cached,
        linkedWalletId,
        linkedWalletName,
        linkedWalletBalanceMad,
        walletSyncDiscrepancyMad:
          Math.round((cached.stablecoinReserveMad - linkedWalletBalanceMad) * 100) / 100,
      };
    }

    try {
      const [accountData, tickers] = await Promise.all([
        this.signedGet<any>('/api/v3/account', { omitZeroBalances: true }),
        this.fetchPublicTickers(),
      ]);

      const rawBalances = Array.isArray(accountData?.balances) ? accountData.balances : [];
      const nonZeroBalances = rawBalances
        .map((b: any) => {
          const asset = String(b.asset || '').toUpperCase();
          const free = parseFloat(b.free) || 0;
          const locked = parseFloat(b.locked) || 0;
          const total = free + locked;
          return { asset, free, locked, total };
        })
        .filter((b: { asset: string; total: number }) => b.asset && b.total > 0);

      let totalSpotValueUsd = 0;
      let cryptoEquityUsd = 0;
      let stablecoinReserveUsd = 0;
      let lockedValueUsd = 0;
      let weightedPrev24hUsd = 0;

      const preliminaryBalances = nonZeroBalances.map((b) => {
        const cleanAsset = b.asset.replace(/^LD/, '');
        const meta = ASSET_METADATA[cleanAsset] || {
          name: b.asset.startsWith('LD') ? `${cleanAsset} (Simple Earn)` : b.asset,
          category: 'Digital Assets' as BinanceAssetCategory,
        };
        const val = this.resolveAssetValuation(b.asset, tickers, rates);
        const valueUsd = b.total * val.priceUsd;
        const valueMad = valueUsd * rates.USD_TO_MAD;
        const lockedUsd = b.locked * val.priceUsd;

        totalSpotValueUsd += valueUsd;
        lockedValueUsd += lockedUsd;

        if (val.isStablecoinOrFiat) {
          stablecoinReserveUsd += valueUsd;
        } else {
          cryptoEquityUsd += valueUsd;
        }

        const prevPriceUsd =
          val.change24hPercent !== -100
            ? val.priceUsd / (1 + val.change24hPercent / 100)
            : val.priceUsd;
        weightedPrev24hUsd += b.total * prevPriceUsd;

        return {
          ...b,
          assetName: b.asset.startsWith('LD') ? `${meta.name} (Earn)` : meta.name,
          category: meta.category,
          isStablecoinOrFiat: val.isStablecoinOrFiat,
          priceUsd: val.priceUsd,
          priceMad: val.priceMad,
          change24hPercent: val.change24hPercent,
          high24hUsd: val.high24hUsd,
          low24hUsd: val.low24hUsd,
          valueUsd,
          valueMad,
          defaultSymbol: val.defaultSymbol,
        };
      });

      // Sort by USD value descending
      preliminaryBalances.sort((a, b) => b.valueUsd - a.valueUsd);

      // Fetch personal trade history for the top non-stablecoin crypto holdings (up to 6 pairs in parallel)
      const tradeCandidateAssets = preliminaryBalances
        .filter((b) => !b.isStablecoinOrFiat && b.defaultSymbol && b.valueUsd >= 0.5)
        .slice(0, 6);

      const tradeSummariesByAsset = new Map<string, BinanceSymbolTradeSummary>();
      const allRecentTrades: BinancePersonalTrade[] = [];

      await Promise.all(
        tradeCandidateAssets.map(async (item) => {
          if (!item.defaultSymbol) return;
          try {
            const { trades, summary } = await this.getPersonalTradesForSymbol(
              item.defaultSymbol,
              rates,
              { limit: 100, forceRefresh: options?.forceRefresh }
            );
            if (trades.length > 0) {
              tradeSummariesByAsset.set(item.asset, summary);
              allRecentTrades.push(...trades);
            }
          } catch {
            // Ignore individual pair trade lookup failures (e.g. if asset was acquired via EUR/BTC pair or convert)
          }
        })
      );

      allRecentTrades.sort((a, b) => b.time - a.time);

      let totalTrackedCostBasisMad = 0;
      let totalTrackedMarketValueMad = 0;
      let totalRealizedPnlMad = 0;
      let totalFeesPaidMad = 0;

      const symbolSummaries = Array.from(tradeSummariesByAsset.values());
      for (const s of symbolSummaries) {
        totalRealizedPnlMad += s.realizedPnlMad;
        totalFeesPaidMad += s.totalFeesMad;
      }

      const enrichedBalances: BinanceSpotAssetBalance[] = preliminaryBalances.map((b) => {
        const weight = totalSpotValueUsd > 0 ? (b.valueUsd / totalSpotValueUsd) * 100 : 0;
        const summary = tradeSummariesByAsset.get(b.asset);

        let avgBuyPriceUsd: number | null = null;
        let costBasisUsd: number | null = null;
        let costBasisMad: number | null = null;
        let unrealizedPnlUsd: number | null = null;
        let unrealizedPnlMad: number | null = null;
        let unrealizedPnlPercent: number | null = null;

        if (!b.isStablecoinOrFiat && summary && summary.avgBuyPriceUsd > 0) {
          avgBuyPriceUsd = summary.avgBuyPriceUsd;
          costBasisUsd = b.total * avgBuyPriceUsd;
          costBasisMad = costBasisUsd * rates.USD_TO_MAD;
          unrealizedPnlUsd = b.valueUsd - costBasisUsd;
          unrealizedPnlMad = b.valueMad - costBasisMad;
          unrealizedPnlPercent = costBasisUsd > 0 ? (unrealizedPnlUsd / costBasisUsd) * 100 : 0;

          totalTrackedCostBasisMad += costBasisMad;
          totalTrackedMarketValueMad += b.valueMad;
        }

        return {
          asset: b.asset,
          assetName: b.assetName,
          category: b.category,
          isStablecoinOrFiat: b.isStablecoinOrFiat,
          free: Math.round(b.free * 1e8) / 1e8,
          locked: Math.round(b.locked * 1e8) / 1e8,
          total: Math.round(b.total * 1e8) / 1e8,
          priceUsd: Math.round(b.priceUsd * 1e6) / 1e6,
          priceMad: Math.round(b.priceMad * 1e4) / 1e4,
          change24hPercent: Math.round(b.change24hPercent * 100) / 100,
          high24hUsd: Math.round(b.high24hUsd * 1e6) / 1e6,
          low24hUsd: Math.round(b.low24hUsd * 1e6) / 1e6,
          valueUsd: Math.round(b.valueUsd * 100) / 100,
          valueMad: Math.round(b.valueMad * 100) / 100,
          portfolioWeightPercent: Math.round(weight * 100) / 100,
          defaultSymbol: b.defaultSymbol,
          avgBuyPriceUsd: avgBuyPriceUsd !== null ? Math.round(avgBuyPriceUsd * 1e4) / 1e4 : null,
          costBasisUsd: costBasisUsd !== null ? Math.round(costBasisUsd * 100) / 100 : null,
          costBasisMad: costBasisMad !== null ? Math.round(costBasisMad * 100) / 100 : null,
          unrealizedPnlUsd: unrealizedPnlUsd !== null ? Math.round(unrealizedPnlUsd * 100) / 100 : null,
          unrealizedPnlMad: unrealizedPnlMad !== null ? Math.round(unrealizedPnlMad * 100) / 100 : null,
          unrealizedPnlPercent:
            unrealizedPnlPercent !== null ? Math.round(unrealizedPnlPercent * 100) / 100 : null,
          realizedPnlUsd: summary ? summary.realizedPnlUsd : null,
          realizedPnlMad: summary ? summary.realizedPnlMad : null,
          tradeCount: summary ? summary.tradeCount : 0,
        };
      });

      const totalSpotValueMad = totalSpotValueUsd * rates.USD_TO_MAD;
      const cryptoEquityMad = cryptoEquityUsd * rates.USD_TO_MAD;
      const stablecoinReserveMad = stablecoinReserveUsd * rates.USD_TO_MAD;
      const lockedValueMad = lockedValueUsd * rates.USD_TO_MAD;

      const change24hUsd = totalSpotValueUsd - weightedPrev24hUsd;
      const change24hMad = change24hUsd * rates.USD_TO_MAD;
      const change24hPercent =
        weightedPrev24hUsd > 0 ? (change24hUsd / weightedPrev24hUsd) * 100 : 0;

      const totalTrackedUnrealizedPnlMad = totalTrackedMarketValueMad - totalTrackedCostBasisMad;
      const totalTrackedUnrealizedPnlPercent =
        totalTrackedCostBasisMad > 0
          ? (totalTrackedUnrealizedPnlMad / totalTrackedCostBasisMad) * 100
          : 0;

      // Build available symbols list prioritizing user's held assets first
      const heldSymbols = enrichedBalances
        .map((b) => b.defaultSymbol)
        .filter((s): s is string => Boolean(s));
      const availableSymbols = Array.from(new Set([...heldSymbols, ...DEFAULT_POPULAR_SYMBOLS]));

      const canTrade = Boolean(accountData?.canTrade);
      const canWithdraw = Boolean(accountData?.canWithdraw);
      const canDeposit = Boolean(accountData?.canDeposit);

      const overview: BinanceAccountOverview = {
        isConfigured: true,
        connected: true,
        statusMessage: 'Connected to Binance Spot via server-side Ed25519 signature authentication.',
        errorCode: null,
        accountType: String(accountData?.accountType || 'SPOT'),
        permissions: {
          canRead: true,
          canTrade,
          canWithdraw,
          canDeposit,
          isReadOnlySafe: !canWithdraw,
        },
        lastSyncedAt: new Date().toISOString(),
        totalSpotValueUsd: Math.round(totalSpotValueUsd * 100) / 100,
        totalSpotValueMad: Math.round(totalSpotValueMad * 100) / 100,
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
        balances: enrichedBalances,
        recentTrades: allRecentTrades.slice(0, 80),
        symbolSummaries,
        availableSymbols,
        linkedWalletId,
        linkedWalletName,
        linkedWalletBalanceMad,
        walletSyncDiscrepancyMad:
          Math.round((stablecoinReserveMad - linkedWalletBalanceMad) * 100) / 100,
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
        statusMessage: err?.message || 'Unable to authenticate with Binance Spot API.',
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
        totalSpotValueUsd: 0,
        totalSpotValueMad: 0,
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
        balances: [],
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
