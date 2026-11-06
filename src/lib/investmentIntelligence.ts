import type {
  DailyOhlcvBar,
  DividendEventRecord,
  HeldInstrumentType,
  PortfolioHistoryPoint,
  PriceFreshnessState,
  StockOrder,
  StockPosition,
  TechnicalIndicatorPoint,
  TraceableAiInsight,
  WalletCapitalFlowEntry,
} from '../types/index.js';
import {
  classifyAssetClass,
  normalizeStockTicker,
  resolveCanonicalCompanyName,
  resolveStockSectorCategory,
} from './stockCategories.js';

// ============================================================================
// 1. INSTRUMENT IDENTITY, EXCHANGE & COUNTRY METADATA (§3.3)
// ============================================================================

const KNOWN_ETFS = new Set([
  'VOO', 'SPY', 'QQQ', 'VTI', 'SCHD', 'JEPI', 'JEPQ', 'VYM', 'VXUS', 'IWM',
  'DIA', 'SMH', 'SOXX', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY',
  'XLU', 'XLB', 'XLRE', 'XLC', 'VNQ', 'TLT', 'GLD', 'SLV', 'IBIT', 'ARKK',
  'URTH', 'VT', 'BND', 'AGG', 'VIG', 'DGRO', 'NOBL',
]);

const KNOWN_ADRS: Record<string, { country: string; exchange: string }> = {
  TSM: { country: 'Taiwan', exchange: 'NYSE (ADR)' },
  ASML: { country: 'Netherlands', exchange: 'NASDAQ (ADR)' },
  NVO: { country: 'Denmark', exchange: 'NYSE (ADR)' },
  AZN: { country: 'United Kingdom', exchange: 'NASDAQ (ADR)' },
  SAP: { country: 'Germany', exchange: 'NYSE (ADR)' },
  TM: { country: 'Japan', exchange: 'NYSE (ADR)' },
  SONY: { country: 'Japan', exchange: 'NYSE (ADR)' },
  BABA: { country: 'China', exchange: 'NYSE (ADR)' },
  PDD: { country: 'China', exchange: 'NASDAQ (ADR)' },
  JD: { country: 'China', exchange: 'NASDAQ (ADR)' },
  BYDDY: { country: 'China', exchange: 'OTC (ADR)' },
  ARM: { country: 'United Kingdom', exchange: 'NASDAQ (ADR)' },
  SHOP: { country: 'Canada', exchange: 'NYSE' },
  MELI: { country: 'Latin America', exchange: 'NASDAQ' },
  SE: { country: 'Singapore', exchange: 'NYSE (ADR)' },
  NU: { country: 'Brazil', exchange: 'NYSE' },
  SHEL: { country: 'United Kingdom', exchange: 'NYSE (ADR)' },
  TTE: { country: 'France', exchange: 'NYSE (ADR)' },
  EQNR: { country: 'Norway', exchange: 'NYSE (ADR)' },
  RIO: { country: 'United Kingdom / Australia', exchange: 'NYSE (ADR)' },
  BHP: { country: 'Australia', exchange: 'NYSE (ADR)' },
  VALE: { country: 'Brazil', exchange: 'NYSE (ADR)' },
};

const KNOWN_CASABLANCA_BVC = new Set([
  'ATW', 'BCP', 'BOA', 'CIH', 'CDM', 'CFG', 'iam', 'IAM', 'TQM', 'TMA',
  'TGCC', 'LHM', 'MSA', 'SID', 'CMT', 'CSR', 'LBV', 'SBM', 'LES', 'OUL',
  'HPS', 'M2M', 'DISWAY', 'MIC', 'SOT', 'PRO', 'ADH', 'RDS', 'ALL', 'MASI',
]);

const NASDAQ_PRIMARY = new Set([
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'AMD',
  'AVGO', 'INTC', 'MU', 'QCOM', 'TXN', 'AMAT', 'LRCX', 'KLAC', 'SNPS',
  'CDNS', 'MRVL', 'ARM', 'SMCI', 'PLTR', 'CRWD', 'PANW', 'FTNT', 'ZS',
  'ADBE', 'COST', 'PEP', 'SBUX', 'NFLX', 'BKNG', 'ISRG', 'AMGN', 'GILD',
  'VRTX', 'REGN', 'HON', 'CSCO', 'PYPL', 'COIN', 'SOFI', 'ROKU', 'ASTS',
  'LUNR', 'RKLB', 'USAR',
]);

export interface ResolvedInstrumentIdentity {
  rawHeldTicker: string;
  canonicalTicker: string;
  underlyingTicker: string | null;
  companyName: string;
  instrumentType: HeldInstrumentType;
  instrumentTypeLabel: string;
  exchange: string;
  country: string;
  sector: string;
  isSyntheticOrTokenized: boolean;
  ownershipDisclosure: string;
}

export function resolveInstrumentIdentity(params: {
  rawTicker: string;
  companyName?: string | null;
  market?: string | null;
  sector?: string | null;
  source?: string | null;
}): ResolvedInstrumentIdentity {
  const rawUpper = (params.rawTicker || '').trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  const canonical = normalizeStockTicker(rawUpper) || rawUpper;
  const isBinanceEqPrefix =
    rawUpper.startsWith('EQ') &&
    rawUpper !== canonical &&
    rawUpper.length >= 3;

  const assetClass = classifyAssetClass({
    ticker: rawUpper,
    market: params.market,
    sector: params.sector,
  });

  const companyName = resolveCanonicalCompanyName(canonical, params.companyName);
  const sector = resolveStockSectorCategory({
    ticker: canonical,
    existingSector: params.sector,
    companyName,
    market: params.market,
  });

  if (assetClass === 'CRYPTO' || assetClass === 'STABLECOIN') {
    return {
      rawHeldTicker: rawUpper,
      canonicalTicker: canonical,
      underlyingTicker: null,
      companyName,
      instrumentType: 'CRYPTO',
      instrumentTypeLabel: 'Spot Cryptocurrency',
      exchange: 'Binance Spot',
      country: 'Global / Decentralized',
      sector: 'Cryptocurrency',
      isSyntheticOrTokenized: false,
      ownershipDisclosure: 'Direct cryptocurrency balance held in Spot/Earn wallet.',
    };
  }

  if (canonical === 'MASI' || canonical === 'SPX' || canonical === 'NDX') {
    return {
      rawHeldTicker: rawUpper,
      canonicalTicker: canonical,
      underlyingTicker: null,
      companyName: canonical === 'MASI' ? 'Casablanca MASI Index' : companyName,
      instrumentType: 'INDEX',
      instrumentTypeLabel: 'Market Benchmark Index',
      exchange: canonical === 'MASI' ? 'Casablanca Stock Exchange (BVC)' : 'US Index',
      country: canonical === 'MASI' ? 'Morocco' : 'United States',
      sector: 'Index & Dividend ETFs',
      isSyntheticOrTokenized: false,
      ownershipDisclosure: 'Benchmark index series used for relative comparison.',
    };
  }

  const isTokenized =
    isBinanceEqPrefix ||
    params.source === 'binance' ||
    (params.companyName || '').toLowerCase().includes('binance funding');

  const isEtf = KNOWN_ETFS.has(canonical) || (params.market || '').toUpperCase() === 'ETF';
  const adrInfo = KNOWN_ADRS[canonical];
  const isBvc = KNOWN_CASABLANCA_BVC.has(canonical) || (params.market || '').toUpperCase() === 'BVC';

  let instrumentType: HeldInstrumentType = 'EQUITY';
  let instrumentTypeLabel = 'Listed Ordinary Equity';

  if (isTokenized) {
    instrumentType = 'TOKENIZED_EQUITY';
    instrumentTypeLabel = isEtf ? 'Tokenized ETF (EQ*)' : 'Tokenized Equity (EQ*)';
  } else if (isEtf) {
    instrumentType = 'ETF';
    instrumentTypeLabel = 'Exchange-Traded Fund (ETF)';
  } else if (adrInfo) {
    instrumentType = 'ADR';
    instrumentTypeLabel = 'American Depositary Receipt (ADR)';
  }

  let country = 'United States';
  let exchange = NASDAQ_PRIMARY.has(canonical) ? 'NASDAQ' : 'NYSE';

  if (isBvc) {
    country = 'Morocco';
    exchange = 'Casablanca Stock Exchange (BVC)';
  } else if (adrInfo) {
    country = adrInfo.country;
    exchange = adrInfo.exchange;
  } else if (isEtf) {
    country = 'United States / Global Basket';
    exchange = canonical === 'QQQ' || canonical === 'SMH' || canonical === 'SOXX' ? 'NASDAQ' : 'NYSE Arca';
  }

  if (isTokenized) {
    exchange = `Binance Funding (${exchange} Ref)`;
  }

  const ownershipDisclosure = isTokenized
    ? `Held as tokenized equity (${rawUpper.startsWith('EQ') ? rawUpper : `EQ${canonical}`}) in Binance Funding Wallet tracking reference asset ${canonical} (${companyName}). Tokenized exposure reflects the underlying reference price and dividends but is distinct from direct registered share ownership at a traditional transfer agent.`
    : `Direct listed ${instrumentTypeLabel.toLowerCase()} (${canonical}) on ${exchange}.`;

  return {
    rawHeldTicker: rawUpper.startsWith('EQ') ? rawUpper : isTokenized ? `EQ${canonical}` : canonical,
    canonicalTicker: canonical,
    underlyingTicker: isTokenized ? canonical : null,
    companyName,
    instrumentType,
    instrumentTypeLabel,
    exchange,
    country,
    sector: sector || 'Unknown / Unclassified',
    isSyntheticOrTokenized: isTokenized,
    ownershipDisclosure,
  };
}

