import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { auth } from '../../lib/firebase';
import type {
  DailyOhlcvBar,
  DividendEventRecord,
  InstrumentDetailPayload,
  StockOrder,
  StockPosition,
} from '../../types';
import { computeTechnicalIndicators, resolveInstrumentIdentity } from '../../lib/investmentIntelligence';
import { normalizeStockTicker, resolveCanonicalCompanyName } from '../../lib/stockCategories';

async function authorizedFetch(url: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

interface InstrumentDetailModalProps {
  symbol: string | null;
  onClose: () => void;
  position?: StockPosition | null;
  storedBars?: DailyOhlcvBar[];
  orders?: StockOrder[];
  dividendEvents?: DividendEventRecord[];
  usdToMadRate: number;
  onOpenOrderModal?: (pos: StockPosition, action: 'BUY' | 'SELL' | 'DIVIDEND') => void;
  onQuickAddStock?: (ticker: string) => void;
}

type ChartPeriod = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';

export const InstrumentDetailModal: React.FC<InstrumentDetailModalProps> = ({
  symbol,
  onClose,
  position,
  storedBars,
  orders = [],
  dividendEvents = [],
  usdToMadRate,
  onOpenOrderModal,
  onQuickAddStock,
}) => {
  const [detail, setDetail] = useState<InstrumentDetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ChartPeriod>('6M');
  const [chartMode, setChartMode] = useState<'area' | 'ohlc'>('area');
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);
  const [showSma200, setShowSma200] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [oscillatorTab, setOscillatorTab] = useState<'none' | 'rsi' | 'macd'>('rsi');

  const canonicalTicker = useMemo(() => {
    if (!symbol) return '';
    return normalizeStockTicker(symbol) || symbol.trim().toUpperCase();
  }, [symbol]);

  const fetchInstrumentDetail = async (force = false) => {
    if (!symbol) return;
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await authorizedFetch(
        `/api/investments/instrument/${encodeURIComponent(symbol)}${force ? '?refresh=true' : ''}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load instrument details');
      }
      const payload = (await res.json()) as InstrumentDetailPayload;
      setDetail(payload);
    } catch (err: any) {
      setError(err?.message || 'Unable to load instrument intelligence');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!symbol) {
      setDetail(null);
      return;
    }
    void fetchInstrumentDetail(false);
  }, [symbol]);

  const activeBars = useMemo<DailyOhlcvBar[]>(() => {
    if (detail?.bars && detail.bars.length > 0) {
      return detail.bars;
    }
    return storedBars || [];
  }, [detail, storedBars]);

  const indicators = useMemo(() => {
    if (detail?.indicators && detail.indicators.length > 0) {
      return detail.indicators;
    }
    return computeTechnicalIndicators(activeBars);
  }, [detail, activeBars]);

  const combinedSeries = useMemo(() => {
    const indByDate = new Map(indicators.map((i) => [i.date, i] as const));
    const full = activeBars.map((bar) => {
      const ind = indByDate.get(bar.date);
      const isUp = bar.close >= bar.open;
      return {
        ...bar,
        sma20: ind?.sma20 ?? null,
        sma50: ind?.sma50 ?? null,
        sma200: ind?.sma200 ?? null,
        ema12: ind?.ema12 ?? null,
        ema26: ind?.ema26 ?? null,
        bbUpper: ind?.bollingerUpper ?? null,
        bbMiddle: ind?.bollingerMiddle ?? null,
        bbLower: ind?.bollingerLower ?? null,
        rsi14: ind?.rsi14 ?? null,
        macd: ind?.macdLine ?? null,
        macdSignal: ind?.macdSignal ?? null,
        macdHist: ind?.macdHistogram ?? null,
        candleSpread: [Math.min(bar.open, bar.close), Math.max(bar.open, bar.close)],
        wickRange: [bar.low, bar.high],
        isUp,
      };
    });

    if (full.length === 0) return [];
    const nowYear = new Date().getUTCFullYear();
    let count = full.length;
    if (period === '1W') count = 7;
    else if (period === '1M') count = 22;
    else if (period === '3M') count = 65;
    else if (period === '6M') count = 130;
    else if (period === '1Y') count = 252;
    else if (period === 'YTD') {
      const ytd = full.filter((d) => d.date.startsWith(`${nowYear}-`));
      return ytd.length > 2 ? ytd : full.slice(-90);
    }

    return full.slice(-Math.min(full.length, count));
  }, [activeBars, indicators, period]);

  if (!symbol) return null;

  const identity = resolveInstrumentIdentity({
    rawTicker: position?.rawHeldTicker || detail?.rawHeldSymbol || symbol,
    companyName: position?.companyName || detail?.displayName,
    market: position?.market || 'US',
    sector: position?.sector || detail?.sector,
    source: position?.source,
  });

  const companyName =
    detail?.displayName ||
    position?.companyName ||
    resolveCanonicalCompanyName(canonicalTicker, symbol);

  const currentPrice =
    position?.currentPriceNum ??
    (combinedSeries.length > 0 ? combinedSeries[combinedSeries.length - 1].close : 0);

  const periodFirst = combinedSeries[0]?.close || currentPrice;
  const periodChange = currentPrice - periodFirst;
  const periodChangePct = periodFirst > 0 ? (periodChange / periodFirst) * 100 : 0;

  const heldPosition = position || null;
  const avgCost = heldPosition?.avgCostNum || 0;
  const breakeven =
    heldPosition && heldPosition.sharesNum > 0
      ? heldPosition.breakevenPriceNative || avgCost * 1.002
      : 0;

  const symbolOrders = orders.filter(
    (o) => (normalizeStockTicker(o.ticker || '') || o.ticker) === canonicalTicker
  );

  const symbolDividends = dividendEvents.filter(
    (d) => (normalizeStockTicker(d.ticker) || d.ticker) === canonicalTicker
  );

  const high52w =
    activeBars.length > 0 ? Math.max(...activeBars.slice(-252).map((b) => b.high)) : currentPrice * 1.15;
  const low52w =
    activeBars.length > 0 ? Math.min(...activeBars.slice(-252).map((b) => b.low)) : currentPrice * 0.85;
  const range52wPct =
    high52w > low52w
      ? Math.min(100, Math.max(0, ((currentPrice - low52w) / (high52w - low52w)) * 100))
      : 50;

  const latestInd = combinedSeries[combinedSeries.length - 1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Top Header */}
        <div className="sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 font-mono text-sm font-bold text-indigo-300">
              {canonicalTicker.slice(0, 5)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  {companyName}
                </h2>
                <span className="font-mono text-xs font-semibold text-indigo-300">
                  {identity.rawHeldTicker}
                </span>
                {identity.underlyingTicker && identity.rawHeldTicker !== identity.underlyingTicker && (
                  <span className="text-xs text-slate-400">
                    · Underlying:{' '}
                    <strong className="font-mono text-slate-200">{identity.underlyingTicker}</strong>
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {detail?.sector || position?.sector || identity.sector} · {identity.exchange} ·{' '}
                {identity.country} · {identity.instrumentTypeLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-left sm:text-right tabular-nums">
              <div className="text-xl sm:text-2xl font-bold text-white">
                ${currentPrice.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">
                  ({(currentPrice * usdToMadRate).toFixed(0)} MAD)
                </span>
              </div>
              <div
                className={`flex items-center sm:justify-end gap-1 text-xs font-semibold ${
                  periodChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {periodChange >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span>
                  {periodChange >= 0 ? '+' : ''}
                  ${periodChange.toFixed(2)} ({periodChange >= 0 ? '+' : ''}
                  {periodChangePct.toFixed(2)}% in {period})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchInstrumentDetail(true)}
                disabled={refreshing}
                title="Refresh cached daily OHLCV bars"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span className="hidden sm:inline">Sync Bars</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Instrument Ownership & Freshness Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Held Instrument Identity: </span>
                <span>{identity.ownershipDisclosure}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 shrink-0 tabular-nums">
              <span>
                Source: <strong className="text-slate-200">{detail?.provider || 'cached_eod'}</strong>
              </span>
              <span>·</span>
              <span>
                Freshness: <strong className="text-emerald-400">{detail?.freshnessState || 'EOD_CACHED'}</strong>
              </span>
              <span>·</span>
              <span>
                As of:{' '}
                <strong className="text-slate-300">
                  {detail?.lastUpdatedAt
                    ? new Date(detail.lastUpdatedAt).toLocaleString()
                    : new Date().toLocaleDateString()}
                </strong>
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
              {error} — displaying locally cached daily bars and indicators.
            </div>
          )}

          {/* Chart Controls Bar */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Timeframe Selector */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
                {(['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as ChartPeriod[]).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setPeriod(tf)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      period === tf
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Chart Type & Indicator Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setChartMode('area')}
                    className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
                      chartMode === 'area' ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    Price &amp; MA
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('ohlc')}
                    className={`rounded px-2.5 py-1 font-medium cursor-pointer ${
                      chartMode === 'ohlc' ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    OHLC Range + Vol
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSma20((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    showSma20
                      ? 'border-sky-500/50 bg-sky-500/15 text-sky-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  SMA 20
                </button>
                <button
                  type="button"
                  onClick={() => setShowSma50((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    showSma50
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  SMA 50
                </button>
                <button
                  type="button"
                  onClick={() => setShowSma200((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    showSma200
                      ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  SMA 200
                </button>
                <button
                  type="button"
                  onClick={() => setShowBollinger((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    showBollinger
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  Bollinger (20,2)
                </button>
              </div>
            </div>

            {/* Primary Price & Technicals Chart */}
            <div className="h-72 sm:h-80 w-full">
              {loading && combinedSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Loading stored daily OHLCV bars and technical indicators...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinedSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="instPriceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={periodChange >= 0 ? '#10b981' : '#f43f5e'}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={periodChange >= 0 ? '#10b981' : '#f43f5e'}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v) => String(v).slice(5)}
                      minTickGap={28}
                    />
                    <YAxis
                      yAxisId="price"
                      domain={['auto', 'auto']}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                      width={56}
                    />
                    <YAxis
                      yAxisId="vol"
                      orientation="right"
                      domain={[0, (dataMax: number) => dataMax * 4]}
                      hide
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, name: string) => {
                        if (name === 'Volume') return [Number(val).toLocaleString(), name];
                        if (Array.isArray(val)) {
                          return [`$${Number(val[0]).toFixed(2)} – $${Number(val[1]).toFixed(2)}`, name];
                        }
                        return [`$${Number(val).toFixed(2)}`, name];
                      }}
                    />
                    <Bar
                      yAxisId="vol"
                      dataKey="volume"
                      name="Volume"
                      fill="#334155"
                      opacity={0.35}
                    />
                    {chartMode === 'area' ? (
                      <Area
                        yAxisId="price"
                        type="monotone"
                        dataKey="close"
                        name="Close Price"
                        stroke={periodChange >= 0 ? '#10b981' : '#f43f5e'}
                        strokeWidth={2}
                        fill="url(#instPriceGrad)"
                      />
                    ) : (
                      <>
                        <Bar
                          yAxisId="price"
                          dataKey="wickRange"
                          name="High-Low Range"
                          fill="#64748b"
                          barSize={2}
                        />
                        <Bar
                          yAxisId="price"
                          dataKey="candleSpread"
                          name="Open-Close Body"
                          fill="#6366f1"
                          barSize={7}
                        />
                      </>
                    )}

                    {showSma20 && (
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="sma20"
                        name="SMA 20"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    )}
                    {showSma50 && (
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="sma50"
                        name="SMA 50"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    )}
                    {showSma200 && (
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="sma200"
                        name="SMA 200"
                        stroke="#c084fc"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    )}
                    {showBollinger && (
                      <>
                        <Line
                          yAxisId="price"
                          type="monotone"
                          dataKey="bbUpper"
                          name="Bollinger Upper"
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeWidth={1.2}
                          dot={false}
                        />
                        <Line
                          yAxisId="price"
                          type="monotone"
                          dataKey="bbLower"
                          name="Bollinger Lower"
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          strokeWidth={1.2}
                          dot={false}
                        />
                      </>
                    )}

                    {/* Average Cost & Breakeven Lines */}
                    {avgCost > 0 && (
                      <ReferenceLine
                        yAxisId="price"
                        y={avgCost}
                        stroke="#6366f1"
                        strokeDasharray="5 5"
                        label={{
                          value: `Avg Cost $${avgCost.toFixed(2)}`,
                          fill: '#818cf8',
                          fontSize: 10,
                          position: 'insideTopLeft',
                        }}
                      />
                    )}
                    {breakeven > 0 && (
                      <ReferenceLine
                        yAxisId="price"
                        y={breakeven}
                        stroke="#f59e0b"
                        strokeDasharray="3 3"
                        label={{
                          value: `Breakeven $${breakeven.toFixed(2)}`,
                          fill: '#fbbf24',
                          fontSize: 10,
                          position: 'insideBottomLeft',
                        }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Oscillator Sub-Chart (RSI 14 / MACD) */}
            <div className="border-t border-slate-800/80 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Momentum Oscillator:</span>
                  <button
                    type="button"
                    onClick={() => setOscillatorTab('rsi')}
                    className={`rounded px-2 py-0.5 font-semibold cursor-pointer ${
                      oscillatorTab === 'rsi'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    RSI (14){' '}
                    {latestInd?.rsi14 !== null && latestInd?.rsi14 !== undefined
                      ? `· ${latestInd.rsi14.toFixed(1)}`
                      : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOscillatorTab('macd')}
                    className={`rounded px-2 py-0.5 font-semibold cursor-pointer ${
                      oscillatorTab === 'macd'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MACD (12,26,9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOscillatorTab('none')}
                    className={`rounded px-2 py-0.5 text-slate-400 hover:text-slate-200 cursor-pointer ${
                      oscillatorTab === 'none' ? 'underline text-slate-200' : ''
                    }`}
                  >
                    Hide
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">
                  Computed locally in TypeScript from cached daily OHLCV bars (0 extra API credits)
                </span>
              </div>

              {oscillatorTab !== 'none' && combinedSeries.length > 0 && (
                <div className="h-32 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {oscillatorTab === 'rsi' ? (
                      <ComposedChart data={combinedSeries} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fill: '#64748b', fontSize: 10 }} width={56} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.5rem',
                            fontSize: '11px',
                          }}
                        />
                        <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" />
                        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 3" />
                        <Line
                          type="monotone"
                          dataKey="rsi14"
                          name="RSI (14)"
                          stroke="#818cf8"
                          strokeWidth={1.75}
                          dot={false}
                        />
                      </ComposedChart>
                    ) : (
                      <ComposedChart data={combinedSeries} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" hide />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={56} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            borderColor: '#334155',
                            borderRadius: '0.5rem',
                            fontSize: '11px',
                          }}
                        />
                        <ReferenceLine y={0} stroke="#475569" />
                        <Bar dataKey="macdHist" name="MACD Histogram" fill="#6366f1" opacity={0.5} />
                        <Line type="monotone" dataKey="macd" name="MACD Line" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                        <Line
                          type="monotone"
                          dataKey="macdSignal"
                          name="Signal (9)"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </ComposedChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Position Summary + 52-Week Range + Fundamentals Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Position Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Your Position &amp; Cost Basis
                </h3>
                {heldPosition && heldPosition.sharesNum > 0 ? (
                  <span className="text-xs font-semibold text-emerald-400">
                    Active Holding ({heldPosition.actualWeightPercent.toFixed(1)}% weight)
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Not currently held</span>
                )}
              </div>

              {heldPosition && heldPosition.sharesNum > 0 ? (
                <div className="grid grid-cols-2 gap-3 pt-1 tabular-nums">
                  <div>
                    <div className="text-[11px] text-slate-400">Held Quantity</div>
                    <div className="text-sm font-bold text-white">
                      {heldPosition.sharesNum.toFixed(4)} sh
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Market Value</div>
                    <div className="text-sm font-bold text-white">
                      ${(heldPosition.sharesNum * currentPrice).toFixed(2)}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        ({heldPosition.marketValueMad.toFixed(0)} MAD)
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Avg Buy Price</div>
                    <div className="text-sm font-semibold text-slate-200">
                      ${heldPosition.avgCostNum.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Fee-Adjusted Breakeven</div>
                    <div className="text-sm font-semibold text-amber-300">
                      ${breakeven.toFixed(2)}
                    </div>
                  </div>
                  <div className="col-span-2 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Unrealized P&amp;L</span>
                    <span
                      className={`text-sm font-bold ${
                        heldPosition.unrealizedPnlMad >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {heldPosition.unrealizedPnlMad >= 0 ? '+' : ''}
                      ${(heldPosition.unrealizedPnlMad / usdToMadRate).toFixed(2)} (
                      {heldPosition.unrealizedPnlPercent >= 0 ? '+' : ''}
                      {heldPosition.unrealizedPnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-xs text-slate-400 space-y-3">
                  <p>
                    You do not currently hold shares of <strong className="text-white">{canonicalTicker}</strong>.
                    You can log a buy order or add it to your portfolio directly.
                  </p>
                  {onQuickAddStock && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onQuickAddStock(canonicalTicker);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add {canonicalTicker} Position
                    </button>
                  )}
                </div>
              )}

              {heldPosition && onOpenOrderModal && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenOrderModal(heldPosition, 'BUY');
                    }}
                    className="flex-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 cursor-pointer"
                  >
                    + Buy More
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenOrderModal(heldPosition, 'SELL');
                    }}
                    className="flex-1 rounded-lg bg-rose-600/20 border border-rose-500/40 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 cursor-pointer"
                  >
                    Sell Shares
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenOrderModal(heldPosition, 'DIVIDEND');
                    }}
                    className="flex-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 cursor-pointer"
                  >
                    Log Dividend
                  </button>
                </div>
              )}
            </div>

            {/* 52-Week Range & Technical Snapshot */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3 tabular-nums">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                52-Week Range &amp; Technical Levels
              </h3>
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>52W Low: ${low52w.toFixed(2)}</span>
                  <span>52W High: ${high52w.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-400"
                    style={{ width: `${range52wPct}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 text-right">
                  Current price is at {range52wPct.toFixed(0)}% of 52-week range
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs">
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                  <span className="text-slate-400 block text-[11px]">SMA 20 / SMA 50</span>
                  <span className="font-semibold text-slate-200">
                    ${latestInd?.sma20?.toFixed(2) || '—'} / ${latestInd?.sma50?.toFixed(2) || '—'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                  <span className="text-slate-400 block text-[11px]">RSI (14) Status</span>
                  <span className="font-semibold text-slate-200">
                    {latestInd?.rsi14
                      ? `${latestInd.rsi14.toFixed(1)} (${
                          latestInd.rsi14 > 70
                            ? 'Overbought'
                            : latestInd.rsi14 < 30
                              ? 'Oversold'
                              : 'Neutral'
                        })`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Fundamentals & Plan Availability */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3 tabular-nums">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Fundamentals &amp; Dividend Profile
                </h3>
                <span className="text-[11px] text-indigo-400">Curated + Local</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Annual Dividend / Sh</span>
                  <span className="font-bold text-emerald-400">
                    ${Number(heldPosition?.annualDividendPerShare || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Dividend Yield</span>
                  <span className="font-bold text-emerald-400">
                    {(detail?.fundamentals?.dividendYieldPercent ?? heldPosition?.dividendYieldPercent ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">P/E Ratio · EPS</span>
                  <span className="font-medium text-slate-300">
                    {detail?.fundamentals?.peRatio
                      ? `${detail.fundamentals.peRatio.toFixed(1)}x · $${(detail.fundamentals.eps || 0).toFixed(2)}`
                      : 'Pro Tier'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Market Cap</span>
                  <span className="font-medium text-slate-300">
                    {detail?.fundamentals?.marketCapUsd
                      ? `$${(detail.fundamentals.marketCapUsd / 1e9).toFixed(0)}B`
                      : 'Pro Tier'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400 border-t border-slate-800/80 pt-2">
                {detail?.fundamentals?.description ||
                  detail?.fundamentals?.unavailableReason ||
                  'High-credit Twelve Data financial statements (/statistics = 50 credits) are disabled on the Free tier to protect your daily OHLCV budget.'}
              </p>
            </div>
          </div>

          {/* Execution & Dividend History for this Symbol */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Execution &amp; Order Ledger ({symbolOrders.length})
              </h3>
              {symbolOrders.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">
                  No local buy/sell orders logged for {canonicalTicker} yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {symbolOrders.slice(0, 12).map((o) => {
                    const sh = Number(o.shares) || 0;
                    const pr = Number(o.pricePerShare) || 0;
                    const nat = Number(o.totalNativeAmount) || 0;
                    const mad = Number(o.totalMadAmount) || 0;
                    return (
                      <div
                        key={o.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs tabular-nums"
                      >
                        <div>
                          <span
                            className={`font-bold ${
                              o.action === 'BUY'
                                ? 'text-emerald-400'
                                : o.action === 'SELL'
                                  ? 'text-rose-400'
                                  : 'text-indigo-400'
                            }`}
                          >
                            {o.action}
                          </span>{' '}
                          <span className="text-slate-200">
                            {sh.toFixed(4)} sh @ ${pr.toFixed(2)}
                          </span>
                          <div className="text-[11px] text-slate-500">
                            {new Date(o.executedAt).toLocaleDateString()} {o.notes ? `· ${o.notes}` : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">${nat.toFixed(2)}</div>
                          <div className="text-[11px] text-slate-400">{mad.toFixed(0)} MAD</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Dividend Events &amp; Projections ({symbolDividends.length})
              </h3>
              {symbolDividends.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">
                  No confirmed or estimated dividend distributions for {canonicalTicker}.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {symbolDividends.map((div) => (
                    <div
                      key={div.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs tabular-nums"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">
                          Pay Date: {div.paymentDate}{' '}
                          <span className="text-[11px] text-indigo-400 uppercase">· {div.status}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Ex-Div: {div.exDividendDate || '—'} · ${div.dividendPerShare.toFixed(4)}/sh ×{' '}
                          {div.eligibleShares.toFixed(3)} sh
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">
                          +${div.netAmount.toFixed(2)} Net
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {div.netAmountMad.toFixed(2)} MAD (Tax: ${div.withholdingTax.toFixed(2)})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
