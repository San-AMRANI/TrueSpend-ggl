/**
 * Universal Stock Category & Asset Class Classification Engine
 * Strictly separates Spot Cryptocurrencies from Funding / US / Global / BVC Stocks
 * and categorizes every stock into clear, human-friendly industry sectors:
 * - AI & Semiconductors
 * - Technology & Cloud
 * - Mechanics, Automotive & Industrials
 * - Banking & Financials
 * - Consumer & Retail
 * - Healthcare & Biotech
 * - Energy, Utilities & Real Estate
 * - Index & Dividend ETFs
 */

export type StockSectorCategory =
  | 'AI & Semiconductors'
  | 'Technology & Cloud'
  | 'Mechanics, Automotive & Industrials'
  | 'Banking & Financials'
  | 'Consumer & Retail'
  | 'Healthcare & Biotech'
  | 'Energy, Utilities & Real Estate'
  | 'Index & Dividend ETFs';

export const ALL_STOCK_SECTOR_CATEGORIES: StockSectorCategory[] = [
  'AI & Semiconductors',
  'Technology & Cloud',
  'Mechanics, Automotive & Industrials',
  'Banking & Financials',
  'Consumer & Retail',
  'Healthcare & Biotech',
  'Energy, Utilities & Real Estate',
  'Index & Dividend ETFs',
];

export interface StockSectorMeta {
  id: StockSectorCategory;
  shortLabel: string;
  description: string;
  colorHex: string;
  examples: string[];
}

export const STOCK_SECTOR_METADATA: Record<StockSectorCategory, StockSectorMeta> = {
  'AI & Semiconductors': {
    id: 'AI & Semiconductors',
    shortLabel: 'AI & Chips',
    description: 'GPUs, AI accelerators, foundries, and machine intelligence platforms',
    colorHex: '#8b5cf6', // Violet
    examples: ['NVDA', 'AMD', 'AVGO', 'PLTR', 'TSM', 'ASML', 'INTC', 'ARM'],
  },
  'Technology & Cloud': {
    id: 'Technology & Cloud',
    shortLabel: 'Tech & Cloud',
    description: 'Hyperscale cloud, enterprise software, cybersecurity, and consumer tech ecosystems',
    colorHex: '#3b82f6', // Blue
    examples: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'CRM', 'ORCL'],
  },
  'Mechanics, Automotive & Industrials': {
    id: 'Mechanics, Automotive & Industrials',
    shortLabel: 'Mechanics & Auto',
    description: 'Heavy machinery, robotics, automotive engineering, aerospace, and infrastructure',
    colorHex: '#f59e0b', // Amber
    examples: ['TSLA', 'CAT', 'DE', 'GE', 'HON', 'BA', 'LMT', 'TGCC'],
  },
  'Banking & Financials': {
    id: 'Banking & Financials',
    shortLabel: 'Banking & Finance',
    description: 'Global investment banks, payment networks, insurance, and capital markets',
    colorHex: '#10b981', // Emerald
    examples: ['JPM', 'BAC', 'GS', 'V', 'MA', 'BRK-B', 'ATW', 'BCP'],
  },
  'Consumer & Retail': {
    id: 'Consumer & Retail',
    shortLabel: 'Consumer & Retail',
    description: 'Global retail leaders, food & beverage staples, and household brands',
    colorHex: '#ec4899', // Pink
    examples: ['COST', 'WMT', 'KO', 'PEP', 'MCD', 'NKE', 'SBUX', 'PG'],
  },
  'Healthcare & Biotech': {
    id: 'Healthcare & Biotech',
    shortLabel: 'Healthcare & Bio',
    description: 'Pharmaceuticals, medical robotics, biotechnology, and healthcare networks',
    colorHex: '#14b8a6', // Teal
    examples: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'ISRG', 'AKD'],
  },
  'Energy, Utilities & Real Estate': {
    id: 'Energy, Utilities & Real Estate',
    shortLabel: 'Energy & REITs',
    description: 'Oil & gas majors, power grids, telecom infrastructure, and monthly dividend REITs',
    colorHex: '#f97316', // Orange
    examples: ['XOM', 'CVX', 'O', 'NEE', 'PLD', 'IAM', 'TQM', 'MNG'],
  },
  'Index & Dividend ETFs': {
    id: 'Index & Dividend ETFs',
    shortLabel: 'Market ETFs',
    description: 'S&P 500, Nasdaq-100, dividend growth, and sector index funds',
    colorHex: '#6366f1', // Indigo
    examples: ['VOO', 'SPY', 'QQQ', 'SCHD', 'VTI', 'JEPI', 'SMH', 'XLF'],
  },
};

