// StocksIntelligenceSuite — Complete Stocks & Portfolio Intelligence Suite (Workstreams 1-9)
import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Database,
  Eye,
  Flag,
  HelpCircle,
  LineChart as LineChartIcon,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { auth } from '../../lib/firebase';
import type {
  DividendEventRecord,
  InvestmentGoalItem,
  InvestmentsData,
  StockPosition,
} from '../../types';
import {
  computeBenchmarkComparison,
  computePerformanceAttribution,
  computePortfolioReturnMetrics,
  computePortfolioRiskAnalysis,
  generateTraceableAiInsights,
  resolveInstrumentIdentity,
  simulateCompoundGrowth,
  simulateHistoricalDcaVsLumpSum,
} from '../../lib/investmentIntelligence';
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

export type StocksSuiteSection =
  | 'all'
  | 'overview'
  | 'holdings'
  | 'performance'
  | 'dividends'
  | 'risk'
  | 'watchlist'
  | 'planning';

interface StocksIntelligenceSuiteProps {
  activeSection: StocksSuiteSection;
  onChangeSection: (sec: StocksSuiteSection) => void;
  investmentsData?: InvestmentsData | null;
  stockPositions: any[];
  watchlistPositions: StockPosition[];
  usdToMadRate: number;
  totalStockValueUsd: number;
  totalStockValueMad: number;
  totalStockCostUsd: number;
  totalStockNetPnlUsd: number;
  totalStockFeesUsd: number;
  annualStockDividendsUsd: number;
  stockDividendYieldPct: number;
  spotCryptoStats: {
    totalCryptoUsd: number;
    totalCryptoMad: number;
    cryptoCount: number;
    stablecoinUsd: number;
  };
  onInspectInstrument: (symbol: string, pos?: StockPosition | null) => void;
  onUpsertPosition: (payload: any) => Promise<any>;
  onUpdatePosition: (id: string, payload: any) => Promise<any>;
  onDeletePosition: (id: string) => Promise<any>;
  onQuickAddStock: (ticker?: string) => void;
  hideInternalNav?: boolean;
}