// ============================================================================
// 2. LOCAL TECHNICAL INDICATORS ENGINE (SMA, EMA, RSI, MACD, BOLLINGER) (§12.7)
// ============================================================================

export function computeTechnicalIndicators(bars: DailyOhlcvBar[]): TechnicalIndicatorPoint[] {
  if (!bars || bars.length === 0) return [];
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const closes = sorted.map((b) => Number(b.close) || 0);

  const calcSma = (period: number, idx: number): number | null => {
    if (idx + 1 < period) return null;
    let sum = 0;
    for (let i = idx - period + 1; i <= idx; i++) {
      sum += closes[i];
    }
    return Number((sum / period).toFixed(4));
  };

  // EMA helper
  const calcEmaSeries = (values: number[], period: number): (number | null)[] => {
    const result: (number | null)[] = new Array(values.length).fill(null);
    if (values.length < period) return result;
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let prevEma = sum / period;
    result[period - 1] = Number(prevEma.toFixed(4));
    for (let i = period; i < values.length; i++) {
      prevEma = values[i] * k + prevEma * (1 - k);
      result[i] = Number(prevEma.toFixed(4));
    }
    return result;
  };

  const ema12Series = calcEmaSeries(closes, 12);
  const ema26Series = calcEmaSeries(closes, 26);

  // MACD Line (EMA12 - EMA26) and Signal (9-period EMA of MACD Line)
  const macdLineSeries: (number | null)[] = closes.map((_, i) =>
    ema12Series[i] !== null && ema26Series[i] !== null
      ? Number(((ema12Series[i] as number) - (ema26Series[i] as number)).toFixed(4))
      : null
  );

  const validMacdValues: number[] = [];
  const validMacdIndices: number[] = [];
  macdLineSeries.forEach((v, idx) => {
    if (v !== null) {
      validMacdValues.push(v);
      validMacdIndices.push(idx);
    }
  });
  const macdSignalCompact = calcEmaSeries(validMacdValues, 9);
  const macdSignalSeries: (number | null)[] = new Array(closes.length).fill(null);
  validMacdIndices.forEach((origIdx, compactIdx) => {
    macdSignalSeries[origIdx] = macdSignalCompact[compactIdx];
  });

  // RSI 14 (Wilder's Smoothing)
  const rsi14Series: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length > 14) {
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= 14; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gainSum += diff;
      else lossSum += Math.abs(diff);
    }
    let avgGain = gainSum / 14;
    let avgLoss = lossSum / 14;
    const calcRsiVal = (g: number, l: number) => {
      if (l === 0) return 100;
      const rs = g / l;
      return Number((100 - 100 / (1 + rs)).toFixed(2));
    };
    rsi14Series[14] = calcRsiVal(avgGain, avgLoss);
    for (let i = 15; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
      rsi14Series[i] = calcRsiVal(avgGain, avgLoss);
    }
  }

  return sorted.map((bar, idx) => {
    const sma20 = calcSma(20, idx);
    const sma50 = calcSma(50, idx);
    const sma200 = calcSma(200, idx);

    let bollingerUpper: number | null = null;
    let bollingerLower: number | null = null;
    if (sma20 !== null && idx + 1 >= 20) {
      let varianceSum = 0;
      for (let i = idx - 19; i <= idx; i++) {
        const diff = closes[i] - sma20;
        varianceSum += diff * diff;
      }
      const stdDev = Math.sqrt(varianceSum / 20);
      bollingerUpper = Number((sma20 + 2 * stdDev).toFixed(4));
      bollingerLower = Number((sma20 - 2 * stdDev).toFixed(4));
    }

    const macdLine = macdLineSeries[idx];
    const macdSignal = macdSignalSeries[idx];
    const macdHistogram =
      macdLine !== null && macdSignal !== null
        ? Number((macdLine - macdSignal).toFixed(4))
        : null;

    return {
      date: bar.date,
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: closes[idx],
      volume: Number(bar.volume) || 0,
      sma20,
      sma50,
      sma200,
      ema12: ema12Series[idx],
      ema26: ema26Series[idx],
      bollingerUpper,
      bollingerMiddle: sma20,
      bollingerLower,
      rsi14: rsi14Series[idx],
      macdLine,
      macdSignal,
      macdHistogram,
    };
  });
}

// ============================================================================
// 3. RETURN METRICS: PERIOD RETURNS, CAGR, XIRR & TIME-WEIGHTED RETURN (§4.1)
// ============================================================================

export interface PortfolioReturnMetricsSummary {
  dailyReturnPercent: number | null;
  weeklyReturnPercent: number | null;
  monthlyReturnPercent: number | null;
  quarterlyReturnPercent: number | null;
  ytdReturnPercent: number | null;
  oneYearReturnPercent: number | null;
  allTimeSimpleReturnPercent: number | null;
  totalReturnWithDividendsPercent: number | null;
  cagrPercent: number | null;
  xirrPercent: number | null;
  twrPercent: number | null;
  averageHoldingDays: number;
  largestPositionWeightPercent: number;
  insufficientHistoryReason?: string | null;
}

/**
 * Newton-Raphson XIRR solver on dated cash flows.
 * Contributions into portfolio are negative cash flows (-amount);
 * withdrawals + terminal portfolio value are positive cash flows (+amount).
 */
export function computeXirrPercent(
  cashFlows: { date: Date; amount: number }[]
): number | null {
  if (!cashFlows || cashFlows.length < 2) return null;
  const sorted = [...cashFlows]
    .filter((cf) => Number.isFinite(cf.amount) && Math.abs(cf.amount) > 0.01)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (sorted.length < 2) return null;
  const hasNegative = sorted.some((c) => c.amount < 0);
  const hasPositive = sorted.some((c) => c.amount > 0);
  if (!hasNegative || !hasPositive) return null;

  const t0 = sorted[0].date.getTime();
  const totalDays = (sorted[sorted.length - 1].date.getTime() - t0) / (1000 * 60 * 60 * 24);
  if (totalDays < 7) return null; // Avoid wildly extrapolated annualized numbers for < 7 days

  let rate = 0.08; // Initial guess 8%
  for (let iter = 0; iter < 60; iter++) {
    let fValue = 0;
    let fDerivative = 0;
    for (const cf of sorted) {
      const years = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24 * 365.25);
      const base = Math.max(0.0001, 1 + rate);
      const discount = Math.pow(base, years);
      fValue += cf.amount / discount;
      if (years > 0) {
        fDerivative -= (years * cf.amount) / (discount * base);
      }
    }
    if (Math.abs(fValue) < 1e-4) break;
    if (Math.abs(fDerivative) < 1e-9) return null;
    const nextRate = rate - fValue / fDerivative;
    rate = Math.max(-0.95, Math.min(5.0, nextRate));
  }

  if (!Number.isFinite(rate) || rate <= -0.95 || rate >= 5.0) return null;
  return Number((rate * 100).toFixed(2));
}

