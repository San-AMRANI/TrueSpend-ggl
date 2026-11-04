export type StockSectorCategory =
  | 'AI & Semiconductors'
  | 'Technology & Cloud'
  | 'Mechanics, Automotive & Industrials'
  | 'Banking & Financials'
  | 'Consumer & Retail'
  | 'Healthcare & Biotech'
  | 'Energy, Utilities & Real Estate'
  | 'Index & Dividend ETFs';

export interface StockSectorMetadata {
  category: StockSectorCategory;
  shortLabel: string;
  description: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  barClass: string;
  examples: string[];
}

export const STOCK_SECTOR_METADATA: Record<StockSectorCategory, StockSectorMetadata> = {
  'AI & Semiconductors': {
    category: 'AI & Semiconductors',
    shortLabel: 'AI & Chips',
    description: 'GPUs, AI accelerators, semiconductor foundries, chip design, and quantum/AI infrastructure.',
    colorHex: '#6366f1', // indigo-500
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    badgeBorder: 'border-indigo-200 dark:border-indigo-800/70',
    barClass: 'bg-indigo-500',
    examples: ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'PLTR', 'ARM', 'MU'],
  },
  'Technology & Cloud': {
    category: 'Technology & Cloud',
    shortLabel: 'Tech & Cloud',
    description: 'Hyperscale cloud platforms, enterprise SaaS, cybersecurity, operating systems, and consumer tech.',
    colorHex: '#3b82f6', // blue-500
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800/70',
    barClass: 'bg-blue-500',
    examples: ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'CRM', 'ORCL', 'NFLX'],
  },
  'Mechanics, Automotive & Industrials': {
    category: 'Mechanics, Automotive & Industrials',
    shortLabel: 'Mechanics & Auto',
    description: 'Heavy machinery, robotics, automotive & EV manufacturing, aerospace, defense, logistics, and construction.',
    colorHex: '#f59e0b', // amber-500
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800/70',
    barClass: 'bg-amber-500',
    examples: ['TSLA', 'CAT', 'DE', 'GE', 'HON', 'BA', 'LMT', 'TM', 'F'],
  },
  'Banking & Financials': {
    category: 'Banking & Financials',
    shortLabel: 'Banking & Finance',
    description: 'Commercial & investment banks, global payment networks, insurance, asset managers, and fintech.',
    colorHex: '#10b981', // emerald-500
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800/70',
    barClass: 'bg-emerald-500',
    examples: ['JPM', 'V', 'MA', 'BAC', 'GS', 'MS', 'BRK-B', 'BLK', 'COIN'],
  },
  'Consumer & Retail': {
    category: 'Consumer & Retail',
    shortLabel: 'Consumer & Retail',
    description: 'Global retail chains, e-commerce marketplaces, food & beverage leaders, apparel, travel, and entertainment.',
    colorHex: '#ec4899', // pink-500
    badgeBg: 'bg-pink-50 dark:bg-pink-950/60',
    badgeText: 'text-pink-700 dark:text-pink-300',
    badgeBorder: 'border-pink-200 dark:border-pink-800/70',
    barClass: 'bg-pink-500',
    examples: ['WMT', 'COST', 'KO', 'PEP', 'MCD', 'NKE', 'DIS', 'SBUX', 'HD'],
  },
  'Healthcare & Biotech': {
    category: 'Healthcare & Biotech',
    shortLabel: 'Healthcare & Bio',
    description: 'Pharmaceutical innovators, biotechnology, medical devices, surgical robotics, and healthcare networks.',
    colorHex: '#14b8a6', // teal-500
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60',
    badgeText: 'text-teal-700 dark:text-teal-300',
    badgeBorder: 'border-teal-200 dark:border-teal-800/70',
    barClass: 'bg-teal-500',
    examples: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'NVO', 'ISRG', 'PFE', 'TMO'],
  },
  'Energy, Utilities & Real Estate': {
    category: 'Energy, Utilities & Real Estate',
    shortLabel: 'Energy & REITs',
    description: 'Oil & gas majors, renewable power utilities, REITs, data center real estate, mining, and telecom infrastructure.',
    colorHex: '#f97316', // orange-500
    badgeBg: 'bg-orange-50 dark:bg-orange-950/60',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-200 dark:border-orange-800/70',
    barClass: 'bg-orange-500',
    examples: ['XOM', 'CVX', 'O', 'NEE', 'PLD', 'AMT', 'SHEL', 'VZ', 'T'],
  },
  'Index & Dividend ETFs': {
    category: 'Index & Dividend ETFs',
    shortLabel: 'Index & ETFs',
    description: 'Broad S&P 500, Nasdaq-100, dividend growth, sector-specific, treasury, and global equity ETFs.',
    colorHex: '#8b5cf6', // violet-500
    badgeBg: 'bg-violet-50 dark:bg-violet-950/60',
    badgeText: 'text-violet-700 dark:text-violet-300',
    badgeBorder: 'border-violet-200 dark:border-violet-800/70',
    barClass: 'bg-violet-500',
    examples: ['VOO', 'SPY', 'QQQ', 'SCHD', 'VTI', 'JEPI', 'VYM', 'IWM'],
  },
};

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

/**
 * Known Spot Cryptocurrencies so we never confuse Spot Crypto with US/Funding Stocks.
 */
export const KNOWN_CRYPTO_TICKERS = new Set<string>([
  'BTC',
  'ETH',
  'BNB',
  'SOL',
  'XRP',
  'ADA',
  'DOGE',
  'DOT',
  'AVAX',
  'SHIB',
  'LINK',
  'TON',
  'SUI',
  'NEAR',
  'APT',
  'UNI',
  'PEPE',
  'ICP',
  'LTC',
  'BCH',
  'MATIC',
  'POL',
  'ARB',
  'OP',
  'FET',
  'RENDER',
  'RNDR',
  'TAO',
  'WLD',
  'INJ',
  'AAVE',
  'MKR',
  'LDO',
  'ATOM',
  'TRX',
  'XLM',
  'ALGO',
  'FIL',
  'HBAR',
  'VET',
  'SAND',
  'MANA',
  'AXS',
  'GALA',
  'BONK',
  'WIF',
  'FLOKI',
  'JUP',
  'PYTH',
  'PENDLE',
  'RUNE',
  'STRK',
  'IMX',
  'SEI',
  'TIA',
  'ENA',
  'ETHFI',
  'ONDO',
  'EIGEN',
  'ZK',
  'ZRO',
  'NOT',
  'IO',
  'LISTA',
  'BANANA',
  'RENDER',
  'GRT',
  'THETA',
  'FTM',
  'S',
  'EOS',
  'XTZ',
  'FLOW',
  'NEO',
  'KAVA',
  'CHZ',
  'CRV',
  'COMP',
  'SNX',
  '1INCH',
  'ENS',
  'CAKE',
  'TWT',
  'JASMY',
  'ORDI',
  'SATS',
  'KAS',
  'STX',
  'MINA',
  'ROSE',
  'ZIL',
  'IOTA',
  'QTUM',
  'ZEC',
  'DASH',
  'ETC',
  'BTT',
  'WIN',
  'HOT',
  'CELO',
  'ANKR',
  'GMT',
  'APE',
  'BLUR',
  'MEME',
  'DYDX',
  'GMX',
  'WOO',
  'RAY',
  'ORCA',
  'TRUMP',
  'MELANIA',
  'PNUT',
  'ACT',
  'VIRTUAL',
  'AIXBT',
  'PENGU',
  'BERA',
  'KAITO',
  'IP',
]);

export const KNOWN_STABLECOIN_AND_FIAT_TICKERS = new Set<string>([
  'USDT',
  'USDC',
  'FDUSD',
  'BUSD',
  'DAI',
  'TUSD',
  'USDP',
  'USDE',
  'PYUSD',
  'USDD',
  'FRAX',
  'LUSD',
  'GUSD',
  'EUR',
  'AEUR',
  'EURC',
  'EURT',
  'USD',
  'MAD',
  'GBP',
  'TRY',
  'BRL',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
]);

/**
 * Comprehensive mapping of 850+ US Stocks (S&P 500, Nasdaq-100, Dow 30, Russell 1000),
 * Global ADRs, Tokenized Equities (Binance / Ondo / Backed / Dinari / Swarm), ETFs,
 * and Casablanca Stock Exchange (BVC) equities to the 8 canonical Stock Sector Categories.
 */