/**
 * Exhaustive set of known Spot Cryptocurrencies & Layer-1/DeFi tokens
 * so they are NEVER mixed into the US / Funding Stocks dashboard.
 */
export const KNOWN_CRYPTO_TICKERS = new Set<string>([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'TRX', 'TON', 'AVAX',
  'SHIB', 'DOT', 'LINK', 'BCH', 'NEAR', 'SUI', 'LTC', 'UNI', 'PEPE', 'APT',
  'ICP', 'ETC', 'FET', 'RENDER', 'RNDR', 'TAO', 'KAS', 'STX', 'ARB', 'OP',
  'ATOM', 'FIL', 'IMX', 'INJ', 'HBAR', 'VET', 'MKR', 'AAVE', 'GRT', 'ALGO',
  'SAND', 'MANA', 'AXS', 'FLOW', 'XTZ', 'EOS', 'THETA', 'GALA', 'LDO', 'RUNE',
  'SEI', 'TIA', 'JUP', 'WIF', 'BONK', 'FLOKI', 'ENA', 'PENDLE', 'ONDO', 'WLD',
  'STRK', 'ZK', 'NOT', 'POL', 'MATIC', 'PAXG', 'EARN', 'WBTC', 'STETH', 'WETH',
  'CAKE', 'CRV', 'COMP', 'SNX', '1INCH', 'ENS', 'BLUR', 'APE', 'GMT', 'CHZ',
  'MINA', 'KAVA', 'ZIL', 'IOTA', 'NEO', 'DASH', 'ZEC', 'XMR', 'EGLD', 'QNT',
  'CFX', 'ORDI', 'SATS', 'PYTH', 'JTO', 'DYM', 'ALT', 'MANTA', 'PIXEL', 'PORTAL',
  'AEVO', 'ETHFI', 'BOME', 'IO', 'ZRO', 'LISTA', 'BANANA', 'TONCOIN',
]);

export const KNOWN_STABLECOIN_AND_FIAT_TICKERS = new Set<string>([
  'USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD', 'USDP', 'USDD', 'PYUSD',
  'EUR', 'AEUR', 'EURI', 'USD', 'GBP', 'TRY', 'BRL', 'PLN', 'ARS', 'MAD',
]);

/**
 * Direct mapping of US, Global, and Casablanca BVC stock tickers to their exact Stock Sector Category.
 */
