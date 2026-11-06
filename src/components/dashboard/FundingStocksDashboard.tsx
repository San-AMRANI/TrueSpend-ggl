import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Award,
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  DollarSign,
  Edit3,
  Filter,
  Globe,
  Layers,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
  Wrench,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  BinanceAccountOverview,
  InvestmentsData,
  StockCatalogItem,
  StockMarketType,
  StockOrderAction,
  StockPosition,
  Wallet,
} from '../../types';
import {
  ALL_STOCK_SECTOR_CATEGORIES,
  classifyAssetClass,
  COMPANY_NAME_TO_TICKER,
  normalizeStockTicker,
  resolveCanonicalCompanyName,
  resolveStockSectorCategory,
  STOCK_SECTOR_METADATA,
  TICKER_TO_COMPANY_NAME,
  type StockSectorCategory,
} from '../../lib/stockCategories';
import { InstrumentDetailModal } from './InstrumentDetailModal';
import {
  StocksIntelligenceSuite,
  type StocksSuiteSection,
} from './StocksIntelligenceSuite';

interface FundingStocksDashboardProps {
  investmentsData?: InvestmentsData | null;
  wallets?: Wallet[];
  positions?: StockPosition[];
  catalog?: StockCatalogItem[];
  binance?: BinanceAccountOverview | null;
  usdToMadRate: number;
  deployableSurplusMad?: number;
  isSaving: boolean;
  onUpsertPosition: (payload: {
    ticker: string;
    companyName?: string;
    market?: StockMarketType;
    sector?: string;
    shares?: number;
    avgCostPerShare?: number;
    currentPrice?: number;
    currency?: string;
    annualDividendPerShare?: number;
    targetWeightPercent?: number;
    convictionThesis?: string;
    isWatchlistOnly?: boolean;
    walletId?: string | null;
    syncWithWallet?: boolean;
  }) => Promise<any>;
  onUpdatePosition: (id: string, payload: any) => Promise<any>;
  onDeletePosition: (id: string) => Promise<any>;
  onExecuteOrder: (payload: {
    positionId?: string;
    ticker?: string;
    action: StockOrderAction;
    shares?: number;
    pricePerShare?: number;
    totalNativeAmount?: number;
    walletId?: string | null;
    syncWithWallet?: boolean;
    notes?: string;
  }) => Promise<any>;
  onInspectTickerForensics?: (ticker: string) => void;
  onInspectTickerTrades?: (ticker: string) => void;
  onSwitchToSpotCrypto: () => void;
}

function formatUsd(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  const abs = Math.abs(num);
  const dynamicDecimals = abs > 0 && abs < 1 ? 4 : decimals;
  const sign = num < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: dynamicDecimals,
    maximumFractionDigits: dynamicDecimals,
  })}`;
}

function formatMad(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} MAD`;
}

function formatSignedUsd(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatUsd(num, decimals)}`;
}

function formatSignedMad(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatMad(num, decimals)}`;
}