export const TICKER_TO_STOCK_SECTOR: Record<string, StockSectorCategory> = {
  // ===========================================================================
  // 1. AI & SEMICONDUCTORS (Chips, GPUs, Foundries, EDA, AI Infrastructure, Quantum)
  // ===========================================================================
  NVDA: 'AI & Semiconductors',
  AMD: 'AI & Semiconductors',
  AVGO: 'AI & Semiconductors',
  TSM: 'AI & Semiconductors',
  TSMC: 'AI & Semiconductors',
  ASML: 'AI & Semiconductors',
  INTC: 'AI & Semiconductors',
  ARM: 'AI & Semiconductors',
  QCOM: 'AI & Semiconductors',
  TXN: 'AI & Semiconductors',
  MU: 'AI & Semiconductors',
  ADI: 'AI & Semiconductors',
  NXPI: 'AI & Semiconductors',
  MRVL: 'AI & Semiconductors',
  MCHP: 'AI & Semiconductors',
  ON: 'AI & Semiconductors',
  MPWR: 'AI & Semiconductors',
  SWKS: 'AI & Semiconductors',
  QRVO: 'AI & Semiconductors',
  STM: 'AI & Semiconductors',
  UMC: 'AI & Semiconductors',
  GFS: 'AI & Semiconductors',
  WOLF: 'AI & Semiconductors',
  SLAB: 'AI & Semiconductors',
  SYNA: 'AI & Semiconductors',
  CRUS: 'AI & Semiconductors',
  LSCC: 'AI & Semiconductors',
  RMBS: 'AI & Semiconductors',
  ALGM: 'AI & Semiconductors',
  AMBA: 'AI & Semiconductors',
  SITM: 'AI & Semiconductors',
  NVMI: 'AI & Semiconductors',
  CAMT: 'AI & Semiconductors',
  ONTO: 'AI & Semiconductors',
  ACLS: 'AI & Semiconductors',
  COHR: 'AI & Semiconductors',
  LITE: 'AI & Semiconductors',
  FN: 'AI & Semiconductors',
  AMAT: 'AI & Semiconductors',
  LRCX: 'AI & Semiconductors',
  KLAC: 'AI & Semiconductors',
  TER: 'AI & Semiconductors',
  ENTG: 'AI & Semiconductors',
  MKSI: 'AI & Semiconductors',
  ASX: 'AI & Semiconductors',
  SNPS: 'AI & Semiconductors',
  CDNS: 'AI & Semiconductors',
  ANSS: 'AI & Semiconductors',
  SMCI: 'AI & Semiconductors',
  DELL: 'AI & Semiconductors',
  HPE: 'AI & Semiconductors',
  VRT: 'AI & Semiconductors',
  ANET: 'AI & Semiconductors',
  PLTR: 'AI & Semiconductors',
  AI: 'AI & Semiconductors',
  SOUN: 'AI & Semiconductors',
  BBAI: 'AI & Semiconductors',
  PATH: 'AI & Semiconductors',
  IOT: 'AI & Semiconductors',
  SYM: 'AI & Semiconductors',
  CGNX: 'AI & Semiconductors',
  IONQ: 'AI & Semiconductors',
  RGTI: 'AI & Semiconductors',
  QBTS: 'AI & Semiconductors',
  QUBT: 'AI & Semiconductors',
  ARQQ: 'AI & Semiconductors',
  CORZ: 'AI & Semiconductors',
  IREN: 'AI & Semiconductors',
  APLD: 'AI & Semiconductors',
  NBIS: 'AI & Semiconductors',
  CRWV: 'AI & Semiconductors',
  ALAB: 'AI & Semiconductors',
  CRDO: 'AI & Semiconductors',
  MTSI: 'AI & Semiconductors',
  DIOD: 'AI & Semiconductors',
  POWI: 'AI & Semiconductors',
  SMTC: 'AI & Semiconductors',
  VSH: 'AI & Semiconductors',
  SANM: 'AI & Semiconductors',
  JBL: 'AI & Semiconductors',
  FLEX: 'AI & Semiconductors',
  CLS: 'AI & Semiconductors',

  // ===========================================================================
  // 2. TECHNOLOGY & CLOUD (Hyperscalers, SaaS, Cybersecurity, Enterprise IT, Internet)
  // ===========================================================================
  AAPL: 'Technology & Cloud',
  MSFT: 'Technology & Cloud',
  GOOGL: 'Technology & Cloud',
  GOOG: 'Technology & Cloud',
  AMZN: 'Technology & Cloud',
  META: 'Technology & Cloud',
  NFLX: 'Technology & Cloud',
  CRM: 'Technology & Cloud',
  ORCL: 'Technology & Cloud',
  SAP: 'Technology & Cloud',
  ADBE: 'Technology & Cloud',
  IBM: 'Technology & Cloud',
  CSCO: 'Technology & Cloud',
  NOW: 'Technology & Cloud',
  INTU: 'Technology & Cloud',
  SNOW: 'Technology & Cloud',
  PANW: 'Technology & Cloud',
  CRWD: 'Technology & Cloud',
  FTNT: 'Technology & Cloud',
  ZS: 'Technology & Cloud',
  NET: 'Technology & Cloud',
  OKTA: 'Technology & Cloud',
  CYBR: 'Technology & Cloud',
  TENB: 'Technology & Cloud',
  QLYS: 'Technology & Cloud',
  VRNS: 'Technology & Cloud',
  GEN: 'Technology & Cloud',
  CHKP: 'Technology & Cloud',
  DDOG: 'Technology & Cloud',
  MDB: 'Technology & Cloud',
  TEAM: 'Technology & Cloud',
  WDAY: 'Technology & Cloud',
  HUBS: 'Technology & Cloud',
  VEEV: 'Technology & Cloud',
  TTD: 'Technology & Cloud',
  APP: 'Technology & Cloud',
  U: 'Technology & Cloud',
  RBLX: 'Technology & Cloud',
  EA: 'Technology & Cloud',
  TTWO: 'Technology & Cloud',
  NTDOY: 'Technology & Cloud',
  SONY: 'Technology & Cloud',
  SPOT: 'Technology & Cloud',
  PINS: 'Technology & Cloud',
  SNAP: 'Technology & Cloud',
  RDDT: 'Technology & Cloud',
  MTCH: 'Technology & Cloud',
  BMBL: 'Technology & Cloud',
  IAC: 'Technology & Cloud',
  ZM: 'Technology & Cloud',
  DOCU: 'Technology & Cloud',
  TWLO: 'Technology & Cloud',
  DBX: 'Technology & Cloud',
  BOX: 'Technology & Cloud',
  ASAN: 'Technology & Cloud',
  MNDY: 'Technology & Cloud',
  GTLB: 'Technology & Cloud',
  CFLT: 'Technology & Cloud',
  ESTC: 'Technology & Cloud',
  DT: 'Technology & Cloud',
  NTAP: 'Technology & Cloud',
  PSTG: 'Technology & Cloud',
  WDC: 'Technology & Cloud',
  STX: 'Technology & Cloud',
  HPQ: 'Technology & Cloud',
  LOGI: 'Technology & Cloud',
  GRMN: 'Technology & Cloud',
  MSI: 'Technology & Cloud',
  JNPR: 'Technology & Cloud',
  FFIV: 'Technology & Cloud',
  AKAM: 'Technology & Cloud',
  GDDY: 'Technology & Cloud',
  WIX: 'Technology & Cloud',
  SQSP: 'Technology & Cloud',
  SHOP: 'Technology & Cloud',
  SE: 'Technology & Cloud',
  GRAB: 'Technology & Cloud',
  CPNG: 'Technology & Cloud',
  BIDU: 'Technology & Cloud',
  NTES: 'Technology & Cloud',
  TCEHY: 'Technology & Cloud',
  MSTR: 'Technology & Cloud',
  ACN: 'Technology & Cloud',
  CTSH: 'Technology & Cloud',
  INFY: 'Technology & Cloud',
  WIT: 'Technology & Cloud',
  EPAM: 'Technology & Cloud',
  GLOB: 'Technology & Cloud',
  IT: 'Technology & Cloud',
  GIB: 'Technology & Cloud',
  LDOS: 'Technology & Cloud',
  BAH: 'Technology & Cloud',
  CACI: 'Technology & Cloud',
  SAIC: 'Technology & Cloud',
  TYL: 'Technology & Cloud',
  FICO: 'Technology & Cloud',
  PTC: 'Technology & Cloud',
  ADSK: 'Technology & Cloud',
  BSY: 'Technology & Cloud',
  MANH: 'Technology & Cloud',
  GWRE: 'Technology & Cloud',
  PCOR: 'Technology & Cloud',
  PAYC: 'Technology & Cloud',
  PCTY: 'Technology & Cloud',
  DAY: 'Technology & Cloud',
  BILL: 'Technology & Cloud',
  FRSH: 'Technology & Cloud',
  KVYO: 'Technology & Cloud',
  DUOL: 'Technology & Cloud',
  PLTK: 'Technology & Cloud',
  // Casablanca BVC Technology
  HPS: 'Technology & Cloud',
  M2M: 'Technology & Cloud',
  DYT: 'Technology & Cloud',
  S2M: 'Technology & Cloud',
  INV: 'Technology & Cloud',
  DISWAY: 'Technology & Cloud',

  // ===========================================================================
  // 3. BANKING & FINANCIALS (Banks, Investment Banks, Cards/Payments, Insurance, Asset Mgmt)
  // ===========================================================================
  JPM: 'Banking & Financials',
  JPMORGAN: 'Banking & Financials',
  BAC: 'Banking & Financials',
  WFC: 'Banking & Financials',
  C: 'Banking & Financials',
  CITI: 'Banking & Financials',
  GS: 'Banking & Financials',
  MS: 'Banking & Financials',
  BLK: 'Banking & Financials',
  BX: 'Banking & Financials',
  KKR: 'Banking & Financials',
  APO: 'Banking & Financials',
  ARES: 'Banking & Financials',
  CG: 'Banking & Financials',
  BAM: 'Banking & Financials',
  BN: 'Banking & Financials',
  SCHW: 'Banking & Financials',
  IBKR: 'Banking & Financials',
  HOOD: 'Banking & Financials',
  COIN: 'Banking & Financials',
  V: 'Banking & Financials',
  VISA: 'Banking & Financials',
  MA: 'Banking & Financials',
  AXP: 'Banking & Financials',
  DFS: 'Banking & Financials',
  SYF: 'Banking & Financials',
  COF: 'Banking & Financials',
  PYPL: 'Banking & Financials',
  SQ: 'Banking & Financials',
  XYZ: 'Banking & Financials',
  AFRM: 'Banking & Financials',
  SOFI: 'Banking & Financials',
  NU: 'Banking & Financials',
  UPST: 'Banking & Financials',
  LC: 'Banking & Financials',
  TOST: 'Banking & Financials',
  FI: 'Banking & Financials',
  FIS: 'Banking & Financials',
  GPN: 'Banking & Financials',
  JKHY: 'Banking & Financials',
  'BRK-B': 'Banking & Financials',
  'BRK.B': 'Banking & Financials',
  'BRK-A': 'Banking & Financials',
  'BRK.A': 'Banking & Financials',
  BRKB: 'Banking & Financials',
  BRKA: 'Banking & Financials',
  BRK: 'Banking & Financials',
  CB: 'Banking & Financials',
  PGR: 'Banking & Financials',
  TRV: 'Banking & Financials',
  ALL: 'Banking & Financials',
  MET: 'Banking & Financials',
  PRU: 'Banking & Financials',
  AFL: 'Banking & Financials',
  AIG: 'Banking & Financials',
  HIG: 'Banking & Financials',
  CINF: 'Banking & Financials',
  WRB: 'Banking & Financials',
  ACGL: 'Banking & Financials',
  RNR: 'Banking & Financials',
  EG: 'Banking & Financials',
  L: 'Banking & Financials',
  GL: 'Banking & Financials',
  UNM: 'Banking & Financials',
  PFG: 'Banking & Financials',
  LNC: 'Banking & Financials',
  EQH: 'Banking & Financials',
  AJG: 'Banking & Financials',
  MMC: 'Banking & Financials',
  AON: 'Banking & Financials',
  WTW: 'Banking & Financials',
  BRO: 'Banking & Financials',
  ERIE: 'Banking & Financials',
  SPGI: 'Banking & Financials',
  MCO: 'Banking & Financials',
  MSCI: 'Banking & Financials',
  ICE: 'Banking & Financials',
  CME: 'Banking & Financials',
  NDAQ: 'Banking & Financials',
  CBOE: 'Banking & Financials',
  MKTX: 'Banking & Financials',
  TW: 'Banking & Financials',
  FDS: 'Banking & Financials',
  MORN: 'Banking & Financials',
  TROW: 'Banking & Financials',
  BEN: 'Banking & Financials',
  IVZ: 'Banking & Financials',
  STT: 'Banking & Financials',
  BK: 'Banking & Financials',
  NTRS: 'Banking & Financials',
  RJF: 'Banking & Financials',
  LPLA: 'Banking & Financials',
  SF: 'Banking & Financials',
  EVR: 'Banking & Financials',
  LAZ: 'Banking & Financials',
  HLI: 'Banking & Financials',
  PJT: 'Banking & Financials',
  JEF: 'Banking & Financials',
  PIPR: 'Banking & Financials',
  USB: 'Banking & Financials',
  PNC: 'Banking & Financials',
  TFC: 'Banking & Financials',
  FITB: 'Banking & Financials',
  MTB: 'Banking & Financials',
  HBAN: 'Banking & Financials',
  RF: 'Banking & Financials',
  CFG: 'Banking & Financials',
  KEY: 'Banking & Financials',
  ZION: 'Banking & Financials',
  CMA: 'Banking & Financials',
  ALLY: 'Banking & Financials',
  EWBC: 'Banking & Financials',
  WAL: 'Banking & Financials',
  FHN: 'Banking & Financials',
  SNV: 'Banking & Financials',
  VLY: 'Banking & Financials',
  WTFC: 'Banking & Financials',
  CFR: 'Banking & Financials',
  BOKF: 'Banking & Financials',
  PB: 'Banking & Financials',
  SSB: 'Banking & Financials',
  ONB: 'Banking & Financials',
  FNB: 'Banking & Financials',
  CBSH: 'Banking & Financials',
  HSBC: 'Banking & Financials',
  RY: 'Banking & Financials',
  TD: 'Banking & Financials',
  BMO: 'Banking & Financials',
  BNS: 'Banking & Financials',
  CM: 'Banking & Financials',
  MFC: 'Banking & Financials',
  SLF: 'Banking & Financials',
  UBS: 'Banking & Financials',
  DB: 'Banking & Financials',
  ING: 'Banking & Financials',
  SAN: 'Banking & Financials',
  BBVA: 'Banking & Financials',
  BCS: 'Banking & Financials',
  LYG: 'Banking & Financials',
  NWG: 'Banking & Financials',
  BNP: 'Banking & Financials',
  SMFG: 'Banking & Financials',
  MUFG: 'Banking & Financials',
  MFG: 'Banking & Financials',
  IX: 'Banking & Financials',
  ITUB: 'Banking & Financials',
  BBD: 'Banking & Financials',
  BSBR: 'Banking & Financials',
  BAP: 'Banking & Financials',
  HDB: 'Banking & Financials',
  IBN: 'Banking & Financials',
  KB: 'Banking & Financials',
  SHG: 'Banking & Financials',
  // Casablanca BVC Banking & Insurance
  ATW: 'Banking & Financials',
  BCP: 'Banking & Financials',
  BOA: 'Banking & Financials',
  CIH: 'Banking & Financials',
  CDM: 'Banking & Financials',
  BMCI: 'Banking & Financials',
  WAA: 'Banking & Financials',
  SAH: 'Banking & Financials',
  ATL: 'Banking & Financials',
  AFMA: 'Banking & Financials',
  AGMA: 'Banking & Financials',
  EQD: 'Banking & Financials',
  MAG: 'Banking & Financials',
  SLM: 'Banking & Financials',

  // ===========================================================================
  // 4. MECHANICS, AUTOMOTIVE & INDUSTRIALS (Machinery, EVs/Auto, Aerospace, Defense, Transport)
  // ===========================================================================
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
  HII: 'Mechanics, Automotive & Industrials',
  TDG: 'Mechanics, Automotive & Industrials',
  HEI: 'Mechanics, Automotive & Industrials',
  HWM: 'Mechanics, Automotive & Industrials',
  TXT: 'Mechanics, Automotive & Industrials',
  CW: 'Mechanics, Automotive & Industrials',
  BWXT: 'Mechanics, Automotive & Industrials',
  WOOD: 'Mechanics, Automotive & Industrials',
  AXON: 'Mechanics, Automotive & Industrials',
  LDOS_IND: 'Mechanics, Automotive & Industrials',
  RKLB: 'Mechanics, Automotive & Industrials',
  ASTS: 'Mechanics, Automotive & Industrials',
  LUNR: 'Mechanics, Automotive & Industrials',
  SPCE: 'Mechanics, Automotive & Industrials',
  ACHR: 'Mechanics, Automotive & Industrials',
  JOBY: 'Mechanics, Automotive & Industrials',
  UNP: 'Mechanics, Automotive & Industrials',
  CSX: 'Mechanics, Automotive & Industrials',
  NSC: 'Mechanics, Automotive & Industrials',
  CP: 'Mechanics, Automotive & Industrials',
  CNI: 'Mechanics, Automotive & Industrials',
  WAB: 'Mechanics, Automotive & Industrials',
  UPS: 'Mechanics, Automotive & Industrials',
  FDX: 'Mechanics, Automotive & Industrials',
  JBHT: 'Mechanics, Automotive & Industrials',
  ODFL: 'Mechanics, Automotive & Industrials',
  XPO: 'Mechanics, Automotive & Industrials',
  SAIA: 'Mechanics, Automotive & Industrials',
  KNX: 'Mechanics, Automotive & Industrials',
  LSTR: 'Mechanics, Automotive & Industrials',
  CHRW: 'Mechanics, Automotive & Industrials',
  EXPD: 'Mechanics, Automotive & Industrials',
  GXO: 'Mechanics, Automotive & Industrials',
  R: 'Mechanics, Automotive & Industrials',
  UHAL: 'Mechanics, Automotive & Industrials',
  DAL: 'Mechanics, Automotive & Industrials',
  UAL: 'Mechanics, Automotive & Industrials',
  AAL: 'Mechanics, Automotive & Industrials',
  LUV: 'Mechanics, Automotive & Industrials',
  ALK: 'Mechanics, Automotive & Industrials',
  JBLU: 'Mechanics, Automotive & Industrials',
  RYAAY: 'Mechanics, Automotive & Industrials',
  CPA: 'Mechanics, Automotive & Industrials',
  UBER: 'Mechanics, Automotive & Industrials',
  LYFT: 'Mechanics, Automotive & Industrials',
  F: 'Mechanics, Automotive & Industrials',
  GM: 'Mechanics, Automotive & Industrials',
  TM: 'Mechanics, Automotive & Industrials',
  HMC: 'Mechanics, Automotive & Industrials',
  STLA: 'Mechanics, Automotive & Industrials',
  RACE: 'Mechanics, Automotive & Industrials',
  VWAGY: 'Mechanics, Automotive & Industrials',
  MBGYY: 'Mechanics, Automotive & Industrials',
  BMWYY: 'Mechanics, Automotive & Industrials',
  POAHY: 'Mechanics, Automotive & Industrials',
  BYD: 'Mechanics, Automotive & Industrials',
  BYDDY: 'Mechanics, Automotive & Industrials',
  RIVN: 'Mechanics, Automotive & Industrials',
  LCID: 'Mechanics, Automotive & Industrials',
  NIO: 'Mechanics, Automotive & Industrials',
  XPEV: 'Mechanics, Automotive & Industrials',
  LI: 'Mechanics, Automotive & Industrials',
  VFS: 'Mechanics, Automotive & Industrials',
  PSNY: 'Mechanics, Automotive & Industrials',
  HOG: 'Mechanics, Automotive & Industrials',
  PII: 'Mechanics, Automotive & Industrials',
  THO: 'Mechanics, Automotive & Industrials',
  WGO: 'Mechanics, Automotive & Industrials',
  BC: 'Mechanics, Automotive & Industrials',
  APTV: 'Mechanics, Automotive & Industrials',
  BWA: 'Mechanics, Automotive & Industrials',
  LEA: 'Mechanics, Automotive & Industrials',
  ALV: 'Mechanics, Automotive & Industrials',
  MGA: 'Mechanics, Automotive & Industrials',
  GNTX: 'Mechanics, Automotive & Industrials',
  GT: 'Mechanics, Automotive & Industrials',
  LAZR: 'Mechanics, Automotive & Industrials',
  MBLY: 'Mechanics, Automotive & Industrials',
  MMM: 'Mechanics, Automotive & Industrials',
  ETN: 'Mechanics, Automotive & Industrials',
  EMR: 'Mechanics, Automotive & Industrials',
  ITW: 'Mechanics, Automotive & Industrials',
  PH: 'Mechanics, Automotive & Industrials',
  ROK: 'Mechanics, Automotive & Industrials',
  CMI: 'Mechanics, Automotive & Industrials',
  PCAR: 'Mechanics, Automotive & Industrials',
  OSK: 'Mechanics, Automotive & Industrials',
  AGCO: 'Mechanics, Automotive & Industrials',
  CNH: 'Mechanics, Automotive & Industrials',
  TTC: 'Mechanics, Automotive & Industrials',
  SWK: 'Mechanics, Automotive & Industrials',
  SNA: 'Mechanics, Automotive & Industrials',
  LECO: 'Mechanics, Automotive & Industrials',
  IR: 'Mechanics, Automotive & Industrials',
  DOV: 'Mechanics, Automotive & Industrials',
  XYL: 'Mechanics, Automotive & Industrials',
  IEX: 'Mechanics, Automotive & Industrials',
  FTV: 'Mechanics, Automotive & Industrials',
  AME: 'Mechanics, Automotive & Industrials',
  NDSN: 'Mechanics, Automotive & Industrials',
  GGG: 'Mechanics, Automotive & Industrials',
  PNR: 'Mechanics, Automotive & Industrials',
  FLS: 'Mechanics, Automotive & Industrials',
  ITT: 'Mechanics, Automotive & Industrials',
  CR: 'Mechanics, Automotive & Industrials',
  RBC: 'Mechanics, Automotive & Industrials',
  RRX: 'Mechanics, Automotive & Industrials',
  TKR: 'Mechanics, Automotive & Industrials',
  OTIS: 'Mechanics, Automotive & Industrials',
  CARR: 'Mechanics, Automotive & Industrials',
  TT: 'Mechanics, Automotive & Industrials',
  JCI: 'Mechanics, Automotive & Industrials',
  LII: 'Mechanics, Automotive & Industrials',
  WSO: 'Mechanics, Automotive & Industrials',
  MAS: 'Mechanics, Automotive & Industrials',
  BLDR: 'Mechanics, Automotive & Industrials',
  OC: 'Mechanics, Automotive & Industrials',
  FBIN: 'Mechanics, Automotive & Industrials',
  AOS: 'Mechanics, Automotive & Industrials',
  AAON: 'Mechanics, Automotive & Industrials',
  FAST: 'Mechanics, Automotive & Industrials',
  GWW: 'Mechanics, Automotive & Industrials',
  URI: 'Mechanics, Automotive & Industrials',
  WSC: 'Mechanics, Automotive & Industrials',
  HRI: 'Mechanics, Automotive & Industrials',
  PWR: 'Mechanics, Automotive & Industrials',
  EME: 'Mechanics, Automotive & Industrials',
  FIX: 'Mechanics, Automotive & Industrials',
  MTZ: 'Mechanics, Automotive & Industrials',
  J: 'Mechanics, Automotive & Industrials',
  ACM: 'Mechanics, Automotive & Industrials',
  FLR: 'Mechanics, Automotive & Industrials',
  KBR: 'Mechanics, Automotive & Industrials',
  STRL: 'Mechanics, Automotive & Industrials',
  DY: 'Mechanics, Automotive & Industrials',
  VMC: 'Mechanics, Automotive & Industrials',
  MLM: 'Mechanics, Automotive & Industrials',
  CRH: 'Mechanics, Automotive & Industrials',
  EXP: 'Mechanics, Automotive & Industrials',
  SUM: 'Mechanics, Automotive & Industrials',
  SHW: 'Mechanics, Automotive & Industrials',
  PPG: 'Mechanics, Automotive & Industrials',
  AXTA: 'Mechanics, Automotive & Industrials',
  RPM: 'Mechanics, Automotive & Industrials',
  NUE: 'Mechanics, Automotive & Industrials',
  STLD: 'Mechanics, Automotive & Industrials',
  CLF: 'Mechanics, Automotive & Industrials',
  RS: 'Mechanics, Automotive & Industrials',
  X: 'Mechanics, Automotive & Industrials',
  CMC: 'Mechanics, Automotive & Industrials',
  AA: 'Mechanics, Automotive & Industrials',
  ATI: 'Mechanics, Automotive & Industrials',
  CRS: 'Mechanics, Automotive & Industrials',
  WM: 'Mechanics, Automotive & Industrials',
  RSG: 'Mechanics, Automotive & Industrials',
  WCN: 'Mechanics, Automotive & Industrials',
  CLH: 'Mechanics, Automotive & Industrials',
  SRCL: 'Mechanics, Automotive & Industrials',
  VRSK: 'Mechanics, Automotive & Industrials',
  CPRT: 'Mechanics, Automotive & Industrials',
  CTAS: 'Mechanics, Automotive & Industrials',
  ADP: 'Mechanics, Automotive & Industrials',
  PAYX: 'Mechanics, Automotive & Industrials',
  EFX: 'Mechanics, Automotive & Industrials',
  TRU: 'Mechanics, Automotive & Industrials',
  BR: 'Mechanics, Automotive & Industrials',
  ROL: 'Mechanics, Automotive & Industrials',
  ALLE: 'Mechanics, Automotive & Industrials',
  GNRC: 'Mechanics, Automotive & Industrials',
  HUBB: 'Mechanics, Automotive & Industrials',
  NVT: 'Mechanics, Automotive & Industrials',
  AYI: 'Mechanics, Automotive & Industrials',
  ABB: 'Mechanics, Automotive & Industrials',
  SIEGY: 'Mechanics, Automotive & Industrials',
  EADSY: 'Mechanics, Automotive & Industrials',
  SAFRY: 'Mechanics, Automotive & Industrials',
  RYCEY: 'Mechanics, Automotive & Industrials',
  BAESY: 'Mechanics, Automotive & Industrials',
  // Casablanca BVC Mechanics, Construction, Automotive & Industrials
  TGCC: 'Mechanics, Automotive & Industrials',
  LHM: 'Mechanics, Automotive & Industrials',
  MSA: 'Mechanics, Automotive & Industrials',
  SID: 'Mechanics, Automotive & Industrials',
  CMT: 'Mechanics, Automotive & Industrials',
  JET: 'Mechanics, Automotive & Industrials',
  SNP: 'Mechanics, Automotive & Industrials',
  ALM: 'Mechanics, Automotive & Industrials',
  COL: 'Mechanics, Automotive & Industrials',
  CTM: 'Mechanics, Automotive & Industrials',
  TIM: 'Mechanics, Automotive & Industrials',
  AFI: 'Mechanics, Automotive & Industrials',
  DRI: 'Mechanics, Automotive & Industrials',
  STR: 'Mechanics, Automotive & Industrials',
  AUTOHALL: 'Mechanics, Automotive & Industrials',
  ATH: 'Mechanics, Automotive & Industrials',
  NKL: 'Mechanics, Automotive & Industrials',

  // ===========================================================================
  // 5. CONSUMER & RETAIL (Retail, Food & Beverage, Apparel, Restaurants, Travel, Media)
  // ===========================================================================
  WMT: 'Consumer & Retail',
  COST: 'Consumer & Retail',
  TGT: 'Consumer & Retail',
  BJ: 'Consumer & Retail',
  DG: 'Consumer & Retail',
  DLTR: 'Consumer & Retail',
  FIVE: 'Consumer & Retail',
  OLLI: 'Consumer & Retail',
  PSM: 'Consumer & Retail',
  HD: 'Consumer & Retail',
  LOW: 'Consumer & Retail',
  TSCO: 'Consumer & Retail',
  FND: 'Consumer & Retail',
  WSM: 'Consumer & Retail',
  RH: 'Consumer & Retail',
  W: 'Consumer & Retail',
  ORLY: 'Consumer & Retail',
  AZO: 'Consumer & Retail',
  AAP: 'Consumer & Retail',
  GPC: 'Consumer & Retail',
  LKQ: 'Consumer & Retail',
  KMX: 'Consumer & Retail',
  AN: 'Consumer & Retail',
  PAG: 'Consumer & Retail',
  LAD: 'Consumer & Retail',
  ABG: 'Consumer & Retail',
  SAH_US: 'Consumer & Retail',
  CVNA: 'Consumer & Retail',
  MCD: 'Consumer & Retail',
  SBUX: 'Consumer & Retail',
  CMG: 'Consumer & Retail',
  YUM: 'Consumer & Retail',
  QSR: 'Consumer & Retail',
  DPZ: 'Consumer & Retail',
  WEN: 'Consumer & Retail',
  PZZA: 'Consumer & Retail',
  JACK: 'Consumer & Retail',
  SHAK: 'Consumer & Retail',
  WING: 'Consumer & Retail',
  CAVA: 'Consumer & Retail',
  SG: 'Consumer & Retail',
  BROS: 'Consumer & Retail',
  DRI_US: 'Consumer & Retail',
  TXRH: 'Consumer & Retail',
  EAT: 'Consumer & Retail',
  BLMN: 'Consumer & Retail',
  CAKE_US: 'Consumer & Retail',
  DASH: 'Consumer & Retail',
  CART: 'Consumer & Retail',
  KO: 'Consumer & Retail',
  PEP: 'Consumer & Retail',
  MNST: 'Consumer & Retail',
  CELH: 'Consumer & Retail',
  KDP: 'Consumer & Retail',
  COKE: 'Consumer & Retail',
  STZ: 'Consumer & Retail',
  TAP: 'Consumer & Retail',
  BUD: 'Consumer & Retail',
  DEO: 'Consumer & Retail',
  SAM: 'Consumer & Retail',
  'BF-B': 'Consumer & Retail',
  'BF.B': 'Consumer & Retail',
  'BF-A': 'Consumer & Retail',
  BFB: 'Consumer & Retail',
  PG: 'Consumer & Retail',
  CL: 'Consumer & Retail',
  KMB: 'Consumer & Retail',
  CHD: 'Consumer & Retail',
  CLX: 'Consumer & Retail',
  NWL: 'Consumer & Retail',
  EL: 'Consumer & Retail',
  ULTA: 'Consumer & Retail',
  COTY: 'Consumer & Retail',
  ELF: 'Consumer & Retail',
  KVUE: 'Consumer & Retail',
  NKE: 'Consumer & Retail',
  LULU: 'Consumer & Retail',
  ONON: 'Consumer & Retail',
  DECK: 'Consumer & Retail',
  CROX: 'Consumer & Retail',
  SKX: 'Consumer & Retail',
  UAA: 'Consumer & Retail',
  UA: 'Consumer & Retail',
  ADDYY: 'Consumer & Retail',
  VFC: 'Consumer & Retail',
  RL: 'Consumer & Retail',
  PVH: 'Consumer & Retail',
  HBI: 'Consumer & Retail',
  LEVI: 'Consumer & Retail',
  COLM: 'Consumer & Retail',
  GOOS: 'Consumer & Retail',
  TPR: 'Consumer & Retail',
  CPRI: 'Consumer & Retail',
  LVMUY: 'Consumer & Retail',
  HESAY: 'Consumer & Retail',
  PPRUY: 'Consumer & Retail',
  CFRUY: 'Consumer & Retail',
  BURBY: 'Consumer & Retail',
  TJX: 'Consumer & Retail',
  ROST: 'Consumer & Retail',
  BURL: 'Consumer & Retail',
  M: 'Consumer & Retail',
  KSS: 'Consumer & Retail',
  JWN: 'Consumer & Retail',
  DDS: 'Consumer & Retail',
  GAP: 'Consumer & Retail',
  GPS: 'Consumer & Retail',
  ANF: 'Consumer & Retail',
  AEO: 'Consumer & Retail',
  URBN: 'Consumer & Retail',
  BBY: 'Consumer & Retail',
  GME: 'Consumer & Retail',
  DKS: 'Consumer & Retail',
  ASO: 'Consumer & Retail',
  ULTA_RET: 'Consumer & Retail',
  CHWY: 'Consumer & Retail',
  ETSY: 'Consumer & Retail',
  EBAY: 'Consumer & Retail',
  PM: 'Consumer & Retail',
  MO: 'Consumer & Retail',
  BTI: 'Consumer & Retail',
  IMBBY: 'Consumer & Retail',
  GIS: 'Consumer & Retail',
  K: 'Consumer & Retail',
  KLG: 'Consumer & Retail',
  KHC: 'Consumer & Retail',
  MDLZ: 'Consumer & Retail',
  HSY: 'Consumer & Retail',
  CPB: 'Consumer & Retail',
  CAG: 'Consumer & Retail',
  SJM: 'Consumer & Retail',
  HRL: 'Consumer & Retail',
  TSN: 'Consumer & Retail',
  PPC: 'Consumer & Retail',
  CALM: 'Consumer & Retail',
  MKC: 'Consumer & Retail',
  LW: 'Consumer & Retail',
  POST: 'Consumer & Retail',
  FLO: 'Consumer & Retail',
  INGR: 'Consumer & Retail',
  BG: 'Consumer & Retail',
  ADM: 'Consumer & Retail',
  DAR: 'Consumer & Retail',
  KR: 'Consumer & Retail',
  ACI: 'Consumer & Retail',
  SFM: 'Consumer & Retail',
  CASY: 'Consumer & Retail',
  SYY: 'Consumer & Retail',
  USFD: 'Consumer & Retail',
  PFGC: 'Consumer & Retail',
  DIS: 'Consumer & Retail',
  WBD: 'Consumer & Retail',
  PARA: 'Consumer & Retail',
  FOX: 'Consumer & Retail',
  FOXA: 'Consumer & Retail',
  NWSA: 'Consumer & Retail',
  NYT: 'Consumer & Retail',
  LYV: 'Consumer & Retail',
  TKO: 'Consumer & Retail',
  EDR: 'Consumer & Retail',
  WMG: 'Consumer & Retail',
  MAT: 'Consumer & Retail',
  HAS: 'Consumer & Retail',
  POOL: 'Consumer & Retail',
  YETI: 'Consumer & Retail',
  SW: 'Consumer & Retail',
  PKG: 'Consumer & Retail',
  AVY: 'Consumer & Retail',
  BALL: 'Consumer & Retail',
  CCK: 'Consumer & Retail',
  AMCR: 'Consumer & Retail',
  ABNB: 'Consumer & Retail',
  BKNG: 'Consumer & Retail',
  EXPE: 'Consumer & Retail',
  TRIP: 'Consumer & Retail',
  MAR: 'Consumer & Retail',
  HLT: 'Consumer & Retail',
  H: 'Consumer & Retail',
  IHG: 'Consumer & Retail',
  WH: 'Consumer & Retail',
  CHH: 'Consumer & Retail',
  CCL: 'Consumer & Retail',
  RCL: 'Consumer & Retail',
  NCLH: 'Consumer & Retail',
  VIK: 'Consumer & Retail',
  LVS: 'Consumer & Retail',
  WYNN: 'Consumer & Retail',
  MGM: 'Consumer & Retail',
  CZR: 'Consumer & Retail',
  PENN: 'Consumer & Retail',
  DKNG: 'Consumer & Retail',
  FLUT: 'Consumer & Retail',
  BYD_CAS: 'Consumer & Retail',
  BABA: 'Consumer & Retail',
  JD: 'Consumer & Retail',
  PDD: 'Consumer & Retail',
  VIPS: 'Consumer & Retail',
  MNSO: 'Consumer & Retail',
  YUMC: 'Consumer & Retail',
  HTHT: 'Consumer & Retail',
  TCOM: 'Consumer & Retail',
  MELI: 'Consumer & Retail',
  DHI: 'Consumer & Retail',
  LEN: 'Consumer & Retail',
  PHM: 'Consumer & Retail',
  NVR: 'Consumer & Retail',
  TOL: 'Consumer & Retail',
  KBH: 'Consumer & Retail',
  TMHC: 'Consumer & Retail',
  MTH: 'Consumer & Retail',
  MHK: 'Consumer & Retail',
  WHR: 'Consumer & Retail',
  TPX: 'Consumer & Retail',
  // Casablanca BVC Consumer & Retail
  CSR: 'Consumer & Retail',
  LBV: 'Consumer & Retail',
  SBM: 'Consumer & Retail',
  LES: 'Consumer & Retail',
  OUL: 'Consumer & Retail',
  UMR: 'Consumer & Retail',
  MUT: 'Consumer & Retail',
  CDA: 'Consumer & Retail',
  DARI: 'Consumer & Retail',

  // ===========================================================================
  // 6. HEALTHCARE & BIOTECH (Pharma, Biotech, MedTech, Surgical Robotics, Health Insurers)
  // ===========================================================================
  LLY: 'Healthcare & Biotech',
  NVO: 'Healthcare & Biotech',
  UNH: 'Healthcare & Biotech',
  JNJ: 'Healthcare & Biotech',
  ABBV: 'Healthcare & Biotech',
  MRK: 'Healthcare & Biotech',
  PFE: 'Healthcare & Biotech',
  AZN: 'Healthcare & Biotech',
  NVS: 'Healthcare & Biotech',
  RHHBY: 'Healthcare & Biotech',
  SNY: 'Healthcare & Biotech',
  GSK: 'Healthcare & Biotech',
  TAK: 'Healthcare & Biotech',
  BMY: 'Healthcare & Biotech',
  AMGN: 'Healthcare & Biotech',
  GILD: 'Healthcare & Biotech',
  VRTX: 'Healthcare & Biotech',
  REGN: 'Healthcare & Biotech',
  BIIB: 'Healthcare & Biotech',
  ALNY: 'Healthcare & Biotech',
  BMRN: 'Healthcare & Biotech',
  INCY: 'Healthcare & Biotech',
  EXEL: 'Healthcare & Biotech',
  IONS: 'Healthcare & Biotech',
  SRPT: 'Healthcare & Biotech',
  NBIX: 'Healthcare & Biotech',
  UTHR: 'Healthcare & Biotech',
  HALO: 'Healthcare & Biotech',
  argx: 'Healthcare & Biotech',
  ARGX: 'Healthcare & Biotech',
  BGNE: 'Healthcare & Biotech',
  GMAB: 'Healthcare & Biotech',
  ROIV: 'Healthcare & Biotech',
  PCVX: 'Healthcare & Biotech',
  CYTK: 'Healthcare & Biotech',
  INSM: 'Healthcare & Biotech',
  VKTX: 'Healthcare & Biotech',
  MDGL: 'Healthcare & Biotech',
  MRNA: 'Healthcare & Biotech',
  BNTX: 'Healthcare & Biotech',
  NVAX: 'Healthcare & Biotech',
  CRSP: 'Healthcare & Biotech',
  NTLA: 'Healthcare & Biotech',
  BEAM: 'Healthcare & Biotech',
  PACB: 'Healthcare & Biotech',
  TWST: 'Healthcare & Biotech',
  TEVA: 'Healthcare & Biotech',
  VTRS: 'Healthcare & Biotech',
  CTLT: 'Healthcare & Biotech',
  ZTS: 'Healthcare & Biotech',
  ELAN: 'Healthcare & Biotech',
  IDXX: 'Healthcare & Biotech',
  TMO: 'Healthcare & Biotech',
  ABT: 'Healthcare & Biotech',
  DHR: 'Healthcare & Biotech',
  ISRG: 'Healthcare & Biotech',
  SYK: 'Healthcare & Biotech',
  BSX: 'Healthcare & Biotech',
  MDT: 'Healthcare & Biotech',
  EW: 'Healthcare & Biotech',
  ZBH: 'Healthcare & Biotech',
  BDX: 'Healthcare & Biotech',
  BAX: 'Healthcare & Biotech',
  GEHC: 'Healthcare & Biotech',
  PHG: 'Healthcare & Biotech',
  SHL: 'Healthcare & Biotech',
  ALC: 'Healthcare & Biotech',
  RMD: 'Healthcare & Biotech',
  DXCM: 'Healthcare & Biotech',
  PODD: 'Healthcare & Biotech',
  ALGN: 'Healthcare & Biotech',
  HOLX: 'Healthcare & Biotech',
  STE: 'Healthcare & Biotech',
  COO: 'Healthcare & Biotech',
  TFX: 'Healthcare & Biotech',
  PEN: 'Healthcare & Biotech',
  SWAV: 'Healthcare & Biotech',
  INSP: 'Healthcare & Biotech',
  GKOS: 'Healthcare & Biotech',
  MASI: 'Healthcare & Biotech',
  NVST: 'Healthcare & Biotech',
  XRAY: 'Healthcare & Biotech',
  HSIC: 'Healthcare & Biotech',
  WAT: 'Healthcare & Biotech',
  A: 'Healthcare & Biotech',
  MTD: 'Healthcare & Biotech',
  RVTY: 'Healthcare & Biotech',
  BIO: 'Healthcare & Biotech',
  BRKR: 'Healthcare & Biotech',
  TECH: 'Healthcare & Biotech', // Bio-Techne Corp is Healthcare & Biotech!
  ILMN: 'Healthcare & Biotech',
  EXAS: 'Healthcare & Biotech',
  GH: 'Healthcare & Biotech',
  NTRA: 'Healthcare & Biotech',
  IQV: 'Healthcare & Biotech',
  CRL: 'Healthcare & Biotech',
  ICLR: 'Healthcare & Biotech',
  MEDP: 'Healthcare & Biotech',
  DOCS: 'Healthcare & Biotech',
  TDOC: 'Healthcare & Biotech',
  HIMS: 'Healthcare & Biotech',
  CVS: 'Healthcare & Biotech',
  CI: 'Healthcare & Biotech',
  ELV: 'Healthcare & Biotech',
  HUM: 'Healthcare & Biotech',
  CNC: 'Healthcare & Biotech',
  MOH: 'Healthcare & Biotech',
  HCA: 'Healthcare & Biotech',
  UHS: 'Healthcare & Biotech',
  THC: 'Healthcare & Biotech',
  CYH: 'Healthcare & Biotech',
  ENSG: 'Healthcare & Biotech',
  DVA: 'Healthcare & Biotech',
  LH: 'Healthcare & Biotech',
  DGX: 'Healthcare & Biotech',
  MCK: 'Healthcare & Biotech',
  COR: 'Healthcare & Biotech',
  CAH: 'Healthcare & Biotech',
  WBA: 'Healthcare & Biotech',
  // Casablanca BVC Healthcare & Pharma
  AKD: 'Healthcare & Biotech',
  SOT: 'Healthcare & Biotech',
  PRO: 'Healthcare & Biotech',

  // ===========================================================================
  // 7. ENERGY, UTILITIES & REAL ESTATE (Oil & Gas, Renewables, Power, REITs, Mining, Telecom)
  // ===========================================================================
  XOM: 'Energy, Utilities & Real Estate',
  CVX: 'Energy, Utilities & Real Estate',
  SHEL: 'Energy, Utilities & Real Estate',
  TTE: 'Energy, Utilities & Real Estate',
  BP: 'Energy, Utilities & Real Estate',
  EQNR: 'Energy, Utilities & Real Estate',
  PBR: 'Energy, Utilities & Real Estate',
  EC: 'Energy, Utilities & Real Estate',
  E: 'Energy, Utilities & Real Estate',
  COP: 'Energy, Utilities & Real Estate',
  EOG: 'Energy, Utilities & Real Estate',
  OXY: 'Energy, Utilities & Real Estate',
  DVN: 'Energy, Utilities & Real Estate',
  FANG: 'Energy, Utilities & Real Estate',
  CTRA: 'Energy, Utilities & Real Estate',
  APA: 'Energy, Utilities & Real Estate',
  OVV: 'Energy, Utilities & Real Estate',
  PR: 'Energy, Utilities & Real Estate',
  MTDR: 'Energy, Utilities & Real Estate',
  CHRD: 'Energy, Utilities & Real Estate',
  MUR: 'Energy, Utilities & Real Estate',
  AR: 'Energy, Utilities & Real Estate',
  RRC: 'Energy, Utilities & Real Estate',
  EQT: 'Energy, Utilities & Real Estate',
  CHK: 'Energy, Utilities & Real Estate',
  EXE: 'Energy, Utilities & Real Estate',
  HES: 'Energy, Utilities & Real Estate',
  MRO: 'Energy, Utilities & Real Estate',
  SLB: 'Energy, Utilities & Real Estate',
  HAL: 'Energy, Utilities & Real Estate',
  BKR: 'Energy, Utilities & Real Estate',
  FTI: 'Energy, Utilities & Real Estate',
  NOV: 'Energy, Utilities & Real Estate',
  CHX: 'Energy, Utilities & Real Estate',
  WFRD: 'Energy, Utilities & Real Estate',
  RIG: 'Energy, Utilities & Real Estate',
  VAL: 'Energy, Utilities & Real Estate',
  NE: 'Energy, Utilities & Real Estate',
  MPC: 'Energy, Utilities & Real Estate',
  PSX: 'Energy, Utilities & Real Estate',
  VLO: 'Energy, Utilities & Real Estate',
  DINO: 'Energy, Utilities & Real Estate',
  PBF: 'Energy, Utilities & Real Estate',
  KMI: 'Energy, Utilities & Real Estate',
  WMB: 'Energy, Utilities & Real Estate',
  OKE: 'Energy, Utilities & Real Estate',
  EPD: 'Energy, Utilities & Real Estate',
  ET: 'Energy, Utilities & Real Estate',
  MPLX: 'Energy, Utilities & Real Estate',
  PAA: 'Energy, Utilities & Real Estate',
  TRGP: 'Energy, Utilities & Real Estate',
  WES: 'Energy, Utilities & Real Estate',
  LNG: 'Energy, Utilities & Real Estate',
  ENB: 'Energy, Utilities & Real Estate',
  TRP: 'Energy, Utilities & Real Estate',
  PBA: 'Energy, Utilities & Real Estate',
  SU: 'Energy, Utilities & Real Estate',
  CNQ: 'Energy, Utilities & Real Estate',
  CVE: 'Energy, Utilities & Real Estate',
  IMO: 'Energy, Utilities & Real Estate',
  CCJ: 'Energy, Utilities & Real Estate',
  UEC: 'Energy, Utilities & Real Estate',
  NXE: 'Energy, Utilities & Real Estate',
  DNN: 'Energy, Utilities & Real Estate',
  UUUU: 'Energy, Utilities & Real Estate',
  LEU: 'Energy, Utilities & Real Estate',
  SMR: 'Energy, Utilities & Real Estate',
  OKLO: 'Energy, Utilities & Real Estate',
  FSLR: 'Energy, Utilities & Real Estate',
  ENPH: 'Energy, Utilities & Real Estate',
  SEDG: 'Energy, Utilities & Real Estate',
  RUN: 'Energy, Utilities & Real Estate',
  NXT: 'Energy, Utilities & Real Estate',
  ARRY: 'Energy, Utilities & Real Estate',
  SHLS: 'Energy, Utilities & Real Estate',
  PLUG: 'Energy, Utilities & Real Estate',
  BE: 'Energy, Utilities & Real Estate',
  AES: 'Energy, Utilities & Real Estate',
  NEE: 'Energy, Utilities & Real Estate',
  SO: 'Energy, Utilities & Real Estate',
  DUK: 'Energy, Utilities & Real Estate',
  CEG: 'Energy, Utilities & Real Estate',
  VST: 'Energy, Utilities & Real Estate',
  NRG: 'Energy, Utilities & Real Estate',
  TLN: 'Energy, Utilities & Real Estate',
  AEP: 'Energy, Utilities & Real Estate',
  SRE: 'Energy, Utilities & Real Estate',
  D: 'Energy, Utilities & Real Estate',
  EXC: 'Energy, Utilities & Real Estate',
  XEL: 'Energy, Utilities & Real Estate',
  PEG: 'Energy, Utilities & Real Estate',
  ED: 'Energy, Utilities & Real Estate',
  EIX: 'Energy, Utilities & Real Estate',
  PCG: 'Energy, Utilities & Real Estate',
  WEC: 'Energy, Utilities & Real Estate',
  ES: 'Energy, Utilities & Real Estate',
  AWK: 'Energy, Utilities & Real Estate',
  WTRG: 'Energy, Utilities & Real Estate',
  DTE: 'Energy, Utilities & Real Estate',
  PPL: 'Energy, Utilities & Real Estate',
  FE: 'Energy, Utilities & Real Estate',
  AEE: 'Energy, Utilities & Real Estate',
  CMS: 'Energy, Utilities & Real Estate',
  CNP: 'Energy, Utilities & Real Estate',
  NI: 'Energy, Utilities & Real Estate',
  EVRG: 'Energy, Utilities & Real Estate',
  LNT: 'Energy, Utilities & Real Estate',
  PNW: 'Energy, Utilities & Real Estate',
  ATO: 'Energy, Utilities & Real Estate',
  OGE: 'Energy, Utilities & Real Estate',
  BKH: 'Energy, Utilities & Real Estate',
  NGG: 'Energy, Utilities & Real Estate',
  BIP: 'Energy, Utilities & Real Estate',
  BEP: 'Energy, Utilities & Real Estate',
  // REITs & Real Estate
  O: 'Energy, Utilities & Real Estate',
  PLD: 'Energy, Utilities & Real Estate',
  AMT: 'Energy, Utilities & Real Estate',
  CCI: 'Energy, Utilities & Real Estate',
  SBAC: 'Energy, Utilities & Real Estate',
  EQIX: 'Energy, Utilities & Real Estate',
  DLR: 'Energy, Utilities & Real Estate',
  IRM: 'Energy, Utilities & Real Estate',
  SPG: 'Energy, Utilities & Real Estate',
  VICI: 'Energy, Utilities & Real Estate',
  GLPI: 'Energy, Utilities & Real Estate',
  PSA: 'Energy, Utilities & Real Estate',
  EXR: 'Energy, Utilities & Real Estate',
  CUBE: 'Energy, Utilities & Real Estate',
  WELL: 'Energy, Utilities & Real Estate',
  VTR: 'Energy, Utilities & Real Estate',
  DOC: 'Energy, Utilities & Real Estate',
  OHI: 'Energy, Utilities & Real Estate',
  AVB: 'Energy, Utilities & Real Estate',
  EQR: 'Energy, Utilities & Real Estate',
  MAA: 'Energy, Utilities & Real Estate',
  ESS: 'Energy, Utilities & Real Estate',
  UDR: 'Energy, Utilities & Real Estate',
  CPT: 'Energy, Utilities & Real Estate',
  INVH: 'Energy, Utilities & Real Estate',
  AMH: 'Energy, Utilities & Real Estate',
  SUI_REIT: 'Energy, Utilities & Real Estate',
  ELS: 'Energy, Utilities & Real Estate',
  BXP: 'Energy, Utilities & Real Estate',
  ARE: 'Energy, Utilities & Real Estate',
  KIM: 'Energy, Utilities & Real Estate',
  REG: 'Energy, Utilities & Real Estate',
  FRT: 'Energy, Utilities & Real Estate',
  NNN: 'Energy, Utilities & Real Estate',
  ADC: 'Energy, Utilities & Real Estate',
  WPC: 'Energy, Utilities & Real Estate',
  STAG: 'Energy, Utilities & Real Estate',
  REXFORD: 'Energy, Utilities & Real Estate',
  REXR: 'Energy, Utilities & Real Estate',
  EGP: 'Energy, Utilities & Real Estate',
  FR: 'Energy, Utilities & Real Estate',
  HST: 'Energy, Utilities & Real Estate',
  RHP: 'Energy, Utilities & Real Estate',
  WY: 'Energy, Utilities & Real Estate',
  RYN: 'Energy, Utilities & Real Estate',
  CBRE: 'Energy, Utilities & Real Estate',
  JLL: 'Energy, Utilities & Real Estate',
  CSGP: 'Energy, Utilities & Real Estate',
  Z: 'Energy, Utilities & Real Estate',
  ZG: 'Energy, Utilities & Real Estate',
  OPEN: 'Energy, Utilities & Real Estate',
  // Mining, Metals, Chemicals & Basic Materials
  LIN: 'Energy, Utilities & Real Estate',
  APD: 'Energy, Utilities & Real Estate',
  ECL: 'Energy, Utilities & Real Estate',
  NEM: 'Energy, Utilities & Real Estate',
  GOLD: 'Energy, Utilities & Real Estate',
  AEM: 'Energy, Utilities & Real Estate',
  FNV: 'Energy, Utilities & Real Estate',
  WPM: 'Energy, Utilities & Real Estate',
  RGLD: 'Energy, Utilities & Real Estate',
  FCX: 'Energy, Utilities & Real Estate',
  SCCO: 'Energy, Utilities & Real Estate',
  RIO: 'Energy, Utilities & Real Estate',
  BHP: 'Energy, Utilities & Real Estate',
  VALE: 'Energy, Utilities & Real Estate',
  TECK: 'Energy, Utilities & Real Estate',
  ALB: 'Energy, Utilities & Real Estate',
  SQM: 'Energy, Utilities & Real Estate',
  DOW: 'Energy, Utilities & Real Estate',
  DD: 'Energy, Utilities & Real Estate',
  LYB: 'Energy, Utilities & Real Estate',
  CE: 'Energy, Utilities & Real Estate',
  EMN: 'Energy, Utilities & Real Estate',
  WLK: 'Energy, Utilities & Real Estate',
  CF: 'Energy, Utilities & Real Estate',
  MOS: 'Energy, Utilities & Real Estate',
  NTR: 'Energy, Utilities & Real Estate',
  CTVA: 'Energy, Utilities & Real Estate',
  FMC: 'Energy, Utilities & Real Estate',
  IFF: 'Energy, Utilities & Real Estate',
  // Telecom Infrastructure
  T: 'Energy, Utilities & Real Estate',
  VZ: 'Energy, Utilities & Real Estate',
  TMUS: 'Energy, Utilities & Real Estate',
  CMCSA: 'Energy, Utilities & Real Estate',
  CHTR: 'Energy, Utilities & Real Estate',
  VOD: 'Energy, Utilities & Real Estate',
  ORAN: 'Energy, Utilities & Real Estate',
  TEF: 'Energy, Utilities & Real Estate',
  AMX: 'Energy, Utilities & Real Estate',
  BCE: 'Energy, Utilities & Real Estate',
  TU: 'Energy, Utilities & Real Estate',
  RCI: 'Energy, Utilities & Real Estate',
  // Casablanca BVC Energy, Utilities, Mining, Real Estate & Telecom
  IAM: 'Energy, Utilities & Real Estate',
  TQM: 'Energy, Utilities & Real Estate',
  MNG: 'Energy, Utilities & Real Estate',
  ADH: 'Energy, Utilities & Real Estate',
  RDS: 'Energy, Utilities & Real Estate',
  ALLIANCES: 'Energy, Utilities & Real Estate',
  ADI_MA: 'Energy, Utilities & Real Estate',
  BAL: 'Energy, Utilities & Real Estate',
  IMMR: 'Energy, Utilities & Real Estate',
  ARDS: 'Energy, Utilities & Real Estate',
  TOT: 'Energy, Utilities & Real Estate',
  GAZ: 'Energy, Utilities & Real Estate',
  SMI: 'Energy, Utilities & Real Estate',

  // ===========================================================================
  // 8. INDEX & DIVIDEND ETFs (Broad Market, Dividend, Sector, Bond & Commodity ETFs)
  // ===========================================================================
  SPY: 'Index & Dividend ETFs',
  VOO: 'Index & Dividend ETFs',
  IVV: 'Index & Dividend ETFs',
  SPLG: 'Index & Dividend ETFs',
  RSP: 'Index & Dividend ETFs',
  VTI: 'Index & Dividend ETFs',
  ITOT: 'Index & Dividend ETFs',
  SCHB: 'Index & Dividend ETFs',
  VT: 'Index & Dividend ETFs',
  ACWI: 'Index & Dividend ETFs',
  URTH: 'Index & Dividend ETFs',
  QQQ: 'Index & Dividend ETFs',
  QQQM: 'Index & Dividend ETFs',
  ONEQ: 'Index & Dividend ETFs',
  TQQQ: 'Index & Dividend ETFs',
  SQQQ: 'Index & Dividend ETFs',
  UPRO: 'Index & Dividend ETFs',
  SPXL: 'Index & Dividend ETFs',
  SOXL: 'Index & Dividend ETFs',
  DIA: 'Index & Dividend ETFs',
  IWM: 'Index & Dividend ETFs',
  IJH: 'Index & Dividend ETFs',
  IJR: 'Index & Dividend ETFs',
  MDY: 'Index & Dividend ETFs',
  VB: 'Index & Dividend ETFs',
  VO: 'Index & Dividend ETFs',
  VV: 'Index & Dividend ETFs',
  VUG: 'Index & Dividend ETFs',
  VTV: 'Index & Dividend ETFs',
  IWF: 'Index & Dividend ETFs',
  IWD: 'Index & Dividend ETFs',
  SCHG: 'Index & Dividend ETFs',
  SCHV: 'Index & Dividend ETFs',
  IUSG: 'Index & Dividend ETFs',
  IUSV: 'Index & Dividend ETFs',
  MGK: 'Index & Dividend ETFs',
  MTUM: 'Index & Dividend ETFs',
  QUAL: 'Index & Dividend ETFs',
  USMV: 'Index & Dividend ETFs',
  COWZ: 'Index & Dividend ETFs',
  MOAT: 'Index & Dividend ETFs',
  SCHD: 'Index & Dividend ETFs',
  VYM: 'Index & Dividend ETFs',
  VIG: 'Index & Dividend ETFs',
  DGRO: 'Index & Dividend ETFs',
  DGRW: 'Index & Dividend ETFs',
  NOBL: 'Index & Dividend ETFs',
  SDY: 'Index & Dividend ETFs',
  DVY: 'Index & Dividend ETFs',
  HDV: 'Index & Dividend ETFs',
  SPYD: 'Index & Dividend ETFs',
  SPHD: 'Index & Dividend ETFs',
  SCHY: 'Index & Dividend ETFs',
  VYMI: 'Index & Dividend ETFs',
  VIGI: 'Index & Dividend ETFs',
  FDVV: 'Index & Dividend ETFs',
  JEPI: 'Index & Dividend ETFs',
  JEPQ: 'Index & Dividend ETFs',
  DIVO: 'Index & Dividend ETFs',
  XYLD: 'Index & Dividend ETFs',
  QYLD: 'Index & Dividend ETFs',
  RYLD: 'Index & Dividend ETFs',
  SPYI: 'Index & Dividend ETFs',
  QQQI: 'Index & Dividend ETFs',
  SVOL: 'Index & Dividend ETFs',
  VGT: 'Index & Dividend ETFs',
  XLK: 'Index & Dividend ETFs',
  IYW: 'Index & Dividend ETFs',
  FTEC: 'Index & Dividend ETFs',
  SMH: 'Index & Dividend ETFs',
  SOXX: 'Index & Dividend ETFs',
  XSD: 'Index & Dividend ETFs',
  IGV: 'Index & Dividend ETFs',
  SKYY: 'Index & Dividend ETFs',
  CLOU: 'Index & Dividend ETFs',
  CIBR: 'Index & Dividend ETFs',
  HACK: 'Index & Dividend ETFs',
  BUG: 'Index & Dividend ETFs',
  BOTZ: 'Index & Dividend ETFs',
  ROBO: 'Index & Dividend ETFs',
  AIQ: 'Index & Dividend ETFs',
  CHAT: 'Index & Dividend ETFs',
  ARKK: 'Index & Dividend ETFs',
  ARKQ: 'Index & Dividend ETFs',
  ARKW: 'Index & Dividend ETFs',
  ARKG: 'Index & Dividend ETFs',
  ARKF: 'Index & Dividend ETFs',
  XLF: 'Index & Dividend ETFs',
  VFH: 'Index & Dividend ETFs',
  IYF: 'Index & Dividend ETFs',
  KBE: 'Index & Dividend ETFs',
  KRE: 'Index & Dividend ETFs',
  IAI: 'Index & Dividend ETFs',
  XLI: 'Index & Dividend ETFs',
  VIS: 'Index & Dividend ETFs',
  IYJ: 'Index & Dividend ETFs',
  ITA: 'Index & Dividend ETFs',
  PPA: 'Index & Dividend ETFs',
  XAR: 'Index & Dividend ETFs',
  PAVE: 'Index & Dividend ETFs',
  IFRA: 'Index & Dividend ETFs',
  JETS: 'Index & Dividend ETFs',
  XLE: 'Index & Dividend ETFs',
  VDE: 'Index & Dividend ETFs',
  IYE: 'Index & Dividend ETFs',
  OIH: 'Index & Dividend ETFs',
  XOP: 'Index & Dividend ETFs',
  AMLP: 'Index & Dividend ETFs',
  ICLN: 'Index & Dividend ETFs',
  TAN: 'Index & Dividend ETFs',
  QCLN: 'Index & Dividend ETFs',
  URA: 'Index & Dividend ETFs',
  URNM: 'Index & Dividend ETFs',
  XLV: 'Index & Dividend ETFs',
  VHT: 'Index & Dividend ETFs',
  IYH: 'Index & Dividend ETFs',
  IBB: 'Index & Dividend ETFs',
  XBI: 'Index & Dividend ETFs',
  IHI: 'Index & Dividend ETFs',
  XLY: 'Index & Dividend ETFs',
  VCR: 'Index & Dividend ETFs',
  IYC: 'Index & Dividend ETFs',
  XRT: 'Index & Dividend ETFs',
  ITB: 'Index & Dividend ETFs',
  XHB: 'Index & Dividend ETFs',
  XLP: 'Index & Dividend ETFs',
  VDC: 'Index & Dividend ETFs',
  IYK: 'Index & Dividend ETFs',
  XLU: 'Index & Dividend ETFs',
  VPU: 'Index & Dividend ETFs',
  IDU: 'Index & Dividend ETFs',
  XLRE: 'Index & Dividend ETFs',
  VNQ: 'Index & Dividend ETFs',
  SCHH: 'Index & Dividend ETFs',
  IYR: 'Index & Dividend ETFs',
  USRT: 'Index & Dividend ETFs',
  XLB: 'Index & Dividend ETFs',
  VAW: 'Index & Dividend ETFs',
  IYM: 'Index & Dividend ETFs',
  GDX: 'Index & Dividend ETFs',
  GDXJ: 'Index & Dividend ETFs',
  SIL: 'Index & Dividend ETFs',
  COPX: 'Index & Dividend ETFs',
  LIT: 'Index & Dividend ETFs',
  REMX: 'Index & Dividend ETFs',
  XLC: 'Index & Dividend ETFs',
  VOX: 'Index & Dividend ETFs',
  IYZ: 'Index & Dividend ETFs',
  VXUS: 'Index & Dividend ETFs',
  IXUS: 'Index & Dividend ETFs',
  VEA: 'Index & Dividend ETFs',
  IEFA: 'Index & Dividend ETFs',
  EFA: 'Index & Dividend ETFs',
  SCHF: 'Index & Dividend ETFs',
  VGK: 'Index & Dividend ETFs',
  EZU: 'Index & Dividend ETFs',
  VWO: 'Index & Dividend ETFs',
  IEMG: 'Index & Dividend ETFs',
  EEM: 'Index & Dividend ETFs',
  SCHE: 'Index & Dividend ETFs',
  EWJ: 'Index & Dividend ETFs',
  EWZ: 'Index & Dividend ETFs',
  INDA: 'Index & Dividend ETFs',
  EWY: 'Index & Dividend ETFs',
  EWT: 'Index & Dividend ETFs',
  EWC: 'Index & Dividend ETFs',
  EWU: 'Index & Dividend ETFs',
  EWG: 'Index & Dividend ETFs',
  EWA: 'Index & Dividend ETFs',
  EWW: 'Index & Dividend ETFs',
  FXI: 'Index & Dividend ETFs',
  KWEB: 'Index & Dividend ETFs',
  MCHI: 'Index & Dividend ETFs',
  ASHR: 'Index & Dividend ETFs',
  TLT: 'Index & Dividend ETFs',
  IEF: 'Index & Dividend ETFs',
  SHY: 'Index & Dividend ETFs',
  GOVT: 'Index & Dividend ETFs',
  VGSH: 'Index & Dividend ETFs',
  VGIT: 'Index & Dividend ETFs',
  VGLT: 'Index & Dividend ETFs',
  SGOV: 'Index & Dividend ETFs',
  BIL: 'Index & Dividend ETFs',
  USFR: 'Index & Dividend ETFs',
  TFLO: 'Index & Dividend ETFs',
  BOXX: 'Index & Dividend ETFs',
  BND: 'Index & Dividend ETFs',
  AGG: 'Index & Dividend ETFs',
  SCHZ: 'Index & Dividend ETFs',
  BNDX: 'Index & Dividend ETFs',
  LQD: 'Index & Dividend ETFs',
  VCIT: 'Index & Dividend ETFs',
  VCSH: 'Index & Dividend ETFs',
  HYG: 'Index & Dividend ETFs',
  JNK: 'Index & Dividend ETFs',
  TIP: 'Index & Dividend ETFs',
  VTIP: 'Index & Dividend ETFs',
  SCHP: 'Index & Dividend ETFs',
  MUB: 'Index & Dividend ETFs',
  VTEB: 'Index & Dividend ETFs',
  PFF: 'Index & Dividend ETFs',
  PGX: 'Index & Dividend ETFs',
  GLD: 'Index & Dividend ETFs',
  IAU: 'Index & Dividend ETFs',
  GLDM: 'Index & Dividend ETFs',
  SLV: 'Index & Dividend ETFs',
  PPLT: 'Index & Dividend ETFs',
  PDBC: 'Index & Dividend ETFs',
  DBC: 'Index & Dividend ETFs',
  GSG: 'Index & Dividend ETFs',
  USO: 'Index & Dividend ETFs',
  UNG: 'Index & Dividend ETFs',
  DBA: 'Index & Dividend ETFs',
  IBIT: 'Index & Dividend ETFs',
  FBTC: 'Index & Dividend ETFs',
  BITB: 'Index & Dividend ETFs',
  ARKB: 'Index & Dividend ETFs',
  ETHA: 'Index & Dividend ETFs',
  FETH: 'Index & Dividend ETFs',
  CSPX: 'Index & Dividend ETFs',
  VUAA: 'Index & Dividend ETFs',
  VWCE: 'Index & Dividend ETFs',
  IWDA: 'Index & Dividend ETFs',
  EQQQ: 'Index & Dividend ETFs',
  IB01: 'Index & Dividend ETFs',
};