export const TICKER_TO_STOCK_SECTOR: Record<string, StockSectorCategory> = {
  // 1. AI & Semiconductors
  NVDA: 'AI & Semiconductors',
  AMD: 'AI & Semiconductors',
  AVGO: 'AI & Semiconductors',
  PLTR: 'AI & Semiconductors',
  TSM: 'AI & Semiconductors',
  ASML: 'AI & Semiconductors',
  INTC: 'AI & Semiconductors',
  ARM: 'AI & Semiconductors',
  MU: 'AI & Semiconductors',
  SMCI: 'AI & Semiconductors',
  MRVL: 'AI & Semiconductors',
  QCOM: 'AI & Semiconductors',
  TXN: 'AI & Semiconductors',
  ADI: 'AI & Semiconductors',
  NXPI: 'AI & Semiconductors',
  ON: 'AI & Semiconductors',
  MCHP: 'AI & Semiconductors',
  KLAC: 'AI & Semiconductors',
  LRCX: 'AI & Semiconductors',
  AMAT: 'AI & Semiconductors',
  SNPS: 'AI & Semiconductors',
  CDNS: 'AI & Semiconductors',
  AI: 'AI & Semiconductors',
  SOUN: 'AI & Semiconductors',
  IONQ: 'AI & Semiconductors',
  RGTI: 'AI & Semiconductors',
  BBAI: 'AI & Semiconductors',
  DELL: 'AI & Semiconductors',
  VRT: 'AI & Semiconductors',

  // 2. Technology & Cloud
  AAPL: 'Technology & Cloud',
  MSFT: 'Technology & Cloud',
  GOOGL: 'Technology & Cloud',
  GOOG: 'Technology & Cloud',
  AMZN: 'Technology & Cloud',
  META: 'Technology & Cloud',
  NFLX: 'Technology & Cloud',
  CRM: 'Technology & Cloud',
  ORCL: 'Technology & Cloud',
  ADBE: 'Technology & Cloud',
  IBM: 'Technology & Cloud',
  CSCO: 'Technology & Cloud',
  SAP: 'Technology & Cloud',
  NOW: 'Technology & Cloud',
  SNOW: 'Technology & Cloud',
  PANW: 'Technology & Cloud',
  CRWD: 'Technology & Cloud',
  FTNT: 'Technology & Cloud',
  ZS: 'Technology & Cloud',
  NET: 'Technology & Cloud',
  DDOG: 'Technology & Cloud',
  MDB: 'Technology & Cloud',
  TEAM: 'Technology & Cloud',
  INTU: 'Technology & Cloud',
  ADP: 'Technology & Cloud',
  UBER: 'Technology & Cloud',
  LYFT: 'Technology & Cloud',
  SHOP: 'Technology & Cloud',
  SPOT: 'Technology & Cloud',
  RBLX: 'Technology & Cloud',
  U: 'Technology & Cloud',
  PLTK: 'Technology & Cloud',
  MSTR: 'Technology & Cloud',
  HPS: 'Technology & Cloud',
  M2M: 'Technology & Cloud',
  DYT: 'Technology & Cloud',

  // 3. Mechanics, Automotive & Industrials
  TSLA: 'Mechanics, Automotive & Industrials',
  CAT: 'Mechanics, Automotive & Industrials',
  DE: 'Mechanics, Automotive & Industrials',
  GE: 'Mechanics, Automotive & Industrials',
  GEV: 'Mechanics, Automotive & Industrials',
  HON: 'Mechanics, Automotive & Industrials',
  BA: 'Mechanics, Automotive & Industrials',
  LMT: 'Mechanics, Automotive & Industrials',
  RTX: 'Mechanics, Automotive & Industrials',
  NOC: 'Mechanics, Automotive & Industrials',
  GD: 'Mechanics, Automotive & Industrials',
  LHX: 'Mechanics, Automotive & Industrials',
  UNP: 'Mechanics, Automotive & Industrials',
  CSX: 'Mechanics, Automotive & Industrials',
  NSC: 'Mechanics, Automotive & Industrials',
  UPS: 'Mechanics, Automotive & Industrials',
  FDX: 'Mechanics, Automotive & Industrials',
  F: 'Mechanics, Automotive & Industrials',
  GM: 'Mechanics, Automotive & Industrials',
  TM: 'Mechanics, Automotive & Industrials',
  HMC: 'Mechanics, Automotive & Industrials',
  STLA: 'Mechanics, Automotive & Industrials',
  RACE: 'Mechanics, Automotive & Industrials',
  BYD: 'Mechanics, Automotive & Industrials',
  RIVN: 'Mechanics, Automotive & Industrials',
  LCID: 'Mechanics, Automotive & Industrials',
  NIO: 'Mechanics, Automotive & Industrials',
  XPEV: 'Mechanics, Automotive & Industrials',
  LI: 'Mechanics, Automotive & Industrials',
  MMM: 'Mechanics, Automotive & Industrials',
  ETN: 'Mechanics, Automotive & Industrials',
  EMR: 'Mechanics, Automotive & Industrials',
  ITW: 'Mechanics, Automotive & Industrials',
  PH: 'Mechanics, Automotive & Industrials',
  CMI: 'Mechanics, Automotive & Industrials',
  PCAR: 'Mechanics, Automotive & Industrials',
  URI: 'Mechanics, Automotive & Industrials',
  CARR: 'Mechanics, Automotive & Industrials',
  OTIS: 'Mechanics, Automotive & Industrials',
  ROK: 'Mechanics, Automotive & Industrials',
  AME: 'Mechanics, Automotive & Industrials',
  TGCC: 'Mechanics, Automotive & Industrials',
  LHM: 'Mechanics, Automotive & Industrials',
  SID: 'Mechanics, Automotive & Industrials',
  CMT: 'Mechanics, Automotive & Industrials',
  jet: 'Mechanics, Automotive & Industrials',

  // 4. Banking & Financials
  JPM: 'Banking & Financials',
  BAC: 'Banking & Financials',
  WFC: 'Banking & Financials',
  C: 'Banking & Financials',
  GS: 'Banking & Financials',
  MS: 'Banking & Financials',
  BLK: 'Banking & Financials',
  'BRK-B': 'Banking & Financials',
  'BRK.B': 'Banking & Financials',
  'BRK-A': 'Banking & Financials',
  BRK: 'Banking & Financials',
  V: 'Banking & Financials',
  MA: 'Banking & Financials',
  AXP: 'Banking & Financials',
  PYPL: 'Banking & Financials',
  SQ: 'Banking & Financials',
  XYZ: 'Banking & Financials',
  COIN: 'Banking & Financials',
  HOOD: 'Banking & Financials',
  SOFI: 'Banking & Financials',
  AFRM: 'Banking & Financials',
  UPST: 'Banking & Financials',
  SCHW: 'Banking & Financials',
  IBKR: 'Banking & Financials',
  SPGI: 'Banking & Financials',
  MCO: 'Banking & Financials',
  ICE: 'Banking & Financials',
  CME: 'Banking & Financials',
  NDAQ: 'Banking & Financials',
  USB: 'Banking & Financials',
  PNC: 'Banking & Financials',
  TFC: 'Banking & Financials',
  COF: 'Banking & Financials',
  CB: 'Banking & Financials',
  PGR: 'Banking & Financials',
  TRV: 'Banking & Financials',
  ALL: 'Banking & Financials',
  MET: 'Banking & Financials',
  PRU: 'Banking & Financials',
  AIG: 'Banking & Financials',
  ATW: 'Banking & Financials',
  BCP: 'Banking & Financials',
  BOA: 'Banking & Financials',
  CIH: 'Banking & Financials',
  CDM: 'Banking & Financials',
  WAA: 'Banking & Financials',
  SAH: 'Banking & Financials',
  ATL: 'Banking & Financials',

  // 5. Consumer & Retail
  COST: 'Consumer & Retail',
  WMT: 'Consumer & Retail',
  TGT: 'Consumer & Retail',
  HD: 'Consumer & Retail',
  LOW: 'Consumer & Retail',
  MCD: 'Consumer & Retail',
  SBUX: 'Consumer & Retail',
  CMG: 'Consumer & Retail',
  YUM: 'Consumer & Retail',
  DPZ: 'Consumer & Retail',
  NKE: 'Consumer & Retail',
  LULU: 'Consumer & Retail',
  KO: 'Consumer & Retail',
  PEP: 'Consumer & Retail',
  MNST: 'Consumer & Retail',
  PG: 'Consumer & Retail',
  CL: 'Consumer & Retail',
  KMB: 'Consumer & Retail',
  EL: 'Consumer & Retail',
  PM: 'Consumer & Retail',
  MO: 'Consumer & Retail',
  DIS: 'Consumer & Retail',
  ABNB: 'Consumer & Retail',
  BKNG: 'Consumer & Retail',
  MAR: 'Consumer & Retail',
  HLT: 'Consumer & Retail',
  MDLZ: 'Consumer & Retail',
  HSY: 'Consumer & Retail',
  GIS: 'Consumer & Retail',
  KHC: 'Consumer & Retail',
  BABA: 'Consumer & Retail',
  PDD: 'Consumer & Retail',
  JD: 'Consumer & Retail',
  MELI: 'Consumer & Retail',
  CSR: 'Consumer & Retail',
  LBV: 'Consumer & Retail',
  SBM: 'Consumer & Retail',
  LES: 'Consumer & Retail',

  // 6. Healthcare & Biotech
  LLY: 'Healthcare & Biotech',
  UNH: 'Healthcare & Biotech',
  JNJ: 'Healthcare & Biotech',
  ABBV: 'Healthcare & Biotech',
  MRK: 'Healthcare & Biotech',
  PFE: 'Healthcare & Biotech',
  TMO: 'Healthcare & Biotech',
  ABT: 'Healthcare & Biotech',
  DHR: 'Healthcare & Biotech',
  AMGN: 'Healthcare & Biotech',
  BMY: 'Healthcare & Biotech',
  GILD: 'Healthcare & Biotech',
  ISRG: 'Healthcare & Biotech',
  VRTX: 'Healthcare & Biotech',
  REGN: 'Healthcare & Biotech',
  SYK: 'Healthcare & Biotech',
  BSX: 'Healthcare & Biotech',
  MDT: 'Healthcare & Biotech',
  ZTS: 'Healthcare & Biotech',
  CVS: 'Healthcare & Biotech',
  CI: 'Healthcare & Biotech',
  ELV: 'Healthcare & Biotech',
  HCA: 'Healthcare & Biotech',
  NVO: 'Healthcare & Biotech',
  AZN: 'Healthcare & Biotech',
  SNY: 'Healthcare & Biotech',
  GSK: 'Healthcare & Biotech',
  MRNA: 'Healthcare & Biotech',
  BNTX: 'Healthcare & Biotech',
  AKD: 'Healthcare & Biotech',
  SOT: 'Healthcare & Biotech',

  // 7. Energy, Utilities & Real Estate
  XOM: 'Energy, Utilities & Real Estate',
  CVX: 'Energy, Utilities & Real Estate',
  COP: 'Energy, Utilities & Real Estate',
  SLB: 'Energy, Utilities & Real Estate',
  EOG: 'Energy, Utilities & Real Estate',
  OXY: 'Energy, Utilities & Real Estate',
  MPC: 'Energy, Utilities & Real Estate',
  PSX: 'Energy, Utilities & Real Estate',
  VLO: 'Energy, Utilities & Real Estate',
  HAL: 'Energy, Utilities & Real Estate',
  KMI: 'Energy, Utilities & Real Estate',
  WMB: 'Energy, Utilities & Real Estate',
  OKE: 'Energy, Utilities & Real Estate',
  ENB: 'Energy, Utilities & Real Estate',
  O: 'Energy, Utilities & Real Estate',
  PLD: 'Energy, Utilities & Real Estate',
  AMT: 'Energy, Utilities & Real Estate',
  CCI: 'Energy, Utilities & Real Estate',
  EQIX: 'Energy, Utilities & Real Estate',
  DLR: 'Energy, Utilities & Real Estate',
  SPG: 'Energy, Utilities & Real Estate',
  VICI: 'Energy, Utilities & Real Estate',
  PSA: 'Energy, Utilities & Real Estate',
  WELL: 'Energy, Utilities & Real Estate',
  NEE: 'Energy, Utilities & Real Estate',
  SO: 'Energy, Utilities & Real Estate',
  DUK: 'Energy, Utilities & Real Estate',
  CEG: 'Energy, Utilities & Real Estate',
  VST: 'Energy, Utilities & Real Estate',
  AEP: 'Energy, Utilities & Real Estate',
  SRE: 'Energy, Utilities & Real Estate',
  IAM: 'Energy, Utilities & Real Estate',
  TQM: 'Energy, Utilities & Real Estate',
  MNG: 'Energy, Utilities & Real Estate',
  ADH: 'Energy, Utilities & Real Estate',
  RDS: 'Energy, Utilities & Real Estate',
  TOT: 'Energy, Utilities & Real Estate',

  // 8. Index & Dividend ETFs
  SPY: 'Index & Dividend ETFs',
  VOO: 'Index & Dividend ETFs',
  IVV: 'Index & Dividend ETFs',
  VTI: 'Index & Dividend ETFs',
  QQQ: 'Index & Dividend ETFs',
  QQQM: 'Index & Dividend ETFs',
  SCHD: 'Index & Dividend ETFs',
  DIA: 'Index & Dividend ETFs',
  IWM: 'Index & Dividend ETFs',
  JEPI: 'Index & Dividend ETFs',
  JEPQ: 'Index & Dividend ETFs',
  VYM: 'Index & Dividend ETFs',
  DGRO: 'Index & Dividend ETFs',
  VIG: 'Index & Dividend ETFs',
  SDY: 'Index & Dividend ETFs',
  HDV: 'Index & Dividend ETFs',
  VXUS: 'Index & Dividend ETFs',
  VEA: 'Index & Dividend ETFs',
  VWO: 'Index & Dividend ETFs',
  VGT: 'Index & Dividend ETFs',
  XLK: 'Index & Dividend ETFs',
  XLF: 'Index & Dividend ETFs',
  XLI: 'Index & Dividend ETFs',
  XLE: 'Index & Dividend ETFs',
  XLV: 'Index & Dividend ETFs',
  XLP: 'Index & Dividend ETFs',
  XLY: 'Index & Dividend ETFs',
  XLU: 'Index & Dividend ETFs',
  XLRE: 'Index & Dividend ETFs',
  XLB: 'Index & Dividend ETFs',
  XLC: 'Index & Dividend ETFs',
  SMH: 'Index & Dividend ETFs',
  SOXX: 'Index & Dividend ETFs',
  ARKK: 'Index & Dividend ETFs',
  TLT: 'Index & Dividend ETFs',
  BND: 'Index & Dividend ETFs',
  AGG: 'Index & Dividend ETFs',
  GLD: 'Index & Dividend ETFs',
  IAU: 'Index & Dividend ETFs',
  SLV: 'Index & Dividend ETFs',
  VNQ: 'Index & Dividend ETFs',
};