function formatQty(value: number | undefined | null): string {
  const num = Number(value || 0);
  if (num === 0) return '0';
  if (Math.abs(num) >= 1000) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (Math.abs(num) >= 1) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function getSectorIcon(sector: StockSectorCategory) {
  switch (sector) {
    case 'AI & Semiconductors':
      return <Cpu className="h-4 w-4" />;
    case 'Technology & Cloud':
      return <Globe className="h-4 w-4" />;
    case 'Mechanics, Automotive & Industrials':
      return <Wrench className="h-4 w-4" />;
    case 'Banking & Financials':
      return <Building2 className="h-4 w-4" />;
    case 'Consumer & Retail':
      return <Briefcase className="h-4 w-4" />;
    case 'Healthcare & Biotech':
      return <Activity className="h-4 w-4" />;
    case 'Energy, Utilities & Real Estate':
      return <Layers className="h-4 w-4" />;
    case 'Index & Dividend ETFs':
      return <PieChartIcon className="h-4 w-4" />;
    default:
      return <BarChart3 className="h-4 w-4" />;
  }
}

export const FundingStocksDashboard: React.FC<FundingStocksDashboardProps> = ({
  investmentsData,
  positions,
  catalog,
  binance,
  usdToMadRate,
  isSaving,
  onUpsertPosition,
  onUpdatePosition,
  onDeletePosition,
  onExecuteOrder,
  onInspectTickerForensics,
  onInspectTickerTrades,
  onSwitchToSpotCrypto,
}) => {
  const safePositions = useMemo<StockPosition[]>(() => {
    if (Array.isArray(positions)) return positions;
    if (Array.isArray(investmentsData?.positions)) return investmentsData.positions;
    return [];
  }, [positions, investmentsData?.positions]);

  const safeCatalog = useMemo<StockCatalogItem[]>(() => {
    if (Array.isArray(catalog)) return catalog;
    if (Array.isArray(investmentsData?.catalog)) return investmentsData.catalog;
    return [];
  }, [catalog, investmentsData?.catalog]);

  const safeBinance = binance ?? investmentsData?.binance ?? null;
  const handleInspectForensics =
    onInspectTickerForensics || onInspectTickerTrades || (() => {});

  // Interactive Filter & Search State
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<'ALL' | StockSectorCategory>('ALL');
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'US' | 'ETF' | 'BVC'>('ALL');
  const [stockSearch, setStockSearch] = useState('');
  const [sortBy, setSortBy] = useState<'weight_desc' | 'pnl_desc' | 'yield_desc' | 'change24h_desc'>('weight_desc');
  const [activeSuiteSection, setActiveSuiteSection] = useState<StocksSuiteSection>('all');
  const [inspectedInstrument, setInspectedInstrument] = useState<{
    symbol: string;
    position?: StockPosition | null;
  } | null>(null);

  // Add / Calibrate Funding Stock Modal State
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<StockPosition | null>(null);
  const [formTicker, setFormTicker] = useState('NVDA');
  const [formCompanyName, setFormCompanyName] = useState('NVIDIA Corporation');
  const [formSector, setFormSector] = useState<StockSectorCategory>('AI & Semiconductors');
  const [formMarket, setFormMarket] = useState<StockMarketType>('US');
  const [formShares, setFormShares] = useState('1');
  const [formAvgCost, setFormAvgCost] = useState('138.60');
  const [formCurrency, setFormCurrency] = useState<'USD' | 'MAD'>('USD');
  const [formDividendPerShare, setFormDividendPerShare] = useState('0.04');
  const [formThesis, setFormThesis] = useState('Held in Binance Funding Wallet');

  // Quick Order Modal State (Buy / Sell / Dividend on an existing Stock)
  const [orderModalStock, setOrderModalStock] = useState<StockPosition | null>(null);
  const [orderAction, setOrderAction] = useState<StockOrderAction>('BUY');
  const [orderShares, setOrderShares] = useState('1');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Simulator State
  const [simTicker, setSimTicker] = useState<string>('NVDA');
  const [simInvestUsd, setSimInvestUsd] = useState<string>('100');
  const [simTargetMovePct, setSimTargetMovePct] = useState<string>('15');
  const [simHoldingMonths, setSimHoldingMonths] = useState<string>('12');
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);

  // 1. Strictly filter ONLY Stock & ETF positions (never Spot Cryptocurrencies, Stablecoins, or <$0.05 delisted dust)
  const stockHoldings = useMemo(() => {
    const rawStocks = (safePositions || []).filter((p) => {
      const cls = classifyAssetClass({
        ticker: p.ticker,
        market: p.market,
        sector: p.sector,
      });
      const hasRealValue = (p.marketValueMad ?? 0) >= 0.5 || (p.marketValueUsd ?? 0) >= 0.05;
      return cls === 'STOCK' && !p.isWatchlistOnly && p.sharesNum > 0 && hasRealValue;
    });

    // Enrich each stock with its canonical StockSectorCategory and recalculated weight within the Stocks portfolio
    const totalStocksMad = rawStocks.reduce((sum, p) => sum + p.marketValueMad, 0);

    return rawStocks.map((p) => {
      const cleanTicker = normalizeStockTicker(p.ticker) || p.ticker;
      const cleanCompanyName = resolveCanonicalCompanyName(cleanTicker, p.companyName);
      const canonicalSector = resolveStockSectorCategory({
        ticker: cleanTicker,
        existingSector: p.sector,
        companyName: cleanCompanyName,
        market: p.market,
      });
      const stockWeightPercent =
        totalStocksMad > 0 ? Math.round((p.marketValueMad / totalStocksMad) * 1000) / 10 : 0;

      return {
        ...p,
        ticker: cleanTicker,
        companyName: cleanCompanyName,
        canonicalSector,
        stockWeightPercent,
      };
    });
  }, [safePositions]);

  // Separate Spot Crypto totals so we can show the clean separation between Funding Stocks vs. Spot Crypto
  const spotCryptoSummary = useMemo(() => {
    const cryptoPositions = (safePositions || []).filter((p) => {
      const cls = classifyAssetClass({
        ticker: p.ticker,
        market: p.market,
        sector: p.sector,
      });
      return cls === 'CRYPTO' && p.marketValueMad > 0.05;
    });
    const totalCryptoMad =
      safeBinance?.cryptoEquityMad && safeBinance.cryptoEquityMad > 0
        ? safeBinance.cryptoEquityMad
        : cryptoPositions.reduce((s, p) => s + p.marketValueMad, 0);
    const totalCryptoUsd = totalCryptoMad / usdToMadRate;
    return {
      count: cryptoPositions.length,
      totalCryptoMad,
      totalCryptoUsd,
      topTickers: cryptoPositions.slice(0, 4).map((p) => p.ticker),
    };
  }, [safePositions, safeBinance?.cryptoEquityMad, usdToMadRate]);

  // 2. Compute Stocks Portfolio Aggregate KPIs
  const stocksSummary = useMemo(() => {
    const holdingsValueMad = stockHoldings.reduce((s, p) => s + p.marketValueMad, 0);
    const holdingsValueUsd = holdingsValueMad / usdToMadRate;

    const fundingWalletMad = safeBinance?.totalFundingValueMad ?? 0;
    const fundingWalletUsd = safeBinance?.totalFundingValueUsd ?? 0;
    const fundingStocksReportedMad = safeBinance?.stockEquityMad ?? 0;
    const fundingStocksReportedUsd = safeBinance?.stockEquityUsd ?? 0;

    // Total Stocks Portfolio Value combines itemized stock holdings (or Binance Funding Wallet equity if higher)
    const effectiveStocksValueMad = Math.max(
      holdingsValueMad,
      fundingStocksReportedMad,
      fundingWalletMad
    );
    const effectiveStocksValueUsd = effectiveStocksValueMad / usdToMadRate;

    const totalCostBasisMad = stockHoldings.reduce((s, p) => s + p.costBasisMad, 0);
    const totalCostBasisUsd = totalCostBasisMad / usdToMadRate;

    const grossPnlMad = stockHoldings.reduce((s, p) => s + p.unrealizedPnlMad, 0);
    const grossPnlUsd = grossPnlMad / usdToMadRate;

    const totalFeeLossMad = stockHoldings.reduce((s, p) => s + (p.totalFeeLossMad ?? 0), 0);
    const totalFeeLossUsd = totalFeeLossMad / usdToMadRate;

    const netPnlAfterFeesMad = stockHoldings.reduce(
      (s, p) => s + (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad - (p.totalFeeLossMad ?? 0)),
      0
    );
    const netPnlAfterFeesUsd = netPnlAfterFeesMad / usdToMadRate;
    const netPnlPercent =
      totalCostBasisMad > 0 ? (netPnlAfterFeesMad / totalCostBasisMad) * 100 : 0;

    const annualDividendMad = stockHoldings.reduce((s, p) => s + (p.annualDividendMad ?? 0), 0);
    const annualDividendUsd = annualDividendMad / usdToMadRate;
    const monthlyDividendMad = annualDividendMad / 12;
    const monthlyDividendUsd = annualDividendUsd / 12;

    const weightedYieldPercent =
      holdingsValueMad > 0 ? (annualDividendMad / holdingsValueMad) * 100 : 0;

    const weighted24hChangeMad = stockHoldings.reduce((s, p) => {
      const chg = p.change24hPercent || 0;
      return s + p.marketValueMad * (chg / 100);
    }, 0);
    const weighted24hChangeUsd = weighted24hChangeMad / usdToMadRate;
    const weighted24hChangePercent =
      holdingsValueMad > 0 ? (weighted24hChangeMad / holdingsValueMad) * 100 : 0;

    const unallocatedFundingCashUsd = Math.max(0, fundingWalletUsd - holdingsValueUsd);
    const unallocatedFundingCashMad = unallocatedFundingCashUsd * usdToMadRate;

    const winners = [...stockHoldings].sort(
      (a, b) => (b.netPnlAfterFeesUsd ?? b.unrealizedPnlUsd) - (a.netPnlAfterFeesUsd ?? a.unrealizedPnlUsd)
    );
    const topWinner = winners[0] || null;

    return {
      holdingsCount: stockHoldings.length,
      holdingsValueMad,
      holdingsValueUsd,
      fundingWalletMad,
      fundingWalletUsd,
      effectiveStocksValueMad,
      effectiveStocksValueUsd,
      unallocatedFundingCashUsd,
      unallocatedFundingCashMad,
      totalCostBasisMad,
      totalCostBasisUsd,
      grossPnlMad,
      grossPnlUsd,
      totalFeeLossMad,
      totalFeeLossUsd,
      netPnlAfterFeesMad,
      netPnlAfterFeesUsd,
      netPnlPercent,
      annualDividendMad,
      annualDividendUsd,
      monthlyDividendMad,
      monthlyDividendUsd,
      weightedYieldPercent,
      weighted24hChangeMad,
      weighted24hChangeUsd,
      weighted24hChangePercent,
      topWinner,
    };
  }, [stockHoldings, safeBinance, usdToMadRate]);

  // 3. Compute Stock Category Breakdown (AI, Tech, Mechanics/Automotive, Banking, Consumer, Healthcare, Energy, ETFs)
  const categoryBreakdown = useMemo(() => {
    const totalStocksValueMad = stockHoldings.reduce((s, p) => s + p.marketValueMad, 0);

    const map = new Map<
      StockSectorCategory,
      {
        category: StockSectorCategory;
        shortLabel: string;
        description: string;
        colorHex: string;
        valueMad: number;
        valueUsd: number;
        costBasisMad: number;
        netPnlMad: number;
        netPnlUsd: number;
        netPnlPercent: number;
        weightPercent: number;
        positionsCount: number;
        tickers: string[];
        weighted24hChange: number;
        annualDividendUsd: number;
        avgYieldPercent: number;
      }
    >();

    for (const cat of ALL_STOCK_SECTOR_CATEGORIES) {
      const meta = STOCK_SECTOR_METADATA[cat];
      map.set(cat, {
        category: cat,
        shortLabel: meta.shortLabel,
        description: meta.description,
        colorHex: meta.colorHex,
        valueMad: 0,
        valueUsd: 0,
        costBasisMad: 0,
        netPnlMad: 0,
        netPnlUsd: 0,
        netPnlPercent: 0,
        weightPercent: 0,
        positionsCount: 0,
        tickers: [],
        weighted24hChange: 0,
        annualDividendUsd: 0,
        avgYieldPercent: 0,
      });
    }

    for (const pos of stockHoldings) {
      const entry = map.get(pos.canonicalSector)!;
      entry.valueMad += pos.marketValueMad;
      entry.valueUsd += pos.marketValueUsd ?? pos.marketValueMad / usdToMadRate;
      entry.costBasisMad += pos.costBasisMad;
      const netMad = pos.netPnlAfterFeesMad ?? pos.unrealizedPnlMad - (pos.totalFeeLossMad ?? 0);
      entry.netPnlMad += netMad;
      entry.netPnlUsd += netMad / usdToMadRate;
      entry.positionsCount += 1;
      if (!entry.tickers.includes(pos.ticker)) {
        entry.tickers.push(pos.ticker);
      }
      entry.weighted24hChange += pos.marketValueMad * (pos.change24hPercent || 0);
      entry.annualDividendUsd += (pos.annualDividendMad || 0) / usdToMadRate;
    }

    const list = Array.from(map.values()).map((item) => {
      const weightPercent =
        totalStocksValueMad > 0
          ? Math.round((item.valueMad / totalStocksValueMad) * 1000) / 10
          : 0;
      const netPnlPercent =
        item.costBasisMad > 0 ? Math.round((item.netPnlMad / item.costBasisMad) * 1000) / 10 : 0;
      const weighted24hChange =
        item.valueMad > 0 ? Math.round((item.weighted24hChange / item.valueMad) * 100) / 100 : 0;
      const avgYieldPercent =
        item.valueUsd > 0 ? Math.round((item.annualDividendUsd / item.valueUsd) * 10000) / 100 : 0;

      return {
        ...item,
        valueMad: Math.round(item.valueMad * 100) / 100,
        valueUsd: Math.round(item.valueUsd * 100) / 100,
        netPnlMad: Math.round(item.netPnlMad * 100) / 100,
        netPnlUsd: Math.round(item.netPnlUsd * 100) / 100,
        weightPercent,
        netPnlPercent,
        weighted24hChange,
        avgYieldPercent,
      };
    });

    // Sort active categories by weight descending, then empty categories in canonical order
    const activeCategories = list
      .filter((c) => c.positionsCount > 0)
      .sort((a, b) => b.weightPercent - a.weightPercent);
    const emptyCategories = list.filter((c) => c.positionsCount === 0);

    return {
      all: [...activeCategories, ...emptyCategories],
      active: activeCategories,
      dominantCategory: activeCategories[0] || null,
      secondCategory: activeCategories[1] || null,
      thirdCategory: activeCategories[2] || null,
    };
  }, [stockHoldings, usdToMadRate]);

  // 4. Filter and Sort Stock Holdings for Display
  const displayedStockHoldings = useMemo(() => {
    const filtered = stockHoldings.filter((pos) => {
      if (selectedSectorFilter !== 'ALL' && pos.canonicalSector !== selectedSectorFilter) {
        return false;
      }
      if (marketFilter !== 'ALL' && pos.market !== marketFilter) {
        return false;
      }
      if (stockSearch.trim()) {
        const q = stockSearch.trim().toLowerCase();
        return (
          pos.ticker.toLowerCase().includes(q) ||
          pos.companyName.toLowerCase().includes(q) ||
          pos.canonicalSector.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'pnl_desc') {
        return (
          (b.netPnlAfterFeesMad ?? b.unrealizedPnlMad) -
          (a.netPnlAfterFeesMad ?? a.unrealizedPnlMad)
        );
      }
      if (sortBy === 'yield_desc') {
        return (b.dividendYieldPercent || 0) - (a.dividendYieldPercent || 0);
      }
      if (sortBy === 'change24h_desc') {
        return (b.change24hPercent || 0) - (a.change24hPercent || 0);
      }
      return b.marketValueMad - a.marketValueMad;
    });
  }, [stockHoldings, selectedSectorFilter, marketFilter, stockSearch, sortBy]);

  // 5. Enrich & Filter Benchmark Stock Catalog by Canonical Sector
  const enrichedCatalog = useMemo(() => {
    return (safeCatalog || []).map((item) => ({
      ...item,
      canonicalSector: resolveStockSectorCategory({
        ticker: item.ticker,
        existingSector: item.sector,
        companyName: item.companyName,
        market: item.market,
      }),
    }));
  }, [safeCatalog]);

  const filteredCatalog = useMemo(() => {
    return enrichedCatalog.filter((item) => {
      if (selectedSectorFilter !== 'ALL' && item.canonicalSector !== selectedSectorFilter) {
        return false;
      }
      if (marketFilter !== 'ALL' && item.market !== marketFilter) {
        return false;
      }
      if (stockSearch.trim()) {
        const q = stockSearch.trim().toLowerCase();
        return (
          item.ticker.toLowerCase().includes(q) ||
          item.companyName.toLowerCase().includes(q) ||
          item.canonicalSector.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [enrichedCatalog, selectedSectorFilter, marketFilter, stockSearch]);

  // 6. Generate Friendly, Actionable Stocks Dashboard Insights
  const friendlyStockInsights = useMemo(() => {
    const dom = categoryBreakdown.dominantCategory;
    const sec = categoryBreakdown.secondCategory;
    const activeCatCount = categoryBreakdown.active.length;

    const totalStocksPlusCryptoMad =
      stocksSummary.effectiveStocksValueMad + spotCryptoSummary.totalCryptoMad;
    const stocksShareOfRiskPct =
      totalStocksPlusCryptoMad > 0
        ? (stocksSummary.effectiveStocksValueMad / totalStocksPlusCryptoMad) * 100
        : 100;

    return [
      {
        id: 'dominant-category-insight',
        badge: 'Category Dominance',
        tone: dom && dom.weightPercent > 60 ? ('amber' as const) : ('indigo' as const),
        title: dom
          ? `#1 Category: ${dom.category} (${dom.weightPercent.toFixed(1)}% of Stocks)`
          : 'Categorize Your Funding Stocks (AI, Tech, Banking, Mechanics)',
        metric: dom
          ? `${formatUsd(dom.valueUsd)} · ${formatMad(dom.valueMad, 0)} across ${dom.positionsCount} stock${dom.positionsCount === 1 ? '' : 's'} (${dom.tickers.join(', ')})`
          : '8 Industry Sectors Ready',
        body: dom
          ? dom.weightPercent > 55
            ? `Your stocks portfolio is heavily concentrated in ${dom.category} (${dom.weightPercent.toFixed(1)}%).${
                sec ? ` Your second largest category is ${sec.category} (${sec.weightPercent.toFixed(1)}%).` : ''
              } To make your portfolio more resilient against single-sector pullbacks, consider balancing with defensive or industrial categories like Banking & Financials (JPM, V) or Mechanics & Industrials (CAT, DE, GE).`
            : `Your stocks are led by ${dom.category} (${dom.weightPercent.toFixed(1)}%)${
                sec ? ` and ${sec.category} (${sec.weightPercent.toFixed(1)}%)` : ''
              } across ${activeCatCount} active sector${activeCatCount === 1 ? '' : 's'}. Keeping no single category above 50% protects your capital across market cycles.`
          : 'Add or sync the US stocks held in your Binance Funding Wallet below to automatically see your exact percentage breakdown across AI & Semiconductors, Technology & Cloud, Mechanics & Automotive, and Banking & Financials.',
      },
      {
        id: 'funding-vs-spot-separation',
        badge: 'Funding vs. Spot Split',
        tone: 'emerald' as const,
        title: 'US Stocks (Funding) Strictly Separated from Spot Crypto',
        metric: `Stocks: ${formatUsd(stocksSummary.effectiveStocksValueUsd)} (${stocksShareOfRiskPct.toFixed(1)}%) · Spot Crypto: ${formatUsd(spotCryptoSummary.totalCryptoUsd)}`,
        body: `Your US & Global Stock positions in the Funding Wallet (${formatUsd(stocksSummary.effectiveStocksValueUsd)} / ${formatMad(stocksSummary.effectiveStocksValueMad, 0)}) are tracked separately from your ${spotCryptoSummary.count} Spot Cryptocurrency holding${spotCryptoSummary.count === 1 ? '' : 's'} (${formatUsd(spotCryptoSummary.totalCryptoUsd)}). This ensures 24/7 crypto volatility never distorts your stock sector percentages or equity P&L.`,
      },
      {
        id: 'breakeven-and-fee-protection',
        badge: 'Breakeven & Net Profit',
        tone: stocksSummary.netPnlAfterFeesMad >= 0 ? ('emerald' as const) : ('amber' as const),
        title:
          stocksSummary.topWinner
            ? `Top Stock Performer: ${stocksSummary.topWinner.ticker} (${formatSignedUsd(stocksSummary.topWinner.netPnlAfterFeesUsd ?? stocksSummary.topWinner.unrealizedPnlUsd)} Net)`
            : 'Round-Trip Fee & Breakeven Protection',
        metric: `Net Stocks P&L: ${formatSignedUsd(stocksSummary.netPnlAfterFeesUsd)} (${formatSignedMad(stocksSummary.netPnlAfterFeesMad, 1)}) · Fee Drag: -${formatUsd(stocksSummary.totalFeeLossUsd, 3)}`,
        body:
          stocksSummary.topWinner
            ? `${stocksSummary.topWinner.ticker} (${stocksSummary.topWinner.canonicalSector}) is your strongest stock position. Every stock card below shows its exact Breakeven Share Price so you never sell below your entry + exit fee threshold.`
            : `Every stock trade incurs entry and exit friction (~0.10% on US/Funding equities, ~0.35% on Casablanca BVC). Use the Breakeven target on each stock card to verify your net profit after fees.`,
      },
      {
        id: 'passive-dividend-vision',
        badge: 'Passive Cash Flow',
        tone: 'indigo' as const,
        title: 'Stocks Dividend Yield & 5-Year Compounding',
        metric: `+${formatUsd(stocksSummary.annualDividendUsd)}/yr (+${formatMad(stocksSummary.annualDividendMad, 1)}/yr · ${stocksSummary.weightedYieldPercent.toFixed(2)}% Yield)`,
        body:
          stocksSummary.annualDividendUsd > 0
            ? `Your stocks generate +${formatUsd(stocksSummary.monthlyDividendUsd)}/month (+${formatMad(stocksSummary.monthlyDividendMad, 1)}/mo) in projected passive dividends. Reinvesting dividends (DRIP) at historical 8% equity growth projects your stocks to reach ${formatUsd(stocksSummary.effectiveStocksValueUsd * 1.48)} in 5 years.`
            : `AI & Tech growth stocks reinvest cash internally for price appreciation (0%–0.5% dividend yield). Blending in Banking (JPM 2.1%, ATW 3.6%), Mechanics (CAT 1.5%, HON 2.1%), or Dividend ETFs (SCHD 3.5%, O 5.4%) adds steady quarterly cash payouts.`,
      },
    ];
  }, [categoryBreakdown, stocksSummary, spotCryptoSummary]);

  // 7. Stock Trade & Breakeven Simulator Calculation
  const stockSimulation = useMemo(() => {
    const selectedStock =
      enrichedCatalog.find((c) => c.ticker === simTicker) ||
      enrichedCatalog[0] || {
        ticker: 'NVDA',
        companyName: 'NVIDIA Corporation',
        market: 'US' as StockMarketType,
        sector: 'AI & Semiconductors',
        canonicalSector: 'AI & Semiconductors' as StockSectorCategory,
        price: 138.6,
        change24hPercent: 2.15,
        currency: 'USD',
        annualDividendPerShare: 0.04,
        dividendYieldPercent: 0.03,
        priceInMad: 138.6 * usdToMadRate,
        inPortfolio: false,
        inWatchlist: false,
      };

    const investUsd = Math.max(1, parseFloat(simInvestUsd) || 100);
    const investMad = investUsd * usdToMadRate;
    const targetMovePct = parseFloat(simTargetMovePct) || 0;
    const holdingMonths = Math.max(1, parseFloat(simHoldingMonths) || 12);

    const stockPriceUsd =
      selectedStock.currency === 'MAD'
        ? selectedStock.price / usdToMadRate
        : selectedStock.price || 100;
    const sharesAcquired = stockPriceUsd > 0 ? investUsd / stockPriceUsd : 0;

    const feeRate = selectedStock.market === 'BVC' ? 0.0035 : 0.001;
    const entryFeeUsd = investUsd * feeRate;
    const projectedGrossValueUsd = investUsd * (1 + targetMovePct / 100);
    const exitFeeUsd = projectedGrossValueUsd * feeRate;
    const totalRoundTripFeesUsd = entryFeeUsd + exitFeeUsd;
    const totalRoundTripFeesMad = totalRoundTripFeesUsd * usdToMadRate;

    const grossCapitalGainUsd = projectedGrossValueUsd - investUsd;
    const netCapitalGainAfterFeesUsd = grossCapitalGainUsd - totalRoundTripFeesUsd;

    const divYieldPct = selectedStock.dividendYieldPercent || 0;
    const proratedDividendUsd = investUsd * (divYieldPct / 100) * (holdingMonths / 12);
    const totalNetReturnUsd = netCapitalGainAfterFeesUsd + proratedDividendUsd;
    const totalNetReturnMad = totalNetReturnUsd * usdToMadRate;
    const totalNetRoiPct = (totalNetReturnUsd / investUsd) * 100;

    const breakevenStockPriceUsd = (stockPriceUsd * (1 + feeRate)) / (1 - feeRate);

    return {
      stock: selectedStock,
      investUsd,
      investMad,
      sharesAcquired,
      stockPriceUsd,
      entryFeeUsd,
      exitFeeUsd,
      totalRoundTripFeesUsd,
      totalRoundTripFeesMad,
      grossCapitalGainUsd,
      netCapitalGainAfterFeesUsd,
      proratedDividendUsd,
      totalNetReturnUsd,
      totalNetReturnMad,
      totalNetRoiPct,
      breakevenStockPriceUsd,
    };
  }, [enrichedCatalog, simTicker, simInvestUsd, simTargetMovePct, simHoldingMonths, usdToMadRate]);

  // Handlers for opening Add / Edit Stock Modal
  const openAddStockModalWithPreset = (preset?: {
    ticker?: string;
    companyName?: string;
    sector?: StockSectorCategory;
    market?: StockMarketType;
    price?: number;
    currency?: 'USD' | 'MAD';
    annualDividendPerShare?: number;
  }) => {
    setEditingPosition(null);
    const catMatch = preset?.ticker
      ? enrichedCatalog.find((c) => c.ticker === preset.ticker)
      : null;

    const ticker = preset?.ticker || catMatch?.ticker || 'NVDA';
    const companyName = preset?.companyName || catMatch?.companyName || 'NVIDIA Corporation';
    const sector =
      preset?.sector ||
      catMatch?.canonicalSector ||
      resolveStockSectorCategory({ ticker, companyName });
    const market = preset?.market || catMatch?.market || 'US';
    const currency = (preset?.currency || catMatch?.currency || (market === 'BVC' ? 'MAD' : 'USD')) as 'USD' | 'MAD';
    const price = preset?.price ?? catMatch?.price ?? 100;
    const div = preset?.annualDividendPerShare ?? catMatch?.annualDividendPerShare ?? 0;

    setFormTicker(ticker);
    setFormCompanyName(companyName);
    setFormSector(sector);
    setFormMarket(market);
    setFormCurrency(currency);
    setFormAvgCost(String(price));
    setFormShares('1');
    setFormDividendPerShare(String(div));
    setFormThesis(`Held in Binance Funding Wallet (${sector})`);
    setShowAddStockModal(true);
  };

  const openEditPositionModal = (pos: StockPosition & { canonicalSector: StockSectorCategory }) => {
    setEditingPosition(pos);
    setFormTicker(pos.ticker);
    setFormCompanyName(pos.companyName.replace(/\s*\(Binance.*\)$/i, ''));
    setFormSector(pos.canonicalSector);
    setFormMarket(pos.market === 'BINANCE' ? 'US' : pos.market);
    setFormCurrency((pos.currency === 'MAD' ? 'MAD' : 'USD') as 'USD' | 'MAD');
    setFormShares(String(pos.sharesNum));
    setFormAvgCost(String(pos.avgCostNum));
    setFormDividendPerShare(String(pos.annualDividendPerShare || '0'));
    setFormThesis(pos.convictionThesis || `Held in Binance Funding Wallet (${pos.canonicalSector})`);
    setShowAddStockModal(true);
  };

  const handleTickerInputInModal = (nextTickerRaw: string) => {
    const rawUpper = nextTickerRaw.toUpperCase();
    const norm = normalizeStockTicker(rawUpper) || rawUpper;
    setFormTicker(rawUpper);

    const found = enrichedCatalog.find((c) => c.ticker === norm || c.ticker === rawUpper);
    if (found) {
      setFormCompanyName(found.companyName);
      setFormSector(found.canonicalSector);
      setFormMarket(found.market);
      setFormCurrency((found.currency === 'MAD' ? 'MAD' : 'USD') as 'USD' | 'MAD');
      setFormAvgCost(String(found.price));
      setFormDividendPerShare(String(found.annualDividendPerShare || 0));
      setFormThesis(`Held in Binance Funding Wallet (${found.canonicalSector})`);
    } else if (rawUpper.length >= 1) {
      const knownName = TICKER_TO_COMPANY_NAME[norm];
      const nextCompanyName = knownName || formCompanyName;
      if (knownName) {
        setFormCompanyName(knownName);
      }
      const inferredSector = resolveStockSectorCategory({
        ticker: norm,
        companyName: knownName || '',
        market: formMarket,
      });
      setFormSector(inferredSector);
      setFormThesis(`Held in Binance Funding Wallet (${inferredSector})`);
      void nextCompanyName;
    }
  };

  const handleCompanyNameInputInModal = (nextName: string) => {
    setFormCompanyName(nextName);
    const upperClean = nextName.trim().toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
    const mappedTicker = COMPANY_NAME_TO_TICKER[upperClean];
    const effectiveTicker = mappedTicker || normalizeStockTicker(formTicker) || formTicker;
    if (mappedTicker && (!formTicker || formTicker === 'NVDA')) {
      setFormTicker(mappedTicker);
    }
    const inferredSector = resolveStockSectorCategory({
      ticker: effectiveTicker,
      companyName: nextName,
      market: formMarket,
    });
    setFormSector(inferredSector);
  };

  const handleSaveStockPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const shares = parseFloat(formShares) || 0;
    const avgCost = parseFloat(formAvgCost) || 0;
    const divPerShare = parseFloat(formDividendPerShare) || 0;

    if (!formTicker.trim() || shares <= 0 || avgCost <= 0) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: 'Please enter a valid stock ticker, share quantity, and average buy price.',
            type: 'error',
          },
        })
      );
      return;
    }

    const finalTicker = normalizeStockTicker(formTicker.trim()) || formTicker.trim().toUpperCase();
    const finalCompanyName = resolveCanonicalCompanyName(
      finalTicker,
      formCompanyName.trim() || finalTicker
    );
    const finalSector = resolveStockSectorCategory({
      ticker: finalTicker,
      existingSector: formSector,
      companyName: finalCompanyName,
      market: formMarket,
    });

    try {
      if (editingPosition && !editingPosition.id.startsWith('binance-')) {
        await onUpdatePosition(editingPosition.id, {
          companyName: finalCompanyName,
          market: formMarket,
          sector: finalSector,
          shares,
          avgCostPerShare: avgCost,
          currency: formCurrency,
          annualDividendPerShare: divPerShare,
          convictionThesis: formThesis,
        });
      } else {
        await onUpsertPosition({
          ticker: finalTicker,
          companyName: finalCompanyName,
          market: formMarket,
          sector: finalSector,
          shares,
          avgCostPerShare: avgCost,
          currency: formCurrency,
          annualDividendPerShare: divPerShare,
          convictionThesis: formThesis,
          syncWithWallet: false,
        });
      }

      setShowAddStockModal(false);
      setEditingPosition(null);
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: `Saved ${finalTicker} under ${finalSector} in your Funding Stocks portfolio.`,
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Could not save stock position.',
            type: 'error',
          },
        })
      );
    }
  };

  const handleInlineCategoryChange = async (
    pos: StockPosition & { canonicalSector: StockSectorCategory },
    nextCategory: StockSectorCategory
  ) => {
    try {
      if (!pos.id.startsWith('binance-')) {
        await onUpdatePosition(pos.id, { sector: nextCategory });
      } else {
        await onUpsertPosition({
          ticker: pos.ticker,
          companyName: pos.companyName.replace(/\s*\(Binance.*\)$/i, ''),
          market: 'US',
          sector: nextCategory,
          shares: pos.sharesNum,
          avgCostPerShare: pos.avgCostNum,
          currency: pos.currency,
          convictionThesis: `Binance Funding Stock (${nextCategory})`,
          syncWithWallet: false,
        });
      }
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: `Categorized ${pos.ticker} under ${nextCategory}.`,
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Could not update category.',
            type: 'error',
          },
        })
      );
    }
  };

  const handleExecuteStockOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderModalStock) return;
    const shares = parseFloat(orderShares) || 0;
    const price = parseFloat(orderPrice) || orderModalStock.currentPriceNum;
    try {
      await onExecuteOrder({
        positionId: orderModalStock.id.startsWith('binance-') ? undefined : orderModalStock.id,
        ticker: orderModalStock.ticker,
        action: orderAction,
        shares,
        pricePerShare: price,
        syncWithWallet: false,
        notes: orderNotes || `${orderAction} ${orderModalStock.ticker} (Funding Stocks)`,
      });
      setOrderModalStock(null);
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: `Recorded ${orderAction} order for ${orderModalStock.ticker}.`,
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Failed to record stock order.',
            type: 'error',
          },
        })
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. FRIENDLY HERO BANNER: FUNDING STOCKS VS. SPOT CRYPTO SEPARATION
             + #1 DOMINANT STOCK CATEGORY CALLOUT
         ===================================================================== */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" />
                Binance Funding Wallet &amp; US Equities Dashboard
              </span>
              <span>·</span>
              <span>Strictly Separated from Spot Cryptocurrency</span>
              <span>·</span>
              <span>8 Industry Categories</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              US Stocks, Sector Breakdown &amp; Funding Portfolio Intelligence
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
              Your US &amp; global stocks live in your Funding portfolio—completely separated from Spot crypto—so you can track your exact category concentration across AI, Tech, Banking, and Mechanics with clear breakeven and dividend insights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openAddStockModalWithPreset()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add / Sync Funding Stock
            </button>
            <button
              type="button"
              onClick={onSwitchToSpotCrypto}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <WalletIcon className="h-3.5 w-3.5 text-gray-500" />
              View Spot Crypto ({spotCryptoSummary.count}) →
            </button>
          </div>
        </div>

        {/* 4 Friendly Executive KPI Cards Specifically for Stocks (Funding) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Funding & US Stocks Value */}
          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Funding &amp; US Stocks Value</span>
              <Briefcase className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="font-mono tabular-nums">
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {formatUsd(stocksSummary.effectiveStocksValueUsd)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatMad(stocksSummary.effectiveStocksValueMad, 2)}
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800 flex items-center justify-between text-[11px] font-mono tabular-nums">
              <span className="font-sans text-gray-500">
                {stocksSummary.holdingsCount} Held Stock{stocksSummary.holdingsCount === 1 ? '' : 's'}
              </span>
              <span
                className={`font-semibold ${
                  stocksSummary.weighted24hChangePercent >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                24h: {stocksSummary.weighted24hChangePercent >= 0 ? '+' : ''}
                {stocksSummary.weighted24hChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Card 2: #1 Most Percentage Stock Category (Hero User Request!) */}
          <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
              <span className="font-semibold">Top Stock Category (% Weight)</span>
              <Award className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            {categoryBreakdown.dominantCategory ? (
              <>
                <div>
                  <div className="text-base font-bold text-gray-900 dark:text-white truncate">
                    {categoryBreakdown.dominantCategory.category}
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5 font-mono tabular-nums">
                    <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                      {categoryBreakdown.dominantCategory.weightPercent.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      of your stocks ({formatUsd(categoryBreakdown.dominantCategory.valueUsd)})
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50 flex items-center justify-between text-[11px]">
                  <span className="text-gray-600 dark:text-gray-400 truncate">
                    Tickers: <strong className="font-mono text-gray-900 dark:text-white">{categoryBreakdown.dominantCategory.tickers.join(', ')}</strong>
                  </span>
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                    {categoryBreakdown.active.length} active sector{categoryBreakdown.active.length === 1 ? '' : 's'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    No Categorized Stocks Yet
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Add your Funding stocks (e.g. NVDA, AAPL, CAT, JPM) to see your #1 category %.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAddStockModalWithPreset()}
                  className="text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Categorize first stock now →
                </button>
              </>
            )}
          </div>

          {/* Card 3: Stocks Net Profit / Loss & Fee Protection */}
          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Stocks Net P&amp;L (After Fees)</span>
              {stocksSummary.netPnlAfterFeesMad >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-500" />
              )}
            </div>
            <div className="font-mono tabular-nums">
              <div
                className={`text-xl font-bold ${
                  stocksSummary.netPnlAfterFeesMad >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedUsd(stocksSummary.netPnlAfterFeesUsd)} (
                {stocksSummary.netPnlPercent >= 0 ? '+' : ''}
                {stocksSummary.netPnlPercent.toFixed(2)}%)
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatSignedMad(stocksSummary.netPnlAfterFeesMad, 2)}
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800 flex items-center justify-between text-[11px] font-mono tabular-nums">
              <span className="font-sans text-gray-500">Est. Round-Trip Fees:</span>
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                -{formatUsd(stocksSummary.totalFeeLossUsd, 3)}
              </span>
            </div>
          </div>

          {/* Card 4: Stocks Passive Dividend Yield & 5Y Vision */}
          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Stocks Dividend Cash Flow</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="font-mono tabular-nums">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                +{formatUsd(stocksSummary.annualDividendUsd)}/yr
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                +{formatMad(stocksSummary.annualDividendMad, 2)}/yr · Yield{' '}
                {stocksSummary.weightedYieldPercent.toFixed(2)}%
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800 flex items-center justify-between text-[11px] font-mono tabular-nums">
              <span className="font-sans text-gray-500">5-Yr DRIP Target:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                {formatUsd((stocksSummary.effectiveStocksValueUsd || 100) * 1.48)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. STOCKS CATEGORY DOMINANCE & SECTOR ALLOCATION ANALYZER
             (AI & Semiconductors, Tech & Cloud, Mechanics & Auto, Banking, etc.)
         ===================================================================== */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Stocks Breakdown by Category (AI, Tech, Mechanics, Banking &amp; More)</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              See which stock sector represents the highest percentage of your Funding &amp; Equities portfolio. Click any category card to filter your holdings or add a stock in that sector.
            </p>
          </div>

          {selectedSectorFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedSectorFilter('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer self-start"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filter ({selectedSectorFilter})
            </button>
          )}
        </div>

        {/* Stacked Horizontal Percentage Bar when user holds stocks */}
        {categoryBreakdown.active.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Live Category Weight Distribution (100% of Held Stocks)
              </span>
              <span className="font-mono tabular-nums text-gray-500">
                Most Held:{' '}
                <strong className="text-gray-900 dark:text-white">
                  {categoryBreakdown.dominantCategory?.category} (
                  {categoryBreakdown.dominantCategory?.weightPercent.toFixed(1)}%)
                </strong>
              </span>
            </div>

            <div className="h-4 w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex p-0.5 gap-0.5">
              {categoryBreakdown.active.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() =>
                    setSelectedSectorFilter((prev) =>
                      prev === cat.category ? 'ALL' : cat.category
                    )
                  }
                  style={{
                    width: `${Math.max(4, cat.weightPercent)}%`,
                    backgroundColor: cat.colorHex,
                  }}
                  title={`${cat.category}: ${cat.weightPercent.toFixed(1)}% (${formatUsd(cat.valueUsd)})`}
                  className="h-full first:rounded-l-md last:rounded-r-md transition-opacity hover:opacity-85 cursor-pointer"
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs">
              {categoryBreakdown.active.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() =>
                    setSelectedSectorFilter((prev) =>
                      prev === cat.category ? 'ALL' : cat.category
                    )
                  }
                  className={`inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer ${
                    selectedSectorFilter === cat.category
                      ? 'text-indigo-600 dark:text-indigo-400 font-bold underline'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: cat.colorHex }}
                  />
                  <span>{cat.category}</span>
                  <span className="font-mono tabular-nums font-bold text-gray-900 dark:text-white">
                    {cat.weightPercent.toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 8 Interactive Category Cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categoryBreakdown.all.map((cat, idx) => {
            const isSelected = selectedSectorFilter === cat.category;
            const isTopCategory =
              idx === 0 && cat.positionsCount > 0 && cat.weightPercent > 0;
            const meta = STOCK_SECTOR_METADATA[cat.category];

            return (
              <div
                key={cat.category}
                onClick={() =>
                  setSelectedSectorFilter((prev) =>
                    prev === cat.category ? 'ALL' : cat.category
                  )
                }
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30'
                    : isTopCategory
                    ? 'border-indigo-300 dark:border-indigo-800/80 bg-gray-50/80 dark:bg-gray-950/60 hover:border-indigo-500'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-950/30 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat.colorHex }}
                      >
                        {getSectorIcon(cat.category)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                          {cat.category}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {cat.positionsCount > 0
                            ? `${cat.positionsCount} stock${cat.positionsCount === 1 ? '' : 's'} (${cat.tickers.join(', ')})`
                            : `Examples: ${meta.examples.slice(0, 4).join(', ')}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div
                        className={`text-sm font-extrabold ${
                          cat.weightPercent > 0
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-400 dark:text-gray-600'
                        }`}
                      >
                        {cat.weightPercent.toFixed(1)}%
                      </div>
                      {isTopCategory && (
                        <div className="text-[10px] font-sans font-bold text-indigo-600 dark:text-indigo-400">
                          #1 Category
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mini Progress Bar */}
                  <div className="h-1.5 w-full rounded-full bg-gray-200/80 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(cat.positionsCount > 0 ? 4 : 0, cat.weightPercent))}%`,
                        backgroundColor: cat.colorHex,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800/80 flex items-center justify-between text-xs font-mono tabular-nums">
                  {cat.positionsCount > 0 ? (
                    <>
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatUsd(cat.valueUsd)}
                        </span>
                        <span className="text-[11px] text-gray-500 ml-1">
                          ({formatMad(cat.valueMad, 0)})
                        </span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          cat.netPnlUsd >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedUsd(cat.netPnlUsd)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-sans text-[11px] text-gray-400">0% allocation</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddStockModalWithPreset({
                            ticker: meta.examples[0],
                            sector: cat.category,
                          });
                        }}
                        className="font-sans text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        + Add {meta.examples[0]}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          3. FRIENDLY STOCKS INSIGHTS & STRATEGIC VISION PANEL (4 CARDS)
         ===================================================================== */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Smart Stocks Insights &amp; Category Recommendations</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Clear, plain-English insights into your stock sector concentration, Funding vs. Spot separation, breakeven targets, and dividend growth.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {friendlyStockInsights.map((ins) => (
            <div
              key={ins.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-gray-900 dark:text-white text-sm">
                  {ins.title}
                </span>
                <span
                  className={`font-semibold text-[11px] shrink-0 ${
                    ins.tone === 'emerald'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ins.tone === 'amber'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {ins.badge}
                </span>
              </div>
              <div className="font-mono tabular-nums text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {ins.metric}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {ins.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================================
          4. MY FUNDING & US STOCK HOLDINGS (WITH QUICK CATEGORY PRESETS)
         ===================================================================== */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              My Funding &amp; Stock Positions ({displayedStockHoldings.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Every stock position below is categorized by industry (AI, Tech, Mechanics, Banking, etc.) with live mark-to-market P&amp;L, breakeven price, and 1-click category editing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter Dropdown */}
            <select
              value={selectedSectorFilter}
              onChange={(e) => setSelectedSectorFilter(e.target.value as any)}
              aria-label="Filter by stock category"
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 font-medium"
            >
              <option value="ALL">All Stock Categories (8)</option>
              {ALL_STOCK_SECTOR_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort stocks"
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 font-medium"
            >
              <option value="weight_desc">Sort: Highest Weight %</option>
              <option value="pnl_desc">Sort: Best Net Profit</option>
              <option value="yield_desc">Sort: Highest Dividend Yield</option>
              <option value="change24h_desc">Sort: 24h Performance</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search NVDA, CAT, JPM..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={() => openAddStockModalWithPreset()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Stock
            </button>
          </div>
        </div>

        {/* 1-Click Quick-Add Bar for Popular Funding Stocks across AI, Tech, Mechanics & Banking */}
        <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200/70 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">Quick-Sync Funding Stocks by Category:</strong>{' '}
            Click any ticker to log or calibrate a stock from your Funding Wallet:
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { ticker: 'NVDA', label: 'NVDA (AI)', sector: 'AI & Semiconductors' as StockSectorCategory },
              { ticker: 'AMD', label: 'AMD (AI)', sector: 'AI & Semiconductors' as StockSectorCategory },
              { ticker: 'AAPL', label: 'AAPL (Tech)', sector: 'Technology & Cloud' as StockSectorCategory },
              { ticker: 'MSFT', label: 'MSFT (Tech)', sector: 'Technology & Cloud' as StockSectorCategory },
              { ticker: 'TSLA', label: 'TSLA (Auto/Mech)', sector: 'Mechanics, Automotive & Industrials' as StockSectorCategory },
              { ticker: 'CAT', label: 'CAT (Mechanics)', sector: 'Mechanics, Automotive & Industrials' as StockSectorCategory },
              { ticker: 'DE', label: 'DE (Mechanics)', sector: 'Mechanics, Automotive & Industrials' as StockSectorCategory },
              { ticker: 'JPM', label: 'JPM (Banking)', sector: 'Banking & Financials' as StockSectorCategory },
              { ticker: 'V', label: 'V (Banking)', sector: 'Banking & Financials' as StockSectorCategory },
              { ticker: 'VOO', label: 'VOO (S&P 500)', sector: 'Index & Dividend ETFs' as StockSectorCategory },
            ].map((preset) => (
              <button
                key={preset.ticker}
                type="button"
                onClick={() =>
                  openAddStockModalWithPreset({
                    ticker: preset.ticker,
                    sector: preset.sector,
                  })
                }
                className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Held Stock Cards */}
        {displayedStockHoldings.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-800 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="space-y-1 max-w-lg mx-auto">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {stockHoldings.length === 0
                  ? 'Ready to Track Your Funding Wallet US Stocks by Category'
                  : `No stocks match "${selectedSectorFilter !== 'ALL' ? selectedSectorFilter : stockSearch}"`}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stockHoldings.length === 0
                  ? 'Spot cryptocurrencies (BTC, ETH, SOL, etc.) are kept strictly in the Spot Crypto tab. Click "+ Add / Sync Funding Stock" or any quick-preset above (NVDA, AAPL, TSLA, CAT, JPM) to log your Funding stocks and unlock live sector percentages.'
                  : 'Try clearing the active sector filter or adding a stock in this category.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => openAddStockModalWithPreset()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add / Sync Funding Stock
              </button>
              {selectedSectorFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedSectorFilter('ALL')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Show All Categories
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {displayedStockHoldings.map((pos) => {
              const sectorMeta = STOCK_SECTOR_METADATA[pos.canonicalSector];
              const grossPnlMad = pos.unrealizedPnlMad;
              const grossPnlUsd = pos.unrealizedPnlUsd ?? grossPnlMad / usdToMadRate;
              const feeLossMad = pos.totalFeeLossMad ?? 0;
              const feeLossUsd = pos.totalFeeLossUsd ?? feeLossMad / usdToMadRate;
              const netPnlMad = pos.netPnlAfterFeesMad ?? grossPnlMad - feeLossMad;
              const netPnlUsd = pos.netPnlAfterFeesUsd ?? grossPnlUsd - feeLossUsd;
              const totalRetMad = pos.totalReturnWithDividendMad ?? netPnlMad;
              const totalRetUsd = pos.totalReturnWithDividendUsd ?? netPnlUsd;
              const isExpanded = expandedStockId === pos.id;

              return (
                <div
                  key={pos.id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4 hover:border-indigo-500/40 transition-colors"
                >
                  {/* Top Row: Ticker, Company Name, Category Selector & Market Value */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-white shrink-0"
                        style={{ backgroundColor: sectorMeta?.colorHex || '#4f46e5' }}
                      >
                        {pos.ticker.slice(0, 4)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-gray-900 dark:text-white">
                            {pos.ticker}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {pos.companyName.replace(/\s*\(Binance.*\)$/i, '')}
                          </span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {pos.stockWeightPercent.toFixed(1)}% of Stocks
                          </span>
                        </div>

                        {/* Inline Category Selector & Wallet Source */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <select
                            value={pos.canonicalSector}
                            onChange={(e) =>
                              handleInlineCategoryChange(
                                pos,
                                e.target.value as StockSectorCategory
                              )
                            }
                            aria-label={`Category for ${pos.ticker}`}
                            className="px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-semibold text-gray-800 dark:text-gray-200 cursor-pointer"
                          >
                            {ALL_STOCK_SECTOR_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {pos.market === 'BVC'
                              ? 'Casablanca BVC'
                              : pos.market === 'ETF'
                              ? 'Index / Dividend ETF'
                              : 'Funding Wallet · US Stock'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-base font-bold text-gray-900 dark:text-white">
                        {formatUsd(pos.marketValueUsd ?? pos.marketValueMad / usdToMadRate)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatMad(pos.marketValueMad, 2)}
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          (pos.change24hPercent || 0) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        24h: {(pos.change24hPercent || 0) >= 0 ? '+' : ''}
                        {(pos.change24hPercent || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Share Count, Avg Cost, Live Price & Breakeven Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800">
                    <span>
                      <span className="font-sans text-gray-500">Shares:</span>{' '}
                      <strong className="text-gray-900 dark:text-white">
                        {formatQty(pos.sharesNum)}
                      </strong>
                    </span>
                    <span>
                      <span className="font-sans text-gray-500">Avg Buy:</span>{' '}
                      <strong className="text-gray-900 dark:text-white">
                        {pos.currency === 'MAD'
                          ? formatMad(pos.avgCostNum)
                          : formatUsd(pos.avgCostNum)}
                      </strong>
                    </span>
                    <span>
                      <span className="font-sans text-gray-500">Live:</span>{' '}
                      <strong className="text-gray-900 dark:text-white">
                        {pos.currency === 'MAD'
                          ? formatMad(pos.currentPriceNum)
                          : formatUsd(pos.currentPriceNum)}
                      </strong>
                    </span>
                    <span>
                      <span className="font-sans text-gray-500">Breakeven:</span>{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400">
                        {pos.currency === 'MAD'
                          ? formatMad(pos.breakevenPriceMad ?? pos.avgCostNum)
                          : formatUsd(pos.breakevenPriceUsd ?? pos.avgCostNum)}
                      </strong>
                    </span>
                  </div>

                  {/* 4-Column Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
                    <div className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800/80">
                      <div className="font-sans text-[10px] uppercase text-gray-400">
                        Net P&amp;L (After Fees)
                      </div>
                      <div
                        className={`font-bold mt-0.5 ${
                          netPnlUsd >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatSignedUsd(netPnlUsd)}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {formatSignedMad(netPnlMad, 1)} (
                        {(pos.netPnlAfterFeesPercent ?? pos.unrealizedPnlPercent) >= 0 ? '+' : ''}
                        {(pos.netPnlAfterFeesPercent ?? pos.unrealizedPnlPercent).toFixed(1)}%)
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800/80">
                      <div className="font-sans text-[10px] uppercase text-gray-400">
                        Fee Drag
                      </div>
                      <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                        -{formatUsd(feeLossUsd, 3)}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        -{formatMad(feeLossMad, 2)} ({(pos.feeDragPercent ?? 0.2).toFixed(2)}%)
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800/80">
                      <div className="font-sans text-[10px] uppercase text-gray-400">
                        Annual Dividend
                      </div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{formatUsd((pos.annualDividendMad || 0) / usdToMadRate)}/yr
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Yield {pos.dividendYieldPercent.toFixed(2)}%
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50/70 dark:bg-gray-950/50 border border-gray-100 dark:border-gray-800/80">
                      <div className="font-sans text-[10px] uppercase text-gray-400">
                        5-Yr Compounding
                      </div>
                      <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {formatUsd(
                          (pos.drip5YearProjectedValueMad ?? pos.marketValueMad * 1.47) /
                            usdToMadRate
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {formatMad(pos.drip5YearProjectedValueMad ?? pos.marketValueMad * 1.47, 0)}
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderModalStock(pos);
                          setOrderAction('BUY');
                          setOrderShares('1');
                          setOrderPrice(String(pos.currentPriceNum));
                        }}
                        className="px-2.5 py-1 rounded-md font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        + Buy More
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderModalStock(pos);
                          setOrderAction('SELL');
                          setOrderShares(String(pos.sharesNum));
                          setOrderPrice(String(pos.currentPriceNum));
                        }}
                        className="px-2.5 py-1 rounded-md font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        Sell
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditPositionModal(pos)}
                        className="px-2.5 py-1 rounded-md font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" />
                        Edit
                      </button>
                      {!pos.id.startsWith('binance-') && (
                        <button
                          type="button"
                          onClick={() => onDeletePosition(pos.id)}
                          className="p-1 rounded-md text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove position"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setInspectedInstrument({ symbol: pos.ticker, position: pos })
                        }
                        className="px-2.5 py-1 rounded-md font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
                      >
                        Chart &amp; Technicals
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInspectForensics(pos.ticker)}
                        className="px-2.5 py-1 rounded-md font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        Trade Forensics →
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedStockId((prev) => (prev === pos.id ? null : pos.id))
                        }
                        className="text-gray-500 hover:text-gray-900 dark:hover:text-white font-semibold cursor-pointer"
                      >
                        {isExpanded ? 'Less' : 'Thesis'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-xs space-y-2">
                      <p className="text-gray-600 dark:text-gray-400">
                        <strong>Investment Thesis:</strong>{' '}
                        {pos.convictionThesis || `Core ${pos.canonicalSector} equity holding.`}
                      </p>
                      <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-[11px] bg-gray-50 dark:bg-gray-950 p-2.5 rounded-lg">
                        <div>
                          <span className="text-gray-400 block font-sans">Distance to Breakeven</span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {(pos.distanceToBreakevenPercent ?? 0) >= 0 ? '+' : ''}
                            {(pos.distanceToBreakevenPercent ?? 0).toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-sans">Total Return + Divs</span>
                          <span
                            className={`font-bold ${
                              totalRetUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatSignedUsd(totalRetUsd)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-sans">Surplus Buying Power</span>
                          <span className="font-bold text-indigo-600">
                            +{formatQty(pos.affordableSharesFromSurplus)} {pos.ticker}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          5. SMART STOCK TRADE, FEE LOSS, DIVIDEND & BREAKEVEN SIMULATOR
         ===================================================================== */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calculator className="h-4 w-4 text-indigo-500" />
              <span>Funding Stock Profit, Breakeven &amp; Dividend Simulator</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Test any AI, Tech, Mechanics, or Banking stock before buying to see exact round-trip fees, breakeven stock price, and projected net return.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-center">
          <div className="lg:col-span-5 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Select Stock / ETF by Category
              </label>
              <select
                value={simTicker}
                onChange={(e) => setSimTicker(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white font-mono"
              >
                {enrichedCatalog.map((c) => (
                  <option key={c.ticker} value={c.ticker}>
                    [{c.canonicalSector}] {c.ticker} — {c.companyName} ({c.price} {c.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Investment Amount (USD)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={simInvestUsd}
                onChange={(e) => setSimInvestUsd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Expected Price Gain (%)
              </label>
              <input
                type="number"
                step="0.5"
                value={simTargetMovePct}
                onChange={(e) => setSimTargetMovePct(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Holding Period (Months)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="120"
                value={simHoldingMonths}
                onChange={(e) => setSimHoldingMonths(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="lg:col-span-7 grid gap-3 sm:grid-cols-3 text-xs font-mono tabular-nums bg-gray-50/70 dark:bg-gray-950/60 p-4 rounded-xl border border-gray-200/80 dark:border-gray-800">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <div className="font-sans text-[11px] text-gray-400 uppercase font-semibold">
                Shares &amp; Breakeven
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {formatQty(stockSimulation.sharesAcquired)} {stockSimulation.stock.ticker}
              </div>
              <div className="text-[11px] text-gray-500">
                Entry: {formatUsd(stockSimulation.stockPriceUsd)}
              </div>
              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                Breakeven: {formatUsd(stockSimulation.breakevenStockPriceUsd)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <div className="font-sans text-[11px] text-gray-400 uppercase font-semibold">
                Fees vs. Dividends
              </div>
              <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                Fees: -{formatUsd(stockSimulation.totalRoundTripFeesUsd, 3)}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Divs: +{formatUsd(stockSimulation.proratedDividendUsd, 2)}
              </div>
              <div className="text-[11px] text-gray-500 font-sans truncate">
                {stockSimulation.stock.canonicalSector}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
              <div className="font-sans text-[11px] text-gray-400 uppercase font-semibold">
                Net Projected Profit
              </div>
              <div
                className={`text-sm font-bold ${
                  stockSimulation.totalNetReturnUsd >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedUsd(stockSimulation.totalNetReturnUsd)} (
                {stockSimulation.totalNetRoiPct >= 0 ? '+' : ''}
                {stockSimulation.totalNetRoiPct.toFixed(1)}%)
              </div>
              <div className="text-[11px] text-gray-500">
                {formatSignedMad(stockSimulation.totalNetReturnMad, 1)}
              </div>
              <button
                type="button"
                onClick={() =>
                  openAddStockModalWithPreset({
                    ticker: stockSimulation.stock.ticker,
                    companyName: stockSimulation.stock.companyName,
                    sector: stockSimulation.stock.canonicalSector,
                    market: stockSimulation.stock.market,
                    price: stockSimulation.stock.price,
                  })
                }
                className="font-sans text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5 block cursor-pointer"
              >
                + Log {stockSimulation.stock.ticker} in Funding →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          6. STOCKS CATALOG & BENCHMARK EXPLORER BY SECTOR
         ===================================================================== */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-500" />
              <span>Explore US Stocks, Mechanics, Banking, AI &amp; ETFs Catalog</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Browse curated stocks across AI, Technology, Mechanics &amp; Industrials, Banking, Consumer, Healthcare, Energy, and ETFs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
              {(['ALL', 'US', 'ETF', 'BVC'] as const).map((mkt) => (
                <button
                  key={mkt}
                  type="button"
                  onClick={() => setMarketFilter(mkt)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    marketFilter === mkt
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  {mkt === 'ALL' ? 'All Markets' : mkt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCatalog.map((item) => {
            const meta = STOCK_SECTOR_METADATA[item.canonicalSector];
            return (
              <div
                key={item.ticker}
                className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 flex flex-col justify-between gap-2.5 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: meta?.colorHex || '#4f46e5' }}
                      />
                      <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                        {item.ticker}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
                      {item.canonicalSector}
                    </span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 font-medium truncate mt-0.5">
                    {item.companyName}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-2 mt-1">
                    {item.thesis}
                  </p>
                  <div className="mt-2 flex items-baseline justify-between font-mono tabular-nums">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {item.currency === 'MAD'
                        ? formatMad(item.price, 2)
                        : formatUsd(item.price, 2)}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">
                      Yield: {item.dividendYieldPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      openAddStockModalWithPreset({
                        ticker: item.ticker,
                        companyName: item.companyName,
                        sector: item.canonicalSector,
                        market: item.market,
                        price: item.price,
                        currency: item.currency as 'USD' | 'MAD',
                        annualDividendPerShare: item.annualDividendPerShare,
                      })
                    }
                    className="flex-1 py-1.5 px-2 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    + Add to Funding
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectedInstrument({ symbol: item.ticker, position: null })}
                    className="py-1.5 px-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 font-semibold hover:border-indigo-500 transition-colors cursor-pointer"
                  >
                    Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimTicker(item.ticker)}
                    className="py-1.5 px-2 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:border-indigo-500 transition-colors cursor-pointer"
                  >
                    Simulate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          7. COMPLETE STOCKS & PORTFOLIO INTELLIGENCE SUITE (WORKSTREAMS 1–9)
         ===================================================================== */}
      <StocksIntelligenceSuite
        activeSection={activeSuiteSection}
        onChangeSection={setActiveSuiteSection}
        investmentsData={investmentsData}
        stockPositions={stockHoldings}
        watchlistPositions={investmentsData?.watchlistPositions || []}
        usdToMadRate={usdToMadRate}
        totalStockValueUsd={stocksSummary.effectiveStocksValueUsd}
        totalStockValueMad={stocksSummary.effectiveStocksValueMad}
        totalStockCostUsd={stocksSummary.totalCostBasisUsd}
        totalStockNetPnlUsd={stocksSummary.netPnlAfterFeesUsd}
        totalStockFeesUsd={stocksSummary.totalFeeLossUsd}
        annualStockDividendsUsd={stocksSummary.annualDividendUsd}
        stockDividendYieldPct={stocksSummary.weightedYieldPercent}
        spotCryptoStats={{
          totalCryptoUsd: spotCryptoSummary.totalCryptoUsd,
          totalCryptoMad: spotCryptoSummary.totalCryptoMad,
          cryptoCount: spotCryptoSummary.count,
          stablecoinUsd: safeBinance?.stablecoinReserveUsd || 0,
        }}
        onInspectInstrument={(symbol, pos) =>
          setInspectedInstrument({ symbol, position: pos || null })
        }
        onUpsertPosition={onUpsertPosition}
        onUpdatePosition={onUpdatePosition}
        onDeletePosition={onDeletePosition}
        onQuickAddStock={(ticker) =>
          openAddStockModalWithPreset(ticker ? { ticker } : undefined)
        }
      />

      {inspectedInstrument && (
        <InstrumentDetailModal
          symbol={inspectedInstrument.symbol}
          position={inspectedInstrument.position}
          orders={investmentsData?.orders || []}
          dividendEvents={investmentsData?.dividendEvents || []}
          storedBars={
            investmentsData?.storedDailyBarsBySymbol?.[
              normalizeStockTicker(inspectedInstrument.symbol) || inspectedInstrument.symbol
            ]
          }
          usdToMadRate={usdToMadRate}
          onClose={() => setInspectedInstrument(null)}
          onQuickAddStock={(ticker) => {
            setInspectedInstrument(null);
            openAddStockModalWithPreset({ ticker });
          }}
        />
      )}

      {/* =====================================================================
          MODAL 1: ADD / CALIBRATE FUNDING STOCK POSITION
         ===================================================================== */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingPosition
                    ? `Edit ${editingPosition.ticker} Stock Position`
                    : 'Add / Sync Funding Wallet Stock'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Categorize your US or BVC stock under AI, Tech, Mechanics, Banking, or ETFs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStockModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStockPosition} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Stock Ticker (e.g. NVDA, CAT, JPM)
                  </label>
                  <input
                    type="text"
                    required
                    value={formTicker}
                    onChange={(e) => handleTickerInputInModal(e.target.value)}
                    placeholder="NVDA"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono uppercase text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formCompanyName}
                    onChange={(e) => handleCompanyNameInputInModal(e.target.value)}
                    placeholder="NVIDIA Corporation"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Stock Category / Sector
                  </label>
                  <select
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value as StockSectorCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white font-semibold"
                  >
                    {ALL_STOCK_SECTOR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Market &amp; Currency
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formMarket}
                      onChange={(e) => {
                        const m = e.target.value as StockMarketType;
                        setFormMarket(m);
                        if (m === 'BVC') setFormCurrency('MAD');
                        else setFormCurrency('USD');
                      }}
                      className="flex-1 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                    >
                      <option value="US">US Stock (Funding)</option>
                      <option value="ETF">US / Global ETF</option>
                      <option value="BVC">Casablanca BVC</option>
                    </select>
                    <select
                      value={formCurrency}
                      onChange={(e) => setFormCurrency(e.target.value as 'USD' | 'MAD')}
                      className="w-20 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
                    >
                      <option value="USD">USD</option>
                      <option value="MAD">MAD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Number of Shares
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={formShares}
                    onChange={(e) => setFormShares(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Avg Buy Price ({formCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={formAvgCost}
                    onChange={(e) => setFormAvgCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Annual Div / Share
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={formDividendPerShare}
                    onChange={(e) => setFormDividendPerShare(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Notes / Funding Thesis
                </label>
                <input
                  type="text"
                  value={formThesis}
                  onChange={(e) => setFormThesis(e.target.value)}
                  placeholder="Held in Binance Funding Wallet"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save to Funding Stocks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: QUICK BUY / SELL / DIVIDEND ORDER LOGGER
         ===================================================================== */}
      {orderModalStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Record {orderAction} Order · {orderModalStock.ticker}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Update your {orderModalStock.ticker} Funding stock position.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderModalStock(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteStockOrderSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                {(['BUY', 'SELL', 'DIVIDEND'] as StockOrderAction[]).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setOrderAction(act)}
                    className={`py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      orderAction === act
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Shares
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={orderShares}
                    onChange={(e) => setOrderShares(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Price per Share ({orderModalStock.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={orderPrice}
                    onChange={(e) => setOrderPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Order Notes
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Optional trade note"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setOrderModalStock(null)}
                  className="px-4 py-2 rounded-lg font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  Confirm {orderAction}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