/**
 * Maps common company names, brand names, and full corporate names directly to canonical tickers.
 * This ensures that even if a user or external sync passes "JPMorgan", "JPMorgan Chase", "Caterpillar",
 * "John Deere", "Eli Lilly", "Apple", etc. as the ticker or name, it resolves 100% accurately.
 */
export const COMPANY_NAME_TO_TICKER: Record<string, string> = {
  // Banking & Financials
  JPMORGAN: 'JPM',
  'JP MORGAN': 'JPM',
  'J.P. MORGAN': 'JPM',
  'JPMORGAN CHASE': 'JPM',
  'JPMORGAN CHASE & CO': 'JPM',
  'CHASE BANK': 'JPM',
  CHASE: 'JPM',
  'BANK OF AMERICA': 'BAC',
  BOFA: 'BAC',
  'WELLS FARGO': 'WFC',
  CITIGROUP: 'C',
  CITIBANK: 'C',
  CITI: 'C',
  'GOLDMAN SACHS': 'GS',
  GOLDMAN: 'GS',
  'MORGAN STANLEY': 'MS',
  BLACKROCK: 'BLK',
  BLACKSTONE: 'BX',
  'CHARLES SCHWAB': 'SCHW',
  SCHWAB: 'SCHW',
  VISA: 'V',
  MASTERCARD: 'MA',
  'AMERICAN EXPRESS': 'AXP',
  AMEX: 'AXP',
  'CAPITAL ONE': 'COF',
  PAYPAL: 'PYPL',
  BLOCK: 'SQ',
  SQUARE: 'SQ',
  AFFIRM: 'AFRM',
  'SOFI TECHNOLOGIES': 'SOFI',
  ROBINHOOD: 'HOOD',
  COINBASE: 'COIN',
  'INTERACTIVE BROKERS': 'IBKR',
  'BERKSHIRE HATHAWAY': 'BRK-B',
  BERKSHIRE: 'BRK-B',
  CHUBB: 'CB',
  PROGRESSIVE: 'PGR',
  TRAVELERS: 'TRV',
  ALLSTATE: 'ALL',
  METLIFE: 'MET',
  PRUDENTIAL: 'PRU',
  AFLAC: 'AFL',
  'S&P GLOBAL': 'SPGI',
  MOODYS: 'MCO',
  "MOODY'S": 'MCO',
  'INTERCONTINENTAL EXCHANGE': 'ICE',
  'CME GROUP': 'CME',
  NASDAQ: 'NDAQ',
  'US BANCORP': 'USB',
  'PNC FINANCIAL': 'PNC',
  'TRUIST FINANCIAL': 'TFC',
  'BANK OF NEW YORK MELLON': 'BK',
  'BNY MELLON': 'BK',
  'STATE STREET': 'STT',
  'ATTIJARIWAFA BANK': 'ATW',
  ATTIJARIWAFA: 'ATW',
  ATTIJARI: 'ATW',
  'BANQUE POPULAIRE': 'BCP',
  'BANK OF AFRICA': 'BOA',
  'CIH BANK': 'CIH',
  'CREDIT DU MAROC': 'CDM',
  'WAFA ASSURANCE': 'WAA',
  'SANLAM MAROC': 'SAH',
  ATLANTASANAD: 'ATL',

  // Mechanics, Automotive & Industrials
  TESLA: 'TSLA',
  CATERPILLAR: 'CAT',
  'JOHN DEERE': 'DE',
  'DEERE & CO': 'DE',
  DEERE: 'DE',
  'GENERAL ELECTRIC': 'GE',
  'GE AEROSPACE': 'GE',
  'GE VERNOVA': 'GEV',
  HONEYWELL: 'HON',
  BOEING: 'BA',
  'LOCKHEED MARTIN': 'LMT',
  LOCKHEED: 'LMT',
  RAYTHEON: 'RTX',
  'RTX CORP': 'RTX',
  'NORTHROP GRUMMAN': 'NOC',
  NORTHROP: 'NOC',
  'GENERAL DYNAMICS': 'GD',
  'L3HARRIS': 'LHX',
  TRANSDIGM: 'TDG',
  'UNION PACIFIC': 'UNP',
  'UNITED PARCEL SERVICE': 'UPS',
  FEDEX: 'FDX',
  'DELTA AIR LINES': 'DAL',
  'UNITED AIRLINES': 'UAL',
  'AMERICAN AIRLINES': 'AAL',
  'SOUTHWEST AIRLINES': 'LUV',
  'FORD MOTOR': 'F',
  FORD: 'F',
  'GENERAL MOTORS': 'GM',
  TOYOTA: 'TM',
  HONDA: 'HMC',
  STELLANTIS: 'STLA',
  FERRARI: 'RACE',
  VOLKSWAGEN: 'VWAGY',
  'MERCEDES-BENZ': 'MBGYY',
  MERCEDES: 'MBGYY',
  BMW: 'BMWYY',
  PORSCHE: 'POAHY',
  RIVIAN: 'RIVN',
  'LUCID MOTORS': 'LCID',
  LUCID: 'LCID',
  '3M': 'MMM',
  '3M COMPANY': 'MMM',
  EATON: 'ETN',
  'EMERSON ELECTRIC': 'EMR',
  'ILLINOIS TOOL WORKS': 'ITW',
  'PARKER HANNIFIN': 'PH',
  'ROCKWELL AUTOMATION': 'ROK',
  CUMMINS: 'CMI',
  PACCAR: 'PCAR',
  'OTIS WORLDWIDE': 'OTIS',
  'CARRIER GLOBAL': 'CARR',
  'TRANE TECHNOLOGIES': 'TT',
  'JOHNSON CONTROLS': 'JCI',
  FASTENAL: 'FAST',
  GRAINGER: 'GWW',
  'UNITED RENTALS': 'URI',
  'QUANTA SERVICES': 'PWR',
  'WASTE MANAGEMENT': 'WM',
  'REPUBLIC SERVICES': 'RSG',
  'SHERWIN-WILLIAMS': 'SHW',
  NUCOR: 'NUE',
  AIRBUS: 'EADSY',
  SIEMENS: 'SIEGY',
  'LAFARGEHOLCIM MAROC': 'LHM',
  LAFARGEHOLCIM: 'LHM',
  LAFARGE: 'LHM',
  'MARSA MAROC': 'MSA',
  SONASID: 'SID',

  // AI & Semiconductors
  NVIDIA: 'NVDA',
  'ADVANCED MICRO DEVICES': 'AMD',
  BROADCOM: 'AVGO',
  'TAIWAN SEMICONDUCTOR': 'TSM',
  'ASML HOLDING': 'ASML',
  INTEL: 'INTC',
  'ARM HOLDINGS': 'ARM',
  QUALCOMM: 'QCOM',
  'TEXAS INSTRUMENTS': 'TXN',
  MICRON: 'MU',
  'MICRON TECHNOLOGY': 'MU',
  'ANALOG DEVICES': 'ADI',
  'MARVELL TECHNOLOGY': 'MRVL',
  MARVELL: 'MRVL',
  'APPLIED MATERIALS': 'AMAT',
  'LAM RESEARCH': 'LRCX',
  'KLA CORP': 'KLAC',
  SYNOPSYS: 'SNPS',
  CADENCE: 'CDNS',
  'SUPER MICRO COMPUTER': 'SMCI',
  SUPERMICRO: 'SMCI',
  'DELL TECHNOLOGIES': 'DELL',
  'ARISTA NETWORKS': 'ANET',
  'VERTIV HOLDINGS': 'VRT',
  VERTIV: 'VRT',
  PALANTIR: 'PLTR',
  'PALANTIR TECHNOLOGIES': 'PLTR',
  'C3.AI': 'AI',
  SOUNDHOUND: 'SOUN',

  // Technology & Cloud
  APPLE: 'AAPL',
  MICROSOFT: 'MSFT',
  ALPHABET: 'GOOGL',
  GOOGLE: 'GOOGL',
  AMAZON: 'AMZN',
  'META PLATFORMS': 'META',
  FACEBOOK: 'META',
  NETFLIX: 'NFLX',
  SALESFORCE: 'CRM',
  ORACLE: 'ORCL',
  ADOBE: 'ADBE',
  CISCO: 'CSCO',
  SERVICENOW: 'NOW',
  INTUIT: 'INTU',
  SNOWFLAKE: 'SNOW',
  'PALO ALTO NETWORKS': 'PANW',
  CROWDSTRIKE: 'CRWD',
  FORTINET: 'FTNT',
  ZSCALER: 'ZS',
  CLOUDFLARE: 'NET',
  DATADOG: 'DDOG',
  MONGODB: 'MDB',
  ATLASSIAN: 'TEAM',
  WORKDAY: 'WDAY',
  HUBSPOT: 'HUBS',
  SHOPIFY: 'SHOP',
  SPOTIFY: 'SPOT',
  ROBLOX: 'RBLX',
  REDDIT: 'RDDT',
  MICROSTRATEGY: 'MSTR',
  STRATEGY: 'MSTR',
  ACCENTURE: 'ACN',

  // Consumer & Retail
  WALMART: 'WMT',
  COSTCO: 'COST',
  TARGET: 'TGT',
  'HOME DEPOT': 'HD',
  LOWES: 'LOW',
  "LOWE'S": 'LOW',
  MCDONALDS: 'MCD',
  "MCDONALD'S": 'MCD',
  STARBUCKS: 'SBUX',
  CHIPOTLE: 'CMG',
  'COCA-COLA': 'KO',
  'COCA COLA': 'KO',
  PEPSICO: 'PEP',
  PEPSI: 'PEP',
  'MONSTER BEVERAGE': 'MNST',
  'PROCTER & GAMBLE': 'PG',
  'COLGATE-PALMOLIVE': 'CL',
  NIKE: 'NKE',
  LULULEMON: 'LULU',
  'WALT DISNEY': 'DIS',
  DISNEY: 'DIS',
  AIRBNB: 'ABNB',
  'BOOKING HOLDINGS': 'BKNG',
  MARRIOTT: 'MAR',
  HILTON: 'HLT',
  ALIBABA: 'BABA',
  'MERCADOLIBRE': 'MELI',
  'PHILIP MORRIS': 'PM',
  ALTRIA: 'MO',
  'MONDELEZ': 'MDLZ',
  COSUMAR: 'CSR',
  'LABEL VIE': 'LBV',

  // Healthcare & Biotech
  'ELI LILLY': 'LLY',
  LILLY: 'LLY',
  'NOVO NORDISK': 'NVO',
  UNITEDHEALTH: 'UNH',
  'UNITEDHEALTH GROUP': 'UNH',
  'JOHNSON & JOHNSON': 'JNJ',
  ABBVIE: 'ABBV',
  MERCK: 'MRK',
  PFIZER: 'PFE',
  ASTRAZENECA: 'AZN',
  NOVARTIS: 'NVS',
  SANOFI: 'SNY',
  AMGEN: 'AMGN',
  GILEAD: 'GILD',
  VERTEX: 'VRTX',
  REGENERON: 'REGN',
  MODERNA: 'MRNA',
  'THERMO FISHER': 'TMO',
  'ABBOTT LABORATORIES': 'ABT',
  ABBOTT: 'ABT',
  DANAHER: 'DHR',
  'INTUITIVE SURGICAL': 'ISRG',
  STRYKER: 'SYK',
  'BOSTON SCIENTIFIC': 'BSX',
  MEDTRONIC: 'MDT',
  'CVS HEALTH': 'CVS',
  CIGNA: 'CI',
  HUMANA: 'HUM',
  AKDITAL: 'AKD',
  SOTHEMA: 'SOT',

  // Energy, Utilities & Real Estate
  'EXXON MOBIL': 'XOM',
  EXXON: 'XOM',
  EXXONMOBIL: 'XOM',
  CHEVRON: 'CVX',
  SHELL: 'SHEL',
  TOTALENERGIES: 'TTE',
  CONOCOPHILLIPS: 'COP',
  'OCCIDENTAL PETROLEUM': 'OXY',
  OCCIDENTAL: 'OXY',
  SCHLUMBERGER: 'SLB',
  HALLIBURTON: 'HAL',
  'NEXTERA ENERGY': 'NEE',
  NEXTERA: 'NEE',
  'DUKE ENERGY': 'DUK',
  'SOUTHERN COMPANY': 'SO',
  'CONSTELLATION ENERGY': 'CEG',
  'REALTY INCOME': 'O',
  PROLOGIS: 'PLD',
  'AMERICAN TOWER': 'AMT',
  EQUINIX: 'EQIX',
  'SIMON PROPERTY': 'SPG',
  'AT&T': 'T',
  VERIZON: 'VZ',
  'T-MOBILE': 'TMUS',
  'MAROC TELECOM': 'IAM',
  'ITISSALAT AL-MAGHRIB': 'IAM',
  'TAQA MOROCCO': 'TQM',
  MANAGEM: 'MNG',
  ADDOHA: 'ADH',
  'DAR SAADA': 'RDS',

  // Index & Dividend ETFs
  'S&P 500': 'VOO',
  'VANGUARD S&P 500': 'VOO',
  'SPDR S&P 500': 'SPY',
  'INVESCO QQQ': 'QQQ',
  'NASDAQ 100': 'QQQ',
  'SCHWAB US DIVIDEND': 'SCHD',
};