/**
 * Normalizes a potentially tokenized stock ticker from Binance Funding/Spot
 * (e.g., "NVDAUSDT" -> "NVDA", "TSLAON" -> "TSLA", "LDAAPL" -> "AAPL").
 */
export function normalizeStockTicker(rawTicker: string): string {
  let clean = (rawTicker || '').trim().toUpperCase();
  if (!clean) return '';
  if (clean.startsWith('LD') && clean.length > 2 && !TICKER_TO_STOCK_SECTOR[clean]) {
    clean = clean.slice(2);
  }
  for (const suffix of ['USDT', 'FDUSD', 'USDC', 'BUSD', 'USD']) {
    if (clean.endsWith(suffix) && clean.length > suffix.length) {
      const stripped = clean.slice(0, -suffix.length);
      if (TICKER_TO_STOCK_SECTOR[stripped] || KNOWN_CRYPTO_TICKERS.has(stripped)) {
        return stripped;
      }
    }
  }
  // Handle Ondo / Tokenized stock suffixes like NVDAON, TSLAON, AAPLX if base is a known stock
  if (clean.endsWith('ON') && clean.length > 3) {
    const base = clean.slice(0, -2);
    if (TICKER_TO_STOCK_SECTOR[base]) return base;
  }
  if (clean.endsWith('X') && clean.length > 3 && !TICKER_TO_STOCK_SECTOR[clean]) {
    const base = clean.slice(0, -1);
    if (TICKER_TO_STOCK_SECTOR[base]) return base;
  }
  return clean;
}

