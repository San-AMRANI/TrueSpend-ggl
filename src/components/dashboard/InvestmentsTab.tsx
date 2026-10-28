import React, { useState, useMemo, useEffect } from 'react';
import {
  InvestmentsData,
  StockMarketType,
  StockOrderAction,
  StockCatalogItem,
  Wallet,
  DashboardTab,
  BinanceSpotAssetBalance,
  BinanceSymbolTradeSummary,
  BinancePersonalTrade,
} from '../../types';
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
  ExternalLink,
  Key,
  Globe,
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

type ActiveSubView = 'spot' | 'trades' | 'wallets' | 'ledger';
type SpotFilterType = 'ALL' | 'STOCKS' | 'CRYPTO' | 'STABLECOIN' | 'LOCKED';
type WalletScopeFilterType = 'ALL' | 'SPOT' | 'FUNDING';

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
  return `$${num.toLocaleString('en-US', {
    minimumFractionDigits: dynamicDecimals,
    maximumFractionDigits: dynamicDecimals,
  })}`;
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

  // Trade History State
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [customSymbolInput, setCustomSymbolInput] = useState<string>('');
  const [tradeLimit, setTradeLimit] = useState<number>(100);
  const [tradeSideFilter, setTradeSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [tradeSearch, setTradeSearch] = useState<string>('');
  const [liveSymbolData, setLiveSymbolData] = useState<{
    symbol: string;
    trades: BinancePersonalTrade[];
    summary: BinanceSymbolTradeSummary;
  } | null>(null);
  const [isLoadingSymbolTrades, setIsLoadingSymbolTrades] = useState<boolean>(false);
  const [symbolTradeError, setSymbolTradeError] = useState<string | null>(null);

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
    market: 'BVC' as StockMarketType,
    sector: 'Diversified',
    shares: '',
    avgCostPerShare: '',
    currentPrice: '',
    currency: 'MAD',
    annualDividendPerShare: '0',
    targetWeightPercent: '10',
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
  const usdToMadRate = investmentsData?.rates?.USD_TO_MAD || 10.0;

  const bankAndCashWallets = useMemo(
    () => wallets.filter((w) => w.type === 'Bank' || w.type === 'Cash'),
    [wallets]
  );
  const investmentWallets = useMemo(
    () => wallets.filter((w) => w.type === 'Investment'),
    [wallets]
  );

  // Set default wallets for capital transfer form
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

  // Set initial symbol from Binance trade summaries if available
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

  // Catalog search for manual off-exchange positions
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
    return (
      binance?.symbolSummaries?.find((s) => s.symbol === selectedSymbol) || null
    );
  }, [liveSymbolData, binance?.symbolSummaries, selectedSymbol]);

  const displayedTrades: BinancePersonalTrade[] = useMemo(() => {
    const sourceTrades =
      liveSymbolData && liveSymbolData.symbol === selectedSymbol
        ? liveSymbolData.trades
        : (binance?.recentTrades || []).filter(
            (t) => !selectedSymbol || t.symbol === selectedSymbol
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

  const filteredSpotBalances = useMemo(() => {
    const list = binance?.balances || [];
    return list.filter((b) => {
      // Wallet scope filter
      if (walletScopeFilter === 'SPOT' && (b.spotTotal ?? 0) <= 0) return false;
      if (walletScopeFilter === 'FUNDING' && (b.fundingTotal ?? 0) <= 0) return false;

      // Asset category filter
      if (spotFilter === 'STOCKS' && b.category !== 'Tokenized Stocks & Equities') return false;
      if (spotFilter === 'CRYPTO' && (b.isStablecoinOrFiat || b.category === 'Tokenized Stocks & Equities')) return false;
      if (spotFilter === 'STABLECOIN' && !b.isStablecoinOrFiat) return false;
      if (spotFilter === 'LOCKED' && b.locked <= 0) return false;

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
            message: 'Refreshed live Binance Spot balances and portfolio telemetry.',
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
      'Role',
      'PriceUSD',
      'PriceMAD',
      'Quantity',
      'QuoteTotalUSD',
      'QuoteTotalMAD',
      'Commission',
      'CommissionAsset',
    ];
    const rows = displayedTrades.map((t) => [
      t.id,
      t.orderId,
      t.executedAt,
      t.symbol,
      t.side,
      t.isMaker ? 'MAKER' : 'TAKER',
      t.price.toFixed(6),
      (t.price * usdToMadRate).toFixed(4),
      t.qty.toFixed(8),
      t.quoteQtyUsd.toFixed(4),
      t.quoteQtyMad.toFixed(2),
      t.commission.toFixed(8),
      t.commissionAsset,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `binance_trades_${selectedSymbol}_${new Date().toISOString().slice(0, 10)}.csv`;
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
            message: err?.message || 'Failed to sync wallet with Binance Spot.',
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
      const initialMad = binance?.connected ? binance.stablecoinReserveMad : 0;
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
        market: 'BVC',
        sector: 'Diversified',
        shares: '',
        avgCostPerShare: '',
        currentPrice: '',
        currency: 'MAD',
        annualDividendPerShare: '0',
        targetWeightPercent: '10',
        convictionThesis: '',
        walletId: '',
        syncWithWallet: false,
      });
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: 'Saved off-exchange position to ledger.', type: 'success' },
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
          detail: { message: 'Logged investment ledger entry.', type: 'success' },
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

  // Core KPIs
  const totalCombinedBinanceValueMad = binance?.totalCombinedValueMad ?? binance?.totalSpotValueMad ?? 0;
  const totalCombinedBinanceValueUsd = binance?.totalCombinedValueUsd ?? binance?.totalSpotValueUsd ?? 0;
  const totalSpotValueMad = binance?.totalSpotValueMad ?? 0;
  const totalSpotValueUsd = binance?.totalSpotValueUsd ?? 0;
  const totalFundingValueMad = binance?.totalFundingValueMad ?? 0;
  const totalFundingValueUsd = binance?.totalFundingValueUsd ?? 0;
  const stockEquityMad = binance?.stockEquityMad ?? 0;
  const stockEquityUsd = binance?.stockEquityUsd ?? 0;
  const cryptoEquityMad = binance?.cryptoEquityMad ?? 0;
  const stablecoinReserveMad = binance?.stablecoinReserveMad ?? 0;
  const change24hMad = binance?.change24hMad ?? 0;
  const change24hPct = binance?.change24hPercent ?? 0;

  const protectedWalletReserveMad =
    investmentsData?.buyingPower?.investmentWalletBalanceMad ?? 0;
  const totalCombinedWealthMad =
    (investmentsData?.totalPortfolioValueMad ?? 0) + protectedWalletReserveMad;
  const totalUnrealizedGainMad = investmentsData?.totalUnrealizedPnlMad ?? 0;
  const totalUnrealizedGainPct = investmentsData?.totalUnrealizedPnlPercent ?? 0;
  const totalRealizedGainMad = investmentsData?.totalRealizedPnlMad ?? 0;
  const netCapitalContributedMad = investmentsData?.netCapitalContributedMad ?? 0;

  return (
    <div className="space-y-6 pb-10">
      {/* Top Executive Header & Security Posture Bar */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Binance Spot &amp; Funding Telemetry
              </span>
              <span>·</span>
              <span>Ed25519 Server-Signed</span>
              <span>·</span>
              <span>Zero Trading / Zero Withdrawal Execution</span>
              {binance?.connected && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    1 USD ≈ {usdToMadRate.toFixed(2)} MAD
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Investments &amp; Binance Position
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
              Live read-only Binance Spot &amp; Funding balances (<code className="font-mono text-xs">/api/v3/account</code> &amp; <code className="font-mono text-xs">/sapi/v1/asset/get-funding-asset</code>) and personal trade executions integrated with TrueSpend Investment Wallets and Safe-to-Spend protection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSetupGuide((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Lock className="h-3.5 w-3.5 text-indigo-500" />
              {showSetupGuide ? 'Hide Security & Env Spec' : 'Ed25519 Security Spec'}
            </button>

            <button
              type="button"
              onClick={handleTriggerRefresh}
              disabled={isRefreshingLive || isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingLive ? 'animate-spin' : ''}`} />
              {isRefreshingLive ? 'Syncing Spot...' : 'Refresh Live Position'}
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
                  ? 'Connected to Binance Spot REST API'
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

        {/* Case 1: Credentials configured but connection failed (Diagnostic & Troubleshooting) */}
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

            {/* Step-by-Step Remediation Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs pt-1 border-t border-amber-200/70 dark:border-amber-900/50">
              <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-900/90 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
                  <Globe className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>1. IP Access Restriction</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                  Binance defaults to restricting IPs. Because Vercel serverless runs on dynamic cloud IPs, in Binance API Management set IP Access to <strong>&ldquo;Unrestricted (Less Secure)&rdquo;</strong>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-900/90 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>2. Read-Only Permission</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                  Verify <strong>&ldquo;Enable Reading&rdquo;</strong> is checked. Ensure Trading, Withdrawals, and Margin are <strong>unchecked</strong>. Setting Unrestricted IP is safe when read-only.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-900/90 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
                  <Key className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>3. Ed25519 Key Pair Match</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                  Ensure <code className="font-mono text-indigo-600 dark:text-indigo-400">BINANCE_ED25519_PRIVATE_KEY_B64</code> matches the public key uploaded to Binance. If in doubt, generate a fresh key pair.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-900/90 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white mb-1">
                  <Terminal className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                  <span>4. Base64 &amp; Vercel Region</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-[11px] leading-relaxed">
                  Encode with <code className="font-mono">base64 -w 0 private_key.pem</code>. Our <code className="font-mono">vercel.json</code> routes to Europe (<code className="font-mono">fra1</code>) to prevent US IP blocks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Case 2: Credentials NOT configured at all */}
        {!binance?.isConfigured && (
          <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/60 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Server-Side Binance Ed25519 Configuration Required
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    All Binance authentication and Ed25519 cryptographic signing run exclusively on the server (/api/investments/binance/*). Credentials are never exposed to the browser.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  1. Server Environment Variables
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  Add <code className="font-mono text-indigo-600 dark:text-indigo-400">BINANCE_API_KEY</code> and{' '}
                  <code className="font-mono text-indigo-600 dark:text-indigo-400">
                    BINANCE_ED25519_PRIVATE_KEY_B64
                  </code>{' '}
                  in your Vercel project settings or local <code className="font-mono">.env</code> file. Never use{' '}
                  <code className="font-mono">VITE_</code> prefixes.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  2. Base64 Ed25519 Private Key
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  Encode your PKCS#8 Ed25519 PEM private key as Base64:{' '}
                  <code className="font-mono text-gray-700 dark:text-gray-300">
                    base64 -w 0 private_key.pem
                  </code>
                  . The server decodes it in memory into PEM format for <code className="font-mono">crypto.sign(null, payload, key)</code>.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  3. Read-Only Permission Scope
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  Keep your Binance API key restricted to <strong>Enable Reading</strong> only. This app only queries{' '}
                  <code className="font-mono">GET /api/v3/account</code> and{' '}
                  <code className="font-mono">GET /api/v3/myTrades</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Case 3: Connected but user toggled Security Spec guide */}
        {binance?.connected && showSetupGuide && (
          <div className="mt-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/60 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Terminal className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Server-Side Ed25519 Security Architecture
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    Connected to Binance Spot with Ed25519 asymmetric cryptography. Private keys and API secrets are never transmitted over the network or exposed to client-side code.
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

            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  Zero Trading by Design
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  The backend whitelist strictly allows <code className="font-mono">/api/v3/account</code> and <code className="font-mono">/api/v3/myTrades</code>. Trading orders and withdrawal routes are not implemented.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  Private Cache Control
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  All financial telemetry responses return <code className="font-mono">Cache-Control: private, no-store</code> to prevent edge CDN or intermediary caching of your balances.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800">
                <div className="font-semibold text-gray-900 dark:text-white mb-1">
                  European Serverless Routing
                </div>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  Configured via <code className="font-mono">vercel.json</code> to execute in Frankfurt (<code className="font-mono">fra1</code>), fully compliant with Binance geographic availability.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4-Card Executive Telemetry Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Investment & Binance Position */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">Unified Investment Position</span>
            <Briefcase className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
              {formatMad(totalCombinedWealthMad, 2)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
              <span>{formatUsd(totalCombinedWealthMad / usdToMadRate)}</span>
              <span>·</span>
              <span>{(investmentsData?.positions || []).length} Active Holdings</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Net Contributed Capital</span>
            <span className="font-mono tabular-nums font-medium text-gray-800 dark:text-gray-200">
              {formatMad(netCapitalContributedMad, 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Live Binance Position Value & 24h Change */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">Binance Live Position</span>
            <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              {binance?.connected ? `${binance.balances.length} Assets` : 'Offline'}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
              {formatMad(totalCombinedBinanceValueMad, 2)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono tabular-nums">
              <span className="text-gray-500 dark:text-gray-400">{formatUsd(totalCombinedBinanceValueUsd)}</span>
              <span>·</span>
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  change24hMad >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {change24hMad >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {change24hPct >= 0 ? '+' : ''}
                {change24hPct.toFixed(2)}% (24h)
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center justify-between gap-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Spot: {formatMad(totalSpotValueMad, 0)}</span>
            <span>·</span>
            <span>Funding (Stocks): {formatMad(totalFundingValueMad, 0)}</span>
          </div>
        </div>

        {/* Card 3: TrueSpend Wallet Reserve & Safe-to-Spend Protection */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">Protected Wallet Reserve</span>
            <WalletIcon className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
              {formatMad(protectedWalletReserveMad, 2)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Shielded from Daily Safe-to-Spend</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Liquid Safe-to-Spend</span>
            <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
              {formatMad(kpis?.safeToSpend ?? investmentsData?.buyingPower?.safeToSpendMad ?? 0, 0)}
            </span>
          </div>
        </div>

        {/* Card 4: Unrealized & Realized P&L */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold uppercase tracking-wider">Unrealized &amp; Realized P&amp;L</span>
            <History className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                totalUnrealizedGainMad >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totalUnrealizedGainMad >= 0 ? '+' : ''}
              {formatMad(totalUnrealizedGainMad, 2)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
              <span>
                Return: {totalUnrealizedGainPct >= 0 ? '+' : ''}
                {totalUnrealizedGainPct.toFixed(2)}%
              </span>
              <span>·</span>
              <span>WAC Cost Basis</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Realized Trade P&amp;L</span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                totalRealizedGainMad >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totalRealizedGainMad >= 0 ? '+' : ''}
              {formatMad(totalRealizedGainMad, 2)}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
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
            onClick={() => setActiveSubView('trades')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeSubView === 'trades'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Personal Trade History (/api/v3/myTrades)
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
            Wallet Sync &amp; Capital Flows ({investmentsData?.investmentWallets?.length || 0})
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
            Off-Exchange &amp; BVC Ledger ({manualPositions.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('wallets')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 transition-colors"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Sync or Log Capital Flow
          </button>
        </div>
      </div>

      {/* ===================================================================
          VIEW 1: BINANCE SPOT & FUNDING HOLDINGS (STOCKS & CRYPTO)
         =================================================================== */}
      {activeSubView === 'spot' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Binance Live Holdings (Spot &amp; Funding Wallets)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Non-zero Spot &amp; Funding Wallet balances (including tokenized stocks and fiat reserves) with live valuation and Weighted Average Cost (WAC).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Wallet Scope: All / Spot / Funding */}
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-xs">
                  {(['ALL', 'SPOT', 'FUNDING'] as WalletScopeFilterType[]).map((scope) => (
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
                        ? 'Spot Wallet'
                        : 'Funding Wallet (Stocks)'}
                    </button>
                  ))}
                </div>

                {/* Asset Class Filter */}
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
                        ? 'All Classes'
                        : f === 'STOCKS'
                        ? 'Stocks'
                        : f === 'CRYPTO'
                        ? 'Crypto'
                        : f === 'STABLECOIN'
                        ? 'Stablecoins'
                        : 'Locked / Earn'}
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
                    ? 'No non-zero Spot balances match the active filter.'
                    : 'Binance Spot account is not connected yet.'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  {binance?.connected
                    ? 'Try switching the asset filter to "All Assets" or clearing your search query.'
                    : 'Configure BINANCE_API_KEY and BINANCE_ED25519_PRIVATE_KEY_B64 in your server environment variables, then click "Refresh Live Position".'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Asset</th>
                      <th className="py-3 px-3 text-right">Total / Free / Locked</th>
                      <th className="py-3 px-3 text-right">Spot Price</th>
                      <th className="py-3 px-3 text-right">24h Change</th>
                      <th className="py-3 px-3 text-right">Avg Buy Price (WAC)</th>
                      <th className="py-3 px-3 text-right">Market Value</th>
                      <th className="py-3 px-3 text-right">Unrealized P&amp;L</th>
                      <th className="py-3 px-3 text-right">Weight</th>
                      <th className="py-3 pl-3 pr-4 text-right">Trades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs">
                    {filteredSpotBalances.map((b) => {
                      const hasCostBasis =
                        !b.isStablecoinOrFiat &&
                        b.avgBuyPriceUsd !== null &&
                        b.unrealizedPnlMad !== null;
                      const pnlMad = b.unrealizedPnlMad ?? 0;
                      const pnlPct = b.unrealizedPnlPercent ?? 0;

                      return (
                        <tr
                          key={b.asset}
                          className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
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
                                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    }`}
                                  >
                                    {b.walletType === 'FUNDING'
                                      ? 'Funding'
                                      : b.walletType === 'BOTH'
                                      ? 'Spot + Fund'
                                      : 'Spot'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 flex-wrap">
                                  <span>{b.category}</span>
                                  {(b.spotTotal ?? 0) > 0 && (b.fundingTotal ?? 0) > 0 && (
                                    <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                                      (Spot: {formatQty(b.spotTotal)} · Fund: {formatQty(b.fundingTotal)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {formatQty(b.total)} {b.asset}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              Free: {formatQty(b.free)}
                              {b.locked > 0 ? ` · Locked: ${formatQty(b.locked)}` : ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {formatUsd(b.priceUsd)}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatMad(b.priceMad, 2)}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {b.isStablecoinOrFiat ? (
                              <span className="text-gray-400">0.00%</span>
                            ) : (
                              <span
                                className={`font-semibold ${
                                  b.change24hPercent >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {b.change24hPercent >= 0 ? '+' : ''}
                                {b.change24hPercent.toFixed(2)}%
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {b.isStablecoinOrFiat ? (
                              <span className="text-gray-400">1.00 USD Peg</span>
                            ) : hasCostBasis ? (
                              <div>
                                <div className="text-gray-900 dark:text-white font-medium">
                                  {formatUsd(b.avgBuyPriceUsd)}
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                  Basis: {formatMad(b.costBasisMad, 0)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[11px]">Deposit / Pre-Trade</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="font-bold text-gray-900 dark:text-white">
                              {formatMad(b.valueMad, 2)}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatUsd(b.valueUsd)}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            {b.isStablecoinOrFiat ? (
                              <span className="text-gray-400">—</span>
                            ) : hasCostBasis ? (
                              <div>
                                <div
                                  className={`font-semibold ${
                                    pnlMad >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {pnlMad >= 0 ? '+' : ''}
                                  {formatMad(pnlMad, 2)}
                                </div>
                                <div
                                  className={`text-[11px] ${
                                    pnlPct >= 0
                                      ? 'text-emerald-600/80 dark:text-emerald-400/80'
                                      : 'text-rose-600/80 dark:text-rose-400/80'
                                  }`}
                                >
                                  {pnlPct >= 0 ? '+' : ''}
                                  {pnlPct.toFixed(2)}%
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {b.portfolioWeightPercent.toFixed(1)}%
                            </div>
                            <div className="w-16 ml-auto mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(2, b.portfolioWeightPercent))}%`,
                                }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 pl-3 pr-4 text-right">
                            {!b.isStablecoinOrFiat && b.defaultSymbol ? (
                              <button
                                type="button"
                                onClick={() => handleInspectAssetTrades(b)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                              >
                                <span>History</span>
                                <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400">Reserve</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Portfolio Allocation Breakdown & TrueSpend Safe-to-Spend Reconciliation */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sector / Asset Category Breakdown */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Asset Class &amp; Sector Allocation
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Distribution across Binance Spot crypto layers, stablecoin reserves, and local equities.
                  </p>
                </div>
                <Layers className="h-4 w-4 text-gray-400" />
              </div>

              <div className="space-y-3">
                {(investmentsData?.sectorBreakdown || []).length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 py-4">
                    No active asset allocations yet.
                  </p>
                ) : (
                  (investmentsData?.sectorBreakdown || []).map((item) => (
                    <div key={item.sector} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {item.sector}
                        </span>
                        <span className="font-mono tabular-nums text-gray-900 dark:text-white font-semibold">
                          {formatMad(item.valueMad, 0)} · {item.weightPercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(2, item.weightPercent))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TrueSpend Financial Engine & Wallet Integration Summary */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    TrueSpend Wallet &amp; Safe-to-Spend Integration
                  </h3>
                  <WalletIcon className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  How your Binance Spot position interacts with your daily spending power and Net Worth.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    1. Binance Spot Stablecoin Cash (USDT / USDC / FDUSD)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                    {formatMad(stablecoinReserveMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    2. Binance Spot Crypto Equity (Live Market Value)
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                    {formatMad(cryptoEquityMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-600 dark:text-gray-400">
                    3. TrueSpend Protected Investment Wallet Reserve
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                    {formatMad(protectedWalletReserveMad, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-900 dark:text-white font-semibold">
                    Deduplicated Net Portfolio Addition to Net Worth
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatMad(investmentsData?.totalPortfolioValueMad ?? 0, 2)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => handleSyncWalletAction('stablecoins_only')}
                  disabled={!binance?.connected || isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync Stablecoin Reserve to Wallet
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubView('wallets')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Manage Wallets &amp; Capital Flows →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          VIEW 2: PERSONAL TRADE HISTORY (/api/v3/myTrades)
         =================================================================== */}
      {activeSubView === 'trades' && (
        <div className="space-y-6">
          {/* Symbol Selector & Query Controls */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Binance Personal Trade Execution History (<code className="font-mono text-xs">GET /api/v3/myTrades</code>)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Signed server-side with Ed25519. Select any Spot trading pair to inspect your historical fills, WAC buy price, realized P&amp;L, and trading commissions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customSymbolInput}
                    onChange={(e) => setCustomSymbolInput(e.target.value.toUpperCase())}
                    placeholder="Custom Pair (e.g. FETUSDT)"
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

          {/* Per-Symbol Trade Performance Summary */}
          {activeSymbolSummary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">
                  {activeSymbolSummary.symbol} Buy Volume &amp; WAC
                </div>
                <div className="mt-2 text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  {formatQty(activeSymbolSummary.totalBoughtQty)} {activeSymbolSummary.baseAsset}
                </div>
                <div className="mt-1 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  Avg Buy: {formatUsd(activeSymbolSummary.avgBuyPriceUsd)} · Total:{' '}
                  {formatUsd(activeSymbolSummary.totalBuyVolumeUsd)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">
                  {activeSymbolSummary.symbol} Sell Volume &amp; Avg Exit
                </div>
                <div className="mt-2 text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  {formatQty(activeSymbolSummary.totalSoldQty)} {activeSymbolSummary.baseAsset}
                </div>
                <div className="mt-1 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  Avg Sell: {formatUsd(activeSymbolSummary.avgSellPriceUsd)} · Total:{' '}
                  {formatUsd(activeSymbolSummary.totalSellVolumeUsd)}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">
                  Realized P&amp;L ({activeSymbolSummary.symbol})
                </div>
                <div
                  className={`mt-2 text-lg font-bold font-mono tabular-nums ${
                    activeSymbolSummary.realizedPnlMad >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {activeSymbolSummary.realizedPnlMad >= 0 ? '+' : ''}
                  {formatMad(activeSymbolSummary.realizedPnlMad, 2)}
                </div>
                <div className="mt-1 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {activeSymbolSummary.realizedPnlUsd >= 0 ? '+' : ''}
                  {formatUsd(activeSymbolSummary.realizedPnlUsd)} ({activeSymbolSummary.tradeCount} fills)
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase">
                  Net Accumulated &amp; Fees
                </div>
                <div className="mt-2 text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  {formatQty(activeSymbolSummary.netAccumulatedQty)} {activeSymbolSummary.baseAsset}
                </div>
                <div className="mt-1 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  Commissions: {formatUsd(activeSymbolSummary.totalFeesUsd)}
                </div>
              </div>
            </div>
          )}

          {/* Personal Trade Execution Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Executed Fills ({displayedTrades.length})
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
                  Export CSV
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
                  Select another pair above or enter a custom symbol (e.g., ETHUSDT, BNBUSDT, SOLUSDT) and click &ldquo;Query Pair&rdquo;.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Date / Time</th>
                      <th className="py-3 px-3">Pair</th>
                      <th className="py-3 px-3">Side &amp; Role</th>
                      <th className="py-3 px-3 text-right">Fill Price</th>
                      <th className="py-3 px-3 text-right">Executed Qty</th>
                      <th className="py-3 px-3 text-right">Quote Total</th>
                      <th className="py-3 px-3 text-right">Fee</th>
                      <th className="py-3 pl-3 pr-4 text-right">Order ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs font-mono tabular-nums">
                    {displayedTrades.map((trade) => (
                      <tr
                        key={`${trade.symbol}-${trade.id}`}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="py-3 pl-4 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          <div>{new Date(trade.time).toLocaleDateString()}</div>
                          <div className="text-[11px] text-gray-400">
                            {new Date(trade.time).toLocaleTimeString()}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">
                          {trade.symbol}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              trade.side === 'BUY'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {trade.side}
                          </span>
                          <span className="ml-1.5 text-[11px] text-gray-400">
                            · {trade.isMaker ? 'Maker' : 'Taker'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="text-gray-900 dark:text-white font-medium">
                            {formatUsd(trade.price)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {formatMad(trade.price * usdToMadRate, 2)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatQty(trade.qty)} {trade.baseAsset}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {formatMad(trade.quoteQtyMad, 2)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {formatUsd(trade.quoteQtyUsd)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">
                          {formatQty(trade.commission)} {trade.commissionAsset}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right text-gray-400">
                          #{trade.orderId}
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

      {/* ===================================================================
          VIEW 3: TRUESPEND WALLET SYNC & CAPITAL FLOWS
         =================================================================== */}
      {activeSubView === 'wallets' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 7 Cols: Investment Wallets & Binance Synchronization */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      TrueSpend Investment Wallets &amp; Binance Sync
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Wallets with type <code className="font-mono">Investment</code> are automatically deducted from daily <code className="font-mono">Safe to Spend</code> so your trading and investment capital stays protected.
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

                {(investmentsData?.investmentWallets || []).length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      No <code className="font-mono">Investment</code> wallet exists yet. Click below to auto-create and link a <strong>Binance Spot</strong> wallet.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSyncWalletAction('stablecoins_only')}
                        disabled={isSaving}
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                      >
                        Auto-Create &amp; Sync Binance Spot Wallet
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(investmentsData?.investmentWallets || []).map((w) => (
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
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                Linked to Binance Spot
                              </span>
                            )}
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <span className="text-xs text-gray-500 mr-1.5">Recorded Wallet Reserve:</span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {formatMad(w.uninvestedCashMad, 2)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-800/70 text-xs font-mono tabular-nums">
                          <div>
                            <div className="text-[11px] font-sans text-gray-400">
                              Binance Stablecoins
                            </div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">
                              {formatMad(w.binanceStablecoinCashMad ?? 0, 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-gray-400">
                              Binance Crypto Equity
                            </div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">
                              {formatMad(w.binanceSpotCryptoMad ?? 0, 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-gray-400">
                              Local Equity Holdings
                            </div>
                            <div className="font-semibold text-gray-800 dark:text-gray-200">
                              {formatMad(w.loggedPositionsValueMad ?? 0, 0)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-sans text-gray-400">
                              Net Capital Deposited
                            </div>
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {formatMad(w.netCapitalDepositedMad ?? 0, 0)}
                            </div>
                          </div>
                        </div>

                        {w.isBinanceLinked && (
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => handleSyncWalletAction('stablecoins_only', w.walletId)}
                              disabled={!binance?.connected || isSaving}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Sync Stablecoin Cash ({formatMad(stablecoinReserveMad, 0)})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSyncWalletAction('full_spot_balance', w.walletId)}
                              disabled={!binance?.connected || isSaving}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                            >
                              Sync Full Spot Balance ({formatMad(totalSpotValueMad, 0)})
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                    Record money moved from your Bank/Cash wallet into Binance or a brokerage account (or withdrawn back to your bank). Local ledger only — never initiates bank or Binance transfers.
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
                        ? 'Source Bank / Cash Wallet (Reduces Safe-to-Spend)'
                        : 'Destination Bank / Cash Wallet (Restores Safe-to-Spend)'}
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
                      {transferDirection === 'deposit'
                        ? 'Destination Investment Wallet (e.g. Binance Spot)'
                        : 'Source Investment Wallet'}
                    </label>
                    <select
                      value={selectedInvWalletId}
                      onChange={(e) => setSelectedInvWalletId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                    >
                      {investmentWallets.length === 0 ? (
                        <option value="">Auto-create &ldquo;Binance Spot&rdquo; Wallet</option>
                      ) : (
                        investmentWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} — {formatMad(w.balance, 2)}
                          </option>
                        ))
                      )}
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
                      placeholder="e.g. 2500"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Memo / Reference (Optional)
                    </label>
                    <input
                      type="text"
                      value={transferNotes}
                      onChange={(e) => setTransferNotes(e.target.value)}
                      placeholder={
                        transferDirection === 'deposit'
                          ? 'e.g. Monthly P2P USDT funding for Binance Spot'
                          : 'e.g. Realized profit withdrawal to CIH Bank'
                      }
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
                    ? 'Record Investment Deposit & Update Wallets'
                    : 'Record Bank Withdrawal & Restore Safe-to-Spend'}
                </button>
              </form>
            </div>
          </div>

          {/* Capital Flow History Table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Investment Capital Flows &amp; Wallet Ledger History
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Every capital transfer, investment funding transaction, and dividend recorded in TrueSpend.
                </p>
              </div>
              {setActiveTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Open Full Transactions Ledger →
                </button>
              )}
            </div>

            {(investmentsData?.walletCapitalFlows || []).length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No capital flow transactions recorded yet. Use the form above to log deposits or withdrawals between your Bank and Investment wallets.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Date</th>
                      <th className="py-3 px-3">Flow Type</th>
                      <th className="py-3 px-3">Wallets</th>
                      <th className="py-3 px-3">Description</th>
                      <th className="py-3 pl-3 pr-4 text-right">Amount (MAD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70 text-xs">
                    {(investmentsData?.walletCapitalFlows || []).map((flow) => (
                      <tr key={flow.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                        <td className="py-3 pl-4 pr-3 font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          {new Date(flow.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                              flow.direction === 'DEPOSIT_TO_INVESTMENT'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                : flow.direction === 'WITHDRAWAL_TO_BANK' ||
                                  flow.direction === 'DIVIDEND_OR_YIELD'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {flow.direction.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                          {flow.destinationWalletName
                            ? `${flow.sourceWalletName} → ${flow.destinationWalletName}`
                            : flow.sourceWalletName}
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                          {flow.notes}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right font-mono tabular-nums font-bold text-gray-900 dark:text-white">
                          {formatMad(flow.amountMad, 2)}
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

      {/* ===================================================================
          VIEW 4: OFF-EXCHANGE & EQUITY LEDGER (BVC / US ETFs / MANUAL)
         =================================================================== */}
      {activeSubView === 'ledger' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Off-Exchange &amp; Equity Holdings Ledger (Casablanca BVC, ETFs, Cold Storage)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Track positions held outside Binance alongside your live Binance Spot portfolio.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogOrderOpen((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Log Ledger Order / Dividend
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddPositionOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Off-Exchange Holding
                </button>
              </div>
            </div>

            {/* Collapsible Add Position Form */}
            {isAddPositionOpen && (
              <form
                onSubmit={handleSaveManualPosition}
                className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">
                    Add or Update Off-Exchange Position
                  </span>
                  <input
                    type="text"
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                    placeholder="Quick-fill BVC / Global ticker (ATW, IAM, VOO...)"
                    className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 w-64"
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
                        {item.currency})
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
                      placeholder="ATW"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-gray-500 mb-1">Asset / Company Name</label>
                    <input
                      type="text"
                      value={posForm.companyName}
                      onChange={(e) => setPosForm({ ...posForm, companyName: e.target.value })}
                      placeholder="Attijariwafa Bank"
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
                      <option value="BVC">BVC (Morocco)</option>
                      <option value="ETF">Global ETF</option>
                      <option value="US">US Equity</option>
                      <option value="GLOBAL">Global Equity</option>
                      <option value="CRYPTO">Cold Crypto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Quantity / Shares</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={posForm.shares}
                      onChange={(e) => setPosForm({ ...posForm, shares: e.target.value })}
                      placeholder="10"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Avg Buy Price</label>
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
                      placeholder="520"
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
                    Save Holding
                  </button>
                </div>
              </form>
            )}

            {/* Collapsible Log Order Form */}
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

            {manualPositions.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No off-exchange holdings logged yet. Your live Binance Spot holdings are displayed in the &ldquo;Binance Spot Holdings&rdquo; tab.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/50 dark:bg-gray-950/40">
                      <th className="py-3 pl-4 pr-3">Ticker</th>
                      <th className="py-3 px-3">Market / Sector</th>
                      <th className="py-3 px-3 text-right">Shares</th>
                      <th className="py-3 px-3 text-right">Avg Cost</th>
                      <th className="py-3 px-3 text-right">Current Price</th>
                      <th className="py-3 px-3 text-right">Market Value (MAD)</th>
                      <th className="py-3 px-3 text-right">Unrealized P&amp;L</th>
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
                          {pos.avgCostNum.toFixed(2)} {pos.currency}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {pos.currentPriceNum.toFixed(2)} {pos.currency}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">
                          {formatMad(pos.marketValueMad, 2)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-semibold ${
                            pos.unrealizedPnlMad >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {pos.unrealizedPnlMad >= 0 ? '+' : ''}
                          {formatMad(pos.unrealizedPnlMad, 2)} ({pos.unrealizedPnlPercent.toFixed(1)}%)
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