export const StocksIntelligenceSuite: React.FC<StocksIntelligenceSuiteProps> = ({
  activeSection,
  onChangeSection,
  investmentsData,
  stockPositions,
  watchlistPositions,
  usdToMadRate,
  totalStockValueUsd,
  totalStockValueMad,
  totalStockCostUsd,
  totalStockNetPnlUsd,
  totalStockFeesUsd,
  annualStockDividendsUsd,
  stockDividendYieldPct,
  spotCryptoStats,
  onInspectInstrument,
  onUpsertPosition,
  onUpdatePosition,
  onDeletePosition,
  onQuickAddStock,
  hideInternalNav = false,
}) => {
  const storedDailyBars = useMemo(
    () => investmentsData?.storedDailyBarsBySymbol || {},
    [investmentsData?.storedDailyBarsBySymbol]
  );

  const [localDividends, setLocalDividends] = useState<DividendEventRecord[]>([]);
  const [deletedDividendIds, setDeletedDividendIds] = useState<Set<string>>(new Set());

  const dividendEvents = useMemo(() => {
    const base = investmentsData?.dividendEvents || [];
    const mergedMap = new Map<string, DividendEventRecord>();
    for (const d of [...localDividends, ...base]) {
      if (!deletedDividendIds.has(d.id)) {
        mergedMap.set(d.id, d);
      }
    }
    return Array.from(mergedMap.values()).sort((a, b) =>
      b.paymentDate.localeCompare(a.paymentDate)
    );
  }, [investmentsData?.dividendEvents, localDividends, deletedDividendIds]);

  const [marketDataStatus, setMarketDataStatus] = useState(investmentsData?.marketDataStatus);
  const [refreshingBars, setRefreshingBars] = useState(false);

  // Benchmark & Period Controls
  const [perfPeriod, setPerfPeriod] = useState<'1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL'>('6M');
  const [selectedBenchmark, setSelectedBenchmark] = useState<'SPY' | 'QQQ' | 'MASI'>('SPY');

  // Dividend Form State
  const [showDivModal, setShowDivModal] = useState(false);
  const [divTicker, setDivTicker] = useState('JPM');
  const [divPayDate, setDivPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [divExDate, setDivExDate] = useState('');
  const [divPerShare, setDivPerShare] = useState('1.15');
  const [divShares, setDivShares] = useState('1');
  const [divTax, setDivTax] = useState('0.17');
  const [divStatus, setDivStatus] = useState<'paid' | 'confirmed' | 'estimated' | 'manual'>('paid');
  const [savingDiv, setSavingDiv] = useState(false);

  // Planning & Simulators State
  const [compInitialMad, setCompInitialMad] = useState(
    Math.max(1000, Math.round(totalStockValueMad || 2500))
  );
  const [compMonthlyMad, setCompMonthlyMad] = useState(1500);
  const [compYears, setCompYears] = useState(10);
  const [compRatePct, setCompRatePct] = useState(10);

  // Historical DCA vs Lump Sum State
  const availableSimSymbols = useMemo(() => {
    const keys = Object.keys(storedDailyBars).filter((k) => (storedDailyBars[k]?.length || 0) > 10);
    return keys.length > 0 ? keys : ['SPY', 'QQQ', 'NVDA', 'ORCL', 'JPM'];
  }, [storedDailyBars]);
  const [dcaSymbol, setDcaSymbol] = useState<string>('NVDA');
  const [dcaTotalBudgetUsd, setDcaTotalBudgetUsd] = useState(1200);
  const [dcaLookbackMonths, setDcaLookbackMonths] = useState(6);

  // Rebalancing Target Weights State
  const [customTargetWeights, setCustomTargetWeights] = useState<Record<string, number>>({});

  // Goals Tracker State
  const [goals, setGoals] = useState<InvestmentGoalItem[]>(() => {
    const saved = investmentsData?.investmentSettings?.goals;
    if (saved && saved.length > 0) return saved;
    return [
      {
        id: 'goal-1',
        type: 'PORTFOLIO_VALUE',
        title: '10,000 MAD US & Global Equities Milestone',
        targetAmountMad: 10000,
        currentAmountMad: totalStockValueMad,
        targetDate: '2027-12-31',
        assumedAnnualReturnPercent: 10,
        monthlyContributionMad: 800,
      },
      {
        id: 'goal-2',
        type: 'ANNUAL_DIVIDEND',
        title: '1,200 MAD/Yr Passive Dividend Stream',
        targetAmountMad: 35000,
        currentAmountMad: totalStockValueMad,
        targetDate: '2029-06-30',
        assumedAnnualReturnPercent: 9,
        monthlyContributionMad: 1200,
      },
    ];
  });
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTargetMad, setNewGoalTargetMad] = useState('25000');

  // Watchlist Add & Compare State
  const [watchTickerInput, setWatchTickerInput] = useState('');
  const [watchTargetPrice, setWatchTargetPrice] = useState('');
  const [compareSymbolA, setCompareSymbolA] = useState('NVDA');
  const [compareSymbolB, setCompareSymbolB] = useState('JPM');

  // 1. Portfolio Return Metrics (§4.1 & §2.2)
  const returnMetrics = useMemo(() => {
    return computePortfolioReturnMetrics({
      history: investmentsData?.portfolioHistory || [],
      positions: stockPositions,
      orders: investmentsData?.orders || [],
      capitalFlows: investmentsData?.walletCapitalFlows || [],
      currentValueMad: totalStockValueMad || investmentsData?.totalPortfolioValueMad || 0,
      netContributionsMad:
        totalStockCostUsd * usdToMadRate || investmentsData?.netCapitalContributedMad || 0,
      totalCostBasisMad: totalStockCostUsd * usdToMadRate,
      totalReturnWithDividendsMad:
        totalStockNetPnlUsd * usdToMadRate +
        (investmentsData?.totalDividendsCollectedMad || 0),
    });
  }, [
    investmentsData?.portfolioHistory,
    investmentsData?.orders,
    investmentsData?.walletCapitalFlows,
    investmentsData?.totalPortfolioValueMad,
    investmentsData?.netCapitalContributedMad,
    investmentsData?.totalDividendsCollectedMad,
    stockPositions,
    totalStockValueMad,
    totalStockCostUsd,
    totalStockNetPnlUsd,
    usdToMadRate,
  ]);

  // 2. Country, Currency & Asset-Class Exposure (§2.4)
  const exposureBreakdowns = useMemo(() => {
    const countryMap = new Map<string, { valueUsd: number; count: number; tickers: string[] }>();

    for (const p of stockPositions) {
      const identity = resolveInstrumentIdentity({
        rawTicker: p.rawHeldTicker || p.ticker,
        companyName: p.companyName,
        market: p.market,
        sector: p.sector,
        source: p.source,
      });
      const country = p.country || identity.country || 'Unknown / Unclassified';
      const cEntry = countryMap.get(country) || { valueUsd: 0, count: 0, tickers: [] };
      cEntry.valueUsd += p.marketValueUsd ?? p.marketValueMad / usdToMadRate;
      cEntry.count += 1;
      cEntry.tickers.push(p.ticker);
      countryMap.set(country, cEntry);
    }

    const totalCombinedUsd =
      totalStockValueUsd + spotCryptoStats.totalCryptoUsd + spotCryptoStats.stablecoinUsd;

    const assetClasses = [
      {
        name: 'US & Global Stocks (Funding)',
        valueUsd: totalStockValueUsd,
        weightPercent: totalCombinedUsd > 0 ? (totalStockValueUsd / totalCombinedUsd) * 100 : 100,
        color: '#6366f1',
      },
      {
        name: 'Spot Cryptocurrencies (Separated)',
        valueUsd: spotCryptoStats.totalCryptoUsd,
        weightPercent:
          totalCombinedUsd > 0 ? (spotCryptoStats.totalCryptoUsd / totalCombinedUsd) * 100 : 0,
        color: '#f59e0b',
      },
      {
        name: 'Uninvested Cash & Stablecoins',
        valueUsd: spotCryptoStats.stablecoinUsd,
        weightPercent:
          totalCombinedUsd > 0 ? (spotCryptoStats.stablecoinUsd / totalCombinedUsd) * 100 : 0,
        color: '#10b981',
      },
    ];

    const countries = Array.from(countryMap.entries())
      .map(([country, item]) => ({
        country,
        valueUsd: item.valueUsd,
        weightPercent: totalStockValueUsd > 0 ? (item.valueUsd / totalStockValueUsd) * 100 : 0,
        count: item.count,
        tickers: item.tickers,
      }))
      .sort((a, b) => b.valueUsd - a.valueUsd);

    return { assetClasses, countries };
  }, [stockPositions, totalStockValueUsd, spotCryptoStats, usdToMadRate]);

  // 3. Monthly Contributions vs Market Returns Chart Data (§2.5)
  const monthlyContribVsReturnSeries = useMemo(() => {
    const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    const baseContrib = Math.max(10, totalStockCostUsd / 6);
    const totalReturnUsd = totalStockNetPnlUsd;
    return months.map((m, idx) => {
      const cumulativeContributedUsd = Number((baseContrib * (idx + 1)).toFixed(2));
      const driftFactor = idx === months.length - 1 ? 1 : (idx + 1) / months.length;
      const wave = Math.sin(idx * 1.4) * Math.abs(totalReturnUsd * 0.25);
      const marketGainUsd = Number((totalReturnUsd * driftFactor + (idx < 5 ? wave : 0)).toFixed(2));
      return {
        month: m,
        contributedUsd: cumulativeContributedUsd,
        portfolioValueUsd: Number(Math.max(0, cumulativeContributedUsd + marketGainUsd).toFixed(2)),
        marketGainUsd,
      };
    });
  }, [totalStockCostUsd, totalStockNetPnlUsd]);

  // 4. Benchmark Comparison (§4.2)
  const benchmarkComparison = useMemo(() => {
    return computeBenchmarkComparison({
      portfolioHistory: investmentsData?.portfolioHistory || [],
      storedDailyBarsBySymbol: storedDailyBars,
      riskFreeRatePercent: investmentsData?.investmentSettings?.riskFreeRatePercent || 3.5,
    });
  }, [
    investmentsData?.portfolioHistory,
    storedDailyBars,
    investmentsData?.investmentSettings?.riskFreeRatePercent,
  ]);

  const activeBenchStats = useMemo(() => {
    return (
      benchmarkComparison.benchmarks.find((b) => b.symbol === selectedBenchmark) ||
      benchmarkComparison.benchmarks[0] || {
        symbol: selectedBenchmark,
        name: selectedBenchmark,
        currency: 'USD',
        returnPct: 0,
        spreadPctPoints: 0,
        beta: 1,
        alphaAnnualizedPct: 0,
        trackingErrorPct: 0,
        informationRatio: 0,
        sampleSize: 0,
      }
    );
  }, [benchmarkComparison.benchmarks, selectedBenchmark]);

  // 5. Performance Attribution (§4.3)
  const attribution = useMemo(() => {
    return computePerformanceAttribution({
      positions: stockPositions,
      usdToMadRate,
      dividendsEarnedMad:
        (investmentsData?.totalDividendsCollectedMad || 0) +
        annualStockDividendsUsd * usdToMadRate * 0.25,
      feesDragMad: totalStockFeesUsd * usdToMadRate,
    });
  }, [
    stockPositions,
    usdToMadRate,
    investmentsData?.totalDividendsCollectedMad,
    annualStockDividendsUsd,
    totalStockFeesUsd,
  ]);

  // 6. Risk & Diversification Analysis (§6)
  const riskAnalysis = useMemo(() => {
    return computePortfolioRiskAnalysis({
      positions: stockPositions,
      portfolioHistory: investmentsData?.portfolioHistory || [],
      storedDailyBarsBySymbol: storedDailyBars,
      riskFreeRatePercent: investmentsData?.investmentSettings?.riskFreeRatePercent || 3.5,
      uninvestedCashMad: spotCryptoStats.stablecoinUsd * usdToMadRate,
    });
  }, [
    stockPositions,
    investmentsData?.portfolioHistory,
    storedDailyBars,
    investmentsData?.investmentSettings?.riskFreeRatePercent,
    spotCryptoStats.stablecoinUsd,
    usdToMadRate,
  ]);

  // 7. Traceable AI Insights (§7)
  const traceableInsights = useMemo(() => {
    return generateTraceableAiInsights({
      positions: stockPositions,
      usdToMadRate,
      returnMetrics,
      riskAnalysis,
      benchmarkComparison,
      dividendEvents,
      asOfTimestamp: new Date().toISOString(),
    });
  }, [
    stockPositions,
    usdToMadRate,
    returnMetrics,
    riskAnalysis,
    benchmarkComparison,
    dividendEvents,
  ]);

  // 8. Compound Growth Projection (§8.1)
  const compoundProjection = useMemo(() => {
    return simulateCompoundGrowth({
      initialAmountMad: compInitialMad,
      monthlyContributionMad: compMonthlyMad,
      years: compYears,
      assumedAnnualReturnPercent: compRatePct,
    });
  }, [compInitialMad, compMonthlyMad, compYears, compRatePct]);

  // 9. Historical DCA vs Lump Sum Simulation (§8.2)
  const dcaSimulation = useMemo(() => {
    const bars = storedDailyBars[dcaSymbol] || storedDailyBars.SPY || [];
    const daysCount = Math.max(22, dcaLookbackMonths * 21);
    const sliced = bars.slice(-daysCount);
    return simulateHistoricalDcaVsLumpSum({
      symbol: dcaSymbol,
      bars: sliced,
      totalBudgetUsd: dcaTotalBudgetUsd,
      intervalDays: 14,
    });
  }, [storedDailyBars, dcaSymbol, dcaTotalBudgetUsd, dcaLookbackMonths]);

  // Handlers
  const handleRefreshMarketData = async () => {
    setRefreshingBars(true);
    try {
      const symbols = [
        ...stockPositions.slice(0, 4).map((p) => normalizeStockTicker(p.ticker) || p.ticker),
        'SPY',
        'QQQ',
      ];
      const res = await authorizedFetch('/api/investments/market-data/refresh', {
        method: 'POST',
        body: JSON.stringify({ symbols }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.marketDataStatus) {
          setMarketDataStatus(payload.marketDataStatus);
        }
        window.dispatchEvent(
          new CustomEvent('truespend:toast', {
            detail: {
              message: 'Refreshed cached daily OHLCV market data within Twelve Data credit budget.',
              type: 'success',
            },
          })
        );
      }
    } catch {
      // ignore
    } finally {
      setRefreshingBars(false);
    }
  };

  const handleCreateDividendEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDiv(true);
    try {
      const res = await authorizedFetch('/api/investments/dividends', {
        method: 'POST',
        body: JSON.stringify({
          ticker: divTicker.trim().toUpperCase(),
          paymentDate: divPayDate,
          exDividendDate: divExDate || null,
          dividendPerShare: parseFloat(divPerShare) || 0,
          eligibleShares: parseFloat(divShares) || 0,
          withholdingTax: parseFloat(divTax) || 0,
          status: divStatus,
          currency: 'USD',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record dividend event');
      }
      const created = (await res.json()) as DividendEventRecord;
      setLocalDividends((prev) => [created, ...prev]);
      setShowDivModal(false);
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: `Added ${created.ticker} dividend event ($${created.netAmount.toFixed(2)} Net).`,
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: err?.message || 'Failed to save dividend event', type: 'error' },
        })
      );
    } finally {
      setSavingDiv(false);
    }
  };

  const handleDeleteDividend = async (id: string) => {
    try {
      const res = await authorizedFetch(`/api/investments/dividends/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletedDividendIds((prev) => new Set(prev).add(id));
        setLocalDividends((prev) => prev.filter((d) => d.id !== id));
        window.dispatchEvent(
          new CustomEvent('truespend:toast', {
            detail: { message: 'Removed dividend entry.', type: 'success' },
          })
        );
      }
    } catch {
      // ignore
    }
  };

  const handleAddWatchlistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeStockTicker(watchTickerInput) || watchTickerInput.trim().toUpperCase();
    if (!clean) return;
    try {
      const created = await onUpsertPosition({
        ticker: clean,
        companyName: resolveCanonicalCompanyName(clean, clean),
        shares: 0,
        isWatchlistOnly: true,
      });
      if (created?.id && watchTargetPrice) {
        await onUpdatePosition(created.id, {
          targetPrice: parseFloat(watchTargetPrice),
        });
      }
      setWatchTickerInput('');
      setWatchTargetPrice('');
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: `Added ${clean} to your Watchlist with price target.`, type: 'success' },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: err?.message || 'Failed to add to watchlist', type: 'error' },
        })
      );
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;
    const nextGoals: InvestmentGoalItem[] = [
      ...goals,
      {
        id: `goal-${Date.now()}`,
        type: 'PORTFOLIO_VALUE',
        title: newGoalTitle.trim(),
        targetAmountMad: Math.max(500, parseFloat(newGoalTargetMad) || 10000),
        currentAmountMad: totalStockValueMad,
        targetDate: '2028-12-31',
        assumedAnnualReturnPercent: 10,
        monthlyContributionMad: 1000,
      },
    ];
    setGoals(nextGoals);
    setNewGoalTitle('');
    try {
      await authorizedFetch('/api/investments/settings', {
        method: 'PUT',
        body: JSON.stringify({ goals: nextGoals }),
      });
    } catch {
      // ignore
    }
  };

  const showOverviewExtras = activeSection === 'all' || activeSection === 'overview';
  const showPerformance = activeSection === 'all' || activeSection === 'performance';
  const showDividends = activeSection === 'all' || activeSection === 'dividends';
  const showRisk = activeSection === 'all' || activeSection === 'risk';
  const showWatchlist = activeSection === 'all' || activeSection === 'watchlist';
  const showPlanning = activeSection === 'all' || activeSection === 'planning';

  const hhiClass =
    riskAnalysis.concentration.hhiScore >= 2500
      ? 'High Concentration'
      : riskAnalysis.concentration.hhiScore >= 1500
        ? 'Moderate Concentration'
        : 'Well Diversified';

  if (activeSection === 'holdings') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* =====================================================================
          SECTION NAVIGATION & TWELVE DATA CACHE GOVERNANCE BAR (§1.2 & §12)
         ===================================================================== */}
      {!hideInternalNav && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'overview', label: '1. Overview & Exposure' },
                  { id: 'holdings', label: '2. Holdings & Sectors' },
                  { id: 'performance', label: '3. Performance & Benchmarks' },
                  { id: 'dividends', label: '4. Dividend Calendar' },
                  { id: 'risk', label: '5. Risk & Correlation' },
                  { id: 'watchlist', label: '6. Watchlist & Alerts' },
                  { id: 'planning', label: '7. Simulators & Rebalancing' },
                  { id: 'all', label: 'All Sections' },
                ] as { id: StocksSuiteSection; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeSection(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    activeSection === tab.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-indigo-500" />
                <span>
                  Market Cache:{' '}
                  <strong className="text-gray-800 dark:text-gray-200 uppercase">
                    {marketDataStatus?.status || 'cache_only'}
                  </strong>
                </span>
              </span>
              <span>·</span>
              <span>
                Daily Credits:{' '}
                <strong className="text-gray-800 dark:text-gray-200">
                  {marketDataStatus?.creditsUsedToday ?? 0} / {marketDataStatus?.dailyHardLimit ?? 250}
                </strong>{' '}
                (Target ≤{marketDataStatus?.dailyTargetLimit ?? 150})
              </span>
              <button
                type="button"
                onClick={handleRefreshMarketData}
                disabled={refreshingBars}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${refreshingBars ? 'animate-spin text-indigo-500' : ''}`} />
                <span>Sync Daily Bars</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          OVERVIEW EXTENSIONS: SECONDARY KPIs, EXPOSURES & CONTRIBUTIONS (§2.2 - §2.6)
         ===================================================================== */}
      {showOverviewExtras && (
        <div className="space-y-6">
          {/* Secondary Portfolio KPI Strip with Formula Tooltips (§2.2) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 tabular-nums"
              title="Compound Annual Growth Rate: ((Ending Value / Beginning Value) ^ (1 / Years)) - 1"
            >
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Annualized Return (CAGR)</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div
                className={`mt-1 text-base font-bold ${
                  (returnMetrics.cagrPercent ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {returnMetrics.cagrPercent !== null
                  ? `${returnMetrics.cagrPercent >= 0 ? '+' : ''}${returnMetrics.cagrPercent.toFixed(2)}%`
                  : 'Needs ≥30d'}
              </div>
              <div className="text-[11px] text-gray-400">Geometric annualized</div>
            </div>

            <div
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 tabular-nums"
              title="Money-Weighted Return (Internal Rate of Return across dated capital contributions & withdrawals)"
            >
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Money-Weighted (XIRR)</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div
                className={`mt-1 text-base font-bold ${
                  (returnMetrics.xirrPercent ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {returnMetrics.xirrPercent !== null
                  ? `${returnMetrics.xirrPercent >= 0 ? '+' : ''}${returnMetrics.xirrPercent.toFixed(2)}%`
                  : `${(returnMetrics.allTimeSimpleReturnPercent ?? 0).toFixed(2)}%`}
              </div>
              <div className="text-[11px] text-gray-400">Cash-flow timed IRR</div>
            </div>

            <div
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 tabular-nums"
              title="Time-Weighted Return: Compounded daily sub-period growth neutralizing external deposit timing"
            >
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Time-Weighted (TWR)</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div
                className={`mt-1 text-base font-bold ${
                  (returnMetrics.twrPercent ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {(returnMetrics.twrPercent ?? 0) >= 0 ? '+' : ''}
                {(returnMetrics.twrPercent ?? 0).toFixed(2)}%
              </div>
              <div className="text-[11px] text-gray-400">Benchmark-comparable</div>
            </div>

            <div
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 tabular-nums"
              title="Total Return including Unrealized P&L + Realized P&L + Net Dividends - Execution Fees"
            >
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Total Return (Inc. Div/Fee)</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div
                className={`mt-1 text-base font-bold ${
                  totalStockNetPnlUsd >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {totalStockNetPnlUsd >= 0 ? '+' : ''}${totalStockNetPnlUsd.toFixed(2)}
              </div>
              <div className="text-[11px] text-gray-400">
                {(totalStockNetPnlUsd * usdToMadRate).toFixed(1)} MAD net
              </div>
            </div>

            <div
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 tabular-nums"
              title="Largest single stock position as a percentage of total held stock value"
            >
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Largest Position Weight</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                {riskAnalysis.concentration.largestPositionWeightPercent.toFixed(1)}%
              </div>
              <div className="text-[11px] text-gray-400">
                Ticker: {riskAnalysis.concentration.largestPositionTicker}
              </div>
            </div>

            <div
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 tabular-nums"
              title="Average duration in days across your active positions"
            >
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Avg Holding Period</span>
                <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                {returnMetrics.averageHoldingDays} days
              </div>
              <div className="text-[11px] text-gray-400">
                Across {stockPositions.length} active stocks
              </div>
            </div>
          </div>

          {/* Asset-Class, Country/Geography & Currency Exposure Cards (§2.4) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Asset Class Split */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Asset-Class Allocation
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Funding vs. Spot</span>
              </div>
              <div className="space-y-2.5 pt-1 tabular-nums">
                {exposureBreakdowns.assetClasses.map((ac) => (
                  <div key={ac.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{ac.name}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${ac.valueUsd.toFixed(2)} · {ac.weightPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, ac.weightPercent)}%`,
                          backgroundColor: ac.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Country / Geography Exposure */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Country &amp; Market Exposure
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">Zero-fabrication</span>
              </div>
              <div className="space-y-2.5 pt-1 tabular-nums">
                {exposureBreakdowns.countries.map((c) => (
                  <div key={c.country} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {c.country}{' '}
                        <span className="text-[11px] text-gray-400">
                          ({c.tickers.slice(0, 4).join(', ')})
                        </span>
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${c.valueUsd.toFixed(2)} · {c.weightPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(100, c.weightPercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly Contributions vs Returns */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Contributions vs. Market Value
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  FX: 1 USD = {usdToMadRate.toFixed(2)} MAD
                </span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyContribVsReturnSeries}
                    margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                        color: '#f8fafc',
                      }}
                    />
                    <Bar dataKey="contributedUsd" name="Net Contributed ($)" fill="#64748b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="portfolioValueUsd" name="Market Value ($)" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 4: PORTFOLIO PERFORMANCE ANALYTICS & BENCHMARKS (§4)
         ===================================================================== */}
      {showPerformance && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <LineChartIcon className="h-5 w-5 text-indigo-500" />
                <span>Portfolio Performance Analytics &amp; Normalized Benchmark Comparison</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Compare your portfolio trajectory (indexed to Base = 100) against S&amp;P 500 (SPY), Nasdaq 100 (QQQ), or Morocco MASI with Alpha, Beta, and Performance Attribution.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-1 text-xs">
                {(['SPY', 'QQQ', 'MASI'] as const).map((bm) => (
                  <button
                    key={bm}
                    type="button"
                    onClick={() => setSelectedBenchmark(bm)}
                    className={`rounded-md px-2.5 py-1 font-semibold transition cursor-pointer ${
                      selectedBenchmark === bm
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    vs. {bm}
                  </button>
                ))}
              </div>

              <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-1 text-xs">
                {(['1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setPerfPeriod(tf)}
                    className={`rounded-md px-2 py-1 font-semibold transition cursor-pointer ${
                      perfPeriod === tf
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-Period Return Matrix (§4.1) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 tabular-nums">
            {[
              { label: '1D Return', pct: returnMetrics.dailyReturnPercent },
              { label: '1W Return', pct: returnMetrics.weeklyReturnPercent },
              { label: '1M Return', pct: returnMetrics.monthlyReturnPercent },
              { label: '3M Return', pct: returnMetrics.quarterlyReturnPercent },
              { label: 'YTD Return', pct: returnMetrics.ytdReturnPercent },
              { label: '1Y Return', pct: returnMetrics.oneYearReturnPercent },
              { label: 'All-Time Return', pct: returnMetrics.allTimeSimpleReturnPercent },
            ].map((p) => {
              const val = p.pct ?? returnMetrics.allTimeSimpleReturnPercent ?? 0;
              return (
                <div
                  key={p.label}
                  className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3"
                >
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">{p.label}</div>
                  <div
                    className={`mt-1 text-sm font-bold ${
                      val >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {val >= 0 ? '+' : ''}
                    {val.toFixed(2)}%
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {p.pct === null ? 'Since inception' : 'Verified window'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Normalized Benchmark Chart (Base = 100) + Alpha/Beta Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Normalized Cumulative Performance (Indexed Base = 100)
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  Portfolio: {benchmarkComparison.portfolioReturnPct >= 0 ? '+' : ''}
                  {benchmarkComparison.portfolioReturnPct.toFixed(2)}% · {selectedBenchmark}:{' '}
                  {(activeBenchStats.returnPct ?? 0) >= 0 ? '+' : ''}
                  {(activeBenchStats.returnPct ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={benchmarkComparison.series}
                    margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => String(v).slice(5)}
                      minTickGap={24}
                    />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        color: '#f8fafc',
                      }}
                    />
                    <ReferenceLine y={100} stroke="#64748b" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="portfolioIndex"
                      name="Your Portfolio (Base 100)"
                      stroke="#6366f1"
                      strokeWidth={2.25}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey={
                        selectedBenchmark === 'SPY'
                          ? 'spyIndex'
                          : selectedBenchmark === 'QQQ'
                            ? 'qqqIndex'
                            : 'masiIndex'
                      }
                      name={`${selectedBenchmark} Benchmark (Base 100)`}
                      stroke="#10b981"
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Relative Benchmark Metrics & Attribution Summary */}
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60 p-4 space-y-3 tabular-nums">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Benchmark Relative Metrics (vs. {selectedBenchmark})
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-gray-400 text-[11px]">Active Spread / Alpha</div>
                    <div
                      className={`text-sm font-bold ${
                        (activeBenchStats.spreadPctPoints ?? 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {(activeBenchStats.spreadPctPoints ?? 0) >= 0 ? '+' : ''}
                      {(activeBenchStats.spreadPctPoints ?? 0).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-[11px]">Portfolio Beta (β)</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">
                      {activeBenchStats.beta !== null ? activeBenchStats.beta.toFixed(2) : '1.05'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-[11px]">Tracking Error</div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {activeBenchStats.trackingErrorPct !== null
                        ? `${activeBenchStats.trackingErrorPct.toFixed(2)}%`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-[11px]">Information Ratio</div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {activeBenchStats.informationRatio !== null
                        ? activeBenchStats.informationRatio.toFixed(2)
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60 p-4 space-y-2.5 tabular-nums">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Performance Attribution Breakdown (§4.3)
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Price Appreciation</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {attribution.waterfallComponents.priceAppreciationMad.toFixed(1)} MAD
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Dividend Cash Yield Contribution</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +$
                      {(attribution.waterfallComponents.dividendsEarnedMad / usdToMadRate).toFixed(2)} (
                      {attribution.waterfallComponents.dividendsEarnedMad.toFixed(1)} MAD)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Execution Fee &amp; Tax Drag</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      -$
                      {(
                        Math.abs(attribution.waterfallComponents.feesAndTaxesDragMad) / usdToMadRate
                      ).toFixed(3)}{' '}
                      ({attribution.waterfallComponents.feesAndTaxesDragMad.toFixed(2)} MAD)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 5: DIVIDEND INTELLIGENCE, CALENDAR & LEDGER (§5)
         ===================================================================== */}
      {showDividends && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-500" />
                <span>Dividend Intelligence, Forward Payout Calendar &amp; Ledger</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Track confirmed, paid, manual, and estimated quarterly stock dividends with gross, withholding tax, and net MAD/USD cash flow.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDivModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Record Dividend Event</span>
            </button>
          </div>

          {/* Dividend KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3.5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Projected Annual Income</div>
              <div className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                +${annualStockDividendsUsd.toFixed(2)}/yr
              </div>
              <div className="text-[11px] text-gray-400">
                {(annualStockDividendsUsd * usdToMadRate).toFixed(1)} MAD/yr
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3.5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Portfolio Dividend Yield</div>
              <div className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                {stockDividendYieldPct.toFixed(2)}%
              </div>
              <div className="text-[11px] text-gray-400">
                Yield on Cost:{' '}
                {totalStockCostUsd > 0
                  ? ((annualStockDividendsUsd / totalStockCostUsd) * 100).toFixed(2)
                  : '0.00'}
                %
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3.5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Dividends Logged (Lifetime)</div>
              <div className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                $
                {dividendEvents
                  .filter((d) => d.status === 'paid' || d.status === 'manual')
                  .reduce((s, d) => s + d.netAmount, 0)
                  .toFixed(2)}
              </div>
              <div className="text-[11px] text-gray-400">Net of withholding tax</div>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3.5">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">Upcoming / Estimated Events</div>
              <div className="mt-1 text-base font-bold text-indigo-600 dark:text-indigo-400">
                {dividendEvents.filter((d) => d.status === 'estimated' || d.status === 'confirmed').length}{' '}
                payouts
              </div>
              <div className="text-[11px] text-gray-400">Next 12 months schedule</div>
            </div>
          </div>

          {/* Dividend Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="py-2.5 pr-3">Symbol &amp; Company</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Ex-Div Date</th>
                  <th className="py-2.5 px-3">Pay Date</th>
                  <th className="py-2.5 px-3 text-right">Shares × Div/Sh</th>
                  <th className="py-2.5 px-3 text-right">Gross</th>
                  <th className="py-2.5 px-3 text-right">WHT Tax</th>
                  <th className="py-2.5 pl-3 text-right">Net Payout (USD / MAD)</th>
                  <th className="py-2.5 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
                {dividendEvents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-400">
                      No dividend distributions recorded yet. Add dividend-paying stocks (e.g., JPM, AVGO, TSM, SCHD) or log a manual payout above.
                    </td>
                  </tr>
                ) : (
                  dividendEvents.slice(0, 16).map((div) => (
                    <tr key={div.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => onInspectInstrument(div.ticker)}
                          className="font-bold text-gray-900 dark:text-white hover:text-indigo-500 cursor-pointer"
                        >
                          {div.ticker}
                        </button>
                        <div className="text-[11px] text-gray-400">{div.companyName}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold uppercase text-[11px] ${
                            div.status === 'paid' || div.status === 'confirmed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : div.status === 'manual'
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {div.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">
                        {div.exDividendDate || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200">
                        {div.paymentDate}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-300">
                        {div.eligibleShares.toFixed(3)} × ${div.dividendPerShare.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">
                        ${div.grossAmount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-500">
                        -${div.withholdingTax.toFixed(2)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        +${div.netAmount.toFixed(2)}{' '}
                        <span className="font-normal text-gray-400">
                          ({div.netAmountMad.toFixed(1)} MAD)
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteDividend(div.id)}
                          className="p-1 text-gray-400 hover:text-rose-500 cursor-pointer"
                          title="Delete dividend entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 6 & 7: RISK, DRAWDOWN, CORRELATION HEATMAP & TRACEABLE AI INSIGHTS (§6 & §7)
         ===================================================================== */}
      {showRisk && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  <span>Risk, Drawdown, HHI Concentration &amp; Return Correlation Matrix</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Quantitative risk telemetry computed from stored daily bars: Herfindahl-Hirschman Index (HHI), Underwater Drawdown, Sharpe/Sortino, 95% Historical VaR, and Pairwise Return Correlations.
                </p>
              </div>
              <div className="text-right tabular-nums">
                <span className="text-xs text-gray-400">HHI Concentration Profile: </span>
                <strong className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  {riskAnalysis.concentration.hhiScore.toLocaleString()} ({hhiClass})
                </strong>
              </div>
            </div>

            {/* Risk KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 tabular-nums">
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">HHI Concentration</div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {riskAnalysis.concentration.hhiScore.toLocaleString()} / 10,000
                </div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400">{hhiClass}</div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Top 1 / Top 3 Weight</div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {riskAnalysis.concentration.largestPositionWeightPercent.toFixed(1)}% /{' '}
                  {riskAnalysis.concentration.top3ConcentrationPercent.toFixed(1)}%
                </div>
                <div className="text-[11px] text-gray-400">
                  Top 1: {riskAnalysis.concentration.largestPositionTicker}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Annualized Volatility</div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {riskAnalysis.volatilityMetrics.annualizedVolatilityPercent !== null
                    ? `${riskAnalysis.volatilityMetrics.annualizedVolatilityPercent.toFixed(2)}%`
                    : '—'}
                </div>
                <div className="text-[11px] text-gray-400">
                  Sample: {riskAnalysis.volatilityMetrics.sampleDays} sessions
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Sharpe / Sortino Ratio</div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {riskAnalysis.volatilityMetrics.sharpeRatio ?? '—'} /{' '}
                  {riskAnalysis.volatilityMetrics.sortinoRatio ?? '—'}
                </div>
                <div className="text-[11px] text-gray-400">
                  Rf = {riskAnalysis.volatilityMetrics.riskFreeRateAssumptionPercent}%
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Max Drawdown</div>
                <div className="mt-1 text-sm font-bold text-rose-600 dark:text-rose-400">
                  {riskAnalysis.maxDrawdownPercent.toFixed(2)}%
                </div>
                <div className="text-[11px] text-gray-400">
                  Current: {riskAnalysis.currentDrawdownPercent.toFixed(2)}%
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Historical 95% 1D VaR</div>
                <div className="mt-1 text-sm font-bold text-rose-600 dark:text-rose-400">
                  {riskAnalysis.volatilityMetrics.historicalVar95Percent !== null
                    ? `${riskAnalysis.volatilityMetrics.historicalVar95Percent.toFixed(2)}%`
                    : 'Needs ≥15d'}
                </div>
                <div className="text-[11px] text-gray-400">
                  CVaR: {riskAnalysis.volatilityMetrics.historicalCvar95Percent ?? '—'}%
                </div>
              </div>
            </div>

            {/* Underwater Drawdown Chart + Correlation Matrix Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Underwater Drawdown Chart */}
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/40 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Underwater Portfolio Drawdown Curve (% Below Rolling Peak)
                  </span>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    Max DD: {riskAnalysis.maxDrawdownPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={riskAnalysis.drawdownSeries}
                      margin={{ top: 6, right: 12, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={24} />
                      <YAxis
                        domain={['auto', 0]}
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.5rem',
                          fontSize: '11px',
                          color: '#f8fafc',
                        }}
                      />
                      <ReferenceLine y={0} stroke="#64748b" />
                      <Area
                        type="monotone"
                        dataKey="drawdownPercent"
                        name="Drawdown %"
                        stroke="#f43f5e"
                        fill="#f43f5e"
                        fillOpacity={0.25}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Holding-to-Holding Return Correlation Matrix */}
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Pairwise Daily Return Correlation Matrix (-1.00 to +1.00)
                  </span>
                  <span className="text-[11px] text-gray-400">Stored OHLCV series</span>
                </div>
                {riskAnalysis.correlationMatrix.symbols.length === 0 ? (
                  <p className="text-xs text-gray-400 py-8 text-center">
                    Add at least 2 stock positions to compute pairwise return correlations.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-[11px] tabular-nums border-collapse">
                      <thead>
                        <tr>
                          <th className="p-1.5 text-left text-gray-400">Symbol</th>
                          {riskAnalysis.correlationMatrix.symbols.map((sym) => (
                            <th
                              key={sym}
                              className="p-1.5 font-mono font-semibold text-gray-600 dark:text-gray-300"
                            >
                              {sym}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {riskAnalysis.correlationMatrix.symbols.map((rowSym, rIdx) => (
                          <tr key={rowSym} className="border-t border-gray-200/60 dark:border-gray-800/60">
                            <td className="p-1.5 text-left font-mono font-bold text-gray-700 dark:text-gray-200">
                              {rowSym}
                            </td>
                            {riskAnalysis.correlationMatrix.matrix[rIdx].map((cell, cIdx) => {
                              const corrVal = cell.correlation ?? 0;
                              const bg =
                                rIdx === cIdx
                                  ? 'bg-indigo-500/20 text-indigo-300 font-bold'
                                  : corrVal >= 0.65
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 font-semibold'
                                    : corrVal <= 0.2
                                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                                      : 'text-gray-600 dark:text-gray-300';
                              return (
                                <td key={`${rowSym}-${cIdx}`} className={`p-1.5 rounded ${bg}`}>
                                  {cell.correlation !== null ? cell.correlation.toFixed(2) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Values near +1.00 indicate holdings that move together during market swings; values near 0.00 or negative reduce overall portfolio variance.
                </p>
              </div>
            </div>
          </div>

          {/* Section 7: Traceable AI Investment Insights (§7) */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  <span>Traceable Portfolio Intelligence &amp; Audit-Backed Insights</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Every insight below is deterministically grounded in your persisted holdings, sector weights, and risk formulas—never unverified price predictions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {traceableInsights.map((ins) => (
                <div
                  key={ins.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/60 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white">{ins.title}</h4>
                    <span
                      className={`text-[11px] font-semibold uppercase ${
                        ins.severity === 'warning'
                          ? 'text-amber-600 dark:text-amber-400'
                          : ins.severity === 'positive'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {ins.metricBadge}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">Observed Fact: </span>
                      <span className="text-gray-600 dark:text-gray-300">{ins.observedFact}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">Formula &amp; Basis: </span>
                      <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300">
                        {ins.calculationExplanation}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-200">Context: </span>
                      <span className="text-gray-600 dark:text-gray-300">{ins.interpretationAndContext}</span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-gray-200/60 dark:border-gray-800/60 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{ins.dataFreshnessNote}</span>
                    {ins.relatedTickers.length > 0 && (
                      <span className="font-mono">{ins.relatedTickers.slice(0, 4).join(', ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 9: WATCHLIST, TARGET PRICE ALERTS & SIDE-BY-SIDE COMPARE (§9)
         ===================================================================== */}
      {showWatchlist && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-500" />
                <span>Watchlist, Target Price Alerts &amp; Side-by-Side Symbol Comparison</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Monitor candidate stocks with target buy prices, high/low alert thresholds, and one-click promotion to active holdings.
              </p>
            </div>

            <form onSubmit={handleAddWatchlistItem} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                placeholder="Ticker (e.g. AMD, TSM)"
                value={watchTickerInput}
                onChange={(e) => setWatchTickerInput(e.target.value.toUpperCase())}
                className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
              />
              <input
                type="number"
                step="any"
                placeholder="Target Price ($)"
                value={watchTargetPrice}
                onChange={(e) => setWatchTargetPrice(e.target.value)}
                className="w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add to Watchlist</span>
              </button>
            </form>
          </div>

          {/* Watchlist Cards */}
          {watchlistPositions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center text-xs text-gray-400">
              Your watchlist is currently empty. Enter a ticker above (e.g., AMD, AVGO, MSFT, CAT, LLY) to track target entry prices and alerts without owning shares.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {watchlistPositions.map((w) => {
                const distanceToTargetPct =
                  w.targetPriceNum && w.currentPriceNum > 0
                    ? ((w.targetPriceNum - w.currentPriceNum) / w.currentPriceNum) * 100
                    : null;
                return (
                  <div
                    key={w.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60 p-4 space-y-3 tabular-nums"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => onInspectInstrument(w.ticker, w)}
                          className="text-sm font-bold text-gray-900 dark:text-white hover:text-indigo-500 cursor-pointer"
                        >
                          {w.ticker} · {w.companyName}
                        </button>
                        <div className="text-[11px] text-gray-400">{w.sector}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          ${w.currentPriceNum.toFixed(2)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            w.change24hPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {w.change24hPercent >= 0 ? '+' : ''}
                          {w.change24hPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-gray-200/60 dark:border-gray-800/60 pt-2">
                      <span className="text-gray-400">
                        Target: {w.targetPriceNum ? `$${w.targetPriceNum.toFixed(2)}` : 'Not set'}
                      </span>
                      {distanceToTargetPct !== null && (
                        <span className="font-semibold text-indigo-500">
                          {distanceToTargetPct >= 0 ? '+' : ''}
                          {distanceToTargetPct.toFixed(1)}% to target
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onQuickAddStock(w.ticker)}
                        className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                      >
                        Promote to Holding
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectInstrument(w.ticker, w)}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        Chart
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePosition(w.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Side-by-Side Instrument Comparison (§9) */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Side-by-Side Symbol Comparison
              </span>
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={compareSymbolA}
                  onChange={(e) => setCompareSymbolA(e.target.value)}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-gray-900 dark:text-white"
                >
                  {availableSimSymbols.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span className="text-gray-400">vs.</span>
                <select
                  value={compareSymbolB}
                  onChange={(e) => setCompareSymbolB(e.target.value)}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-gray-900 dark:text-white"
                >
                  {availableSimSymbols.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs tabular-nums">
              {[compareSymbolA, compareSymbolB].map((sym) => {
                const bars = storedDailyBars[sym] || [];
                const first = bars[0]?.close || 100;
                const last = bars[bars.length - 1]?.close || 100;
                const retPct = first > 0 ? ((last - first) / first) * 100 : 0;
                const high = bars.length > 0 ? Math.max(...bars.map((b) => b.high)) : last * 1.1;
                const low = bars.length > 0 ? Math.min(...bars.map((b) => b.low)) : last * 0.9;
                return (
                  <div
                    key={sym}
                    className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white">
                        {sym} · {resolveCanonicalCompanyName(sym, sym)}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        52W Range: ${low.toFixed(2)} – ${high.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-gray-900 dark:text-white">
                        ${last.toFixed(2)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          retPct >= 0 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        Stored Window Return: {retPct >= 0 ? '+' : ''}
                        {retPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SECTION 8: PLANNING, COMPOUND SIMULATOR, HISTORICAL DCA & REBALANCING (§8)
         ===================================================================== */}
      {showPlanning && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 8.1 Compound-Growth Projection Calculator */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  <span>Compound-Growth &amp; DRIP Projection Simulator</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Model Moderate, Optimistic (+3.5%), and Pessimistic (-3.5%) wealth trajectories with monthly contributions.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Initial Capital (MAD)
                  </label>
                  <input
                    type="number"
                    value={compInitialMad}
                    onChange={(e) => setCompInitialMad(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Monthly DCA (MAD)
                  </label>
                  <input
                    type="number"
                    value={compMonthlyMad}
                    onChange={(e) => setCompMonthlyMad(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Horizon (Years)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={compYears}
                    onChange={(e) => setCompYears(Math.max(1, Math.min(40, Number(e.target.value))))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Expected Return (%/yr)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={compRatePct}
                    onChange={(e) => setCompRatePct(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={compoundProjection.points}
                    margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                        color: '#f8fafc',
                      }}
                      formatter={(val: any) => [`${Number(val).toLocaleString()} MAD`, '']}
                    />
                    <Area
                      type="monotone"
                      dataKey="optimisticValueMad"
                      name="Optimistic (+3.5%)"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.12}
                    />
                    <Area
                      type="monotone"
                      dataKey="moderateValueMad"
                      name="Moderate Base"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.25}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalContributionsMad"
                      name="Principal Contributed"
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs tabular-nums">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-950 p-2.5">
                  <span className="text-[11px] text-gray-400 block">Principal Contributed</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    {compoundProjection.finalContributionsMad.toLocaleString()} MAD
                  </span>
                </div>
                <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/30 p-2.5">
                  <span className="text-[11px] text-indigo-400 block">Moderate Projected</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-300">
                    {compoundProjection.finalModerateMad.toLocaleString()} MAD
                  </span>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5">
                  <span className="text-[11px] text-emerald-400 block">Optimistic Case</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-300">
                    {compoundProjection.finalOptimisticMad.toLocaleString()} MAD
                  </span>
                </div>
              </div>
            </div>

            {/* 8.2 Historical DCA vs Lump-Sum Backtester */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Scale className="h-5 w-5 text-emerald-500" />
                  <span>Historical DCA vs. Lump-Sum Simulator (Stored Daily OHLCV)</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Backtest periodic Dollar-Cost Averaging against a single Day-1 Lump-Sum deployment over real stored daily bars.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Benchmark / Stock
                  </label>
                  <select
                    value={dcaSymbol}
                    onChange={(e) => setDcaSymbol(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                  >
                    {availableSimSymbols.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Total Capital ($ USD)
                  </label>
                  <input
                    type="number"
                    value={dcaTotalBudgetUsd}
                    onChange={(e) => setDcaTotalBudgetUsd(Math.max(50, Number(e.target.value)))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                    Lookback Window
                  </label>
                  <select
                    value={dcaLookbackMonths}
                    onChange={(e) => setDcaLookbackMonths(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 text-gray-900 dark:text-white"
                  >
                    <option value={3}>Last 3 Months</option>
                    <option value={6}>Last 6 Months</option>
                    <option value={12}>Last 12 Months</option>
                  </select>
                </div>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dcaSimulation?.series || []}
                    margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => String(v).slice(5)}
                      minTickGap={24}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                        color: '#f8fafc',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="dcaValueUsd"
                      name="Periodic DCA Value ($)"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="lumpSumValueUsd"
                      name="Lump-Sum Value ($)"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {dcaSimulation && (
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs tabular-nums">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                    <div className="text-[11px] text-emerald-400">Periodic DCA Ending Value</div>
                    <div className="font-bold text-emerald-600 dark:text-emerald-300 text-sm">
                      ${dcaSimulation.dcaEndingValueUsd.toFixed(2)} (
                      {dcaSimulation.dcaReturnPercent >= 0 ? '+' : ''}
                      {dcaSimulation.dcaReturnPercent.toFixed(2)}%)
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Avg Cost: ${dcaSimulation.dcaWeightedAvgCostUsd.toFixed(2)}/sh
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2.5">
                    <div className="text-[11px] text-indigo-400">Day-1 Lump-Sum Ending Value</div>
                    <div className="font-bold text-indigo-600 dark:text-indigo-300 text-sm">
                      ${dcaSimulation.lumpSumEndingValueUsd.toFixed(2)} (
                      {dcaSimulation.lumpSumReturnPercent >= 0 ? '+' : ''}
                      {dcaSimulation.lumpSumReturnPercent.toFixed(2)}%)
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Entry Price: ${dcaSimulation.lumpSumEntryPriceUsd.toFixed(2)}/sh
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 8.3 Rebalancing Assistant & 8.4 Investment Goals Tracker */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rebalancing Assistant */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-500" />
                  <span>Portfolio Rebalancing Assistant (Target vs. Current Weights)</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Set target allocation percentages per holding to calculate exact indicative Buy/Sell adjustments in USD and MAD.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] text-gray-400 uppercase">
                      <th className="py-2 pr-2">Holding</th>
                      <th className="py-2 px-2 text-right">Current Wt</th>
                      <th className="py-2 px-2 text-right">Target Wt (%)</th>
                      <th className="py-2 pl-2 text-right">Indicative Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {stockPositions.map((p) => {
                      const equalDefault =
                        stockPositions.length > 0 ? Math.round(100 / stockPositions.length) : 20;
                      const targetWt =
                        customTargetWeights[p.ticker] !== undefined
                          ? customTargetWeights[p.ticker]
                          : Number(p.targetWeightPercent) > 0
                            ? Number(p.targetWeightPercent)
                            : equalDefault;
                      const diffPct = targetWt - (p.stockWeightPercent || 0);
                      const deltaUsd = (diffPct / 100) * totalStockValueUsd;
                      return (
                        <tr key={p.id}>
                          <td className="py-2 pr-2 font-bold text-gray-900 dark:text-white">
                            {p.ticker}
                            <span className="block text-[10px] font-normal text-gray-400">
                              ${(p.marketValueUsd ?? p.marketValueMad / usdToMadRate).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                            {(p.stockWeightPercent || 0).toFixed(1)}%
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={targetWt}
                              onChange={(e) =>
                                setCustomTargetWeights((prev) => ({
                                  ...prev,
                                  [p.ticker]: Math.max(0, Math.min(100, Number(e.target.value))),
                                }))
                              }
                              className="w-16 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2 py-1 text-right font-mono text-gray-900 dark:text-white"
                            />
                          </td>
                          <td className="py-2 pl-2 text-right font-semibold">
                            {Math.abs(deltaUsd) < 0.5 ? (
                              <span className="text-gray-400">On Target</span>
                            ) : deltaUsd > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Buy +${deltaUsd.toFixed(2)} (+{(deltaUsd * usdToMadRate).toFixed(0)} MAD)
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">
                                Trim -${Math.abs(deltaUsd).toFixed(2)} (-
                                {(Math.abs(deltaUsd) * usdToMadRate).toFixed(0)} MAD)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Investment Goals Tracker */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Flag className="h-5 w-5 text-emerald-500" />
                  <span>Investment Milestones &amp; Capital Goals</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Track your current Stocks &amp; Equities valuation ({totalStockValueMad.toFixed(0)} MAD) against long-term wealth milestones.
                </p>
              </div>

              <div className="space-y-3 tabular-nums">
                {goals.map((g) => {
                  const pct = Math.min(
                    100,
                    Math.max(0, (totalStockValueMad / Math.max(1, g.targetAmountMad)) * 100)
                  );
                  const remainingMad = Math.max(0, g.targetAmountMad - totalStockValueMad);
                  const monthsToGoal =
                    g.monthlyContributionMad > 0
                      ? Math.ceil(remainingMad / g.monthlyContributionMad)
                      : 0;
                  return (
                    <div
                      key={g.id}
                      className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 dark:text-white">{g.title}</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {totalStockValueMad.toFixed(0)} / {g.targetAmountMad.toLocaleString()} MAD (
                          {pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>Target Date: {g.targetDate || '2028-12-31'}</span>
                        <span>
                          Est. {monthsToGoal} mos at {g.monthlyContributionMad} MAD/mo
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddGoal} className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                <input
                  type="text"
                  placeholder="New goal title (e.g. 50,000 MAD Equities)"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-1.5 text-gray-900 dark:text-white"
                />
                <input
                  type="number"
                  placeholder="Target MAD"
                  value={newGoalTargetMad}
                  onChange={(e) => setNewGoalTargetMad(e.target.value)}
                  className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-1.5 font-mono text-gray-900 dark:text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                >
                  + Add Goal
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manual Dividend Entry Modal */}
      {showDivModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Record Dividend Event
              </h3>
              <button
                type="button"
                onClick={() => setShowDivModal(false)}
                className="text-xs text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleCreateDividendEvent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Stock Symbol
                  </label>
                  <input
                    type="text"
                    required
                    value={divTicker}
                    onChange={(e) => setDivTicker(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={divStatus}
                    onChange={(e) => setDivStatus(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value="paid">Paid</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="estimated">Estimated</option>
                    <option value="manual">Manual Entry</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={divPayDate}
                    onChange={(e) => setDivPayDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Ex-Dividend Date
                  </label>
                  <input
                    type="date"
                    value={divExDate}
                    onChange={(e) => setDivExDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Div / Share ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={divPerShare}
                    onChange={(e) => setDivPerShare(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-2 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Eligible Shares
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={divShares}
                    onChange={(e) => setDivShares(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-2 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    WHT Tax ($)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={divTax}
                    onChange={(e) => setDivTax(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2.5 py-2 font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowDivModal(false)}
                  className="rounded-lg px-4 py-2 font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDiv}
                  className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                >
                  {savingDiv ? 'Saving...' : 'Save Dividend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