/**
 * Canonical Company Names for well-known stock tickers so the UI and Binance Funding sync
 * always display clean, human-friendly company names even when offline or before Yahoo quote lookup.
 */
export const TICKER_TO_COMPANY_NAME: Record<string, string> = {
  NVDA: 'NVIDIA Corporation',
  AMD: 'Advanced Micro Devices, Inc.',
  AVGO: 'Broadcom Inc.',
  TSM: 'Taiwan Semiconductor Manufacturing (TSMC)',
  ASML: 'ASML Holding N.V.',
  INTC: 'Intel Corporation',
  ARM: 'Arm Holdings plc',
  QCOM: 'Qualcomm Incorporated',
  TXN: 'Texas Instruments Incorporated',
  MU: 'Micron Technology, Inc.',
  AMAT: 'Applied Materials, Inc.',
  LRCX: 'Lam Research Corporation',
  KLAC: 'KLA Corporation',
  SMCI: 'Super Micro Computer, Inc.',
  DELL: 'Dell Technologies Inc.',
  ANET: 'Arista Networks, Inc.',
  VRT: 'Vertiv Holdings Co',
  PLTR: 'Palantir Technologies Inc.',
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc. (Class A)',
  GOOG: 'Alphabet Inc. (Class C)',
  AMZN: 'Amazon.com, Inc.',
  META: 'Meta Platforms, Inc.',
  NFLX: 'Netflix, Inc.',
  CRM: 'Salesforce, Inc.',
  ORCL: 'Oracle Corporation',
  SAP: 'SAP SE',
  ADBE: 'Adobe Inc.',
  IBM: 'International Business Machines (IBM)',
  CSCO: 'Cisco Systems, Inc.',
  NOW: 'ServiceNow, Inc.',
  INTU: 'Intuit Inc.',
  SNOW: 'Snowflake Inc.',
  PANW: 'Palo Alto Networks, Inc.',
  CRWD: 'CrowdStrike Holdings, Inc.',
  FTNT: 'Fortinet, Inc.',
  NET: 'Cloudflare, Inc.',
  DDOG: 'Datadog, Inc.',
  SHOP: 'Shopify Inc.',
  SPOT: 'Spotify Technology S.A.',
  MSTR: 'MicroStrategy Incorporated',
  JPM: 'JPMorgan Chase & Co.',
  BAC: 'Bank of America Corporation',
  WFC: 'Wells Fargo & Company',
  C: 'Citigroup Inc.',
  GS: 'The Goldman Sachs Group, Inc.',
  MS: 'Morgan Stanley',
  BLK: 'BlackRock, Inc.',
  BX: 'Blackstone Inc.',
  KKR: 'KKR & Co. Inc.',
  SCHW: 'The Charles Schwab Corporation',
  V: 'Visa Inc.',
  MA: 'Mastercard Incorporated',
  AXP: 'American Express Company',
  PYPL: 'PayPal Holdings, Inc.',
  SQ: 'Block, Inc.',
  COIN: 'Coinbase Global, Inc.',
  HOOD: 'Robinhood Markets, Inc.',
  SOFI: 'SoFi Technologies, Inc.',
  'BRK-B': 'Berkshire Hathaway Inc. (Class B)',
  'BRK-A': 'Berkshire Hathaway Inc. (Class A)',
  CB: 'Chubb Limited',
  PGR: 'The Progressive Corporation',
  SPGI: 'S&P Global Inc.',
  MCO: "Moody's Corporation",
  ICE: 'Intercontinental Exchange, Inc.',
  CME: 'CME Group Inc.',
  USB: 'U.S. Bancorp',
  PNC: 'The PNC Financial Services Group',
  TFC: 'Truist Financial Corporation',
  TSLA: 'Tesla, Inc.',
  CAT: 'Caterpillar Inc.',
  DE: 'Deere & Company (John Deere)',
  GE: 'GE Aerospace',
  GEV: 'GE Vernova Inc.',
  HON: 'Honeywell International Inc.',
  BA: 'The Boeing Company',
  LMT: 'Lockheed Martin Corporation',
  RTX: 'RTX Corporation (Raytheon)',
  NOC: 'Northrop Grumman Corporation',
  GD: 'General Dynamics Corporation',
  UNP: 'Union Pacific Corporation',
  UPS: 'United Parcel Service, Inc.',
  FDX: 'FedEx Corporation',
  UBER: 'Uber Technologies, Inc.',
  F: 'Ford Motor Company',
  GM: 'General Motors Company',
  TM: 'Toyota Motor Corporation',
  RIVN: 'Rivian Automotive, Inc.',
  LCID: 'Lucid Group, Inc.',
  BYD: 'BYD Company Limited',
  MMM: '3M Company',
  ETN: 'Eaton Corporation plc',
  EMR: 'Emerson Electric Co.',
  ITW: 'Illinois Tool Works Inc.',
  PH: 'Parker-Hannifin Corporation',
  CMI: 'Cummins Inc.',
  OTIS: 'Otis Worldwide Corporation',
  CARR: 'Carrier Global Corporation',
  URI: 'United Rentals, Inc.',
  WM: 'Waste Management, Inc.',
  WMT: 'Walmart Inc.',
  COST: 'Costco Wholesale Corporation',
  TGT: 'Target Corporation',
  HD: 'The Home Depot, Inc.',
  LOW: "Lowe's Companies, Inc.",
  MCD: "McDonald's Corporation",
  SBUX: 'Starbucks Corporation',
  CMG: 'Chipotle Mexican Grill, Inc.',
  KO: 'The Coca-Cola Company',
  PEP: 'PepsiCo, Inc.',
  PG: 'The Procter & Gamble Company',
  CL: 'Colgate-Palmolive Company',
  NKE: 'NIKE, Inc.',
  LULU: 'Lululemon Athletica Inc.',
  DIS: 'The Walt Disney Company',
  ABNB: 'Airbnb, Inc.',
  BKNG: 'Booking Holdings Inc.',
  MAR: 'Marriott International, Inc.',
  BABA: 'Alibaba Group Holding Limited',
  MELI: 'MercadoLibre, Inc.',
  PM: 'Philip Morris International Inc.',
  MO: 'Altria Group, Inc.',
  LLY: 'Eli Lilly and Company',
  NVO: 'Novo Nordisk A/S',
  UNH: 'UnitedHealth Group Incorporated',
  JNJ: 'Johnson & Johnson',
  ABBV: 'AbbVie Inc.',
  MRK: 'Merck & Co., Inc.',
  PFE: 'Pfizer Inc.',
  AZN: 'AstraZeneca PLC',
  NVS: 'Novartis AG',
  AMGN: 'Amgen Inc.',
  GILD: 'Gilead Sciences, Inc.',
  VRTX: 'Vertex Pharmaceuticals Incorporated',
  REGN: 'Regeneron Pharmaceuticals, Inc.',
  ISRG: 'Intuitive Surgical, Inc.',
  TMO: 'Thermo Fisher Scientific Inc.',
  ABT: 'Abbott Laboratories',
  DHR: 'Danaher Corporation',
  SYK: 'Stryker Corporation',
  BSX: 'Boston Scientific Corporation',
  MDT: 'Medtronic plc',
  CVS: 'CVS Health Corporation',
  XOM: 'Exxon Mobil Corporation',
  CVX: 'Chevron Corporation',
  SHEL: 'Shell plc',
  TTE: 'TotalEnergies SE',
  BP: 'BP p.l.c.',
  COP: 'ConocoPhillips',
  EOG: 'EOG Resources, Inc.',
  OXY: 'Occidental Petroleum Corporation',
  SLB: 'SLB (Schlumberger)',
  NEE: 'NextEra Energy, Inc.',
  DUK: 'Duke Energy Corporation',
  SO: 'The Southern Company',
  CEG: 'Constellation Energy Corporation',
  O: 'Realty Income Corporation',
  PLD: 'Prologis, Inc.',
  AMT: 'American Tower Corporation',
  EQIX: 'Equinix, Inc.',
  SPG: 'Simon Property Group, Inc.',
  T: 'AT&T Inc.',
  VZ: 'Verizon Communications Inc.',
  TMUS: 'T-Mobile US, Inc.',
  SPY: 'SPDR S&P 500 ETF Trust',
  VOO: 'Vanguard S&P 500 ETF',
  IVV: 'iShares Core S&P 500 ETF',
  VTI: 'Vanguard Total Stock Market ETF',
  QQQ: 'Invesco QQQ Trust (Nasdaq-100)',
  QQQM: 'Invesco NASDAQ 100 ETF',
  DIA: 'SPDR Dow Jones Industrial Average ETF',
  IWM: 'iShares Russell 2000 ETF',
  SCHD: 'Schwab U.S. Dividend Equity ETF',
  VYM: 'Vanguard High Dividend Yield ETF',
  VIG: 'Vanguard Dividend Appreciation ETF',
  JEPI: 'JPMorgan Equity Premium Income ETF',
  JEPQ: 'JPMorgan Nasdaq Equity Premium Income ETF',
  VNQ: 'Vanguard Real Estate ETF',
  TLT: 'iShares 20+ Year Treasury Bond ETF',
  GLD: 'SPDR Gold Shares',
  IBIT: 'iShares Bitcoin Trust ETF',
  ATW: 'Attijariwafa Bank',
  IAM: 'Maroc Telecom (Itissalat Al-Maghrib)',
  BCP: 'Banque Centrale Populaire',
  LHM: 'LafargeHolcim Maroc',
  TQM: 'Taqa Morocco',
  MNG: 'Managem',
  TGCC: 'Travaux Généraux de Construction de Casablanca (TGCC)',
  AKD: 'Akdital Holding',
  MSA: 'Marsa Maroc',
  CIH: 'CIH Bank',
  BOA: 'Bank of Africa',
  CSR: 'Cosumar',
  HPS: 'Hightech Payment Systems (HPS)',
};