/**
 * Determines whether a given ticker/position is a Stock/ETF (including Funding Wallet equities)
 * vs. a Spot Cryptocurrency or Stablecoin.
 */
export function classifyAssetClass(params: {
  ticker: string;
  market?: string;
  sector?: string;
  walletType?: string;
  fundingTotal?: number;
  isStablecoinOrFiat?: boolean;
}): 'STOCK' | 'CRYPTO' | 'STABLECOIN' {
  const raw = (params.ticker || '').trim().toUpperCase();
  const clean = normalizeStockTicker(raw);

  if (
    params.isStablecoinOrFiat ||
    KNOWN_STABLECOIN_AND_FIAT_TICKERS.has(raw) ||
    KNOWN_STABLECOIN_AND_FIAT_TICKERS.has(clean) ||
    params.sector === 'Stablecoin / Fiat Reserve'
  ) {
    return 'STABLECOIN';
  }

  // Known stock ticker in our dictionary
  if (TICKER_TO_STOCK_SECTOR[clean] || TICKER_TO_STOCK_SECTOR[raw]) {
    return 'STOCK';
  }

  // Known cryptocurrency ticker -> always CRYPTO
  if (KNOWN_CRYPTO_TICKERS.has(clean) || KNOWN_CRYPTO_TICKERS.has(raw)) {
    return 'CRYPTO';
  }

  // Explicit market tag from position record
  const mkt = (params.market || '').toUpperCase();
  if (mkt === 'US' || mkt === 'BVC' || mkt === 'ETF' || mkt === 'GLOBAL') {
    return 'STOCK';
  }

  // Explicit stock sector tag
  const sec = (params.sector || '').toLowerCase();
  if (
    sec.includes('stock') ||
    sec.includes('equit') ||
    sec.includes('semiconductor') ||
    sec.includes('banking') ||
    sec.includes('mechanic') ||
    sec.includes('automotive') ||
    sec.includes('industrial') ||
    sec.includes('healthcare') ||
    sec.includes('consumer') ||
    sec.includes('etf') ||
    sec.includes('telecom') ||
    sec.includes('real estate')
  ) {
    return 'STOCK';
  }

  // If held in Binance Funding Wallet and not a known cryptocurrency or stablecoin, treat as Funding Stock
  if (
    (params.walletType === 'FUNDING' || (params.fundingTotal && params.fundingTotal > 0)) &&
    !KNOWN_CRYPTO_TICKERS.has(clean)
  ) {
    return 'STOCK';
  }

  if (mkt === 'CRYPTO') {
    return 'CRYPTO';
  }

  return 'STOCK';
}

