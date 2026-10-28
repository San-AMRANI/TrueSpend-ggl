import React, { useState, useMemo, useEffect } from 'react';
import {
  InvestmentsData,
  StockMarketType,
  StockOrderAction,
  StockCatalogItem,
  StockPosition,
  Wallet,
  DashboardTab,
  BinanceSpotAssetBalance,
  BinanceSymbolTradeSummary,
  BinancePersonalTrade,
} from '../../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  ShieldCheck,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet as WalletIcon,
  History,
  Layers,
  Lock,
  Search,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Terminal,
  Briefcase,
  Filter,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Key,
  Globe,
  TrendingUp,
  TrendingDown,
  Activity,
  Calculator,
  DollarSign,
  Percent,
  Sparkles,
  Scale,
  Award,
  Clock,
} from 'lucide-react';

interface InvestmentsTabProps {
  investmentsData: InvestmentsData | null;
  wallets: Wallet[];
  kpis?: {
    totalLiquidity?: number;
    safeToSpend?: number;
    investmentReserve?: number;
    emergencyBuffer?: number;
  } | null;
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
  onDeleteOrder: (id: string) => Promise<any>;
  onExecutePaydayAllocation?: (payload: {
    walletId?: string | null;
    syncWithWallet?: boolean;
    allocations: { positionId: string; amountMad: number }[];
  }) => Promise<any>;
  onFundInvestmentWallet: (payload: {
    sourceWalletId?: string;
    destinationWalletId?: string;
    amountMad: number;
    notes?: string;
  }) => Promise<any>;
  onSyncBinanceWallet?: (payload: {
    walletId?: string;
    mode?: 'stablecoins_only' | 'full_spot_balance';
  }) => Promise<any>;
  onLogWalletCapitalTransfer?: (payload: {
    direction: 'deposit' | 'withdrawal';
    bankWalletId?: string;
    investmentWalletId?: string;
    amountMad: number;
    notes?: string;
  }) => Promise<any>;
  onFetchBinanceTrades?: (params: {
    symbol: string;
    limit?: number;
    refresh?: boolean;
  }) => Promise<{ trades: BinancePersonalTrade[]; summary: BinanceSymbolTradeSummary }>;
  onRefreshInvestments?: (forceRefresh?: boolean) => Promise<any>;
  onCreateWallet?: (payload: {
    name: string;
    type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
    isMain?: boolean;
    initialBalance?: number;
  }) => Promise<any>;
  onSearchStocks: (q: string) => Promise<StockCatalogItem[]>;
  onRefresh: () => Promise<void>;
  setActiveTab?: (tab: DashboardTab) => void;
}

type ActiveSubView = 'spot' | 'stocks' | 'trades' | 'wallets' | 'ledger';
type SpotFilterType = 'ALL' | 'STOCKS' | 'CRYPTO' | 'STABLECOIN' | 'LOCKED';
type WalletScopeFilterType = 'ALL' | 'SPOT' | 'FUNDING' | 'EARN';
type AnalyticsChartMode = 'trajectory' | 'bridge' | 'attribution';
type ChartTimeframe = '7D' | '14D' | '30D';
type DisplayCurrency = 'MAD' | 'USD';

function formatMad(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} MAD`;
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

function formatSignedMad(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatMad(num, decimals)}`;
}