const QUOTE_SUFFIXES = ['USDT', 'FDUSD', 'USDC', 'BUSD', 'TUSD', 'USD', 'EUR', 'GBP', 'TRY', 'PERP'];

/**
 * Normalizes any stock ticker, tokenized equity symbol (Ondo ON, Swarm/xStocks X, Backed b*, Dinari d*, Simple Earn LD*),
 * trading pair (e.g., "JPMUSDT", "NVDAONUSDT", "JPM-USD", "BRK.B"), or company name alias ("JPMorgan" -> "JPM").
 */
export function normalizeStockTicker(rawTicker: string): string {
  const original = (rawTicker || '').trim().toUpperCase();
  if (!original) return '';

  // 0. Check if the raw string is a known company name alias (e.g. "JPMORGAN", "JP MORGAN", "CATERPILLAR")
  const cleanWords = original.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  if (COMPANY_NAME_TO_TICKER[cleanWords]) {
    return COMPANY_NAME_TO_TICKER[cleanWords];
  }

  // Normalize share class dots/slashes: BRK.B -> BRK-B, BF.B -> BF-B
  let clean = original
    .replace(/\s*\(.*?\)\s*/g, '') // remove parenthetical suffixes like "(Binance Funding)"
    .trim();

  if (COMPANY_NAME_TO_TICKER[clean]) {
    return COMPANY_NAME_TO_TICKER[clean];
  }

  if (/^BRK[./]B$/i.test(clean)) return 'BRK-B';
  if (/^BRK[./]A$/i.test(clean)) return 'BRK-A';
  if (/^BF[./]B$/i.test(clean)) return 'BF-B';
  if (/^BF[./]A$/i.test(clean)) return 'BF-A';

  // Strip common exchange suffixes (.US, .NYSE, .NASDAQ, .N, .O, .CAS, .MA, .PA, .L, .DE, .TO)
  clean = clean.replace(/\.(US|NYSE|NASDAQ|AMEX|ARCA|CAS|MA|PA|DE|SW|TO|HK|L|N|O)$/i, '');

  // Strip pair separators like JPM/USDT, JPM-USD, JPM_USDT
  for (const q of QUOTE_SUFFIXES) {
    const sepRegex = new RegExp(`[-/_:]${q}$`, 'i');
    if (sepRegex.test(clean)) {
      clean = clean.replace(sepRegex, '');
      break;
    }
  }

  // Keep only alphanumeric and hyphen
  clean = clean.replace(/[^A-Z0-9-]/g, '');
  if (!clean) return '';

  // Direct hit before stripping prefixes/suffixes
  if (TICKER_TO_STOCK_SECTOR[clean]) {
    return clean;
  }
  if (COMPANY_NAME_TO_TICKER[clean]) {
    return COMPANY_NAME_TO_TICKER[clean];
  }

  // Strip Simple Earn "LD" prefix (e.g., LDJPM, LDNVDA, LDAAPL)
  if (clean.startsWith('LD') && clean.length > 2 && !TICKER_TO_STOCK_SECTOR[clean]) {
    const withoutLd = clean.slice(2);
    if (TICKER_TO_STOCK_SECTOR[withoutLd] || KNOWN_CRYPTO_TICKERS.has(withoutLd) || withoutLd.length >= 1) {
      clean = withoutLd;
    }
  }

  // Strip quote currency suffixes (e.g., JPMUSDT -> JPM, NVDAONUSDT -> NVDAON, JPMUSD -> JPM)
  for (const suffix of QUOTE_SUFFIXES) {
    if (clean.endsWith(suffix) && clean.length > suffix.length) {
      const stripped = clean.slice(0, -suffix.length);
      if (
        TICKER_TO_STOCK_SECTOR[stripped] ||
        KNOWN_CRYPTO_TICKERS.has(stripped) ||
        (stripped.endsWith('ON') && TICKER_TO_STOCK_SECTOR[stripped.slice(0, -2)]) ||
        (stripped.endsWith('X') && TICKER_TO_STOCK_SECTOR[stripped.slice(0, -1)])
      ) {
        clean = stripped;
        break;
      }
    }
  }

  if (TICKER_TO_STOCK_SECTOR[clean]) {
    return clean;
  }

  // Handle Ondo Global Markets tokenized stock suffix "ON" (e.g. JPMON -> JPM, NVDAON -> NVDA, VON -> V, CON -> C, FON -> F, OON -> O)
  if (clean.endsWith('ON') && clean.length >= 3 && !TICKER_TO_STOCK_SECTOR[clean]) {
    const base = clean.slice(0, -2).replace(/-$/, '');
    if (TICKER_TO_STOCK_SECTOR[base]) {
      return base;
    }
  }

  // Handle Swarm / xStocks tokenized suffix "X" (e.g. JPMX -> JPM, NVDAX -> NVDA, TSLAX -> TSLA, VX -> V)
  if (clean.endsWith('X') && clean.length >= 2 && !TICKER_TO_STOCK_SECTOR[clean]) {
    const base = clean.slice(0, -1).replace(/-$/, '');
    if (TICKER_TO_STOCK_SECTOR[base]) {
      return base;
    }
  }

  // Handle Backed Finance "b" prefix (e.g. bJPM -> JPM, bNVDA -> NVDA, bTSLA -> TSLA, bCSPX -> CSPX)
  if (clean.startsWith('B') && clean.length >= 3 && !TICKER_TO_STOCK_SECTOR[clean]) {
    const base = clean.slice(1);
    if (TICKER_TO_STOCK_SECTOR[base]) {
      return base;
    }
  }

  // Handle Dinari "d" prefix (e.g. dJPM -> JPM, dNVDA -> NVDA, dTSLA -> TSLA)
  if (clean.startsWith('D') && clean.length >= 3 && !TICKER_TO_STOCK_SECTOR[clean]) {
    const base = clean.slice(1);
    if (TICKER_TO_STOCK_SECTOR[base]) {
      return base;
    }
  }

  return clean;
}