/**
 * Classifies any stock into one of the 8 canonical Stock Sector Categories
 * (AI & Semiconductors, Technology & Cloud, Mechanics, Automotive & Industrials, Banking & Financials, etc.).
 */
export function resolveStockSectorCategory(params: {
  ticker: string;
  existingSector?: string | null;
  companyName?: string | null;
  market?: string | null;
}): StockSectorCategory {
  const raw = (params.ticker || '').trim().toUpperCase();
  const clean = normalizeStockTicker(raw);

  // 1. Check if existingSector already matches one of the 8 canonical categories
  if (params.existingSector) {
    const exactMatch = ALL_STOCK_SECTOR_CATEGORIES.find(
      (c) => c.toLowerCase() === params.existingSector!.trim().toLowerCase()
    );
    if (exactMatch) return exactMatch;
  }

  // 2. Direct ticker lookup
  if (TICKER_TO_STOCK_SECTOR[clean]) {
    return TICKER_TO_STOCK_SECTOR[clean];
  }
  if (TICKER_TO_STOCK_SECTOR[raw]) {
    return TICKER_TO_STOCK_SECTOR[raw];
  }

  // 3. Keyword matching on existingSector + companyName
  const combined = `${params.existingSector || ''} ${params.companyName || ''}`.toLowerCase();

  if (
    combined.includes('ai') ||
    combined.includes('semiconductor') ||
    combined.includes('chip') ||
    combined.includes('nvidia') ||
    combined.includes('silicon') ||
    combined.includes('quantum') ||
    combined.includes('gpu')
  ) {
    return 'AI & Semiconductors';
  }

  if (
    combined.includes('mechanic') ||
    combined.includes('auto') ||
    combined.includes('industrial') ||
    combined.includes('machinery') ||
    combined.includes('aerospace') ||
    combined.includes('defense') ||
    combined.includes('construction') ||
    combined.includes('building') ||
    combined.includes('motor') ||
    combined.includes('vehicle') ||
    combined.includes('caterpillar') ||
    combined.includes('deere') ||
    combined.includes('tesla') ||
    combined.includes('transport') ||
    combined.includes('logistics')
  ) {
    return 'Mechanics, Automotive & Industrials';
  }

  if (
    combined.includes('bank') ||
    combined.includes('financ') ||
    combined.includes('insur') ||
    combined.includes('capital') ||
    combined.includes('payment') ||
    combined.includes('visa') ||
    combined.includes('mastercard') ||
    combined.includes('attijari') ||
    combined.includes('bcp')
  ) {
    return 'Banking & Financials';
  }

  if (
    combined.includes('etf') ||
    combined.includes('index') ||
    combined.includes('vanguard') ||
    combined.includes('spdr') ||
    combined.includes('ishares') ||
    combined.includes('invesco') ||
    combined.includes('schwab') ||
    combined.includes('fund') ||
    (params.market || '').toUpperCase() === 'ETF'
  ) {
    return 'Index & Dividend ETFs';
  }

  if (
    combined.includes('health') ||
    combined.includes('pharma') ||
    combined.includes('biotech') ||
    combined.includes('med') ||
    combined.includes('clinic') ||
    combined.includes('therap')
  ) {
    return 'Healthcare & Biotech';
  }

  if (
    combined.includes('consumer') ||
    combined.includes('retail') ||
    combined.includes('food') ||
    combined.includes('beverage') ||
    combined.includes('apparel') ||
    combined.includes('restaurant') ||
    combined.includes('commerce')
  ) {
    return 'Consumer & Retail';
  }

  if (
    combined.includes('energy') ||
    combined.includes('oil') ||
    combined.includes('gas') ||
    combined.includes('utilit') ||
    combined.includes('real estate') ||
    combined.includes('reit') ||
    combined.includes('telecom') ||
    combined.includes('mining') ||
    combined.includes('power') ||
    combined.includes('solar')
  ) {
    return 'Energy, Utilities & Real Estate';
  }

  if (
    combined.includes('tech') ||
    combined.includes('cloud') ||
    combined.includes('software') ||
    combined.includes('cyber') ||
    combined.includes('digital') ||
    combined.includes('internet')
  ) {
    return 'Technology & Cloud';
  }

  // Default fallback for uncategorized US/Funding equities
  return 'Technology & Cloud';
}