export function computePortfolioReturnMetrics(params: {
  history: PortfolioHistoryPoint[];
  positions: StockPosition[];
  orders: StockOrder[];
  capitalFlows: WalletCapitalFlowEntry[];
  currentValueMad: number;
  netContributionsMad: number;
  totalCostBasisMad: number;
  totalReturnWithDividendsMad: number;
}): PortfolioReturnMetricsSummary {
  const {
    history,
    positions,
    orders,
    capitalFlows,
    currentValueMad,
    netContributionsMad,
    totalCostBasisMad,
    totalReturnWithDividendsMad,
  } = params;

  const denominator = totalCostBasisMad > 0 ? totalCostBasisMad : netContributionsMad;
  const allTimeSimpleReturnPercent =
    denominator > 0
      ? Number((((currentValueMad - denominator) / denominator) * 100).toFixed(2))
      : null;

  const totalReturnWithDividendsPercent =
    denominator > 0
      ? Number(((totalReturnWithDividendsMad / denominator) * 100).toFixed(2))
      : null;

  // Weighted 24h change from positions
  const totalPosValue = positions.reduce((s, p) => s + (p.marketValueMad || 0), 0);
  const dailyReturnPercent =
    totalPosValue > 0
      ? Number(
          (
            positions.reduce(
              (s, p) => s + (p.marketValueMad || 0) * ((p.change24hPercent || 0) / 100),
              0
            ) /
              totalPosValue *
            100
          ).toFixed(2)
        )
      : null;

  // Period returns from history points (neutralizing capital jump distortion by comparing netPnlPercent delta)
  const sortedHist = [...(history || [])].sort((a, b) => a.timestamp - b.timestamp);
  const calcHistoryWindowReturn = (daysBack: number): number | null => {
    if (sortedHist.length < 2) return null;
    const latest = sortedHist[sortedHist.length - 1];
    const cutoffTs = latest.timestamp - daysBack * 24 * 60 * 60 * 1000;
    const earliestOverall = sortedHist[0];
    if (latest.timestamp - earliestOverall.timestamp < daysBack * 0.4 * 24 * 60 * 60 * 1000) {
      return null; // Not enough history coverage for this window
    }
    const refPoint =
      sortedHist.find((pt) => pt.timestamp >= cutoffTs) || sortedHist[0];
    if (!refPoint || refPoint.costBasisMad <= 0) return null;
    const pnlDelta = latest.netPnlMad - refPoint.netPnlMad;
    return Number(((pnlDelta / Math.max(refPoint.costBasisMad, latest.costBasisMad)) * 100).toFixed(2));
  };

  const weeklyReturnPercent = calcHistoryWindowReturn(7) ?? allTimeSimpleReturnPercent;
  const monthlyReturnPercent = calcHistoryWindowReturn(30) ?? allTimeSimpleReturnPercent;
  const quarterlyReturnPercent = calcHistoryWindowReturn(90);
  const oneYearReturnPercent = calcHistoryWindowReturn(365);

  // YTD
  let ytdReturnPercent: number | null = null;
  if (sortedHist.length >= 2) {
    const currentYearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    const ytdRef = sortedHist.find((pt) => pt.timestamp >= currentYearStart) || sortedHist[0];
    const latest = sortedHist[sortedHist.length - 1];
    if (ytdRef && Math.max(ytdRef.costBasisMad, latest.costBasisMad) > 0) {
      ytdReturnPercent = Number(
        (
          ((latest.netPnlMad - ytdRef.netPnlMad) /
            Math.max(ytdRef.costBasisMad, latest.costBasisMad)) *
          100
        ).toFixed(2)
      );
    }
  }

  // Time-Weighted Return (TWR) across sub-periods in history
  let twrPercent: number | null = null;
  if (sortedHist.length >= 2) {
    let compound = 1;
    let validSubPeriods = 0;
    for (let i = 1; i < sortedHist.length; i++) {
      const prev = sortedHist[i - 1];
      const curr = sortedHist[i];
      const cashFlow = curr.initialCapitalMad - prev.initialCapitalMad;
      const denom = prev.portfolioValueMad + Math.max(0, cashFlow);
      if (denom > 0.5) {
        const subReturn = (curr.portfolioValueMad - prev.portfolioValueMad - cashFlow) / denom;
        if (Number.isFinite(subReturn) && subReturn > -0.95 && subReturn < 5) {
          compound *= 1 + subReturn;
          validSubPeriods++;
        }
      }
    }
    if (validSubPeriods > 0) {
      twrPercent = Number(((compound - 1) * 100).toFixed(2));
    }
  }
  if (twrPercent === null && allTimeSimpleReturnPercent !== null) {
    twrPercent = allTimeSimpleReturnPercent;
  }

  // XIRR from dated orders or capital flows
  const cashFlows: { date: Date; amount: number }[] = [];
  if (orders && orders.length > 0) {
    for (const o of orders) {
      const dt = new Date(o.executedAt);
      const mad = Number(o.totalMadAmount) || 0;
      if (mad > 0 && !Number.isNaN(dt.getTime())) {
        if (o.action === 'BUY') cashFlows.push({ date: dt, amount: -mad });
        else if (o.action === 'SELL' || o.action === 'DIVIDEND')
          cashFlows.push({ date: dt, amount: mad });
      }
    }
  } else if (capitalFlows && capitalFlows.length > 0) {
    for (const cf of capitalFlows) {
      const dt = new Date(cf.createdAt);
      if (cf.amountMad > 0 && !Number.isNaN(dt.getTime())) {
        if (cf.direction === 'WITHDRAWAL_TO_BANK')
          cashFlows.push({ date: dt, amount: cf.amountMad });
        else cashFlows.push({ date: dt, amount: -cf.amountMad });
      }
    }
  }
  if (cashFlows.length === 0 && denominator > 0 && sortedHist.length > 0) {
    cashFlows.push({
      date: new Date(sortedHist[0].timestamp),
      amount: -denominator,
    });
  }
  if (currentValueMad > 0) {
    cashFlows.push({ date: new Date(), amount: currentValueMad });
  }
  const xirrPercent = computeXirrPercent(cashFlows);

  // Average holding period & CAGR
  const holdingDaysList = positions
    .filter((p) => (p.marketValueMad || 0) > 0)
    .map((p) => p.holdingDays || 1);
  const averageHoldingDays =
    holdingDaysList.length > 0
      ? Math.round(holdingDaysList.reduce((s, d) => s + d, 0) / holdingDaysList.length)
      : 0;

  let cagrPercent: number | null = null;
  if (denominator > 0 && currentValueMad > 0 && averageHoldingDays >= 30) {
    const years = averageHoldingDays / 365.25;
    cagrPercent = Number(
      ((Math.pow(currentValueMad / denominator, 1 / Math.max(0.25, years)) - 1) * 100).toFixed(2)
    );
  }

  const largestPositionWeightPercent =
    totalPosValue > 0
      ? Number(
          (
            (Math.max(...positions.map((p) => p.marketValueMad || 0), 0) / totalPosValue) *
            100
          ).toFixed(1)
        )
      : 0;

  return {
    dailyReturnPercent,
    weeklyReturnPercent,
    monthlyReturnPercent,
    quarterlyReturnPercent,
    ytdReturnPercent,
    oneYearReturnPercent,
    allTimeSimpleReturnPercent,
    totalReturnWithDividendsPercent,
    cagrPercent,
    xirrPercent,
    twrPercent,
    averageHoldingDays,
    largestPositionWeightPercent,
    insufficientHistoryReason:
      averageHoldingDays < 30
        ? 'CAGR and multi-quarter returns require at least 30 days of verified holding history.'
        : null,
  };
}

// ============================================================================
// 4. BENCHMARK NORMALIZATION & COMPARISON (BASE = 100) (§4.2)
// ============================================================================

export interface NormalizedBenchmarkPoint {
  date: string;
  portfolioIndex: number; // Base 100
  portfolioReturnPct: number;
  spyIndex: number | null;
  spyReturnPct: number | null;
  qqqIndex: number | null;
  qqqReturnPct: number | null;
  masiIndex: number | null;
  masiReturnPct: number | null;
}

export interface BenchmarkComparisonResult {
  series: NormalizedBenchmarkPoint[];
  portfolioReturnPct: number;
  benchmarks: {
    symbol: string;
    name: string;
    currency: string;
    returnPct: number | null;
    spreadPctPoints: number | null;
    beta: number | null;
    alphaAnnualizedPct: number | null;
    trackingErrorPct: number | null;
    informationRatio: number | null;
    sampleSize: number;
  }[];
  currencyDisclosure: string;
}