function formatSignedUsd(value: number | undefined | null, decimals = 2): string {
  const num = Number(value || 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatUsd(num, decimals)}`;
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

export const InvestmentsTab: React.FC<InvestmentsTabProps> = ({
  investmentsData,
  wallets,
  kpis,
  isSaving,
  onUpsertPosition,
  onDeletePosition,
  onExecuteOrder,
  onDeleteOrder,
  onFundInvestmentWallet,
  onSyncBinanceWallet,
  onLogWalletCapitalTransfer,
  onFetchBinanceTrades,
  onRefreshInvestments,
  onCreateWallet,
  onSearchStocks,
  onRefresh,
  setActiveTab,
}) => {
  const [activeSubView, setActiveSubView] = useState<ActiveSubView>('spot');
  const [walletScopeFilter, setWalletScopeFilter] = useState<WalletScopeFilterType>('ALL');
  const [spotFilter, setSpotFilter] = useState<SpotFilterType>('ALL');
  const [spotSearch, setSpotSearch] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);
  const [expandedAssetKey, setExpandedAssetKey] = useState<string | null>(null);

  // Analytics & Chart Controls
  const [chartMode, setChartMode] = useState<AnalyticsChartMode>('trajectory');
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('30D');
  const [chartCurrency, setChartCurrency] = useState<DisplayCurrency>('USD');
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState<boolean>(true);

  // Trade History & Forensics State
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [customSymbolInput, setCustomSymbolInput] = useState<string>('');
  const [tradeLimit, setTradeLimit] = useState<number>(100);
  const [tradeSideFilter, setTradeSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [tradeSearch, setTradeSearch] = useState<string>('');
  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const [liveSymbolData, setLiveSymbolData] = useState<{
    symbol: string;
    trades: BinancePersonalTrade[];
    summary: BinanceSymbolTradeSummary;
  } | null>(null);
  const [isLoadingSymbolTrades, setIsLoadingSymbolTrades] = useState<boolean>(false);
  const [symbolTradeError, setSymbolTradeError] = useState<string | null>(null);

  // Stocks & Equities Intelligence Simulator State
  const [simTicker, setSimTicker] = useState<string>('NVDA');
  const [simInvestUsd, setSimInvestUsd] = useState<string>('100');
  const [simTargetMovePct, setSimTargetMovePct] = useState<string>('12');
  const [simHoldingMonths, setSimHoldingMonths] = useState<string>('12');
  const [selectedStockDetailId, setSelectedStockDetailId] = useState<string | null>(null);

  // Wallet Capital Transfer State
  const [transferDirection, setTransferDirection] = useState<'deposit' | 'withdrawal'>('deposit');
  const [selectedBankWalletId, setSelectedBankWalletId] = useState<string>('');
  const [selectedInvWalletId, setSelectedInvWalletId] = useState<string>('');
  const [transferAmountMad, setTransferAmountMad] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Off-Exchange Manual Position / Ledger State
  const [isAddPositionOpen, setIsAddPositionOpen] = useState(false);
  const [isLogOrderOpen, setIsLogOrderOpen] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [catalogResults, setCatalogResults] = useState<StockCatalogItem[]>([]);
  const [posForm, setPosForm] = useState({
    ticker: '',
    companyName: '',
    market: 'US' as StockMarketType,
    sector: 'Technology',
    shares: '',
    avgCostPerShare: '',
    currentPrice: '',
    currency: 'USD',
    annualDividendPerShare: '0',
    targetWeightPercent: '15',
    convictionThesis: '',
    walletId: '',
    syncWithWallet: false,
  });
  const [orderForm, setOrderForm] = useState({
    positionId: '',
    ticker: '',
    action: 'BUY' as StockOrderAction,
    shares: '',
    pricePerShare: '',
    walletId: '',
    syncWithWallet: true,
    notes: '',
  });

  const binance = investmentsData?.binance;
  const usdToMadRate = investmentsData?.rates?.USD_TO_MAD || 9.95;
  const reconciliation = investmentsData?.capitalReconciliation;

  const bankAndCashWallets = useMemo(
    () => wallets.filter((w) => w.type === 'Bank' || w.type === 'Cash'),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((w) => w.type === 'Investment'),
    [wallets]
  );

  useEffect(() => {
    if (!selectedBankWalletId && bankAndCashWallets.length > 0) {
      const mainBank = bankAndCashWallets.find((w) => w.isMain) || bankAndCashWallets[0];
      if (mainBank) setSelectedBankWalletId(mainBank.id);
    }
    if (!selectedInvWalletId && investmentWallets.length > 0) {
      const binanceWallet =
        investmentWallets.find((w) => w.name.toLowerCase().includes('binance')) ||
        investmentWallets[0];
      if (binanceWallet) setSelectedInvWalletId(binanceWallet.id);
    }
  }, [bankAndCashWallets, investmentWallets, selectedBankWalletId, selectedInvWalletId]);

  useEffect(() => {
    if (binance?.symbolSummaries && binance.symbolSummaries.length > 0) {
      const firstWithTrades = binance.symbolSummaries[0].symbol;
      if (firstWithTrades) {
        setSelectedSymbol(firstWithTrades);
      }
    } else if (binance?.balances && binance.balances.length > 0) {
      const firstCrypto = binance.balances.find((b) => !b.isStablecoinOrFiat && b.defaultSymbol);
      if (firstCrypto?.defaultSymbol) {
        setSelectedSymbol(firstCrypto.defaultSymbol);
      }
    }
  }, [binance?.symbolSummaries, binance?.balances]);

  useEffect(() => {
    let active = true;
    if (!isAddPositionOpen) return;
    onSearchStocks(catalogSearchQuery).then((res) => {
      if (active) setCatalogResults(res.slice(0, 8));
    });
    return () => {
      active = false;
    };
  }, [catalogSearchQuery, isAddPositionOpen, onSearchStocks]);

  const availableTradeSymbols = useMemo(() => {
    const set = new Set<string>();
    (binance?.availableSymbols || []).forEach((s) => set.add(s));
    (binance?.symbolSummaries || []).forEach((s) => set.add(s.symbol));
    (binance?.balances || []).forEach((b) => {
      if (b.defaultSymbol) set.add(b.defaultSymbol);
    });
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT'].forEach(
      (sym) => set.add(sym)
    );
    return Array.from(set);
  }, [binance?.availableSymbols, binance?.symbolSummaries, binance?.balances]);

  const activeSymbolSummary: BinanceSymbolTradeSummary | null = useMemo(() => {
    if (liveSymbolData && liveSymbolData.symbol === selectedSymbol) {
      return liveSymbolData.summary;
    }
    return binance?.symbolSummaries?.find((s) => s.symbol === selectedSymbol) || null;
  }, [liveSymbolData, binance?.symbolSummaries, selectedSymbol]);

  const displayedTrades: BinancePersonalTrade[] = useMemo(() => {
    const sourceTrades =
      liveSymbolData && liveSymbolData.symbol === selectedSymbol
        ? liveSymbolData.trades
        : (binance?.recentTrades || []).filter(
            (t) => !selectedSymbol || t.symbol === selectedSymbol || (binance?.recentTrades || []).length <= 20
          );

    return sourceTrades.filter((trade) => {
      if (tradeSideFilter === 'BUY' && trade.side !== 'BUY') return false;
      if (tradeSideFilter === 'SELL' && trade.side !== 'SELL') return false;
      if (tradeSearch.trim()) {
        const q = tradeSearch.trim().toLowerCase();
        const matchSymbol = trade.symbol.toLowerCase().includes(q);
        const matchOrder = String(trade.orderId).includes(q);
        const matchId = String(trade.id).includes(q);
        if (!matchSymbol && !matchOrder && !matchId) return false;
      }
      return true;
    });
  }, [liveSymbolData, binance?.recentTrades, selectedSymbol, tradeSideFilter, tradeSearch]);

  const activeInspectedTrade: BinancePersonalTrade | null = useMemo(() => {
    if (displayedTrades.length === 0) return null;
    if (selectedTradeId !== null) {
      const found = displayedTrades.find((t) => t.id === selectedTradeId);
      if (found) return found;
    }
    return displayedTrades[0];
  }, [displayedTrades, selectedTradeId]);

  const filteredSpotBalances = useMemo(() => {
    const list = binance?.balances || [];
    return list.filter((b) => {
      if (walletScopeFilter === 'SPOT' && (b.spotTotal ?? 0) <= 0) return false;
      if (walletScopeFilter === 'FUNDING' && (b.fundingTotal ?? 0) <= 0) return false;
      if (walletScopeFilter === 'EARN' && (b.earnTotal ?? 0) <= 0 && b.walletType !== 'EARN') return false;

      if (spotFilter === 'STOCKS' && b.category !== 'Tokenized Stocks & Equities') return false;
      if (
        spotFilter === 'CRYPTO' &&
        (b.isStablecoinOrFiat || b.category === 'Tokenized Stocks & Equities')
      )
        return false;
      if (spotFilter === 'STABLECOIN' && !b.isStablecoinOrFiat) return false;
      if (spotFilter === 'LOCKED' && b.locked <= 0 && (b.earnTotal ?? 0) <= 0) return false;

      if (spotSearch.trim()) {
        const q = spotSearch.trim().toLowerCase();
        return (
          b.asset.toLowerCase().includes(q) ||
          b.assetName.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [binance?.balances, walletScopeFilter, spotFilter, spotSearch]);

  const manualPositions = useMemo(
    () => (investmentsData?.positions || []).filter((p) => p.source !== 'binance'),
    [investmentsData?.positions]
  );

  // Unified Stocks & Equities positions (Binance Funding/Spot Tokenized Stocks + Manual BVC/US/ETF Positions)
  const stockAndEquityPositions: StockPosition[] = useMemo(() => {
    const allPos = investmentsData?.positions || [];
    const filtered = allPos.filter(
      (p) =>
        p.source !== 'binance' ||
        p.sector === 'Tokenized Stocks & Equities' ||
        p.market === 'GLOBAL' ||
        p.market === 'US' ||
        p.market === 'BVC' ||
        p.market === 'ETF'
    );
    // If user currently holds all assets in Binance and wants to analyze all non-stablecoin positions in the Stocks & Equities Intelligence suite too:
    if (filtered.length === 0) {
      return allPos.filter((p) => p.sector !== 'Stablecoin / Fiat Reserve');
    }
    return filtered;
  }, [investmentsData?.positions]);

  // Filtered Portfolio History for Chart
  const chartHistoryData = useMemo(() => {
    const raw = investmentsData?.portfolioHistory || [];
    if (raw.length === 0) return [];
    const count = chartTimeframe === '7D' ? 8 : chartTimeframe === '14D' ? 15 : raw.length;
    return raw.slice(Math.max(0, raw.length - count));
  }, [investmentsData?.portfolioHistory, chartTimeframe]);

  // Capital Bridge Waterfall Data for Chart Mode 2
  const capitalBridgeData = useMemo(() => {
    if (!reconciliation) return [];
    const isUsd = chartCurrency === 'USD';
    const init = isUsd ? reconciliation.initialCapitalUsd : reconciliation.initialCapitalMad;
    const marketPnl = isUsd ? reconciliation.grossMarketPnlUsd : reconciliation.grossMarketPnlMad;
    const feeLoss = -(isUsd ? reconciliation.totalFeeDragUsd : reconciliation.totalFeeDragMad);
    const fxSpread = isUsd ? reconciliation.fxAndFundingSpreadUsd : reconciliation.fxAndFundingSpreadMad;
    const divs =
      (isUsd ? reconciliation.dividendsEarnedUsd : reconciliation.dividendsEarnedMad) +
      (isUsd ? reconciliation.accruedDividendsUsd : reconciliation.accruedDividendsMad);
    const live = isUsd ? reconciliation.currentLiveValueUsd : reconciliation.currentLiveValueMad;

    return [
      {
        name: 'Initial Reserve',
        value: Number(init.toFixed(2)),
        type: 'baseline',
        desc: 'Protected Wallet Initial Capital',
      },
      {
        name: 'Market P&L',
        value: Number(marketPnl.toFixed(2)),
        type: marketPnl >= 0 ? 'gain' : 'loss',
        desc: 'Price movement on held positions',
      },
      {
        name: 'Fee Drag',
        value: Number(feeLoss.toFixed(3)),
        type: 'loss',
        desc: 'Entry commissions + estimated exit fees',
      },
      ...(Math.abs(fxSpread) > 0.05
        ? [
            {
              name: 'FX / Spread',
              value: Number(fxSpread.toFixed(2)),
              type: fxSpread >= 0 ? 'gain' : 'loss',
              desc: 'P2P / FX conversion & funding spread',
            },
          ]
        : []),
      {
        name: 'Dividends',
        value: Number(divs.toFixed(2)),
        type: 'gain',
        desc: 'Collected & accrued dividend yield',
      },
      {
        name: 'Live Balance',
        value: Number(live.toFixed(2)),
        type: live >= init ? 'total_gain' : 'total_loss',
        desc: 'Current real-time portfolio value',
      },
    ];
  }, [reconciliation, chartCurrency]);

  // Position Attribution Data for Chart Mode 3
  const positionAttributionData = useMemo(() => {
    const isUsd = chartCurrency === 'USD';
    return (investmentsData?.positions || [])
      .filter((p) => p.marketValueMad > 0.1)
      .slice(0, 8)
      .map((p) => {
        const cost = isUsd ? p.costBasisUsd ?? p.costBasisMad / usdToMadRate : p.costBasisMad;
        const market = isUsd ? p.marketValueUsd ?? p.marketValueMad / usdToMadRate : p.marketValueMad;
        const netPnl = isUsd
          ? p.netPnlAfterFeesUsd ?? (p.netPnlAfterFeesMad ?? p.unrealizedPnlMad) / usdToMadRate
          : p.netPnlAfterFeesMad ?? p.unrealizedPnlMad;
        const fees = isUsd
          ? p.totalFeeLossUsd ?? (p.totalFeeLossMad || 0) / usdToMadRate
          : p.totalFeeLossMad || 0;
        return {
          ticker: p.ticker,
          CostBasis: Number(cost.toFixed(2)),
          LiveValue: Number(market.toFixed(2)),
          NetPnL: Number(netPnl.toFixed(2)),
          FeeLoss: Number(fees.toFixed(3)),
        };
      });
  }, [investmentsData?.positions, chartCurrency, usdToMadRate]);

  // Stock Trade & Breakeven Simulator Calculation
  const stockSimulation = useMemo(() => {
    const catalog = investmentsData?.catalog || [];
    const selectedStock =
      catalog.find((c) => c.ticker === simTicker) ||
      catalog[0] || {
        ticker: 'NVDA',
        companyName: 'NVIDIA Corp.',
        price: 138.6,
        currency: 'USD' as const,
        dividendYieldPercent: 0.03,
        annualDividendPerShare: 0.04,
        market: 'US' as StockMarketType,
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
    const proratedDividendUsd =
      investUsd * (divYieldPct / 100) * (holdingMonths / 12);
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
  }, [investmentsData?.catalog, simTicker, simInvestUsd, simTargetMovePct, simHoldingMonths, usdToMadRate]);

  const handleTriggerRefresh = async () => {
    setIsRefreshingLive(true);
    try {
      if (onRefreshInvestments) {
        await onRefreshInvestments(true);
      } else {
        await onRefresh();
      }
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: 'Synced live Binance Spot, Funding & Earn valuation with zero cache delay.',
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Failed to refresh Binance telemetry.',
            type: 'error',
          },
        })
      );
    } finally {
      setIsRefreshingLive(false);
    }
  };

  const handleLoadSymbolTrades = async (symbolToLoad: string, forceRefresh = false) => {
    const clean = symbolToLoad.trim().toUpperCase();
    if (!clean || !/^[A-Z0-9]{4,20}$/.test(clean)) {
      setSymbolTradeError('Enter a valid uppercase symbol pair (e.g., BTCUSDT, ETHUSDT, SOLUSDT).');
      return;
    }
    setSelectedSymbol(clean);
    setSymbolTradeError(null);

    if (!onFetchBinanceTrades) return;
    setIsLoadingSymbolTrades(true);
    try {
      const result = await onFetchBinanceTrades({
        symbol: clean,
        limit: tradeLimit,
        refresh: forceRefresh,
      });
      setLiveSymbolData({
        symbol: clean,
        trades: result.trades || [],
        summary: result.summary,
      });
      if (result.trades && result.trades.length > 0) {
        setSelectedTradeId(result.trades[0].id);
      }
    } catch (err: any) {
      setSymbolTradeError(err?.message || `Could not load trades for ${clean}`);
    } finally {
      setIsLoadingSymbolTrades(false);
    }
  };

  const handleInspectAssetTrades = (asset: BinanceSpotAssetBalance) => {
    const pair = asset.defaultSymbol || `${asset.asset}USDT`;
    setActiveSubView('trades');
    handleLoadSymbolTrades(pair, false);
  };

  const handleExportTradesCsv = () => {
    if (displayedTrades.length === 0) return;
    const headers = [
      'TradeID',
      'OrderID',
      'TimestampISO',
      'Symbol',
      'Side',
      'Status',
      'ExecPriceUSD',
      'LivePriceUSD',
      'Quantity',
      'PrincipalUSD',
      'CurrentValueUSD',
      'EntryFeeUSD',
      'RoundTripFeeLossUSD',
      'GrossPnL_USD',
      'NetPnL_AfterFees_USD',
      'BreakevenPriceUSD',
      'AccruedDividendUSD',
      'TotalReturnUSD',
    ];
    const rows = displayedTrades.map((t) => [
      t.id,
      t.orderId,
      t.executedAt,
      t.symbol,
      t.side,
      t.tradeStatusLabel || (t.isCompletedTrade ? 'CLOSED' : 'OPEN_LOT'),
      t.price.toFixed(6),
      (t.currentMarketPriceUsd ?? t.price).toFixed(6),
      t.qty.toFixed(8),
      t.quoteQtyUsd.toFixed(4),
      (t.currentLotValueUsd ?? t.quoteQtyUsd).toFixed(4),
      t.commissionUsd.toFixed(5),
      (t.totalFeeLossUsd ?? t.commissionUsd).toFixed(5),
      (t.grossTradePnlUsd ?? 0).toFixed(4),
      (t.netTradePnlUsd ?? 0).toFixed(4),
      (t.breakevenPriceUsd ?? t.price).toFixed(6),
      (t.accruedDividendUsd ?? 0).toFixed(4),
      (t.totalReturnWithDividendUsd ?? t.netTradePnlUsd ?? 0).toFixed(4),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `binance_trade_forensics_${selectedSymbol}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSyncWalletAction = async (
    mode: 'stablecoins_only' | 'full_spot_balance',
    walletId?: string
  ) => {
    if (!onSyncBinanceWallet) return;
    try {
      const res = await onSyncBinanceWallet({ walletId, mode });
      if (res) {
        window.dispatchEvent(
          new CustomEvent('truespend:toast', {
            detail: {
              message:
                res.message ||
                `Synced "${res.walletName}" wallet to ${formatMad(res.syncedBalanceMad)}.`,
              type: 'success',
            },
          })
        );
      }
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Failed to sync wallet with Binance.',
            type: 'error',
          },
        })
      );
    }
  };

  const handleSubmitCapitalTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(transferAmountMad);
    if (!Number.isFinite(amount) || amount <= 0) return;

    try {
      if (onLogWalletCapitalTransfer) {
        await onLogWalletCapitalTransfer({
          direction: transferDirection,
          bankWalletId: selectedBankWalletId || undefined,
          investmentWalletId: selectedInvWalletId || undefined,
          amountMad: amount,
          notes: transferNotes.trim() || undefined,
        });
      } else if (transferDirection === 'deposit') {
        await onFundInvestmentWallet({
          sourceWalletId: selectedBankWalletId || undefined,
          destinationWalletId: selectedInvWalletId || undefined,
          amountMad: amount,
          notes: transferNotes.trim() || undefined,
        });
      }
      setTransferAmountMad('');
      setTransferNotes('');
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message:
              transferDirection === 'deposit'
                ? `Logged ${formatMad(amount)} deposit to Investment Wallet and updated Safe-to-Spend.`
                : `Logged ${formatMad(amount)} withdrawal back to Bank Wallet.`,
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Failed to record capital transfer.',
            type: 'error',
          },
        })
      );
    }
  };

  const handleCreateBinanceWalletQuick = async () => {
    if (!onCreateWallet) return;
    try {
      const initialMad = binance?.connected ? binance.totalCombinedValueMad : 0;
      await onCreateWallet({
        name: 'Binance Spot',
        type: 'Investment',
        isMain: false,
        initialBalance: Number(initialMad.toFixed(2)),
      });
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: 'Created "Binance Spot" Investment Wallet protected from Safe-to-Spend.',
            type: 'success',
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: err?.message || 'Failed to create Binance Spot wallet.',
            type: 'error',
          },
        })
      );
    }
  };

  const handleSaveManualPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posForm.ticker.trim()) return;
    try {
      await onUpsertPosition({
        ticker: posForm.ticker.trim().toUpperCase(),
        companyName: posForm.companyName.trim() || posForm.ticker.trim().toUpperCase(),
        market: posForm.market,
        sector: posForm.sector,
        shares: parseFloat(posForm.shares) || 0,
        avgCostPerShare: parseFloat(posForm.avgCostPerShare) || 0,
        currentPrice: parseFloat(posForm.currentPrice) || parseFloat(posForm.avgCostPerShare) || 0,
        currency: posForm.currency,
        annualDividendPerShare: parseFloat(posForm.annualDividendPerShare) || 0,
        targetWeightPercent: parseFloat(posForm.targetWeightPercent) || 10,
        convictionThesis: posForm.convictionThesis.trim(),
        walletId: posForm.walletId || null,
        syncWithWallet: posForm.syncWithWallet,
      });
      setIsAddPositionOpen(false);
      setPosForm({
        ticker: '',
        companyName: '',
        market: 'US',
        sector: 'Technology',
        shares: '',
        avgCostPerShare: '',
        currentPrice: '',
        currency: 'USD',
        annualDividendPerShare: '0',
        targetWeightPercent: '15',
        convictionThesis: '',
        walletId: '',
        syncWithWallet: false,
      });
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: 'Saved stock/equity position to portfolio.', type: 'success' },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: err?.message || 'Failed to save position.', type: 'error' },
        })
      );
    }
  };

  const handleSaveManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onExecuteOrder({
        positionId: orderForm.positionId || undefined,
        ticker: orderForm.ticker.trim().toUpperCase() || undefined,
        action: orderForm.action,
        shares: parseFloat(orderForm.shares) || 0,
        pricePerShare: parseFloat(orderForm.pricePerShare) || 0,
        walletId: orderForm.walletId || null,
        syncWithWallet: orderForm.syncWithWallet,
        notes: orderForm.notes.trim() || undefined,
      });
      setIsLogOrderOpen(false);
      setOrderForm({
        positionId: '',
        ticker: '',
        action: 'BUY',
        shares: '',
        pricePerShare: '',
        walletId: '',
        syncWithWallet: true,
        notes: '',
      });
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: 'Logged investment order entry.', type: 'success' },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: err?.message || 'Failed to log order.', type: 'error' },
        })
      );
    }
  };

  // Core KPIs (Using exact live values & Capital Reconciliation)
  const totalCombinedBinanceValueMad =
    binance?.totalCombinedValueMad ?? binance?.totalSpotValueMad ?? 0;
  const totalCombinedBinanceValueUsd =
    binance?.totalCombinedValueUsd ?? binance?.totalSpotValueUsd ?? 0;
  const totalSpotValueMad = binance?.totalSpotValueMad ?? 0;
  const totalSpotValueUsd = binance?.totalSpotValueUsd ?? 0;
  const totalFundingValueMad = binance?.totalFundingValueMad ?? 0;
  const totalFundingValueUsd = binance?.totalFundingValueUsd ?? 0;
  const totalEarnValueMad = binance?.totalEarnValueMad ?? 0;
  const totalEarnValueUsd = binance?.totalEarnValueUsd ?? 0;
  const stockEquityMad = binance?.stockEquityMad ?? 0;
  const stockEquityUsd = binance?.stockEquityUsd ?? 0;
  const cryptoEquityMad = binance?.cryptoEquityMad ?? 0;
  const stablecoinReserveMad = binance?.stablecoinReserveMad ?? 0;
  const change24hMad = binance?.change24hMad ?? 0;
  const change24hUsd = binance?.change24hUsd ?? 0;
  const change24hPct = binance?.change24hPercent ?? 0;

  const currentLivePortfolioMad =
    reconciliation?.currentLiveValueMad ??
    investmentsData?.totalPortfolioValueMad ??
    totalCombinedBinanceValueMad;
  const currentLivePortfolioUsd =
    reconciliation?.currentLiveValueUsd ??
    investmentsData?.totalPortfolioValueUsd ??
    totalCombinedBinanceValueUsd;

  const initialCapitalReservedMad =
    reconciliation?.initialCapitalMad ??
    investmentsData?.buyingPower?.investmentWalletBalanceMad ??
    currentLivePortfolioMad;
  const initialCapitalReservedUsd =
    reconciliation?.initialCapitalUsd ?? initialCapitalReservedMad / usdToMadRate;

  const netCapitalPnlMad =
    reconciliation?.netCapitalPnlMad ?? currentLivePortfolioMad - initialCapitalReservedMad;
  const netCapitalPnlUsd =
    reconciliation?.netCapitalPnlUsd ?? currentLivePortfolioUsd - initialCapitalReservedUsd;
  const netCapitalPnlPct =
    reconciliation?.netCapitalPnlPercent ??
    (initialCapitalReservedMad > 0 ? (netCapitalPnlMad / initialCapitalReservedMad) * 100 : 0);

  const totalFeesPaidMad =
    reconciliation?.totalFeesPaidMad ?? investmentsData?.totalFeesPaidMad ?? 0;
  const totalFeesPaidUsd =
    reconciliation?.totalFeesPaidUsd ?? investmentsData?.totalFeesPaidUsd ?? 0;
  const totalFeeDragMad = reconciliation?.totalFeeDragMad ?? totalFeesPaidMad;
  const totalFeeDragUsd = reconciliation?.totalFeeDragUsd ?? totalFeesPaidUsd;
  const feeDragPercent = reconciliation?.feeDragPercentOfCapital ?? 0;

  const annualDividendsMad = investmentsData?.annualPassiveIncomeMad ?? 0;
  const annualDividendsUsd = annualDividendsMad / usdToMadRate;
  const accruedDividendsMad =
    (reconciliation?.dividendsEarnedMad ?? 0) + (reconciliation?.accruedDividendsMad ?? 0);
  const accruedDividendsUsd = accruedDividendsMad / usdToMadRate;

  return (
    <div className="space-y-6 pb-10">
      {/* Top Executive Header & Real-Time Telemetry Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Binance Multi-Wallet &amp; Equities Intelligence
              </span>
              <span>·</span>
              <span>Ed25519 Server-Signed</span>
              <span>·</span>
              <span>Zero Trading / Zero Withdrawal Execution</span>
              {binance?.connected && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    1 USD = {usdToMadRate.toFixed(2)} MAD
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Investments, Live Binance Position &amp; Trade Forensics
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
              Real-time valuation across Spot (<code className="font-mono text-xs">/api/v3/account</code>), Funding Stocks (<code className="font-mono text-xs">/sapi/v1/asset/get-funding-asset</code>), Simple Earn &amp; Unified Wallet Balance (<code className="font-mono text-xs">/sapi/v1/asset/wallet/balance</code>), reconciled against your TrueSpend Initial Capital Reserve.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAnalyticsPanel((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 transition-colors"
            >
              <Activity className="h-3.5 w-3.5" />
              {showAnalyticsPanel ? 'Hide Balance Chart' : 'Show Balance Chart'}
            </button>

            <button
              type="button"
              onClick={() => setShowSetupGuide((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Lock className="h-3.5 w-3.5 text-indigo-500" />
              {showSetupGuide ? 'Hide Security Spec' : 'Ed25519 Spec'}
            </button>

            <button
              type="button"
              onClick={handleTriggerRefresh}
              disabled={isRefreshingLive || isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingLive ? 'animate-spin' : ''}`} />
              {isRefreshingLive ? 'Syncing Live...' : 'Refresh Live Position'}
            </button>
          </div>
        </div>

        {/* Connection Diagnostics Strip */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  binance?.connected
                    ? 'bg-emerald-500'
                    : binance?.isConfigured
                    ? 'bg-amber-500'
                    : 'bg-gray-400'
                }`}
              />
              <span className="text-gray-900 dark:text-gray-100 font-semibold">
                {binance?.connected
                  ? 'Connected to Binance Spot, Funding & Earn REST API'
                  : binance?.isConfigured
                  ? 'Credentials Configured · Connection Error'
                  : 'Awaiting Server Environment Credentials'}
              </span>
            </span>
            <span>·</span>
            <span>
              Account Type:{' '}
              <strong className="font-mono text-gray-800 dark:text-gray-200">
                {binance?.accountType || 'SPOT (READ-ONLY)'}
              </strong>
            </span>
            {binance?.connected && binance.lastSyncedAt && (
              <>
                <span>·</span>
                <span>
                  Synced:{' '}
                  <strong className="font-mono tabular-nums text-gray-800 dark:text-gray-200">
                    {new Date(binance.lastSyncedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </strong>
                  {binance.syncLatencyMs ? (
                    <span className="ml-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                      ({binance.syncLatencyMs}ms · 5s TTL)
                    </span>
                  ) : null}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Cache-Control: private, no-store</span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Trading &amp; Withdrawals Disabled by Architecture
            </span>
            {binance?.connected && binance.permissions.isReadOnlySafe && (
              <>
                <span>·</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Read-Only Key Verified
                </span>
              </>
            )}
          </div>
        </div>

        {/* Warning ONLY if Binance reports that the API key actually has trading or withdrawal permissions enabled */}
        {binance?.connected && !binance.permissions.isReadOnlySafe && (
          <div className="mt-3 p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Binance API Key Permission Advisory: </span>
              Your Binance API key currently has trading or withdrawal permissions enabled on Binance. Although TrueSpend only executes read-only requests, we recommend restricting the key to &ldquo;Enable Reading&rdquo; only in your Binance API Management console.
            </div>
          </div>
        )}

        {/* Case 1: Credentials configured but connection failed */}
        {binance?.isConfigured && !binance?.connected && (
          <div className="mt-4 p-4 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Binance Connection Diagnostic
                    </h3>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold">
                      {binance?.errorCode || 'CONNECTION_FAILED'}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    {binance?.statusMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTriggerRefresh}
                  disabled={isRefreshingLive}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 transition-colors shadow-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshingLive ? 'animate-spin' : ''}`} />
                  {isRefreshingLive ? 'Testing...' : 'Retry Connection'}
                </button>
                <a
                  href="https://www.binance.com/en/my/settings/api-management"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 dark:border-amber-700 bg-white/80 dark:bg-gray-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span>Binance API Console</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Case 3: Connected and user toggled Security Spec guide */}
        {showSetupGuide && (
          <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/60 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Server-Side Ed25519 Security &amp; Multi-Wallet Valuation Architecture
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Queries <code className="font-mono">/api/v3/account</code>, <code className="font-mono">/sapi/v1/asset/get-funding-asset</code>, <code className="font-mono">/sapi/v3/asset/getUserAsset</code>, <code className="font-mono">/sapi/v1/asset/wallet/balance</code>, <code className="font-mono">/sapi/v1/simple-earn/*</code>, <code className="font-mono">/sapi/v1/convert/tradeFlow</code>, and <code className="font-mono">/api/v3/myTrades</code> exclusively on the server using Ed25519 signatures.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================
          4-CARD EXECUTIVE TELEMETRY STRIP (ACCURATE LIVE VALUE & LOSS/GAIN)
         =================================================================== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Live Binance & Portfolio Position (USD & MAD) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">Live Binance &amp; Portfolio</span>
            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              {binance?.connected ? `${binance.balances.length} Live Assets` : 'Local Ledger'}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {formatUsd(currentLivePortfolioUsd, 2)}
              </span>
              <span className="text-sm font-semibold font-mono tabular-nums text-gray-500 dark:text-gray-400">
                ({formatMad(currentLivePortfolioMad, 2)})
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono tabular-nums">
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  change24hUsd >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {change24hUsd >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {formatSignedUsd(change24hUsd)} ({change24hPct >= 0 ? '+' : ''}
                {change24hPct.toFixed(2)}% 24h)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
            <span>Spot: {formatUsd(totalSpotValueUsd)}</span>
            <span>·</span>
            <span>Fund: {formatUsd(totalFundingValueUsd)}</span>
            {totalEarnValueUsd > 0 && (
              <>
                <span>·</span>
                <span>Earn: {formatUsd(totalEarnValueUsd)}</span>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Initial Capital ($879 MAD) vs. Current Live Value (True Gain / Loss) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">
              Net Gain / Loss vs. Reserve
            </span>
            <Scale className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                netCapitalPnlMad >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatSignedMad(netCapitalPnlMad, 2)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono tabular-nums">
              <span
                className={`font-semibold ${
                  netCapitalPnlUsd >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatSignedUsd(netCapitalPnlUsd)} ({netCapitalPnlPct >= 0 ? '+' : ''}
                {netCapitalPnlPct.toFixed(2)}%)
              </span>
              <span>·</span>
              <span className="text-gray-500 dark:text-gray-400">
                {netCapitalPnlMad >= 0 ? 'Net Profit' : 'Capital Loss'}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
            <span>Initial Reserve: {formatMad(initialCapitalReservedMad, 0)} ({formatUsd(initialCapitalReservedUsd)})</span>
            {reconciliation && reconciliation.recoveryNeededMad > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Need +{reconciliation.recoveryNeededPercent.toFixed(1)}% to BE
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Trading Fees, Loss on Fees & Net After-Fee Return */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">
              Loss on Fees &amp; Friction
            </span>
            <Percent className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
              -{formatMad(totalFeeDragMad, 2)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                -{formatUsd(totalFeeDragUsd, 3)}
              </span>
              <span>·</span>
              <span>{feeDragPercent.toFixed(2)}% of Initial Capital</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
            <span>Paid: -{formatUsd(totalFeesPaidUsd, 3)}</span>
            <span>·</span>
            <span>
              Est. Exit: -{formatUsd(reconciliation?.estimatedExitFeesUsd ?? 0, 3)}
            </span>
          </div>
        </div>

        {/* Card 4: Dividends, Passive Yield & Safe Deployable Surplus */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">
              Dividends &amp; Buying Power
            </span>
            <Award className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              +{formatMad(annualDividendsMad, 2)}
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">/yr</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
              <span>{formatUsd(annualDividendsUsd)}/yr</span>
              <span>·</span>
              <span>
                Yield: {(investmentsData?.portfolioYieldPercent ?? 0).toFixed(2)}% (YoC:{' '}
                {(investmentsData?.yieldOnCostPercent ?? 0).toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
            <span>Accrued Divs: +{formatUsd(accruedDividendsUsd)}</span>
            <span>·</span>
            <span className="text-gray-900 dark:text-white font-semibold">
              Safe DCA: {formatMad(investmentsData?.buyingPower?.deployableSurplusMad ?? 0, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          INTERACTIVE INVESTMENT ANALYTICS & BALANCE TRAJECTORY CHART SUITE
         =================================================================== */}
      {showAnalyticsPanel && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                  Portfolio Balance Trajectory &amp; Capital Attribution Analytics
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                    netCapitalPnlMad >= 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {netCapitalPnlMad >= 0 ? 'ABOVE INITIAL CAPITAL' : 'BELOW INITIAL CAPITAL'} (
                  {netCapitalPnlPct >= 0 ? '+' : ''}
                  {netCapitalPnlPct.toFixed(2)}%)
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Tracks your live position ({formatUsd(currentLivePortfolioUsd)} /{' '}
                {formatMad(currentLivePortfolioMad)}) against your initial protected wallet reserve (
                {formatUsd(initialCapitalReservedUsd)} / {formatMad(initialCapitalReservedMad)}),
                including trading fees and dividends.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Chart Mode Selector */}
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
                <button
                  type="button"
                  onClick={() => setChartMode('trajectory')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartMode === 'trajectory'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  Balance vs. Reserve Curve
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('bridge')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartMode === 'bridge'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  Capital Loss/Gain Bridge
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('attribution')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartMode === 'attribution'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                  }`}
                >
                  Position Cost vs. Value
                </button>
              </div>

              {/* Timeframe Selector (for Trajectory) */}
              {chartMode === 'trajectory' && (
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs font-mono">
                  {(['7D', '14D', '30D'] as ChartTimeframe[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setChartTimeframe(tf)}
                      className={`px-2 py-1 rounded-md font-medium transition-colors ${
                        chartTimeframe === tf
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              )}

              {/* Currency Toggle (USD / MAD) */}
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs font-mono">
                {(['USD', 'MAD'] as DisplayCurrency[]).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setChartCurrency(curr)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      chartCurrency === curr
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left 8 Cols: Interactive Recharts Visualization */}
            <div className="lg:col-span-8">
              <div className="h-72 w-full">
                {chartMode === 'trajectory' && chartHistoryData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartHistoryData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="portfolioBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop
                            offset="5%"
                            stopColor={netCapitalPnlMad >= 0 ? '#10b981' : '#f43f5e'}
                            stopOpacity={0.28}
                          />
                          <stop
                            offset="95%"
                            stopColor={netCapitalPnlMad >= 0 ? '#10b981' : '#f43f5e'}
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.35} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) =>
                          chartCurrency === 'USD' ? `$${Number(val).toFixed(1)}` : `${Number(val).toFixed(0)}`
                        }
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const pt = payload[0].payload;
                          const isUsd = chartCurrency === 'USD';
                          const val = isUsd ? pt.portfolioValueUsd : pt.portfolioValueMad;
                          const init = isUsd ? pt.initialCapitalUsd : pt.initialCapitalMad;
                          const pnl = isUsd ? pt.netPnlUsd : pt.netPnlMad;
                          const fees = isUsd ? pt.cumulativeFeesUsd : pt.cumulativeFeesMad;
                          return (
                            <div className="bg-gray-900 text-white border border-gray-700 rounded-xl p-3 shadow-lg text-xs font-mono tabular-nums space-y-1.5">
                              <div className="font-sans font-bold text-gray-200 border-b border-gray-800 pb-1">
                                {pt.dateLabel}
                                {pt.eventLabel ? (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                    {pt.eventLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Live Position:</span>
                                <span className="font-bold text-white">
                                  {isUsd ? formatUsd(val) : formatMad(val)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Initial Capital Reserve:</span>
                                <span className="text-indigo-300">
                                  {isUsd ? formatUsd(init) : formatMad(init)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-gray-400">Net Gain / Loss:</span>
                                <span
                                  className={`font-bold ${
                                    pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {isUsd ? formatSignedUsd(pnl) : formatSignedMad(pnl)} (
                                  {pt.netPnlPercent >= 0 ? '+' : ''}
                                  {pt.netPnlPercent.toFixed(2)}%)
                                </span>
                              </div>
                              <div className="flex justify-between gap-4 text-[11px] text-gray-400 pt-1 border-t border-gray-800">
                                <span>Cum. Fees Paid:</span>
                                <span className="text-rose-400">
                                  -{isUsd ? formatUsd(fees, 3) : formatMad(fees, 2)}
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine
                        y={
                          chartCurrency === 'USD'
                            ? Number(initialCapitalReservedUsd.toFixed(2))
                            : Number(initialCapitalReservedMad.toFixed(2))
                        }
                        stroke="#6366f1"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        label={{
                          value: `Initial Capital (${
                            chartCurrency === 'USD'
                              ? formatUsd(initialCapitalReservedUsd)
                              : formatMad(initialCapitalReservedMad, 0)
                          })`,
                          position: 'insideTopRight',
                          fill: '#6366f1',
                          fontSize: 11,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey={chartCurrency === 'USD' ? 'portfolioValueUsd' : 'portfolioValueMad'}
                        stroke={netCapitalPnlMad >= 0 ? '#10b981' : '#f43f5e'}
                        strokeWidth={2.25}
                        fill="url(#portfolioBalanceGrad)"
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {chartMode === 'bridge' && capitalBridgeData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={capitalBridgeData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.35} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) =>
                          chartCurrency === 'USD' ? `$${val}` : `${val}`
                        }
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const item = payload[0].payload;
                          const isUsd = chartCurrency === 'USD';
                          return (
                            <div className="bg-gray-900 text-white border border-gray-700 rounded-xl p-3 shadow-lg text-xs font-mono tabular-nums space-y-1">
                              <div className="font-sans font-bold">{item.name}</div>
                              <div className="text-gray-400 font-sans text-[11px]">{item.desc}</div>
                              <div className="text-sm font-bold pt-1">
                                {isUsd ? formatUsd(item.value) : formatMad(item.value)}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {capitalBridgeData.map((entry, idx) => {
                          const color =
                            entry.type === 'baseline'
                              ? '#6366f1'
                              : entry.type === 'gain' || entry.type === 'total_gain'
                              ? '#10b981'
                              : '#f43f5e';
                          return <Cell key={`cell-${idx}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {chartMode === 'attribution' && positionAttributionData.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={positionAttributionData}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.35} />
                      <XAxis
                        dataKey="ticker"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar dataKey="CostBasis" name="Cost Basis" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="LiveValue" name="Live Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right 4 Cols: Capital Reconciliation & Loss/Profit Breakdown Ledger */}
            <div className="lg:col-span-4 bg-gray-50/70 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200/70 dark:border-gray-800 pb-2.5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Capital &amp; Loss Forensics
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Reconciling Initial Reserve vs. Live Binance Value
                  </p>
                </div>
                <Calculator className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="space-y-2 text-xs font-mono tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    1. Initial Protected Reserve:
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatMad(initialCapitalReservedMad, 2)} ({formatUsd(initialCapitalReservedUsd)})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    2. Market Price P&amp;L:
                  </span>
                  <span
                    className={`font-semibold ${
                      (reconciliation?.grossMarketPnlMad ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatSignedMad(reconciliation?.grossMarketPnlMad ?? 0, 2)} (
                    {formatSignedUsd(reconciliation?.grossMarketPnlUsd ?? 0)})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    3. Loss on Trading Fees:
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    -{formatMad(totalFeesPaidMad, 2)} (-{formatUsd(totalFeesPaidUsd, 3)})
                  </span>
                </div>

                {reconciliation && Math.abs(reconciliation.fxAndFundingSpreadMad) > 0.05 && (
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-gray-600 dark:text-gray-400">
                      4. P2P / FX Funding Spread:
                    </span>
                    <span
                      className={`font-semibold ${
                        reconciliation.fxAndFundingSpreadMad >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatSignedMad(reconciliation.fxAndFundingSpreadMad, 2)} (
                      {formatSignedUsd(reconciliation.fxAndFundingSpreadUsd)})
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    5. Accrued &amp; Paid Dividends:
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatMad(accruedDividendsMad, 2)} (+{formatUsd(accruedDividendsUsd)})
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <span className="font-sans font-bold text-gray-900 dark:text-white">
                    Current Live Position:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatMad(currentLivePortfolioMad, 2)} ({formatUsd(currentLivePortfolioUsd)})
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <span className="font-sans font-semibold text-gray-700 dark:text-gray-300">
                    Net Capital {netCapitalPnlMad >= 0 ? 'Profit' : 'Loss'}:
                  </span>
                  <span
                    className={`font-bold ${
                      netCapitalPnlMad >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatSignedMad(netCapitalPnlMad, 2)} ({formatSignedUsd(netCapitalPnlUsd)} ·{' '}
                    {netCapitalPnlPct >= 0 ? '+' : ''}
                    {netCapitalPnlPct.toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-NAVIGATION BAR (5 SPECIALIZED VIEWS)
         =================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveSubView('spot')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubView === 'spot'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Binance Holdings ({binance?.balances?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('stocks')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
              activeSubView === 'stocks'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Stocks &amp; Equities Intelligence ({stockAndEquityPositions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('trades')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubView === 'trades'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Trade &amp; Transaction Forensics ({(binance?.recentTrades || []).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('wallets')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubView === 'wallets'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Wallet Reserve &amp; Capital Flows ({investmentsData?.investmentWallets?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('ledger')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubView === 'ledger'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            BVC &amp; Off-Exchange Ledger ({manualPositions.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('stocks')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80 transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Stock Simulator &amp; Insights
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('wallets')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 transition-colors"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Reconcile $879 MAD Reserve
          </button>
        </div>
      </div>

      {/* ===================================================================
          VIEW 1: BINANCE HOLDINGS (SPOT, FUNDING STOCKS & EARN) WITH FORENSICS
         =================================================================== */}
      {activeSubView === 'spot' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Binance Live Positions (Spot, Funding Stocks &amp; Simple Earn)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Click any asset row to expand its full Position Forensics: Entry Cost, Fee Loss, Net P&amp;L After Fees, Breakeven Target Price, and Dividend Yield.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
                  {(['ALL', 'SPOT', 'FUNDING', 'EARN'] as WalletScopeFilterType[]).map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setWalletScopeFilter(scope)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        walletScopeFilter === scope
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      {scope === 'ALL'
                        ? 'All Wallets'
                        : scope === 'SPOT'
                        ? 'Spot'
                        : scope === 'FUNDING'
                        ? 'Funding (Stocks)'
                        : 'Earn'}
                    </button>
                  ))}
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
                  {(['ALL', 'STOCKS', 'CRYPTO', 'STABLECOIN', 'LOCKED'] as SpotFilterType[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSpotFilter(f)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        spotFilter === f
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-semibold'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      {f === 'ALL'
                        ? 'All'
                        : f === 'STOCKS'
                        ? 'Stocks'
                        : f === 'CRYPTO'
                        ? 'Crypto'
                        : f === 'STABLECOIN'
                        ? 'Stablecoins'
                        : 'Locked'}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={spotSearch}
                    onChange={(e) => setSpotSearch(e.target.value)}
                    placeholder="Filter asset (TSLA, BTC...)"
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {filteredSpotBalances.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {binance?.connected
                    ? 'No non-zero balances match the active filter.'
                    : 'Binance account is not connected yet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Asset &amp; Wallet</th>
                      <th className="py-3 px-3 text-right">Quantity</th>
                      <th className="py-3 px-3 text-right">Live Price &amp; 24h</th>
                      <th className="py-3 px-3 text-right">Avg Cost &amp; Breakeven</th>
                      <th className="py-3 px-3 text-right">Market Value</th>
                      <th className="py-3 px-3 text-right">Gross Position P&amp;L</th>
                      <th className="py-3 px-3 text-right">Fee Loss (Drag)</th>
                      <th className="py-3 px-3 text-right">Net P&amp;L + Divs</th>
                      <th className="py-3 pl-3 pr-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs">
                    {filteredSpotBalances.map((b) => {
                      const hasCostBasis =
                        !b.isStablecoinOrFiat &&
                        b.avgBuyPriceUsd !== null &&
                        b.unrealizedPnlMad !== null;
                      const grossPnlMad = b.unrealizedPnlMad ?? 0;
                      const grossPnlUsd = b.unrealizedPnlUsd ?? 0;
                      const grossPnlPct = b.unrealizedPnlPercent ?? 0;
                      const feeLossMad = b.totalFeeLossMad ?? 0;
                      const feeLossUsd = b.totalFeeLossUsd ?? 0;
                      const netPnlMad = b.netPnlAfterFeesMad ?? grossPnlMad - feeLossMad;
                      const netPnlUsd = b.netPnlAfterFeesUsd ?? grossPnlUsd - feeLossUsd;
                      const totalRetMad = b.totalReturnWithDividendMad ?? netPnlMad;
                      const totalRetUsd = b.totalReturnWithDividendUsd ?? netPnlUsd;
                      const isExpanded = expandedAssetKey === b.asset;

                      return (
                        <React.Fragment key={b.asset}>
                          <tr
                            onClick={() =>
                              setExpandedAssetKey((prev) => (prev === b.asset ? null : b.asset))
                            }
                            className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 pl-4 pr-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center font-mono font-bold text-xs text-gray-900 dark:text-white shrink-0">
                                  {b.asset.slice(0, 4)}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                    <span>{b.asset}</span>
                                    <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                      · {b.assetName}
                                    </span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                        b.walletType === 'FUNDING'
                                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                          : b.walletType === 'BOTH'
                                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                          : b.walletType === 'EARN'
                                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                      }`}
                                    >
                                      {b.walletType === 'FUNDING'
                                        ? 'Funding'
                                        : b.walletType === 'BOTH'
                                        ? 'Spot + Fund'
                                        : b.walletType === 'EARN'
                                        ? 'Earn'
                                        : 'Spot'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 flex-wrap">
                                    <span>{b.category}</span>
                                    <span>·</span>
                                    <span className="font-mono">{b.portfolioWeightPercent.toFixed(1)}% wt</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {formatQty(b.total)}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                Free: {formatQty(b.free)}
                                {b.locked > 0 ? ` · Lock: ${formatQty(b.locked)}` : ''}
                              </div>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {formatUsd(b.priceUsd)}
                              </div>
                              <div
                                className={`text-[11px] font-semibold ${
                                  b.change24hPercent >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {b.change24hPercent >= 0 ? '+' : ''}
                                {b.change24hPercent.toFixed(2)}%
                              </div>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              {b.isStablecoinOrFiat ? (
                                <span className="text-gray-400">1.00 USD Peg</span>
                              ) : hasCostBasis ? (
                                <div>
                                  <div className="text-gray-900 dark:text-white font-medium">
                                    Buy: {formatUsd(b.avgBuyPriceUsd)}
                                  </div>
                                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400">
                                    BE: {formatUsd(b.breakevenPriceUsd)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[11px]">Mark Price</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              <div className="font-bold text-gray-900 dark:text-white">
                                {formatUsd(b.valueUsd)}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                {formatMad(b.valueMad, 2)}
                              </div>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              {b.isStablecoinOrFiat ? (
                                <span className="text-gray-400">0.00</span>
                              ) : hasCostBasis ? (
                                <div>
                                  <div
                                    className={`font-semibold ${
                                      grossPnlUsd >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {formatSignedUsd(grossPnlUsd)}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {formatSignedMad(grossPnlMad, 1)} ({grossPnlPct >= 0 ? '+' : ''}
                                    {grossPnlPct.toFixed(1)}%)
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              {b.isStablecoinOrFiat ? (
                                <span className="text-gray-400">$0.00</span>
                              ) : (
                                <div>
                                  <div className="text-rose-600 dark:text-rose-400 font-medium">
                                    -{formatUsd(feeLossUsd, 3)}
                                  </div>
                                  <div className="text-[11px] text-gray-400">
                                    -{formatMad(feeLossMad, 2)} ({(b.feeDragPercent ?? 0).toFixed(2)}%)
                                  </div>
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                              {b.isStablecoinOrFiat ? (
                                <span className="text-gray-400">Reserve</span>
                              ) : hasCostBasis ? (
                                <div>
                                  <div
                                    className={`font-bold ${
                                      totalRetUsd >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {formatSignedUsd(totalRetUsd)}
                                  </div>
                                  <div className="text-[11px] text-gray-500">
                                    {formatSignedMad(totalRetMad, 2)}
                                    {(b.annualDividendUsd ?? 0) > 0
                                      ? ` · Div: +${formatUsd(b.accruedDividendUsd)}`
                                      : ''}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>

                            <td className="py-3.5 pl-3 pr-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedAssetKey((prev) =>
                                      prev === b.asset ? null : b.asset
                                    );
                                  }}
                                  className="px-2 py-1 rounded text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 inline-flex items-center gap-1"
                                >
                                  <span>Forensics</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable Position Deep-Dive Forensics Row */}
                          {isExpanded && (
                            <tr className="bg-gray-50/90 dark:bg-gray-950/70">
                              <td colSpan={9} className="p-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs font-mono tabular-nums">
                                  <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                                    <div className="font-sans text-[11px] font-semibold uppercase text-gray-400">
                                      1. Cost Basis &amp; Valuation
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Cost Basis:</span>
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {formatUsd(b.costBasisUsd ?? b.valueUsd)} (
                                        {formatMad(b.costBasisMad ?? b.valueMad, 1)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Live Value:</span>
                                      <span className="font-bold text-gray-900 dark:text-white">
                                        {formatUsd(b.valueUsd)} ({formatMad(b.valueMad, 1)})
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-sans text-indigo-500">
                                      Source: {b.costBasisSource === 'trades' ? 'Verified Spot Trades (WAC)' : b.costBasisSource === 'capital_allocated' ? 'Allocated from $879 MAD Reserve' : 'Spot Mark'}
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                                    <div className="font-sans text-[11px] font-semibold uppercase text-gray-400">
                                      2. Fee Loss Breakdown
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Entry Fee Paid:</span>
                                      <span className="text-rose-600 dark:text-rose-400">
                                        -{formatUsd(b.feesPaidUsd ?? 0, 4)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Est. Exit Fee:</span>
                                      <span className="text-rose-600 dark:text-rose-400">
                                        -{formatUsd(b.estimatedExitFeeUsd ?? 0, 4)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-100 dark:border-gray-800 pt-1 font-bold">
                                      <span className="text-gray-700 dark:text-gray-300">Total Fee Loss:</span>
                                      <span className="text-rose-600 dark:text-rose-400">
                                        -{formatUsd(feeLossUsd, 3)} (-{formatMad(feeLossMad, 2)})
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                                    <div className="font-sans text-[11px] font-semibold uppercase text-gray-400">
                                      3. Position Gain / Loss
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Gross P&amp;L:</span>
                                      <span
                                        className={
                                          grossPnlUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        }
                                      >
                                        {formatSignedUsd(grossPnlUsd)} ({formatSignedMad(grossPnlMad, 1)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Net After Fees:</span>
                                      <span
                                        className={`font-bold ${
                                          netPnlUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                        }`}
                                      >
                                        {formatSignedUsd(netPnlUsd)} ({formatSignedMad(netPnlMad, 1)})
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Realized P&amp;L:</span>
                                      <span>{formatSignedUsd(b.realizedPnlUsd ?? 0)}</span>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                                    <div className="font-sans text-[11px] font-semibold uppercase text-gray-400">
                                      4. Breakeven Target
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Breakeven Price:</span>
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                        {formatUsd(b.breakevenPriceUsd ?? b.priceUsd)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Distance to BE:</span>
                                      <span
                                        className={
                                          (b.distanceToBreakevenPercent ?? 0) <= 0
                                            ? 'text-emerald-600'
                                            : 'text-amber-600'
                                        }
                                      >
                                        {(b.distanceToBreakevenPercent ?? 0) > 0 ? '+' : ''}
                                        {(b.distanceToBreakevenPercent ?? 0).toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">24h Range:</span>
                                      <span>
                                        {formatUsd(b.low24hUsd)} – {formatUsd(b.high24hUsd)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1 flex flex-col justify-between">
                                    <div>
                                      <div className="font-sans text-[11px] font-semibold uppercase text-gray-400">
                                        5. Dividends &amp; Actions
                                      </div>
                                      <div className="flex justify-between mt-1">
                                        <span className="text-gray-500">Yield / Annual:</span>
                                        <span className="text-emerald-600 font-semibold">
                                          {(b.dividendYieldPercent ?? 0).toFixed(2)}% (+
                                          {formatUsd(b.annualDividendUsd ?? 0)}/yr)
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Accrued Div:</span>
                                        <span className="text-emerald-600">
                                          +{formatUsd(b.accruedDividendUsd ?? 0)}
                                        </span>
                                      </div>
                                    </div>
                                    {!b.isStablecoinOrFiat && b.defaultSymbol && (
                                      <button
                                        type="button"
                                        onClick={() => handleInspectAssetTrades(b)}
                                        className="mt-2 w-full py-1.5 px-2.5 rounded bg-indigo-600 text-white font-sans font-semibold text-xs hover:bg-indigo-700 transition-colors"
                                      >
                                        Inspect {b.asset} Trades →
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Multi-Wallet Breakdown & Smart Insights Strip */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Binance Multi-Wallet Valuation Breakdown
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Exact reconciliation across Spot, Funding (Stocks), Simple Earn &amp; active sub-wallets.
                  </p>
                </div>
                <WalletIcon className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="space-y-2.5 text-xs font-mono tabular-nums">
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    Spot Wallet (<code className="font-mono">/api/v3/account</code>)
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatUsd(totalSpotValueUsd)} · {formatMad(totalSpotValueMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    Funding Wallet / Stocks (<code className="font-mono">get-funding-asset</code>)
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatUsd(totalFundingValueUsd)} · {formatMad(totalFundingValueMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    Simple Earn Flexible &amp; Locked
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatUsd(totalEarnValueUsd)} · {formatMad(totalEarnValueMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    Binance Combined Live Total
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatUsd(totalCombinedBinanceValueUsd)} · {formatMad(totalCombinedBinanceValueMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-sans font-semibold text-gray-800 dark:text-gray-200">
                    Initial Protected Wallet Reserve
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {formatUsd(initialCapitalReservedUsd)} · {formatMad(initialCapitalReservedMad, 2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Portfolio Intelligence Insights */}
            <div className="lg:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Automated Portfolio &amp; Risk Intelligence
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Real-time diagnostics computed from your capital reserve, trade fees, and live mark-to-market prices.
                  </p>
                </div>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(investmentsData?.smartInsights || []).map((ins) => (
                  <div
                    key={ins.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      ins.severity === 'warning'
                        ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20'
                        : ins.severity === 'positive'
                        ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">{ins.title}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300">
                        {ins.category}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                      {ins.metricLabel}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-[11px]">
                      {ins.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          VIEW 2: STOCKS & EQUITIES INTELLIGENCE SUITE (ENHANCED)
         =================================================================== */}
      {activeSubView === 'stocks' && (
        <div className="space-y-6">
          {/* Stocks & Equities Executive Summary Header */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Institutional Equities, Dividends &amp; Fee Drag Intelligence</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  Stocks &amp; Equities Intelligence Suite (Binance Funding Stocks, US ETFs &amp; Casablanca BVC)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Deep per-position equity analytics: WAC cost basis, entry &amp; exit fee drag, net breakeven price, dividend yield on cost (YoC), 5-year DRIP compounding, and pre-trade fee/profit simulation.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPositionOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Stock / Equity Position
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogOrderOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Log Stock Buy / Sell / Dividend
                </button>
              </div>
            </div>

            {/* Quick Add Stock Form if opened */}
            {isAddPositionOpen && (
              <form
                onSubmit={handleSaveManualPosition}
                className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-gray-900 dark:text-white">
                    Add Stock or ETF to Portfolio (Live Yahoo Finance &amp; BVC Pricing)
                  </span>
                  <input
                    type="text"
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                    placeholder="Search ticker (NVDA, TSLA, AAPL, VOO, SCHD, ATW...)"
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-72"
                  />
                </div>

                {catalogResults.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {catalogResults.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() =>
                          setPosForm((prev) => ({
                            ...prev,
                            ticker: item.ticker,
                            companyName: item.companyName,
                            market: item.market,
                            sector: item.sector,
                            currentPrice: String(item.price),
                            avgCostPerShare: prev.avgCostPerShare || String(item.price),
                            currency: item.currency,
                            annualDividendPerShare: String(item.annualDividendPerShare),
                          }))
                        }
                        className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-500 font-mono text-[11px]"
                      >
                        <strong>{item.ticker}</strong> · {item.companyName} ({item.price}{' '}
                        {item.currency} · Div {item.dividendYieldPercent}%)
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div>
                    <label className="block text-gray-500 mb-1">Ticker</label>
                    <input
                      type="text"
                      required
                      value={posForm.ticker}
                      onChange={(e) => setPosForm({ ...posForm, ticker: e.target.value })}
                      placeholder="NVDA"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-gray-500 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={posForm.companyName}
                      onChange={(e) => setPosForm({ ...posForm, companyName: e.target.value })}
                      placeholder="NVIDIA Corporation"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Market</label>
                    <select
                      value={posForm.market}
                      onChange={(e) =>
                        setPosForm({ ...posForm, market: e.target.value as StockMarketType })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    >
                      <option value="US">US Equity</option>
                      <option value="ETF">Index / Dividend ETF</option>
                      <option value="BVC">BVC (Morocco)</option>
                      <option value="GLOBAL">Global / Tokenized Stock</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Shares Held</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={posForm.shares}
                      onChange={(e) => setPosForm({ ...posForm, shares: e.target.value })}
                      placeholder="1.5"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Avg Buy Cost</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={posForm.avgCostPerShare}
                      onChange={(e) =>
                        setPosForm({
                          ...posForm,
                          avgCostPerShare: e.target.value,
                          currentPrice: posForm.currentPrice || e.target.value,
                        })
                      }
                      placeholder="135.00"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddPositionOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-lg font-semibold bg-indigo-600 text-white"
                  >
                    Save Stock Position
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Active Positions Deep-Dive Cards (Stocks, Funding Equities & Core Holdings) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {(investmentsData?.positions || [])
              .filter((p) => p.sector !== 'Stablecoin / Fiat Reserve')
              .map((pos) => {
                const isSelected = selectedStockDetailId === pos.id;
                const grossPnlMad = pos.unrealizedPnlMad;
                const grossPnlUsd = pos.unrealizedPnlUsd ?? grossPnlMad / usdToMadRate;
                const feeLossMad = pos.totalFeeLossMad ?? 0;
                const feeLossUsd = pos.totalFeeLossUsd ?? feeLossMad / usdToMadRate;
                const netPnlMad = pos.netPnlAfterFeesMad ?? grossPnlMad - feeLossMad;
                const netPnlUsd = pos.netPnlAfterFeesUsd ?? grossPnlUsd - feeLossUsd;
                const totalRetMad = pos.totalReturnWithDividendMad ?? netPnlMad;
                const totalRetUsd = pos.totalReturnWithDividendUsd ?? netPnlUsd;

                return (
                  <div
                    key={pos.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-mono font-bold text-xs text-indigo-700 dark:text-indigo-300">
                          {pos.ticker.slice(0, 4)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-gray-900 dark:text-white">
                              {pos.ticker}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {pos.companyName}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {pos.market} · {pos.sector}
                            </span>
                          </div>
                          <div className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatQty(pos.sharesNum)} units · Avg Buy:{' '}
                            {pos.currency === 'MAD'
                              ? formatMad(pos.avgCostNum)
                              : formatUsd(pos.avgCostNum)}{' '}
                            · Breakeven:{' '}
                            <strong className="text-indigo-600 dark:text-indigo-400">
                              {pos.currency === 'MAD'
                                ? formatMad(pos.breakevenPriceMad ?? pos.avgCostNum)
                                : formatUsd(pos.breakevenPriceUsd ?? pos.avgCostNum)}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums">
                        <div className="text-base font-bold text-gray-900 dark:text-white">
                          {formatUsd(pos.marketValueUsd ?? pos.marketValueMad / usdToMadRate)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatMad(pos.marketValueMad, 2)}
                        </div>
                      </div>
                    </div>

                    {/* 4-Column Forensic Metrics Inside Each Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800/80 text-xs font-mono tabular-nums">
                      <div>
                        <div className="font-sans text-[10px] uppercase text-gray-400">
                          Gross P&amp;L
                        </div>
                        <div
                          className={`font-bold mt-0.5 ${
                            grossPnlUsd >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatSignedUsd(grossPnlUsd)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {formatSignedMad(grossPnlMad, 1)} ({pos.unrealizedPnlPercent >= 0 ? '+' : ''}
                          {pos.unrealizedPnlPercent.toFixed(1)}%)
                        </div>
                      </div>

                      <div>
                        <div className="font-sans text-[10px] uppercase text-gray-400">
                          Loss on Fees
                        </div>
                        <div className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                          -{formatUsd(feeLossUsd, 3)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          -{formatMad(feeLossMad, 2)} ({(pos.feeDragPercent ?? 0).toFixed(2)}%)
                        </div>
                      </div>

                      <div>
                        <div className="font-sans text-[10px] uppercase text-gray-400">
                          Dividends &amp; Yield
                        </div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          +{formatUsd((pos.annualDividendMad || 0) / usdToMadRate)}/yr
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Yield {pos.dividendYieldPercent.toFixed(2)}% · Accrued +
                          {formatUsd(pos.accruedDividendUsd ?? 0)}
                        </div>
                      </div>

                      <div>
                        <div className="font-sans text-[10px] uppercase text-gray-400">
                          Total Net Return
                        </div>
                        <div
                          className={`font-bold mt-0.5 ${
                            totalRetUsd >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatSignedUsd(totalRetUsd)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {formatSignedMad(totalRetMad, 1)} (After Fees + Divs)
                        </div>
                      </div>
                    </div>

                    {/* Footer: 5Y DRIP Projection, Weight Drift & Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <div className="flex flex-wrap items-center gap-3 text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                        <span>
                          Weight: <strong className="text-gray-900 dark:text-white">{pos.actualWeightPercent.toFixed(1)}%</strong>
                        </span>
                        <span>·</span>
                        <span>
                          5Y DRIP Est.:{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {formatMad(pos.drip5YearProjectedValueMad ?? pos.marketValueMad * 1.45, 0)}
                          </strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedStockDetailId((prev) => (prev === pos.id ? null : pos.id))
                        }
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {isSelected ? 'Hide Thesis & Rebalance' : 'Thesis & Rebalance Math →'}
                      </button>
                    </div>

                    {isSelected && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-xs space-y-2">
                        <p className="text-gray-600 dark:text-gray-400">
                          <strong>Conviction Thesis:</strong> {pos.convictionThesis || 'Core portfolio holding'}
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
                            <span className="text-gray-400 block font-sans">Yield on Cost (YoC)</span>
                            <span className="font-bold text-emerald-600">
                              {(pos.yieldOnCostPercent ?? pos.dividendYieldPercent).toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-sans">Safe Surplus Buying Power</span>
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

          {/* Interactive Stock Trade, Fee Drag, Dividend & Breakeven Simulator */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-indigo-500" />
                  <span>Smart Stock Trade, Fee Loss, Dividend &amp; Breakeven Simulator</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Calculate exact entry fees, exit fees, breakeven stock price, accrued dividends, and net return before placing any stock trade.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-12 items-center">
              <div className="lg:col-span-5 grid gap-3 sm:grid-cols-2 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Select Stock / ETF from Live Catalog
                  </label>
                  <select
                    value={simTicker}
                    onChange={(e) => setSimTicker(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white font-mono"
                  >
                    {(investmentsData?.catalog || []).map((c) => (
                      <option key={c.ticker} value={c.ticker}>
                        {c.ticker} — {c.companyName} ({c.price} {c.currency} · Div {c.dividendYieldPercent}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Position Size (USD)
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
                    Expected Price Move (%)
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
                    Holding Period (Months for Dividend Accrual)
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
                    Round-Trip Fee Loss
                  </div>
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    -{formatUsd(stockSimulation.totalRoundTripFeesUsd, 3)}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    -{formatMad(stockSimulation.totalRoundTripFeesMad, 2)}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Divs Earned: +{formatUsd(stockSimulation.proratedDividendUsd, 2)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                  <div className="font-sans text-[11px] text-gray-400 uppercase font-semibold">
                    Net Profit / Loss
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
                    {stockSimulation.totalNetRoiPct.toFixed(2)}%)
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {formatSignedMad(stockSimulation.totalNetReturnMad, 2)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Gross: {formatSignedUsd(stockSimulation.grossCapitalGainUsd)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          VIEW 3: PERSONAL TRADE HISTORY & DEEP TRANSACTION FORENSICS
         =================================================================== */}
      {activeSubView === 'trades' && (
        <div className="space-y-6">
          {/* Symbol Selector & Query Controls */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Personal Trade Execution &amp; Open-Lot Forensics (<code className="font-mono text-xs">/api/v3/myTrades</code> &amp; Convert)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every trade calculates exact fees, round-trip fee loss, open/uncompleted position gain or loss at live market price, breakeven price, and accrued dividends.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customSymbolInput}
                    onChange={(e) => setCustomSymbolInput(e.target.value.toUpperCase())}
                    placeholder="Custom Pair (e.g. SOLUSDT)"
                    className="px-3 py-1.5 text-xs font-mono uppercase rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500 w-44"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customSymbolInput.trim()) {
                        handleLoadSymbolTrades(customSymbolInput.trim(), true);
                      }
                    }}
                    disabled={isLoadingSymbolTrades}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
                  >
                    Query Pair
                  </button>
                </div>

                <select
                  value={tradeLimit}
                  onChange={(e) => setTradeLimit(Number(e.target.value))}
                  aria-label="Trade history limit"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200"
                >
                  <option value={50}>Last 50 fills</option>
                  <option value={100}>Last 100 fills</option>
                  <option value={250}>Last 250 fills</option>
                  <option value={500}>Max 500 fills</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleLoadSymbolTrades(selectedSymbol, true)}
                  disabled={isLoadingSymbolTrades}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingSymbolTrades ? 'animate-spin' : ''}`} />
                  Refresh Pair
                </button>
              </div>
            </div>

            {/* Quick Symbol Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mr-1">
                Pairs:
              </span>
              {availableTradeSymbols.map((sym) => {
                const isSelected = selectedSymbol === sym;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => handleLoadSymbolTrades(sym, false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>

            {symbolTradeError && (
              <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{symbolTradeError}</span>
              </div>
            )}
          </div>

          {/* Interactive Selected Trade Forensics Inspector Card */}
          {activeInspectedTrade && (
            <div className="bg-white dark:bg-gray-900 border-2 border-indigo-500/30 dark:border-indigo-500/40 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                      activeInspectedTrade.side === 'BUY'
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {activeInspectedTrade.side} {activeInspectedTrade.symbol}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {activeInspectedTrade.tradeStatusLabel === 'OPEN_LOT'
                      ? 'OPEN POSITION (Uncompleted Trade — Live Mark-to-Market)'
                      : activeInspectedTrade.tradeStatusLabel === 'PARTIALLY_CLOSED'
                      ? 'PARTIALLY OPEN LOT'
                      : 'COMPLETED / REALIZED TRADE'}
                  </span>
                  <span className="text-xs font-mono text-gray-500">
                    Order #{activeInspectedTrade.orderId} ·{' '}
                    {new Date(activeInspectedTrade.time).toLocaleString()} (
                    {activeInspectedTrade.holdingDays ?? 1}d held)
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  Click any trade row below to inspect its forensics
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs font-mono tabular-nums">
                {/* Box 1: Execution vs Live Valuation */}
                <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 space-y-1.5">
                  <div className="font-sans text-[11px] font-bold uppercase text-gray-400">
                    1. Principal vs. Live Value
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Entry Cost:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatUsd(activeInspectedTrade.quoteQtyUsd)} (
                      {formatMad(activeInspectedTrade.quoteQtyMad, 1)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current Value:</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatUsd(
                        activeInspectedTrade.currentLotValueUsd ?? activeInspectedTrade.quoteQtyUsd
                      )}{' '}
                      (
                      {formatMad(
                        activeInspectedTrade.currentLotValueMad ?? activeInspectedTrade.quoteQtyMad,
                        1
                      )}
                      )
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60 dark:border-gray-800">
                    <span>Fill → Live Price:</span>
                    <span>
                      {formatUsd(activeInspectedTrade.price)} →{' '}
                      {formatUsd(
                        activeInspectedTrade.currentMarketPriceUsd ?? activeInspectedTrade.price
                      )}
                    </span>
                  </div>
                </div>

                {/* Box 2: The Fees & Loss on Fees */}
                <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 space-y-1.5">
                  <div className="font-sans text-[11px] font-bold uppercase text-rose-500">
                    2. Fees &amp; Loss on Fees
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fee Charged:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {formatQty(activeInspectedTrade.commission)}{' '}
                      {activeInspectedTrade.commissionAsset} (-
                      {formatUsd(activeInspectedTrade.commissionUsd, 4)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Est. Close Fee:</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      -{formatUsd(activeInspectedTrade.estimatedExitFeeUsd ?? 0, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200/60 dark:border-gray-800 font-bold">
                    <span className="text-gray-700 dark:text-gray-300">Total Fee Loss:</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      -{formatUsd(activeInspectedTrade.totalFeeLossUsd ?? activeInspectedTrade.commissionUsd, 4)}{' '}
                      ({(activeInspectedTrade.feeDragPercent ?? 0.2).toFixed(2)}%)
                    </span>
                  </div>
                </div>

                {/* Box 3: Position Gain/Loss (Before & After Fees, even if uncompleted) */}
                <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 space-y-1.5">
                  <div className="font-sans text-[11px] font-bold uppercase text-gray-400">
                    3. Gain/Loss on Trade
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Position P&amp;L (Gross):</span>
                    <span
                      className={`font-semibold ${
                        (activeInspectedTrade.grossTradePnlUsd ?? 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatSignedUsd(activeInspectedTrade.grossTradePnlUsd ?? 0)} (
                      {formatSignedMad(activeInspectedTrade.grossTradePnlMad ?? 0, 1)})
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200/60 dark:border-gray-800 font-bold">
                    <span className="text-gray-700 dark:text-gray-300">Net After Fees:</span>
                    <span
                      className={
                        (activeInspectedTrade.netTradePnlUsd ?? 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {formatSignedUsd(activeInspectedTrade.netTradePnlUsd ?? 0)} (
                      {(activeInspectedTrade.netTradePnlPercent ?? 0) >= 0 ? '+' : ''}
                      {(activeInspectedTrade.netTradePnlPercent ?? 0).toFixed(2)}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Net in MAD: {formatSignedMad(activeInspectedTrade.netTradePnlMad ?? 0, 2)}
                  </div>
                </div>

                {/* Box 4: Breakeven Recovery Analysis */}
                <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 space-y-1.5">
                  <div className="font-sans text-[11px] font-bold uppercase text-indigo-500">
                    4. Breakeven Target
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Breakeven Price:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatUsd(activeInspectedTrade.breakevenPriceUsd ?? activeInspectedTrade.price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Move Needed:</span>
                    <span
                      className={`font-semibold ${
                        (activeInspectedTrade.distanceToBreakevenPercent ?? 0) <= 0
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {(activeInspectedTrade.distanceToBreakevenPercent ?? 0) > 0 ? '+' : ''}
                      {(activeInspectedTrade.distanceToBreakevenPercent ?? 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-200/60 dark:border-gray-800">
                    Covers entry + exit fee drag
                  </div>
                </div>

                {/* Box 5: Dividends & Total Return */}
                <div className="p-3.5 rounded-xl bg-gray-50/80 dark:bg-gray-950/60 border border-gray-200/80 dark:border-gray-800 space-y-1.5">
                  <div className="font-sans text-[11px] font-bold uppercase text-emerald-500">
                    5. Dividend &amp; Total Return
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Annual Div Rate:</span>
                    <span className="text-emerald-600 font-semibold">
                      {(activeInspectedTrade.dividendYieldPercent ?? 0).toFixed(2)}% (+
                      {formatUsd(activeInspectedTrade.annualDividendLotUsd ?? 0)}/yr)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accrued Div:</span>
                    <span className="text-emerald-600">
                      +{formatUsd(activeInspectedTrade.accruedDividendUsd ?? 0, 3)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-gray-200/60 dark:border-gray-800 font-bold">
                    <span className="text-gray-700 dark:text-gray-300">Total Return:</span>
                    <span
                      className={
                        (activeInspectedTrade.totalReturnWithDividendUsd ?? 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {formatSignedUsd(activeInspectedTrade.totalReturnWithDividendUsd ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Personal Trade Execution Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Executed Fills &amp; Open-Lot Breakdown ({displayedTrades.length})
                </h3>
                <span className="text-xs font-mono text-gray-500">· {selectedSymbol}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
                  {(['ALL', 'BUY', 'SELL'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setTradeSideFilter(side)}
                      className={`px-2.5 py-1 rounded-md font-medium ${
                        tradeSideFilter === side
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Filter className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tradeSearch}
                    onChange={(e) => setTradeSearch(e.target.value)}
                    placeholder="Order ID or Trade ID..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportTradesCsv}
                  disabled={displayedTrades.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Forensics CSV
                </button>
              </div>
            </div>

            {isLoadingSymbolTrades ? (
              <div className="p-10 text-center text-xs text-gray-500 dark:text-gray-400">
                Querying signed <code className="font-mono">/api/v3/myTrades</code> for {selectedSymbol}...
              </div>
            ) : displayedTrades.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  No personal trades found for {selectedSymbol}.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select another pair above or inspect your positions in the Binance Holdings tab.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Date &amp; Status</th>
                      <th className="py-3 px-3">Pair &amp; Side</th>
                      <th className="py-3 px-3 text-right">Fill vs. Live Price</th>
                      <th className="py-3 px-3 text-right">Qty &amp; Principal</th>
                      <th className="py-3 px-3 text-right">Fee &amp; Fee Loss</th>
                      <th className="py-3 px-3 text-right">Position P&amp;L (Gross)</th>
                      <th className="py-3 px-3 text-right">Net P&amp;L (After Fees)</th>
                      <th className="py-3 pl-3 pr-4 text-right">Breakeven &amp; Div</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs font-mono tabular-nums">
                    {displayedTrades.map((trade) => {
                      const isSelected = activeInspectedTrade?.id === trade.id;
                      const grossUsd = trade.grossTradePnlUsd ?? 0;
                      const netUsd = trade.netTradePnlUsd ?? 0;
                      const netPct = trade.netTradePnlPercent ?? 0;
                      const feeLossUsd = trade.totalFeeLossUsd ?? trade.commissionUsd;

                      return (
                        <tr
                          key={`${trade.symbol}-${trade.id}`}
                          onClick={() => setSelectedTradeId(trade.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                              : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          <td className="py-3 pl-4 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            <div>{new Date(trade.time).toLocaleDateString()}</div>
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                              {trade.tradeStatusLabel === 'OPEN_LOT'
                                ? 'OPEN (Live P&L)'
                                : trade.tradeStatusLabel === 'PARTIALLY_CLOSED'
                                ? 'PARTIAL OPEN'
                                : 'COMPLETED'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-gray-900 dark:text-white">
                              {trade.symbol}
                            </div>
                            <div className="mt-0.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  trade.side === 'BUY'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                }`}
                              >
                                {trade.side}
                              </span>
                              <span className="ml-1 text-[10px] text-gray-400">
                                {trade.tradeSource === 'CONVERT'
                                  ? 'Convert'
                                  : trade.isMaker
                                  ? 'Maker'
                                  : 'Taker'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="text-gray-900 dark:text-white font-medium">
                              Fill: {formatUsd(trade.price)}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Live: {formatUsd(trade.currentMarketPriceUsd ?? trade.price)}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {formatQty(trade.qty)} {trade.baseAsset}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Cost: {formatUsd(trade.quoteQtyUsd)} ({formatMad(trade.quoteQtyMad, 0)})
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="text-rose-600 dark:text-rose-400 font-semibold">
                              -{formatUsd(feeLossUsd, 4)}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {formatQty(trade.commission)} {trade.commissionAsset} (
                              {(trade.feeDragPercent ?? 0.2).toFixed(2)}%)
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div
                              className={`font-semibold ${
                                grossUsd >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatSignedUsd(grossUsd)}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {formatSignedMad(trade.grossTradePnlMad ?? 0, 1)}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div
                              className={`font-bold ${
                                netUsd >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatSignedUsd(netUsd)} ({netPct >= 0 ? '+' : ''}
                              {netPct.toFixed(2)}%)
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {formatSignedMad(trade.netTradePnlMad ?? 0, 2)}
                            </div>
                          </td>

                          <td className="py-3 pl-3 pr-4 text-right">
                            <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                              BE: {formatUsd(trade.breakevenPriceUsd ?? trade.price)}
                            </div>
                            <div className="text-[11px] text-emerald-600">
                              Div: +{formatUsd(trade.accruedDividendUsd ?? 0, 3)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          VIEW 4: TRUESPEND WALLET RESERVE ($879 MAD) & CAPITAL RECONCILIATION
         =================================================================== */}
      {activeSubView === 'wallets' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 7 Cols: Investment Wallets & Initial Capital vs. Live Valuation */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Protected Investment Wallet Reserve vs. Live Valuation
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Your <code className="font-mono">Investment</code> wallet stores your initial capital reserve (e.g. {formatMad(initialCapitalReservedMad, 0)}) and compares it directly against your live Binance balance ({formatUsd(totalCombinedBinanceValueUsd)} / {formatMad(totalCombinedBinanceValueMad, 2)}) to compute your true gain or loss.
                    </p>
                  </div>
                  {investmentWallets.length === 0 && onCreateWallet && (
                    <button
                      type="button"
                      onClick={handleCreateBinanceWalletQuick}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create &ldquo;Binance Spot&rdquo; Wallet
                    </button>
                  )}
                </div>

                {(investmentsData?.investmentWallets || []).map((w) => {
                  const pnlMad = w.netWalletPnlMad ?? 0;
                  const pnlUsd = w.netWalletPnlUsd ?? 0;
                  const pnlPct = w.netWalletPnlPercent ?? 0;
                  return (
                    <div
                      key={w.walletId}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {w.name}
                          </span>
                          {w.isBinanceLinked && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                              Linked to Live Binance
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <span className="text-xs text-gray-500 mr-1.5">Net Capital P&amp;L:</span>
                          <span
                            className={`text-sm font-bold ${
                              pnlMad >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatSignedMad(pnlMad, 2)} ({formatSignedUsd(pnlUsd)} ·{' '}
                            {pnlPct >= 0 ? '+' : ''}
                            {pnlPct.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-800/70 text-xs font-mono tabular-nums">
                        <div>
                          <div className="text-[11px] font-sans text-gray-400">
                            Initial Capital Reserved
                          </div>
                          <div className="font-bold text-indigo-600 dark:text-indigo-400">
                            {formatMad(w.initialCapitalReservedMad ?? w.netCapitalDepositedMad ?? 0, 2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-sans text-gray-400">
                            Current Live Valuation
                          </div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            {formatMad(w.liveValuationMad ?? w.totalAccountValueMad, 2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-sans text-gray-400">
                            Binance Spot + Stocks
                          </div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200">
                            {formatMad(
                              (w.binanceSpotCryptoMad ?? 0) + (w.binanceFundingStocksMad ?? 0),
                              2
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-sans text-gray-400">
                            Binance Stablecoin Cash
                          </div>
                          <div className="font-semibold text-gray-800 dark:text-gray-200">
                            {formatMad(w.binanceStablecoinCashMad ?? 0, 2)}
                          </div>
                        </div>
                      </div>

                      {w.isBinanceLinked && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleSyncWalletAction('full_spot_balance', w.walletId)}
                            disabled={!binance?.connected || isSaving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Update Reserve to Match Live Balance ({formatMad(totalCombinedBinanceValueMad, 2)})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSyncWalletAction('stablecoins_only', w.walletId)}
                            disabled={!binance?.connected || isSaving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                          >
                            Sync to Stablecoins Only ({formatMad(stablecoinReserveMad, 2)})
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Log Capital Transfer (Bank <-> Investment Wallet) */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleSubmitCapitalTransfer}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4"
              >
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Log Capital Flow (Bank ↔ Investment Wallet)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Record capital deposited into or withdrawn from your Investment Wallet. Updates your Initial Capital baseline and Safe-to-Spend.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setTransferDirection('deposit')}
                    className={`py-2 rounded-md font-semibold transition-colors ${
                      transferDirection === 'deposit'
                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-gray-500'
                    }`}
                  >
                    Deposit to Investment
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferDirection('withdrawal')}
                    className={`py-2 rounded-md font-semibold transition-colors ${
                      transferDirection === 'withdrawal'
                        ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                        : 'text-gray-500'
                    }`}
                  >
                    Withdraw to Bank
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {transferDirection === 'deposit'
                        ? 'Source Bank / Cash Wallet'
                        : 'Destination Bank / Cash Wallet'}
                    </label>
                    <select
                      value={selectedBankWalletId}
                      onChange={(e) => setSelectedBankWalletId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                    >
                      {bankAndCashWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.type}) — {formatMad(w.balance, 2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Investment Wallet
                    </label>
                    <select
                      value={selectedInvWalletId}
                      onChange={(e) => setSelectedInvWalletId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                    >
                      {investmentWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} — {formatMad(w.balance, 2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Amount (MAD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={transferAmountMad}
                      onChange={(e) => setTransferAmountMad(e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Memo (Optional)
                    </label>
                    <input
                      type="text"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder="e.g. P2P USDT Deposit to Binance"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving || !transferAmountMad}
                  className="w-full py-2.5 px-4 rounded-lg text-xs font-bold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  {transferDirection === 'deposit'
                    ? 'Record Investment Deposit'
                    : 'Record Bank Withdrawal'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          VIEW 5: OFF-EXCHANGE & BVC LEDGER (WITH ORDER FORENSICS)
         =================================================================== */}
      {activeSubView === 'ledger' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Off-Exchange &amp; Casablanca BVC Holdings &amp; Orders Ledger
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every logged stock order calculates broker fee drag, open-lot mark-to-market P&amp;L, breakeven price, and accrued dividends.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogOrderOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Log Order / Dividend
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddPositionOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Holding
                </button>
              </div>
            </div>

            {isLogOrderOpen && (
              <form
                onSubmit={handleSaveManualOrder}
                className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 space-y-3 text-xs"
              >
                <div className="font-bold text-gray-900 dark:text-white">
                  Log Local Ledger Order (BUY / SELL / DIVIDEND)
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <div>
                    <label className="block text-gray-500 mb-1">Action</label>
                    <select
                      value={orderForm.action}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, action: e.target.value as StockOrderAction })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                      <option value="DIVIDEND">DIVIDEND</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Ticker</label>
                    <input
                      type="text"
                      required
                      value={orderForm.ticker}
                      onChange={(e) => setOrderForm({ ...orderForm, ticker: e.target.value })}
                      placeholder="ATW"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Shares / Qty</label>
                    <input
                      type="number"
                      step="any"
                      value={orderForm.shares}
                      onChange={(e) => setOrderForm({ ...orderForm, shares: e.target.value })}
                      placeholder="5"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Price per Unit</label>
                    <input
                      type="number"
                      step="any"
                      value={orderForm.pricePerShare}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, pricePerShare: e.target.value })
                      }
                      placeholder="545"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Sync TrueSpend Wallet</label>
                    <select
                      value={orderForm.walletId}
                      onChange={(e) => setOrderForm({ ...orderForm, walletId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
                    >
                      <option value="">No Wallet Deduction</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({formatMad(w.balance, 0)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLogOrderOpen(false)}
                    className="px-3 py-1.5 text-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 rounded-lg font-semibold bg-indigo-600 text-white"
                  >
                    Record Order
                  </button>
                </div>
              </form>
            )}

            {(investmentsData?.orders || []).length > 0 && (
              <div className="overflow-x-auto border-b border-gray-100 dark:border-gray-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Date</th>
                      <th className="py-3 px-3">Action &amp; Ticker</th>
                      <th className="py-3 px-3 text-right">Shares &amp; Fill</th>
                      <th className="py-3 px-3 text-right">Principal vs. Live</th>
                      <th className="py-3 px-3 text-right">Broker Fee Loss</th>
                      <th className="py-3 px-3 text-right">Net Order P&amp;L</th>
                      <th className="py-3 px-3 text-right">Accrued Div &amp; Total</th>
                      <th className="py-3 pl-3 pr-4 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs font-mono tabular-nums">
                    {(investmentsData?.orders || []).map((ord) => (
                      <tr key={ord.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                        <td className="py-3 pl-4 pr-3 text-gray-600 dark:text-gray-400">
                          {new Date(ord.executedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {ord.action} {ord.ticker}
                          </span>
                          <span className="ml-1.5 text-[10px] text-indigo-500">
                            {ord.isOpenLot ? 'OPEN LOT' : 'REALIZED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {ord.shares} @ {ord.pricePerShare} {ord.currency}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div>{formatMad(parseFloat(ord.totalMadAmount || '0'), 1)}</div>
                          <div className="text-[11px] text-gray-400">
                            Live: {formatMad(ord.currentValueMad ?? 0, 1)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-rose-600">
                          -{formatMad(ord.feeMad ?? 0, 2)} ({(ord.feeDragPercent ?? 0).toFixed(2)}%)
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold ${
                            (ord.netOrderPnlMad ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {formatSignedMad(ord.netOrderPnlMad ?? 0, 2)} (
                          {(ord.netOrderPnlPercent ?? 0).toFixed(1)}%)
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="text-emerald-600">
                            Div: +{formatMad(ord.accruedDividendMad ?? 0, 2)}
                          </div>
                          <div className="font-bold text-gray-900 dark:text-white">
                            Tot: {formatSignedMad(ord.totalReturnMad ?? 0, 2)}
                          </div>
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteOrder(ord.id)}
                            className="p-1 text-gray-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {manualPositions.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No off-exchange manual holdings logged yet. Explore the &ldquo;Stocks &amp; Equities Intelligence&rdquo; tab to simulate or add positions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Ticker</th>
                      <th className="py-3 px-3">Market / Sector</th>
                      <th className="py-3 px-3 text-right">Shares</th>
                      <th className="py-3 px-3 text-right">Avg Cost / Breakeven</th>
                      <th className="py-3 px-3 text-right">Current Price</th>
                      <th className="py-3 px-3 text-right">Market Value</th>
                      <th className="py-3 px-3 text-right">Fee Loss</th>
                      <th className="py-3 px-3 text-right">Net P&amp;L + Divs</th>
                      <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs font-mono tabular-nums">
                    {manualPositions.map((pos) => (
                      <tr key={pos.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                        <td className="py-3 pl-4 pr-3 font-sans">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {pos.ticker}
                          </div>
                          <div className="text-[11px] text-gray-500">{pos.companyName}</div>
                        </td>
                        <td className="py-3 px-3 font-sans text-gray-600 dark:text-gray-400">
                          {pos.market} · {pos.sector}
                        </td>
                        <td className="py-3 px-3 text-right">{formatQty(pos.sharesNum)}</td>
                        <td className="py-3 px-3 text-right">
                          <div>
                            {pos.avgCostNum.toFixed(2)} {pos.currency}
                          </div>
                          <div className="text-[11px] text-indigo-500">
                            BE: {(pos.breakevenPriceNative ?? pos.avgCostNum).toFixed(2)} {pos.currency}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {pos.currentPriceNum.toFixed(2)} {pos.currency}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                          {formatMad(pos.marketValueMad, 2)}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-600">
                          -{formatMad(pos.totalFeeLossMad ?? 0, 2)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold ${
                            (pos.totalReturnWithDividendMad ?? pos.unrealizedPnlMad) >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatSignedMad(
                            pos.totalReturnWithDividendMad ?? pos.unrealizedPnlMad,
                            2
                          )}{' '}
                          ({(pos.totalReturnPercent ?? pos.unrealizedPnlPercent).toFixed(1)}%)
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => onDeletePosition(pos.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                            title="Remove position"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