/**
 * Resolves the canonical company name for a ticker if known.
 */
export function resolveCanonicalCompanyName(ticker: string, fallbackName?: string | null): string {
  const clean = normalizeStockTicker(ticker);
  if (TICKER_TO_COMPANY_NAME[clean]) {
    return TICKER_TO_COMPANY_NAME[clean];
  }
  if (fallbackName && fallbackName.trim() && fallbackName.trim().toUpperCase() !== clean) {
    return fallbackName.trim();
  }
  return TICKER_TO_COMPANY_NAME[clean] || fallbackName?.trim() || clean;
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

  // Known stock ticker in our 850+ dictionary
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

  if (mkt === 'CRYPTO' || mkt === 'BINANCE') {
    return 'CRYPTO';
  }

  return 'STOCK';
}

/**
 * Internal helper that matches company names, brand names, and industry descriptions
 * using strict word-boundary regular expressions so "retail" or "airlines" never false-match "ai".
 */
function matchSectorFromText(text: string): StockSectorCategory | null {
  const s = (text || '').trim();
  if (!s) return null;

  // 1. Check direct company name aliases inside the text
  const upperClean = s
    .toUpperCase()
    .replace(/\s*\(BINANCE.*?\)/g, '')
    .replace(/[.,&']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (COMPANY_NAME_TO_TICKER[upperClean]) {
    const mappedTicker = COMPANY_NAME_TO_TICKER[upperClean];
    if (TICKER_TO_STOCK_SECTOR[mappedTicker]) {
      return TICKER_TO_STOCK_SECTOR[mappedTicker];
    }
  }

  for (const [alias, mappedTicker] of Object.entries(COMPANY_NAME_TO_TICKER)) {
    if (alias.length >= 4 && upperClean.includes(alias)) {
      if (TICKER_TO_STOCK_SECTOR[mappedTicker]) {
        return TICKER_TO_STOCK_SECTOR[mappedTicker];
      }
    }
  }

  // 2. Banking & Financials (checked early so JPMorgan Chase, Goldman Sachs, Morgan Stanley, Berkshire, Visa, etc. always match)
  if (
    /\b(jpmorgan|jp\s*morgan|chase|goldman\s*sachs|morgan\s*stanley|citigroup|citibank|wells\s*fargo|bank\s*of\s*america|bofa|blackrock|blackstone|kkr|apollo\s*global|carlyle|brookfield|charles\s*schwab|schwab|interactive\s*brokers|robinhood|coinbase|visa|mastercard|american\s*express|amex|discover\s*financial|synchrony|capital\s*one|paypal|affirm|sofi|nubank|upstart|fiserv|fidelity\s*national|global\s*payments|berkshire\s*hathaway|chubb|progressive|travelers|allstate|metlife|prudential|aflac|aig|hartford|marsh|aon|moody|s&p\s*global|msci|nasdaq|cboe|intercontinental\s*exchange|cme\s*group|state\s*street|bny\s*mellon|northern\s*trust|us\s*bancorp|pnc|truist|fifth\s*third|huntington\s*bancshares|regions\s*financial|citizens\s*financial|keycorp|ally\s*financial|hsbc|royal\s*bank|toronto-dominion|td\s*bank|scotiabank|barclays|lloyds|natwest|ubs|deutsche\s*bank|santander|bbva|ing\s*groep|bnp\s*paribas|mitsubishi\s*ufj|sumitomo\s*mitsui|mizuho|itau|bradesco|hdfc\s*bank|icici|attijariwafa|attijari|banque\s*populaire|cih\s*bank|bmci|credit\s*du\s*maroc|wafa\s*assurance|sanlam|atlantasanad|bank|banking|bancorp|bancshares|financial|financials|finance|insurance|insurer|reinsurance|assurance|asset\s*management|wealth\s*management|brokerage|fintech|payment|payments|credit\s*card|lending|mortgage|bancaire)\b/i.test(
      s
    )
  ) {
    return 'Banking & Financials';
  }

  // 3. Index & Dividend ETFs
  if (
    /\b(etf|etfs|index\s*fund|index\s*trust|vanguard|spdr|ishares|invesco|schwab\s*u\.?s\.?\s*dividend|proshares|direxion|ark\s*innovation|wisdomtree|vaneck|first\s*trust|global\s*x|jpmorgan\s*equity\s*premium|s&p\s*500\s*etf|nasdaq\s*100\s*etf|russell\s*2000|total\s*stock\s*market|dividend\s*appreciation|high\s*dividend\s*yield|treasury\s*bond\s*etf|ucits)\b/i.test(
      s
    )
  ) {
    return 'Index & Dividend ETFs';
  }

  // 4. Mechanics, Automotive & Industrials
  if (
    /\b(caterpillar|john\s*deere|deere|ge\s*aerospace|ge\s*vernova|general\s*electric|honeywell|boeing|lockheed\s*martin|raytheon|rtx|northrop\s*grumman|general\s*dynamics|l3harris|transdigm|heico|howmet|textron|axon\s*enterprise|rocket\s*lab|union\s*pacific|csx|norfolk\s*southern|canadian\s*pacific|canadian\s*national|wabtec|united\s*parcel|ups|fedex|j\.?b\.?\s*hunt|old\s*dominion|xpo|delta\s*air|united\s*airlines|american\s*airlines|southwest\s*airlines|ryanair|uber|lyft|tesla|ford\s*motor|general\s*motors|toyota|honda\s*motor|stellantis|ferrari|volkswagen|mercedes|bmw|porsche|byd|rivian|lucid\s*group|nio|xpeng|li\s*auto|aptiv|borgwarner|lear|autoliv|magna|goodyear|3m\s*company|eaton|emerson\s*electric|illinois\s*tool|parker-hannifin|parker\s*hannifin|rockwell\s*automation|cummins|paccar|oshkosh|agco|stanley\s*black|snap-on|ingersoll\s*rand|dover|xylem|fortive|ametek|otis\s*worldwide|carrier\s*global|trane\s*technologies|johnson\s*controls|lennox|watsco|masco|fastenal|grainger|united\s*rentals|quanta\s*services|emcor|comfort\s*systems|jacobs\s*solutions|aecom|fluor|vulcan\s*materials|martin\s*marietta|crh|sherwin-williams|ppg\s*industries|nucor|steel\s*dynamics|cleveland-cliffs|alcoa|waste\s*management|republic\s*services|waste\s*connections|copart|cintas|equifax|transunion|rollins|generac|hubbell|siemens|airbus|safran|rolls-royce|bae\s*systems|abb\s*ltd|tgcc|lafargeholcim|lafarge|marsa\s*maroc|sonasid|ciments\s*du\s*maroc|jet\s*contractors|snep|aluminium\s*du\s*maroc|colorado|auto\s*hall|ennakl|mechanic|mechanics|mechanical|automotive|automobile|automaker|electric\s*vehicle|industrial|industrials|machinery|heavy\s*equipment|aerospace|defense|aviation|airline|airlines|railroad|railway|freight|logistics|trucking|shipping|construction|building\s*materials|cement|steel|manufacturing|robotics|engineering|elevator|hvac|tractor|excavator|turbine)\b/i.test(
      s
    )
  ) {
    return 'Mechanics, Automotive & Industrials';
  }

  // 5. AI & Semiconductors (strict word boundaries so "retail" or "air" never match "ai"!)
  if (
    /\b(nvidia|advanced\s*micro\s*devices|amd|broadcom|taiwan\s*semiconductor|tsmc|asml|intel\s*corp|arm\s*holdings|qualcomm|texas\s*instruments|micron|analog\s*devices|nxp\s*semiconductors|marvell|microchip\s*technology|on\s*semiconductor|monolithic\s*power|skyworks|qorvo|stmicroelectronics|globalfoundries|wolfspeed|cirrus\s*logic|lattice\s*semiconductor|rambus|applied\s*materials|lam\s*research|kla\s*corp|teradyne|entegris|synopsys|cadence\s*design|ansys|super\s*micro|supermicro|dell\s*technologies|hewlett\s*packard\s*enterprise|vertiv|arista\s*networks|palantir|c3\.ai|soundhound|bigbear\.ai|uipath|samsara|symbotic|cognex|ionq|rigetti|d-wave|quantum\s*computing|core\s*scientific|iris\s*energy|applied\s*digital|nebius|coreweave|astera\s*labs|credo\s*technology|semiconductor|semiconductors|microchip|microchips|chipmaker|gpu|gpus|wafer|foundry|lithography|artificial\s*intelligence|ai\s*infrastructure|ai\s*compute|ai\s*accelerator|quantum)\b/i.test(
      s
    ) ||
    /\b(ai)\b/i.test(s)
  ) {
    return 'AI & Semiconductors';
  }

  // 6. Healthcare & Biotech
  if (
    /\b(eli\s*lilly|novo\s*nordisk|unitedhealth|johnson\s*&\s*johnson|abbvie|merck|pfizer|astrazeneca|novartis|roche|sanofi|gsk|glaxosmithkline|takeda|bristol-myers|bristol\s*myers|amgen|gilead|vertex\s*pharma|regeneron|biogen|alnylam|biomarin|incyte|moderna|biontech|novavax|crispr|intellia|teva|viatris|zoetis|idexx|thermo\s*fisher|abbott|danaher|intuitive\s*surgical|stryker|boston\s*scientific|medtronic|edwards\s*lifesciences|zimmer\s*biomet|becton\s*dickinson|baxter|ge\s*healthcare|philips|alcon|resmed|dexcom|insulet|align\s*technology|hologic|steris|teleflex|waters\s*corp|agilent|mettler-toledo|revvity|bio-techne|illumina|exact\s*sciences|guardant|natera|iqvia|charles\s*river|medpace|hims|teladoc|cvs\s*health|cigna|elevance|humana|centene|molina|hca\s*healthcare|universal\s*health|tenet\s*healthcare|davita|labcorp|quest\s*diagnostics|mckesson|cencora|cardinal\s*health|walgreens|akdital|sothema|promopharm|healthcare|health\s*care|pharma|pharmaceutical|pharmaceuticals|biotech|biotechnology|biopharma|therapeutics|medical|medtech|surgical|diagnostics|genomics|oncology|hospital|clinics|vaccine|biosciences|life\s*sciences)\b/i.test(
      s
    )
  ) {
    return 'Healthcare & Biotech';
  }

  // 7. Consumer & Retail
  if (
    /\b(walmart|costco|target\s*corp|bj's\s*wholesale|dollar\s*general|dollar\s*tree|five\s*below|home\s*depot|lowe's|lowes|tractor\s*supply|williams-sonoma|wayfair|o'reilly\s*automotive|autozone|genuine\s*parts|carmax|autonation|carvana|mcdonald's|mcdonalds|starbucks|chipotle|yum!\s*brands|restaurant\s*brands|domino's|wendy's|shake\s*shack|wingstop|cava|dutch\s*bros|darden|texas\s*roadhouse|doordash|instacart|coca-cola|coca\s*cola|pepsico|pepsi|monster\s*beverage|celsius|keurig\s*dr\s*pepper|constellation\s*brands|molson\s*coors|anheuser-busch|diageo|brown-forman|procter\s*&\s*gamble|colgate-palmolive|kimberly-clark|church\s*&\s*dwight|clorox|estee\s*lauder|ulta\s*beauty|e\.l\.f\.\s*beauty|kenvue|nike|lululemon|on\s*holding|deckers|crocs|skechers|under\s*armour|adidas|ralph\s*lauren|tapestry|capri\s*holdings|lvmh|hermes|kering|richemont|tjx|ross\s*stores|burlington\s*stores|macy's|kohl's|nordstrom|gap\s*inc|abercrombie|american\s*eagle|urban\s*outfitters|levi\s*strauss|best\s*buy|gamestop|dick's\s*sporting|chewy|etsy|ebay|philip\s*morris|altria|british\s*american\s*tobacco|general\s*mills|kellanova|kraft\s*heinz|mondelez|hershey|campbell\s*soup|conagra|smucker|hormel|tyson\s*foods|mccormick|lamb\s*weston|archer-daniels-midland|bunge|kroger|albertsons|sprouts\s*farmers|sysco|us\s*foods|walt\s*disney|disney|warner\s*bros|paramount|fox\s*corp|new\s*york\s*times|live\s*nation|tko\s*group|mattel|hasbro|yeti|airbnb|booking\s*holdings|expedia|tripadvisor|marriott|hilton|hyatt|carnival|royal\s*caribbean|norwegian\s*cruise|las\s*vegas\s*sands|wynn\s*resorts|mgm\s*resorts|caesars|draftkings|flutter|alibaba|jd\.com|pinduoduo|mercadolibre|d\.r\.\s*horton|lennar|pultegroup|nvr|toll\s*brothers|whirlpool|cosumar|label\s*vie|societe\s*des\s*boissons|lesieur|oulmes|unimer|mutandis|consumer|retail|retailer|supermarket|grocery|hypermarket|e-commerce|ecommerce|marketplace|apparel|footwear|fashion|luxury|cosmetics|beauty|beverage|beverages|soft\s*drinks|brewery|tobacco|food|foods|snacks|confectionery|restaurant|restaurants|fast\s*food|hospitality|hotel|hotels|resort|cruise|casino|gaming|entertainment|streaming|homebuilder|household|appliances)\b/i.test(
      s
    )
  ) {
    return 'Consumer & Retail';
  }

  // 8. Energy, Utilities & Real Estate
  if (
    /\b(exxon\s*mobil|exxon|chevron|shell\s*plc|totalenergies|bp\s*p\.l\.c|equinor|petrobras|conocophillips|eog\s*resources|occidental\s*petroleum|devon\s*energy|diamondback\s*energy|coterra|apache|ovintiv|hess\s*corp|marathon\s*oil|marathon\s*petroleum|phillips\s*66|valero|schlumberger|slb|halliburton|baker\s*hughes|kinder\s*morgan|williams\s*companies|oneok|enterprise\s*products|energy\s*transfer|cheniere\s*energy|enbridge|tc\s*energy|suncor|canadian\s*natural|cameco|uranium\s*energy|nexgen|first\s*solar|enphase|solaredge|sunrun|nextracker|nextera\s*energy|southern\s*company|duke\s*energy|constellation\s*energy|vistra|nrg\s*energy|american\s*electric|sempra|dominion\s*energy|exelon|xcel\s*energy|public\s*service\s*enterprise|consolidated\s*edison|edison\s*international|pg&e|wec\s*energy|eversource|american\s*water|dte\s*energy|entergy|realty\s*income|prologis|american\s*tower|crown\s*castle|sba\s*communications|equinix|digital\s*realty|iron\s*mountain|simon\s*property|vici\s*properties|public\s*storage|extra\s*space|cubesmart|welltower|ventas|avalonbay|equity\s*residential|mid-america\s*apartment|essex\s*property|invitation\s*homes|alexandria\s*real\s*estate|boston\s*properties|kimco|regency\s*centers|federal\s*realty|w\.p\.\s*carey|weyerhaeuser|cbre|jones\s*lang\s*lasalle|costar|zillow|linde|air\s*products|ecolab|newmont|barrick\s*gold|agnico\s*eagle|franco-nevada|wheaton\s*precious|freeport-mcmoran|southern\s*copper|rio\s*tinto|bhp\s*group|vale\s*s\.a|albemarle|sociedad\s*quimica|dow\s*inc|dupont|lyondellbasell|cf\s*industries|mosaic|nutrien|corteva|at&t|verizon|t-mobile|comcast|charter\s*communications|vodafone|orange\s*s\.a|telefonica|america\s*movil|maroc\s*telecom|itissalat|taqa\s*morocco|managem|addoha|dar\s*saada|alliances|balima|immorente|aradei|total\s*maroc|afriquia\s*gaz|smi|energy|petroleum|oil\s*&\s*gas|crude\s*oil|natural\s*gas|lng|midstream|pipeline|refining|oilfield|drilling|solar|renewable|nuclear|uranium|utility|utilities|electric\s*power|water\s*utility|grid|reit|real\s*estate|property|properties|data\s*center\s*reit|cell\s*tower|mining|gold\s*mining|copper|lithium|chemicals|fertilizer|telecom|telecommunications|wireless\s*carrier)\b/i.test(
      s
    )
  ) {
    return 'Energy, Utilities & Real Estate';
  }

  // 9. Technology & Cloud
  if (
    /\b(apple\s*inc|microsoft|alphabet|google|amazon\.com|meta\s*platforms|netflix|salesforce|oracle|sap\s*se|adobe|ibm|cisco|servicenow|intuit|snowflake|palo\s*alto\s*networks|crowdstrike|fortinet|zscaler|cloudflare|okta|cyberark|datadog|mongodb|atlassian|workday|hubspot|veeva|trade\s*desk|applovin|unity\s*software|roblox|electronic\s*arts|take-two|nintendo|sony\s*group|spotify|pinterest|snap\s*inc|reddit|match\s*group|zoom\s*video|docusign|twilio|dropbox|asana|monday\.com|gitlab|confluent|elastic|dynatrace|netapp|pure\s*storage|western\s*digital|seagate|hp\s*inc|logitech|garmin|motorola\s*solutions|akamai|godaddy|wix|squarespace|shopify|sea\s*limited|grab\s*holdings|coupang|baidu|netease|tencent|microstrategy|accenture|cognizant|infosys|wipro|gartner|leidos|booz\s*allen|fair\s*isaac|fico|autodesk|duolingo|hps|hightech\s*payment|disway|involys|s2m|m2m\s*group|cloud\s*computing|saas|software|cybersecurity|enterprise\s*software|internet|operating\s*system|social\s*media|search\s*engine)\b/i.test(
      s
    )
  ) {
    return 'Technology & Cloud';
  }

  return null;
}

const GENERIC_LEGACY_SECTORS = new Set<string>([
  'technology',
  'technology & cloud',
  'tokenized stocks & equities',
  'equities',
  'equity',
  'us stock',
  'us stocks',
  'stocks',
  'digital assets',
  'other',
  'general',
  'unknown',
]);

/**
 * Classifies any stock into one of the 8 canonical Stock Sector Categories:
 *  - AI & Semiconductors
 *  - Technology & Cloud
 *  - Mechanics, Automotive & Industrials
 *  - Banking & Financials
 *  - Consumer & Retail
 *  - Healthcare & Biotech
 *  - Energy, Utilities & Real Estate
 *  - Index & Dividend ETFs
 *
 * Priority rules:
 * 1. Explicit non-generic user override (if the user explicitly picked one of the 7 non-default categories
 *    for a custom ticker, or if the ticker is unknown and has a valid canonical category).
 * 2. Authoritative 850+ Ticker Dictionary (`TICKER_TO_STOCK_SECTOR`) after normalizing tokenized tickers
 *    (`JPM`, `JPMON`, `JPMUSDT`, `bJPM`, `JPMX`, `JPMORGAN`, etc.) — ALWAYS overrides legacy DB defaults
 *    like `'Technology'` or `'Technology & Cloud'`!
 * 3. Deep Company Name & Brand Regex Matching (`matchSectorFromText`) on `companyName` + `ticker`
 *    (so `"JPMorgan Chase & Co."`, `"Caterpillar"`, `"Eli Lilly"`, etc. always resolve to their true category
 *    even if stored under a custom ticker or with legacy `sector = 'Technology'`).
 * 4. Explicit `existingSector` if it is one of the 8 canonical categories.
 * 5. Keyword matching on `existingSector` (if not a generic `'Technology'` default).
 */
export function resolveStockSectorCategory(params: {
  ticker: string;
  existingSector?: string | null;
  companyName?: string | null;
  market?: string | null;
}): StockSectorCategory {
  const raw = (params.ticker || '').trim().toUpperCase();
  const clean = normalizeStockTicker(raw);
  const existingTrimmed = (params.existingSector || '').trim();
  const existingLower = existingTrimmed.toLowerCase();

  // Check if the ticker or company name has an authoritative match in our 850+ stock dictionary
  const dictMatch =
    TICKER_TO_STOCK_SECTOR[clean] ||
    TICKER_TO_STOCK_SECTOR[raw] ||
    (params.companyName ? TICKER_TO_STOCK_SECTOR[normalizeStockTicker(params.companyName)] : undefined);

  // Check if the company name / ticker text matches a known company or industry
  const companyTextMatch = matchSectorFromText(`${params.companyName || ''} ${raw} ${clean}`);

  // If the user explicitly set a non-generic canonical category AND it's not the legacy 'Technology & Cloud' fallback
  // conflicting with a known non-tech stock (like JPMorgan -> Banking & Financials), honor it:
  const exactCanonicalExisting = ALL_STOCK_SECTOR_CATEGORIES.find(
    (c) => c.toLowerCase() === existingLower
  );

  if (dictMatch) {
    // If existingSector is a specific user-chosen category OTHER than 'Technology & Cloud'
    // (or if dictMatch itself is 'Technology & Cloud'), we still prefer dictMatch for known tickers
    // so that JPM, CAT, TSLA, LLY, XOM, VOO are NEVER misclassified as 'Technology & Cloud'!
    if (
      exactCanonicalExisting &&
      exactCanonicalExisting !== 'Technology & Cloud' &&
      dictMatch === 'Technology & Cloud'
    ) {
      return exactCanonicalExisting;
    }
    return dictMatch;
  }

  if (companyTextMatch) {
    if (
      exactCanonicalExisting &&
      exactCanonicalExisting !== 'Technology & Cloud' &&
      companyTextMatch === 'Technology & Cloud'
    ) {
      return exactCanonicalExisting;
    }
    return companyTextMatch;
  }

  // Market === 'ETF' goes to Index & Dividend ETFs
  if ((params.market || '').toUpperCase() === 'ETF') {
    return 'Index & Dividend ETFs';
  }

  // If existingSector is already one of the 8 canonical categories (and neither ticker nor company name matched another sector)
  if (exactCanonicalExisting) {
    return exactCanonicalExisting;
  }

  // If existingSector is not a generic legacy default ('Technology', 'Equities', etc.), check its keywords
  if (existingTrimmed && !GENERIC_LEGACY_SECTORS.has(existingLower)) {
    const sectorTextMatch = matchSectorFromText(existingTrimmed);
    if (sectorTextMatch) {
      return sectorTextMatch;
    }
  }

  return 'Technology & Cloud';
}