export function computeBenchmarkComparison(params: {
  portfolioHistory: PortfolioHistoryPoint[];
  storedDailyBarsBySymbol: Record<string, DailyOhlcvBar[]>;
  riskFreeRatePercent: number;
}): BenchmarkComparisonResult {
  const { portfolioHistory, storedDailyBarsBySymbol, riskFreeRatePercent } = params;
  const sortedPort = [...(portfolioHistory || [])].sort((a, b) => a.timestamp - b.timestamp);

  if (sortedPort.length === 0) {
    return {
      series: [],
      portfolioReturnPct: 0,
      benchmarks: [],
      currencyDisclosure:
        'Portfolio returns are measured in MAD (net of cash-flow jumps); US benchmarks (SPY, QQQ) are measured in USD and MASI in MAD.',
    };
  }

  // Build date-indexed portfolio cumulative return index (starting at 100)
  const portByDate = new Map<string, number>();
  let runningIndex = 100;
  for (let i = 0; i < sortedPort.length; i++) {
    const pt = sortedPort[i];
    const dateStr = new Date(pt.timestamp).toISOString().slice(0, 10);
    if (i === 0) {
      runningIndex = 100;
    } else {
      const prev = sortedPort[i - 1];
      const cashFlow = pt.initialCapitalMad - prev.initialCapitalMad;
      const denom = prev.portfolioValueMad + Math.max(0, cashFlow);
      if (denom > 0.5) {
        const r = (pt.portfolioValueMad - prev.portfolioValueMad - cashFlow) / denom;
        if (Number.isFinite(r) && r > -0.5 && r < 2.0) {
          runningIndex = runningIndex * (1 + r);
        }
      }
    }
    portByDate.set(dateStr, Number(runningIndex.toFixed(2)));
  }

  const dates = Array.from(portByDate.keys()).sort();
  const startDate = dates[0];

  const getBenchCloseOnOrBefore = (bars: DailyOhlcvBar[], targetDate: string): number | null => {
    if (!bars || bars.length === 0) return null;
    let best: number | null = null;
    for (const b of bars) {
      if (b.date <= targetDate) {
        best = Number(b.close);
      } else {
        break;
      }
    }
    return best ?? (bars[0] ? Number(bars[0].close) : null);
  };

  const spyBars = [...(storedDailyBarsBySymbol['SPY'] || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const qqqBars = [...(storedDailyBarsBySymbol['QQQ'] || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const masiBars = [...(storedDailyBarsBySymbol['MASI'] || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const spyBase = getBenchCloseOnOrBefore(spyBars, startDate);
  const qqqBase = getBenchCloseOnOrBefore(qqqBars, startDate);
  const masiBase = getBenchCloseOnOrBefore(masiBars, startDate);

  const series: NormalizedBenchmarkPoint[] = dates.map((d) => {
    const pIdx = portByDate.get(d) ?? 100;
    const spyClose = getBenchCloseOnOrBefore(spyBars, d);
    const qqqClose = getBenchCloseOnOrBefore(qqqBars, d);
    const masiClose = getBenchCloseOnOrBefore(masiBars, d);

    const spyIdx = spyBase && spyClose ? Number(((spyClose / spyBase) * 100).toFixed(2)) : null;
    const qqqIdx = qqqBase && qqqClose ? Number(((qqqClose / qqqBase) * 100).toFixed(2)) : null;
    const masiIdx =
      masiBase && masiClose ? Number(((masiClose / masiBase) * 100).toFixed(2)) : null;

    return {
      date: d,
      portfolioIndex: pIdx,
      portfolioReturnPct: Number((pIdx - 100).toFixed(2)),
      spyIndex: spyIdx,
      spyReturnPct: spyIdx !== null ? Number((spyIdx - 100).toFixed(2)) : null,
      qqqIndex: qqqIdx,
      qqqReturnPct: qqqIdx !== null ? Number((qqqIdx - 100).toFixed(2)) : null,
      masiIndex: masiIdx,
      masiReturnPct: masiIdx !== null ? Number((masiIdx - 100).toFixed(2)) : null,
    };
  });

  const lastPt = series[series.length - 1];
  const portfolioReturnPct = lastPt ? lastPt.portfolioReturnPct : 0;

  const computeStatsForBench = (
    symbol: string,
    name: string,
    currency: string,
    pickIdx: (pt: NormalizedBenchmarkPoint) => number | null
  ) => {
    const valid = series.filter((pt) => pickIdx(pt) !== null);
    if (valid.length < 2) {
      return {
        symbol,
        name,
        currency,
        returnPct: null,
        spreadPctPoints: null,
        beta: null,
        alphaAnnualizedPct: null,
        trackingErrorPct: null,
        informationRatio: null,
        sampleSize: valid.length,
      };
    }

    const firstVal = pickIdx(valid[0]) as number;
    const lastVal = pickIdx(valid[valid.length - 1]) as number;
    const benchReturnPct = Number((((lastVal - firstVal) / firstVal) * 100).toFixed(2));
    const spreadPctPoints = Number((portfolioReturnPct - benchReturnPct).toFixed(2));

    // Periodic returns for Beta / Tracking Error
    const portRets: number[] = [];
    const benchRets: number[] = [];
    for (let i = 1; i < valid.length; i++) {
      const p0 = valid[i - 1].portfolioIndex;
      const p1 = valid[i].portfolioIndex;
      const b0 = pickIdx(valid[i - 1]) as number;
      const b1 = pickIdx(valid[i]) as number;
      if (p0 > 0 && b0 > 0) {
        portRets.push((p1 - p0) / p0);
        benchRets.push((b1 - b0) / b0);
      }
    }

    if (portRets.length < 10) {
      return {
        symbol,
        name,
        currency,
        returnPct: benchReturnPct,
        spreadPctPoints,
        beta: null,
        alphaAnnualizedPct: null,
        trackingErrorPct: null,
        informationRatio: null,
        sampleSize: portRets.length,
      };
    }

    const n = portRets.length;
    const meanP = portRets.reduce((s, v) => s + v, 0) / n;
    const meanB = benchRets.reduce((s, v) => s + v, 0) / n;
    let cov = 0;
    let varB = 0;
    let diffSqSum = 0;
    for (let i = 0; i < n; i++) {
      const dp = portRets[i] - meanP;
      const db = benchRets[i] - meanB;
      cov += dp * db;
      varB += db * db;
      const activeDiff = portRets[i] - benchRets[i] - (meanP - meanB);
      diffSqSum += activeDiff * activeDiff;
    }
    const beta = varB > 1e-9 ? Number((cov / varB).toFixed(2)) : null;
    const trackingErrorDaily = Math.sqrt(diffSqSum / Math.max(1, n - 1));
    const trackingErrorPct = Number((trackingErrorDaily * Math.sqrt(252) * 100).toFixed(2));
    const activeReturnAnnualized = (meanP - meanB) * 252 * 100;
    const informationRatio =
      trackingErrorPct > 0.01 ? Number((activeReturnAnnualized / trackingErrorPct).toFixed(2)) : null;

    const rfDaily = (riskFreeRatePercent / 100) / 252;
    const alphaDaily =
      beta !== null ? meanP - rfDaily - beta * (meanB - rfDaily) : null;
    const alphaAnnualizedPct =
      alphaDaily !== null ? Number((alphaDaily * 252 * 100).toFixed(2)) : null;

    return {
      symbol,
      name,
      currency,
      returnPct: benchReturnPct,
      spreadPctPoints,
      beta,
      alphaAnnualizedPct,
      trackingErrorPct,
      informationRatio,
      sampleSize: n,
    };
  };

  return {
    series,
    portfolioReturnPct,
    benchmarks: [
      computeStatsForBench('SPY', 'S&P 500 ETF (SPY)', 'USD', (pt) => pt.spyIndex),
      computeStatsForBench('QQQ', 'Nasdaq-100 ETF (QQQ)', 'USD', (pt) => pt.qqqIndex),
      computeStatsForBench('MASI', 'Casablanca MASI Index', 'MAD', (pt) => pt.masiIndex),
    ],
    currencyDisclosure:
      'All series are normalized to Base = 100 at the start of the selected window. Portfolio TWR is measured in MAD; SPY & QQQ are USD total-market proxies and MASI is denominated in MAD.',
  };
}

// ============================================================================
// 5. PERFORMANCE ATTRIBUTION (§4.3)
// ============================================================================

export interface AttributionItem {
  label: string;
  subLabel?: string;
  weightPercent: number;
  ownReturnPercent: number;
  portfolioContributionPercent: number;
  pnlMad: number;
  pnlUsd: number;
}

export interface PortfolioAttributionSummary {
  byHolding: AttributionItem[];
  bySector: AttributionItem[];
  byAssetClass: AttributionItem[];
  waterfallComponents: {
    priceAppreciationMad: number;
    dividendsEarnedMad: number;
    fxEffectMad: number;
    feesAndTaxesDragMad: number;
    netTotalReturnMad: number;
  };
}

export function computePerformanceAttribution(params: {
  positions: StockPosition[];
  usdToMadRate: number;
  dividendsEarnedMad: number;
  feesDragMad: number;
}): PortfolioAttributionSummary {
  const { positions, usdToMadRate, dividendsEarnedMad, feesDragMad } = params;
  const totalCostMad = positions.reduce((s, p) => s + (p.costBasisMad || 0), 0);
  const totalValMad = positions.reduce((s, p) => s + (p.marketValueMad || 0), 0);
  const baseDenom = Math.max(totalCostMad, totalValMad, 1);

  const byHolding: AttributionItem[] = positions
    .map((p) => {
      const netPnlMad = p.netPnlAfterFeesMad ?? p.unrealizedPnlMad ?? 0;
      const netPnlUsd = netPnlMad / usdToMadRate;
      const ownRet =
        (p.costBasisMad || 0) > 0 ? (netPnlMad / p.costBasisMad) * 100 : 0;
      const contribPct = (netPnlMad / baseDenom) * 100;
      return {
        label: p.ticker,
        subLabel: p.companyName,
        weightPercent:
          totalValMad > 0 ? Number(((p.marketValueMad / totalValMad) * 100).toFixed(1)) : 0,
        ownReturnPercent: Number(ownRet.toFixed(2)),
        portfolioContributionPercent: Number(contribPct.toFixed(2)),
        pnlMad: Number(netPnlMad.toFixed(2)),
        pnlUsd: Number(netPnlUsd.toFixed(2)),
      };
    })
    .sort((a, b) => b.pnlMad - a.pnlMad);

  // Group by Sector
  const sectorMap = new Map<string, { costMad: number; valMad: number; pnlMad: number }>();
  const assetClassMap = new Map<string, { costMad: number; valMad: number; pnlMad: number }>();

  for (const p of positions) {
    const identity = resolveInstrumentIdentity({
      rawTicker: p.rawHeldTicker || p.ticker,
      companyName: p.companyName,
      market: p.market,
      sector: p.sector,
      source: p.source,
    });
    const sec = identity.sector || 'Unknown / Unclassified';
    const clsLabel = identity.instrumentTypeLabel;
    const netPnlMad = p.netPnlAfterFeesMad ?? p.unrealizedPnlMad ?? 0;

    const curSec = sectorMap.get(sec) || { costMad: 0, valMad: 0, pnlMad: 0 };
    curSec.costMad += p.costBasisMad || 0;
    curSec.valMad += p.marketValueMad || 0;
    curSec.pnlMad += netPnlMad;
    sectorMap.set(sec, curSec);

    const curCls = assetClassMap.get(clsLabel) || { costMad: 0, valMad: 0, pnlMad: 0 };
    curCls.costMad += p.costBasisMad || 0;
    curCls.valMad += p.marketValueMad || 0;
    curCls.pnlMad += netPnlMad;
    assetClassMap.set(clsLabel, curCls);
  }

  const bySector: AttributionItem[] = Array.from(sectorMap.entries())
    .map(([sector, d]) => ({
      label: sector,
      weightPercent: totalValMad > 0 ? Number(((d.valMad / totalValMad) * 100).toFixed(1)) : 0,
      ownReturnPercent: d.costMad > 0 ? Number(((d.pnlMad / d.costMad) * 100).toFixed(2)) : 0,
      portfolioContributionPercent: Number(((d.pnlMad / baseDenom) * 100).toFixed(2)),
      pnlMad: Number(d.pnlMad.toFixed(2)),
      pnlUsd: Number((d.pnlMad / usdToMadRate).toFixed(2)),
    }))
    .sort((a, b) => b.pnlMad - a.pnlMad);

  const byAssetClass: AttributionItem[] = Array.from(assetClassMap.entries())
    .map(([cls, d]) => ({
      label: cls,
      weightPercent: totalValMad > 0 ? Number(((d.valMad / totalValMad) * 100).toFixed(1)) : 0,
      ownReturnPercent: d.costMad > 0 ? Number(((d.pnlMad / d.costMad) * 100).toFixed(2)) : 0,
      portfolioContributionPercent: Number(((d.pnlMad / baseDenom) * 100).toFixed(2)),
      pnlMad: Number(d.pnlMad.toFixed(2)),
      pnlUsd: Number((d.pnlMad / usdToMadRate).toFixed(2)),
    }))
    .sort((a, b) => b.weightPercent - a.weightPercent);

  const grossMarketPnlMad = positions.reduce((s, p) => s + (p.unrealizedPnlMad || 0), 0);
  const fxEffectMad = 0; // Explicitly 0 unless historical lot-by-lot FX rates differ from current USD/MAD
  const netTotalReturnMad = grossMarketPnlMad + dividendsEarnedMad - feesDragMad;

  return {
    byHolding,
    bySector,
    byAssetClass,
    waterfallComponents: {
      priceAppreciationMad: Number(grossMarketPnlMad.toFixed(2)),
      dividendsEarnedMad: Number(dividendsEarnedMad.toFixed(2)),
      fxEffectMad,
      feesAndTaxesDragMad: Number((-Math.abs(feesDragMad)).toFixed(2)),
      netTotalReturnMad: Number(netTotalReturnMad.toFixed(2)),
    },
  };
}

// ============================================================================
// 6. RISK, CONCENTRATION, DRAWDOWN, VOLATILITY, VaR/CVaR & CORRELATION (§6)
// ============================================================================

export interface DrawdownPoint {
  date: string;
  portfolioValueMad: number;
  rollingPeakMad: number;
  drawdownPercent: number; // <= 0
}

export interface PortfolioRiskAnalysis {
  concentration: {
    largestPositionTicker: string;
    largestPositionWeightPercent: number;
    top3ConcentrationPercent: number;
    top5ConcentrationPercent: number;
    top10ConcentrationPercent: number;
    hhiScore: number; // 0 to 10,000
    byCountry: { label: string; valueMad: number; weightPercent: number }[];
    byCurrency: { label: string; valueMad: number; weightPercent: number }[];
    byAssetClass: { label: string; valueMad: number; weightPercent: number }[];
  };
  drawdownSeries: DrawdownPoint[];
  currentDrawdownPercent: number;
  maxDrawdownPercent: number;
  volatilityMetrics: {
    sampleDays: number;
    isSufficientSample: boolean;
    insufficientReason?: string | null;
    annualizedVolatilityPercent: number | null;
    sharpeRatio: number | null;
    sortinoRatio: number | null;
    historicalVar95Percent: number | null;
    historicalCvar95Percent: number | null;
    riskFreeRateAssumptionPercent: number;
  };
  correlationMatrix: {
    symbols: string[];
    matrix: { rowSymbol: string; colSymbol: string; correlation: number | null; overlapDays: number }[][];
  };
}

export function computePortfolioRiskAnalysis(params: {
  positions: StockPosition[];
  portfolioHistory: PortfolioHistoryPoint[];
  storedDailyBarsBySymbol: Record<string, DailyOhlcvBar[]>;
  riskFreeRatePercent: number;
  uninvestedCashMad?: number;
}): PortfolioRiskAnalysis {
  const {
    positions,
    portfolioHistory,
    storedDailyBarsBySymbol,
    riskFreeRatePercent,
    uninvestedCashMad = 0,
  } = params;

  const sortedPos = [...positions].sort((a, b) => (b.marketValueMad || 0) - (a.marketValueMad || 0));
  const totalPosMad = sortedPos.reduce((s, p) => s + (p.marketValueMad || 0), 0);
  const totalWithCashMad = totalPosMad + Math.max(0, uninvestedCashMad);

  const weights = sortedPos.map((p) =>
    totalPosMad > 0 ? ((p.marketValueMad || 0) / totalPosMad) * 100 : 0
  );

  const sumTopN = (n: number) =>
    Number(weights.slice(0, n).reduce((s, w) => s + w, 0).toFixed(1));

  const hhiScore = Math.round(weights.reduce((s, w) => s + w * w, 0));

  const countryMap = new Map<string, number>();
  const currencyMap = new Map<string, number>();
  const assetClassMap = new Map<string, number>();

  for (const p of sortedPos) {
    const id = resolveInstrumentIdentity({
      rawTicker: p.rawHeldTicker || p.ticker,
      companyName: p.companyName,
      market: p.market,
      sector: p.sector,
      source: p.source,
    });
    const country = id.country || 'Unknown / Unclassified';
    const curr = (p.currency || 'USD').toUpperCase();
    const cls = id.instrumentTypeLabel;

    countryMap.set(country, (countryMap.get(country) || 0) + (p.marketValueMad || 0));
    currencyMap.set(curr, (currencyMap.get(curr) || 0) + (p.marketValueMad || 0));
    assetClassMap.set(cls, (assetClassMap.get(cls) || 0) + (p.marketValueMad || 0));
  }

  if (uninvestedCashMad > 0.5) {
    assetClassMap.set('Investment Cash / Stablecoin Reserve', uninvestedCashMad);
    currencyMap.set('USD / Stablecoin', (currencyMap.get('USD / Stablecoin') || 0) + uninvestedCashMad);
  }

  const toAllocationArray = (m: Map<string, number>, denom: number) =>
    Array.from(m.entries())
      .map(([label, valueMad]) => ({
        label,
        valueMad: Number(valueMad.toFixed(2)),
        weightPercent: denom > 0 ? Number(((valueMad / denom) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.valueMad - a.valueMad);

  // Drawdown Series
  const sortedHist = [...(portfolioHistory || [])].sort((a, b) => a.timestamp - b.timestamp);
  let rollingPeak = 0;
  let maxDrawdownPercent = 0;
  const drawdownSeries: DrawdownPoint[] = sortedHist.map((pt) => {
    const val = pt.portfolioValueMad || 0;
    if (val > rollingPeak) rollingPeak = val;
    const dd = rollingPeak > 0 ? ((val - rollingPeak) / rollingPeak) * 100 : 0;
    if (dd < maxDrawdownPercent) maxDrawdownPercent = dd;
    return {
      date: pt.shortLabel || new Date(pt.timestamp).toISOString().slice(0, 10),
      portfolioValueMad: Number(val.toFixed(2)),
      rollingPeakMad: Number(rollingPeak.toFixed(2)),
      drawdownPercent: Number(dd.toFixed(2)),
    };
  });
  const currentDrawdownPercent =
    drawdownSeries.length > 0 ? drawdownSeries[drawdownSeries.length - 1].drawdownPercent : 0;

  // Compute Portfolio Synthetic Daily Returns from held positions' stored daily bars (weighted by current portfolio weight)
  const heldSymbols = sortedPos.map((p) => normalizeStockTicker(p.ticker) || p.ticker);
  const symbolReturnMaps = new Map<string, Map<string, number>>();
  const allReturnDates = new Set<string>();

  for (const sym of heldSymbols) {
    const bars = [...(storedDailyBarsBySymbol[sym] || [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const rMap = new Map<string, number>();
    for (let i = 1; i < bars.length; i++) {
      const c0 = Number(bars[i - 1].close);
      const c1 = Number(bars[i].close);
      if (c0 > 0 && c1 > 0) {
        const r = (c1 - c0) / c0;
        rMap.set(bars[i].date, r);
        allReturnDates.add(bars[i].date);
      }
    }
    symbolReturnMaps.set(sym, rMap);
  }

  const sortedReturnDates = Array.from(allReturnDates).sort();
  const portfolioDailyReturns: number[] = [];

  for (const d of sortedReturnDates) {
    let weightedRet = 0;
    let coveredWeight = 0;
    sortedPos.forEach((p, idx) => {
      const sym = normalizeStockTicker(p.ticker) || p.ticker;
      const r = symbolReturnMaps.get(sym)?.get(d);
      const w = (weights[idx] || 0) / 100;
      if (r !== undefined && w > 0) {
        weightedRet += r * w;
        coveredWeight += w;
      }
    });
    if (coveredWeight >= 0.4) {
      portfolioDailyReturns.push(weightedRet / coveredWeight);
    }
  }

  const sampleDays = portfolioDailyReturns.length;
  const isSufficientSample = sampleDays >= 15;

  let annualizedVolatilityPercent: number | null = null;
  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;
  let historicalVar95Percent: number | null = null;
  let historicalCvar95Percent: number | null = null;

  if (isSufficientSample) {
    const mean = portfolioDailyReturns.reduce((s, r) => s + r, 0) / sampleDays;
    const variance =
      portfolioDailyReturns.reduce((s, r) => s + (r - mean) * (r - mean), 0) /
      Math.max(1, sampleDays - 1);
    const stdDaily = Math.sqrt(variance);
    annualizedVolatilityPercent = Number((stdDaily * Math.sqrt(252) * 100).toFixed(2));

    const rfDaily = (riskFreeRatePercent / 100) / 252;
    const excessDaily = mean - rfDaily;
    if (stdDaily > 1e-6) {
      sharpeRatio = Number(((excessDaily / stdDaily) * Math.sqrt(252)).toFixed(2));
    }

    const downsideSq =
      portfolioDailyReturns.reduce((s, r) => {
        const diff = Math.min(0, r - rfDaily);
        return s + diff * diff;
      }, 0) / sampleDays;
    const downsideStd = Math.sqrt(downsideSq);
    if (downsideStd > 1e-6) {
      sortinoRatio = Number(((excessDaily / downsideStd) * Math.sqrt(252)).toFixed(2));
    }

    const sortedRetsAsc = [...portfolioDailyReturns].sort((a, b) => a - b);
    const varIdx = Math.max(0, Math.floor(sampleDays * 0.05));
    historicalVar95Percent = Number((sortedRetsAsc[varIdx] * 100).toFixed(2));
    const tailSlice = sortedRetsAsc.slice(0, varIdx + 1);
    const cvarMean = tailSlice.reduce((s, r) => s + r, 0) / Math.max(1, tailSlice.length);
    historicalCvar95Percent = Number((cvarMean * 100).toFixed(2));
  }

  // Correlation Matrix across up to 8 top holdings
  const corrSymbols = heldSymbols.slice(0, 8);
  const matrix = corrSymbols.map((rowSym) =>
    corrSymbols.map((colSym) => {
      if (rowSym === colSym) {
        return { rowSymbol: rowSym, colSymbol: colSym, correlation: 1.0, overlapDays: sampleDays };
      }
      const mapA = symbolReturnMaps.get(rowSym);
      const mapB = symbolReturnMaps.get(colSym);
      if (!mapA || !mapB) {
        return { rowSymbol: rowSym, colSymbol: colSym, correlation: null, overlapDays: 0 };
      }
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [d, valA] of mapA.entries()) {
        const valB = mapB.get(d);
        if (valB !== undefined) {
          xs.push(valA);
          ys.push(valB);
        }
      }
      if (xs.length < 10) {
        return { rowSymbol: rowSym, colSymbol: colSym, correlation: null, overlapDays: xs.length };
      }
      const mX = xs.reduce((s, v) => s + v, 0) / xs.length;
      const mY = ys.reduce((s, v) => s + v, 0) / ys.length;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - mX;
        const dy = ys[i] - mY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      const denom = Math.sqrt(denX * denY);
      const corr = denom > 1e-9 ? Number((num / denom).toFixed(2)) : null;
      return {
        rowSymbol: rowSym,
        colSymbol: colSym,
        correlation: corr,
        overlapDays: xs.length,
      };
    })
  );

  return {
    concentration: {
      largestPositionTicker: sortedPos[0]?.ticker || 'None',
      largestPositionWeightPercent: Number((weights[0] || 0).toFixed(1)),
      top3ConcentrationPercent: sumTopN(3),
      top5ConcentrationPercent: sumTopN(5),
      top10ConcentrationPercent: sumTopN(10),
      hhiScore,
      byCountry: toAllocationArray(countryMap, totalPosMad),
      byCurrency: toAllocationArray(currencyMap, totalWithCashMad),
      byAssetClass: toAllocationArray(assetClassMap, totalWithCashMad),
    },
    drawdownSeries,
    currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
    maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2)),
    volatilityMetrics: {
      sampleDays,
      isSufficientSample,
      insufficientReason: !isSufficientSample
        ? `At least 15 overlapping daily sessions are required to compute statistically valid volatility, Sharpe, Sortino, and VaR metrics (currently ${sampleDays} sessions cached).`
        : null,
      annualizedVolatilityPercent,
      sharpeRatio,
      sortinoRatio,
      historicalVar95Percent,
      historicalCvar95Percent,
      riskFreeRateAssumptionPercent: riskFreeRatePercent,
    },
    correlationMatrix: {
      symbols: corrSymbols,
      matrix,
    },
  };
}

// ============================================================================
// 7. TRACEABLE AI INVESTMENT INSIGHTS GENERATOR (§7)
// ============================================================================

export function generateTraceableAiInsights(params: {
  positions: StockPosition[];
  usdToMadRate: number;
  returnMetrics: PortfolioReturnMetricsSummary;
  riskAnalysis: PortfolioRiskAnalysis;
  benchmarkComparison: BenchmarkComparisonResult;
  dividendEvents: DividendEventRecord[];
  asOfTimestamp: string;
}): TraceableAiInsight[] {
  const {
    positions,
    usdToMadRate,
    returnMetrics,
    riskAnalysis,
    benchmarkComparison,
    dividendEvents,
    asOfTimestamp,
  } = params;

  const insights: TraceableAiInsight[] = [];
  if (!positions || positions.length === 0) return insights;

  const totalStocksMad = positions.reduce((s, p) => s + (p.marketValueMad || 0), 0);
  const totalStocksUsd = totalStocksMad / usdToMadRate;
  const totalNetPnlMad = positions.reduce(
    (s, p) => s + (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad ?? 0),
    0
  );
  const totalNetPnlUsd = totalNetPnlMad / usdToMadRate;

  // 1. Portfolio Performance & Net Return Summary
  insights.push({
    id: 'trace-perf-summary',
    type: 'PERFORMANCE_SUMMARY',
    severity: totalNetPnlMad >= 0 ? 'positive' : 'warning',
    title: 'Portfolio Net Valuation & Fee-Adjusted Return',
    metricBadge: `${totalNetPnlMad >= 0 ? '+' : ''}$${totalNetPnlUsd.toFixed(2)} (${totalNetPnlMad.toFixed(0)} MAD)`,
    periodLabel: 'All-Time Held Positions',
    asOfTimestamp,
    relatedTickers: positions.map((p) => p.ticker),
    observedFact: `Your ${positions.length} active stock positions currently hold a combined market value of $${totalStocksUsd.toFixed(2)} (${totalStocksMad.toFixed(2)} MAD) with a net P&L of ${totalNetPnlMad >= 0 ? '+' : ''}$${totalNetPnlUsd.toFixed(2)} after entry and estimated exit fees.`,
    calculationExplanation: `Net P&L = Current Market Value minus Remaining Cost Basis minus Round-Trip Brokerage Fees (0.10% per leg). Time-Weighted Return (TWR): ${returnMetrics.twrPercent !== null ? `${returnMetrics.twrPercent}%` : 'Insufficient history'}.`,
    interpretationAndContext:
      'Separating net investment performance from external deposits ensures cash contributions never masquerade as market gains.',
    dataFreshnessNote: `Valuations synced as of ${new Date(asOfTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} using USD/MAD = ${usdToMadRate.toFixed(2)}.`,
  });

  // 2. Top Contributor & Detractor
  const sortedByPnl = [...positions].sort(
    (a, b) =>
      (b.netPnlAfterFeesMad ?? b.unrealizedPnlMad ?? 0) -
      (a.netPnlAfterFeesMad ?? a.unrealizedPnlMad ?? 0)
  );
  const best = sortedByPnl[0];
  const worst = sortedByPnl[sortedByPnl.length - 1];

  if (best) {
    const bestNetUsd = (best.netPnlAfterFeesMad ?? best.unrealizedPnlMad ?? 0) / usdToMadRate;
    insights.push({
      id: 'trace-top-contributor',
      type: 'TOP_CONTRIBUTOR',
      severity: bestNetUsd >= 0 ? 'positive' : 'neutral',
      title: `Primary Performance Driver: ${best.ticker}`,
      metricBadge: `${bestNetUsd >= 0 ? '+' : ''}$${bestNetUsd.toFixed(2)} Net`,
      periodLabel: 'Since Entry',
      asOfTimestamp,
      relatedTickers: [best.ticker],
      observedFact: `${best.companyName} (${best.ticker}) represents ${((best.marketValueMad / Math.max(1, totalStocksMad)) * 100).toFixed(1)}% of your equities portfolio ($${(best.marketValueUsd ?? best.marketValueMad / usdToMadRate).toFixed(2)}) with a net P&L of ${bestNetUsd >= 0 ? '+' : ''}$${bestNetUsd.toFixed(2)}.`,
      calculationExplanation: `Entry Avg Cost: $${best.avgCostNum.toFixed(2)} · Current Price: $${best.currentPriceNum.toFixed(2)} · Exact Breakeven Price (incl. fees): $${(best.breakevenPriceNative ?? best.avgCostNum * 1.002).toFixed(2)}.`,
      interpretationAndContext:
        'Monitoring the spread between current market price and fee-adjusted breakeven price protects realized gains when trimming or rebalancing.',
      dataFreshnessNote: `Source: ${best.dataSource || 'Cached Live Quote'} (${best.freshnessState || 'EOD_CACHED'}).`,
    });
  }

  if (worst && worst.ticker !== best?.ticker && (worst.netPnlAfterFeesMad ?? 0) < 0) {
    const worstNetUsd = (worst.netPnlAfterFeesMad ?? worst.unrealizedPnlMad ?? 0) / usdToMadRate;
    insights.push({
      id: 'trace-top-detractor',
      type: 'TOP_DETRACTOR',
      severity: 'warning',
      title: `Largest Unrealized Drag: ${worst.ticker}`,
      metricBadge: `-$${Math.abs(worstNetUsd).toFixed(2)} (${(worst.netPnlAfterFeesPercent ?? worst.unrealizedPnlPercent).toFixed(2)}%)`,
      periodLabel: 'Since Entry',
      asOfTimestamp,
      relatedTickers: [worst.ticker],
      observedFact: `${worst.companyName} (${worst.ticker}) is currently trading ${Math.abs(worst.unrealizedPnlPercent).toFixed(2)}% below its average acquisition cost of $${worst.avgCostNum.toFixed(2)}.`,
      calculationExplanation: `Requires a price move to $${(worst.breakevenPriceNative ?? worst.avgCostNum * 1.002).toFixed(2)} (+${(worst.distanceToBreakevenPercent ?? 0).toFixed(2)}%) to cover cost basis plus round-trip fees.`,
      interpretationAndContext:
        'A price decline alone does not automatically make a position a buy or a sell; evaluate whether the original sector thesis and position weight still match your risk tolerance.',
      dataFreshnessNote: `Source: ${worst.dataSource || 'Cached Live Quote'}.`,
    });
  }

  // 3. Concentration & Diversification Check
  if (riskAnalysis.concentration.largestPositionWeightPercent >= 30) {
    insights.push({
      id: 'trace-concentration',
      type: 'CONCENTRATION_WARNING',
      severity: riskAnalysis.concentration.largestPositionWeightPercent >= 45 ? 'warning' : 'info',
      title: `Position & Sector Concentration (${riskAnalysis.concentration.largestPositionTicker})`,
      metricBadge: `Top 1: ${riskAnalysis.concentration.largestPositionWeightPercent}% · Top 3: ${riskAnalysis.concentration.top3ConcentrationPercent}%`,
      periodLabel: 'Current Allocation',
      asOfTimestamp,
      relatedTickers: [riskAnalysis.concentration.largestPositionTicker],
      observedFact: `Your largest single holding (${riskAnalysis.concentration.largestPositionTicker}) accounts for ${riskAnalysis.concentration.largestPositionWeightPercent}% of total equity value, and your top 3 holdings account for ${riskAnalysis.concentration.top3ConcentrationPercent}%.`,
      calculationExplanation: `Portfolio Herfindahl-Hirschman Index (HHI) is ${riskAnalysis.concentration.hhiScore} on a 0–10,000 scale (where 10,000 is a single-stock portfolio).`,
      interpretationAndContext:
        'High concentration amplifies single-company earnings and sector volatility. If you prefer smoother drawdown behavior, future contributions can be directed toward underrepresented sectors.',
      dataFreshnessNote: 'Calculated from live market weights.',
    });
  }

  // 4. Volatility & Risk-Adjusted Telemetry
  if (riskAnalysis.volatilityMetrics.isSufficientSample && riskAnalysis.volatilityMetrics.annualizedVolatilityPercent !== null) {
    insights.push({
      id: 'trace-volatility-risk',
      type: 'DRAWDOWN_VOLATILITY',
      severity: 'info',
      title: 'Historical Volatility & Tail-Risk Profile',
      metricBadge: `Vol: ${riskAnalysis.volatilityMetrics.annualizedVolatilityPercent}% · Sharpe: ${riskAnalysis.volatilityMetrics.sharpeRatio ?? 'N/A'}`,
      periodLabel: `${riskAnalysis.volatilityMetrics.sampleDays} Trading Sessions`,
      asOfTimestamp,
      relatedTickers: positions.map((p) => p.ticker),
      observedFact: `Across ${riskAnalysis.volatilityMetrics.sampleDays} aligned daily sessions, annualized portfolio volatility is ${riskAnalysis.volatilityMetrics.annualizedVolatilityPercent}% with a 95% daily Historical VaR of ${riskAnalysis.volatilityMetrics.historicalVar95Percent}%.`,
      calculationExplanation: `Computed locally from cached daily OHLCV closes weighted by current holdings, assuming a ${riskAnalysis.volatilityMetrics.riskFreeRateAssumptionPercent}% risk-free rate.`,
      interpretationAndContext:
        'Historical volatility and VaR describe past return dispersion and do not guarantee future market bounds.',
      dataFreshnessNote: 'Derived from persisted daily OHLCV bars (zero extra API credits consumed).',
    });
  }

  // 5. Dividend Cash-Flow Trace
  const totalAnnualDivMad = positions.reduce((s, p) => s + (p.annualDividendMad || 0), 0);
  const totalAnnualDivUsd = totalAnnualDivMad / usdToMadRate;
  const portfolioYield = totalStocksMad > 0 ? (totalAnnualDivMad / totalStocksMad) * 100 : 0;
  insights.push({
    id: 'trace-dividend-cashflow',
    type: 'DIVIDEND_UPDATE',
    severity: totalAnnualDivUsd > 0 ? 'positive' : 'neutral',
    title: 'Projected Annual Dividend Cash Flow',
    metricBadge: `+$${totalAnnualDivUsd.toFixed(2)}/yr (${portfolioYield.toFixed(2)}% Yield)`,
    periodLabel: 'Forward 12M Estimate',
    asOfTimestamp,
    relatedTickers: positions.filter((p) => (p.annualDividendMad || 0) > 0).map((p) => p.ticker),
    observedFact: `Your current share quantities generate an estimated $${totalAnnualDivUsd.toFixed(2)}/yr (${totalAnnualDivMad.toFixed(2)} MAD/yr) in gross dividend income across ${dividendEvents.length} tracked ledger/calendar events.`,
    calculationExplanation: `Sum of (Eligible Shares × Annual Dividend per Share) across dividend-paying holdings (such as JPM and ORCL), separate from price appreciation.`,
    interpretationAndContext:
      'Reinvesting quarterly dividends compounds share count automatically over multi-year horizons.',
    dataFreshnessNote: 'Dividend rates sourced from verified instrument metadata and user dividend ledger.',
  });

  return insights;
}

// ============================================================================
// 8. PLANNING & SIMULATION CALCULATORS (COMPOUND, DCA VS LUMP SUM, REBALANCE) (§8)
// ============================================================================

export interface CompoundProjectionPoint {
  year: number;
  label: string;
  totalContributionsMad: number;
  pessimisticValueMad: number;
  moderateValueMad: number;
  optimisticValueMad: number;
  moderateGrowthMad: number;
}

export function simulateCompoundGrowth(params: {
  initialAmountMad: number;
  monthlyContributionMad: number;
  years: number;
  assumedAnnualReturnPercent: number;
  contributionTiming?: 'start_of_month' | 'end_of_month';
}): {
  points: CompoundProjectionPoint[];
  finalContributionsMad: number;
  finalPessimisticMad: number;
  finalModerateMad: number;
  finalOptimisticMad: number;
} {
  const {
    initialAmountMad,
    monthlyContributionMad,
    years,
    assumedAnnualReturnPercent,
    contributionTiming = 'end_of_month',
  } = params;

  const safeYears = Math.max(1, Math.min(40, Math.round(years)));
  const modRate = assumedAnnualReturnPercent / 100;
  const pessRate = Math.max(-0.05, modRate - 0.035);
  const optRate = modRate + 0.035;

  const calcPath = (annualRate: number, totalMonths: number) => {
    const rMonth = annualRate / 12;
    let bal = Math.max(0, initialAmountMad);
    for (let m = 1; m <= totalMonths; m++) {
      if (contributionTiming === 'start_of_month') {
        bal = (bal + Math.max(0, monthlyContributionMad)) * (1 + rMonth);
      } else {
        bal = bal * (1 + rMonth) + Math.max(0, monthlyContributionMad);
      }
    }
    return Number(bal.toFixed(2));
  };

  const points: CompoundProjectionPoint[] = [];
  for (let y = 0; y <= safeYears; y++) {
    const months = y * 12;
    const contrib = Number((initialAmountMad + monthlyContributionMad * months).toFixed(2));
    const pess = calcPath(pessRate, months);
    const mod = calcPath(modRate, months);
    const opt = calcPath(optRate, months);
    points.push({
      year: y,
      label: y === 0 ? 'Today' : `Yr ${y}`,
      totalContributionsMad: contrib,
      pessimisticValueMad: pess,
      moderateValueMad: mod,
      optimisticValueMad: opt,
      moderateGrowthMad: Number((mod - contrib).toFixed(2)),
    });
  }

  const last = points[points.length - 1];
  return {
    points,
    finalContributionsMad: last.totalContributionsMad,
    finalPessimisticMad: last.pessimisticValueMad,
    finalModerateMad: last.moderateValueMad,
    finalOptimisticMad: last.optimisticValueMad,
  };
}

export interface DcaSimulationResult {
  symbol: string;
  periodsCount: number;
  totalInvestedUsd: number;
  dcaEndingValueUsd: number;
  dcaReturnPercent: number;
  dcaUnitsAccumulated: number;
  dcaWeightedAvgCostUsd: number;
  lumpSumEndingValueUsd: number;
  lumpSumReturnPercent: number;
  lumpSumUnitsAccumulated: number;
  lumpSumEntryPriceUsd: number;
  series: {
    date: string;
    totalContributedUsd: number;
    dcaValueUsd: number;
    lumpSumValueUsd: number;
  }[];
}

export function simulateHistoricalDcaVsLumpSum(params: {
  symbol: string;
  bars: DailyOhlcvBar[];
  totalBudgetUsd: number;
  intervalDays?: number; // e.g. every 14 or 30 trading days
  feePercentPerTrade?: number;
}): DcaSimulationResult | null {
  const {
    symbol,
    bars,
    totalBudgetUsd,
    intervalDays = 10,
    feePercentPerTrade = 0.1,
  } = params;

  if (!bars || bars.length < 5 || totalBudgetUsd <= 0) return null;
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const step = Math.max(1, Math.min(sorted.length - 1, intervalDays));

  const buyIndices: number[] = [];
  for (let i = 0; i < sorted.length; i += step) {
    buyIndices.push(i);
  }
  const periodsCount = buyIndices.length;
  const trancheUsd = totalBudgetUsd / periodsCount;
  const feeMult = 1 - feePercentPerTrade / 100;

  // Lump sum at index 0
  const lumpSumEntryPriceUsd = Number(sorted[0].close) || 1;
  const lumpSumUnitsAccumulated = (totalBudgetUsd * feeMult) / lumpSumEntryPriceUsd;

  let dcaUnits = 0;
  let contributedUsd = 0;
  const buyIdxSet = new Set(buyIndices);

  const series = sorted.map((b, idx) => {
    const price = Number(b.close) || 1;
    if (buyIdxSet.has(idx)) {
      contributedUsd += trancheUsd;
      dcaUnits += (trancheUsd * feeMult) / price;
    }
    return {
      date: b.date,
      totalContributedUsd: Number(contributedUsd.toFixed(2)),
      dcaValueUsd: Number((dcaUnits * price).toFixed(2)),
      lumpSumValueUsd: Number((lumpSumUnitsAccumulated * price).toFixed(2)),
    };
  });

  const lastPrice = Number(sorted[sorted.length - 1].close) || 1;
  const dcaEndingValueUsd = Number((dcaUnits * lastPrice).toFixed(2));
  const lumpSumEndingValueUsd = Number((lumpSumUnitsAccumulated * lastPrice).toFixed(2));

  return {
    symbol,
    periodsCount,
    totalInvestedUsd: Number(totalBudgetUsd.toFixed(2)),
    dcaEndingValueUsd,
    dcaReturnPercent: Number((((dcaEndingValueUsd - totalBudgetUsd) / totalBudgetUsd) * 100).toFixed(2)),
    dcaUnitsAccumulated: Number(dcaUnits.toFixed(6)),
    dcaWeightedAvgCostUsd: dcaUnits > 0 ? Number((totalBudgetUsd / dcaUnits).toFixed(2)) : 0,
    lumpSumEndingValueUsd,
    lumpSumReturnPercent: Number(
      (((lumpSumEndingValueUsd - totalBudgetUsd) / totalBudgetUsd) * 100).toFixed(2)
    ),
    lumpSumUnitsAccumulated: Number(lumpSumUnitsAccumulated.toFixed(6)),
    lumpSumEntryPriceUsd: Number(lumpSumEntryPriceUsd.toFixed(2)),
    series,
  };
}
