import React, { useState, useMemo } from 'react';
import {
  InvestmentsData,
  StockPosition,
  StockCatalogItem,
  StockMarketType,
  StockOrderAction,
  Wallet,
  DashboardTab,
} from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  WalletCards,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  Sliders,
  Check,
  Trash2,
  Edit3,
  Eye,
  X,
  RefreshCw,
  Landmark,
  Calculator,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

interface InvestmentsTabProps {
  investmentsData: InvestmentsData | null;
  wallets: Wallet[];
  isSaving: boolean;
  setActiveTab: (tab: DashboardTab) => void;
  onRefresh: () => Promise<void> | void;
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
  onUpdatePosition: (
    id: string,
    payload: {
      companyName?: string;
      market?: StockMarketType;
      sector?: string;
      shares?: number;
      avgCostPerShare?: number;
      currentPrice?: number;
      currency?: string;
      annualDividendPerShare?: number;
      targetWeightPercent?: number;
      convictionThesis?: string | null;
      walletId?: string | null;
      isWatchlistOnly?: boolean;
    }
  ) => Promise<any>;
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
  onExecutePaydayAllocation: (payload: {
    walletId?: string | null;
    syncWithWallet?: boolean;
    allocations: { positionId: string; amountMad: number }[];
  }) => Promise<any>;
  onFundInvestmentWallet?: (payload: {
    sourceWalletId?: string;
    destinationWalletId?: string;
    amountMad: number;
    notes?: string;
  }) => Promise<any>;
  onCreateWallet?: (payload: {
    name: string;
    type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
    isMain?: boolean;
    initialBalance?: number;
  }) => Promise<any>;
  onSearchStocks: (q: string) => Promise<StockCatalogItem[]>;
}

const ALLOCATION_COLORS = [
  'bg-indigo-600',
  'bg-emerald-600',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-slate-500',
];

export const InvestmentsTab: React.FC<InvestmentsTabProps> = ({
  investmentsData,
  wallets,
  isSaving,
  setActiveTab,
  onRefresh,
  onUpsertPosition,
  onUpdatePosition,
  onDeletePosition,
  onExecuteOrder,
  onDeleteOrder,
  onExecutePaydayAllocation,
  onFundInvestmentWallet,
  onCreateWallet,
  onSearchStocks,
}) => {
  const [activeView, setActiveView] = useState<'portfolio' | 'discover' | 'payday'>('portfolio');
  const [marketFilter, setMarketFilter] = useState<'ALL' | 'US' | 'ETF' | 'BVC'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState<StockCatalogItem[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Add / Edit Position Modal State
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<StockPosition | null>(null);
  const [posTicker, setPosTicker] = useState('');
  const [posCompanyName, setPosCompanyName] = useState('');
  const [posMarket, setPosMarket] = useState<StockMarketType>('US');
  const [posSector, setPosSector] = useState('Technology');
  const [posCurrency, setPosCurrency] = useState<'USD' | 'MAD' | 'EUR'>('USD');
  const [posShares, setPosShares] = useState('');
  const [posAvgCost, setPosAvgCost] = useState('');
  const [posDividendPerShare, setPosDividendPerShare] = useState('');
  const [posTargetWeight, setPosTargetWeight] = useState('15');
  const [posThesis, setPosThesis] = useState('');
  const [posIsWatchlist, setPosIsWatchlist] = useState(false);
  const [posWalletId, setPosWalletId] = useState<string>('');
  const [posSyncWallet, setPosSyncWallet] = useState(true);
  const [modalError, setModalError] = useState('');

  // Quick Order Modal State (BUY / SELL / DIVIDEND)
  const [orderTarget, setOrderTarget] = useState<StockPosition | null>(null);
  const [orderAction, setOrderAction] = useState<StockOrderAction>('BUY');
  const [orderShares, setOrderShares] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderTotalNative, setOrderTotalNative] = useState('');
  const [orderWalletId, setOrderWalletId] = useState<string>('');
  const [orderSyncWallet, setOrderSyncWallet] = useState(true);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderError, setOrderError] = useState('');

  // Brokerage Wallet Funding Modal State
  const [showFundWalletModal, setShowFundWalletModal] = useState(false);
  const [fundSourceWalletId, setFundSourceWalletId] = useState<string>('');
  const [fundDestWalletId, setFundDestWalletId] = useState<string>('');
  const [fundAmountMad, setFundAmountMad] = useState<string>('');
  const [fundNotes, setFundNotes] = useState<string>('');
  const [fundError, setFundError] = useState<string>('');

  // Payday Stock Splitter State
  const investmentWalletsList = useMemo(
    () => wallets.filter((w) => w.type === 'Investment'),
    [wallets]
  );
  const fundingSourceWallets = useMemo(
    () => wallets.filter((w) => w.type !== 'Investment'),
    [wallets]
  );
  const defaultWallet = useMemo(
    () =>
      wallets.find((w) => w.type === 'Investment') ||
      wallets.find((w) => w.type === 'Bank' && w.isMain) ||
      wallets[0],
    [wallets]
  );

  const [paydayBudgetMad, setPaydayBudgetMad] = useState<string>('');
  const [paydaySplitMode, setPaydaySplitMode] = useState<'target' | 'equal'>('target');
  const [paydayWalletId, setPaydayWalletId] = useState<string>('');
  const [paydaySyncWallet, setPaydaySyncWallet] = useState<boolean>(true);
  const [paydaySuccessMsg, setPaydaySuccessMsg] = useState<string>('');

  const positions = investmentsData?.positions || [];
  const watchlistPositions = investmentsData?.watchlistPositions || [];
  const orders = investmentsData?.orders || [];
  const catalog = investmentsData?.catalog || [];
  const rates = investmentsData?.rates || { USD_TO_MAD: 9.95, EUR_TO_MAD: 10.82, USD_TO_EUR: 0.92 };
  const buyingPower = investmentsData?.buyingPower || {
    safeToSpendMad: 0,
    investmentWalletBalanceMad: 0,
    monthlyIncomeMad: 0,
    monthlyInvestmentBudgetMad: 0,
    investedThisCycleMad: 0,
    remainingInvestmentBudgetMad: 0,
    deployableSurplusMad: 0,
    deployableSurplusUsd: 0,
    emergencyBufferIntact: true,
    emergencyDeficitMad: 0,
    daysUntilPayday: 0,
    guidanceText: 'Add your first stock position to start tracking equity returns and buying power.',
  };

  const effectivePaydayAmountMad = useMemo(() => {
    const parsed = parseFloat(paydayBudgetMad);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    if (buyingPower.deployableSurplusMad > 0) return Math.round(buyingPower.deployableSurplusMad);
    return 2500;
  }, [paydayBudgetMad, buyingPower.deployableSurplusMad]);

  const toMad = (amount: number, currency: string) => {
    const c = (currency || 'USD').toUpperCase();
    if (c === 'MAD') return amount;
    if (c === 'EUR') return amount * rates.EUR_TO_MAD;
    return amount * rates.USD_TO_MAD;
  };

  // FilteredPositions
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      if (marketFilter !== 'ALL' && p.market !== marketFilter) return false;
      return true;
    });
  }, [positions, marketFilter]);

  // Discover catalog filtering
  const displayedCatalog = useMemo(() => {
    const baseList = remoteSearchResults !== null ? remoteSearchResults : catalog;
    return baseList.filter((item) => {
      if (marketFilter !== 'ALL' && item.market !== marketFilter) return false;
      if (searchQuery.trim() && remoteSearchResults === null) {
        const q = searchQuery.toUpperCase();
        return (
          item.ticker.toUpperCase().includes(q) ||
          item.companyName.toUpperCase().includes(q) ||
          item.sector.toUpperCase().includes(q)
        );
      }
      return true;
    });
  }, [catalog, remoteSearchResults, marketFilter, searchQuery]);

  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setRemoteSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await onSearchStocks(q);
      setRemoteSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  // Open Position Modal (New or Prefilled from Catalog or Edit)
  const openAddPositionModal = (prefill?: Partial<StockCatalogItem>, watchlistOnly = false) => {
    setEditingPosition(null);
    setModalError('');
    setPosTicker(prefill?.ticker || '');
    setPosCompanyName(prefill?.companyName || '');
    setPosMarket(prefill?.market || 'US');
    setPosSector(prefill?.sector || 'Technology');
    setPosCurrency(prefill?.currency || (prefill?.market === 'BVC' ? 'MAD' : 'USD'));
    setPosAvgCost(prefill?.price ? String(prefill.price) : '');
    setPosDividendPerShare(
      prefill?.annualDividendPerShare ? String(prefill.annualDividendPerShare) : '0'
    );
    setPosTargetWeight('15');
    setPosThesis(prefill?.thesis || '');
    setPosIsWatchlist(watchlistOnly);
    setPosShares(watchlistOnly ? '0' : '1');
    setPosWalletId(defaultWallet?.id || '');
    setPosSyncWallet(!watchlistOnly);
    setShowPositionModal(true);
  };

  const openEditPositionModal = (pos: StockPosition) => {
    setEditingPosition(pos);
    setModalError('');
    setPosTicker(pos.ticker);
    setPosCompanyName(pos.companyName);
    setPosMarket(pos.market);
    setPosSector(pos.sector);
    setPosCurrency((pos.currency as any) || 'USD');
    setPosShares(String(pos.sharesNum));
    setPosAvgCost(String(pos.avgCostNum));
    setPosDividendPerShare(String(pos.annualDividendPerShare || '0'));
    setPosTargetWeight(String(pos.targetWeightPercent || '10'));
    setPosThesis(pos.convictionThesis || '');
    setPosIsWatchlist(pos.isWatchlistOnly);
    setPosWalletId(pos.walletId || defaultWallet?.id || '');
    setPosSyncWallet(false);
    setShowPositionModal(true);
  };

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    try {
      if (editingPosition) {
        await onUpdatePosition(editingPosition.id, {
          companyName: posCompanyName,
          market: posMarket,
          sector: posSector,
          shares: posIsWatchlist ? 0 : parseFloat(posShares || '0'),
          avgCostPerShare: parseFloat(posAvgCost || '0'),
          currency: posCurrency,
          annualDividendPerShare: parseFloat(posDividendPerShare || '0'),
          targetWeightPercent: parseFloat(posTargetWeight || '0'),
          convictionThesis: posThesis || null,
          walletId: posWalletId || null,
          isWatchlistOnly: posIsWatchlist,
        });
      } else {
        await onUpsertPosition({
          ticker: posTicker,
          companyName: posCompanyName,
          market: posMarket,
          sector: posSector,
          shares: posIsWatchlist ? 0 : parseFloat(posShares || '0'),
          avgCostPerShare: parseFloat(posAvgCost || '0'),
          currency: posCurrency,
          annualDividendPerShare: parseFloat(posDividendPerShare || '0'),
          targetWeightPercent: parseFloat(posTargetWeight || '0'),
          convictionThesis: posThesis,
          isWatchlistOnly: posIsWatchlist,
          walletId: posWalletId || null,
          syncWithWallet: posSyncWallet && !posIsWatchlist && Boolean(posWalletId),
        });
      }
      setShowPositionModal(false);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to save stock position.');
    }
  };

  // Open Quick Order Modal (BUY / SELL / DIVIDEND)
  const openOrderModal = (pos: StockPosition, action: StockOrderAction) => {
    setOrderTarget(pos);
    setOrderAction(action);
    setOrderError('');
    setOrderWalletId(pos.walletId || defaultWallet?.id || '');
    setOrderSyncWallet(true);

    if (action === 'BUY') {
      setOrderShares('1');
      setOrderPrice(String(pos.currentPriceNum || pos.avgCostNum || 100));
      setOrderTotalNative(String(pos.currentPriceNum || pos.avgCostNum || 100));
      setOrderNotes('');
    } else if (action === 'SELL') {
      const defaultSellShares = pos.sharesNum >= 1 ? '1' : String(pos.sharesNum);
      setOrderShares(defaultSellShares);
      setOrderPrice(String(pos.currentPriceNum || pos.avgCostNum));
      setOrderTotalNative(
        String(
          Math.round(parseFloat(defaultSellShares) * (pos.currentPriceNum || pos.avgCostNum) * 100) /
            100
        )
      );
      setOrderNotes('');
    } else {
      // DIVIDEND
      const divPerShare = parseFloat(pos.annualDividendPerShare || '0') || 0;
      const suggestedQuarterly =
        divPerShare > 0 && pos.sharesNum > 0
          ? Math.round(((pos.sharesNum * divPerShare) / 4) * 100) / 100
          : 25;
      setOrderShares(String(pos.sharesNum));
      setOrderPrice(String(divPerShare > 0 ? Math.round((divPerShare / 4) * 100) / 100 : 0));
      setOrderTotalNative(String(suggestedQuarterly));
      setOrderNotes(`Dividend payout from ${pos.ticker}`);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderTarget) return;
    setOrderError('');

    try {
      const shares = parseFloat(orderShares || '0');
      const pricePerShare = parseFloat(orderPrice || '0');
      const totalNative =
        orderAction === 'DIVIDEND'
          ? parseFloat(orderTotalNative || '0')
          : shares * pricePerShare;

      await onExecuteOrder({
        positionId: orderTarget.id,
        action: orderAction,
        shares,
        pricePerShare,
        totalNativeAmount: totalNative,
        walletId: orderWalletId || null,
        syncWithWallet: orderSyncWallet && Boolean(orderWalletId),
        notes: orderNotes || undefined,
      });
      setOrderTarget(null);
    } catch (err: any) {
      setOrderError(err?.message || 'Order execution failed.');
    }
  };

  // Compute Payday Splitter rows
  const paydayPlanRows = useMemo(() => {
    if (positions.length === 0) return [];
    const totalTargetWeight = positions.reduce(
      (s, p) => s + (parseFloat(p.targetWeightPercent || '0') || 0),
      0
    );

    return positions.map((pos) => {
      let weightRatio = 1 / positions.length;
      if (paydaySplitMode === 'target' && totalTargetWeight > 0) {
        const targetW = parseFloat(pos.targetWeightPercent || '0') || 0;
        weightRatio = targetW / totalTargetWeight;
      }

      const allocatedMad = Math.round(effectivePaydayAmountMad * weightRatio * 100) / 100;
      const oneShareMad = toMad(pos.currentPriceNum || 1, pos.currency);
      const estimatedShares = oneShareMad > 0 ? allocatedMad / oneShareMad : 0;

      return {
        position: pos,
        weightPercent: Math.round(weightRatio * 1000) / 10,
        allocatedMad,
        estimatedShares: Math.round(estimatedShares * 1000) / 1000,
      };
    });
  }, [positions, paydaySplitMode, effectivePaydayAmountMad, rates]);

  const handleRunPaydayAllocation = async () => {
    if (paydayPlanRows.length === 0) return;
    setPaydaySuccessMsg('');
    const targetWallet = paydayWalletId || defaultWallet?.id || null;
    await onExecutePaydayAllocation({
      walletId: targetWallet,
      syncWithWallet: paydaySyncWallet && Boolean(targetWallet),
      allocations: paydayPlanRows
        .filter((r) => r.allocatedMad > 0)
        .map((r) => ({
          positionId: r.position.id,
          amountMad: r.allocatedMad,
        })),
    });
    setPaydaySuccessMsg(
      `Allocated ${effectivePaydayAmountMad.toLocaleString()} MAD across ${paydayPlanRows.length} stocks${
        paydaySyncWallet && targetWallet ? ' and synced with your TrueSpend wallet ledger' : ''
      }.`
    );
  };

  const totalValueMad = investmentsData?.totalPortfolioValueMad || 0;
  const totalValueUsd = investmentsData?.totalPortfolioValueUsd || 0;
  const totalPnlMad = investmentsData?.totalUnrealizedPnlMad || 0;
  const totalPnlPercent = investmentsData?.totalUnrealizedPnlPercent || 0;
  const annualDividendMad = investmentsData?.annualPassiveIncomeMad || 0;
  const monthlyDividendMad = investmentsData?.monthlyPassiveIncomeMad || 0;
  const portfolioYield = investmentsData?.portfolioYieldPercent || 0;
  const subCoverage = investmentsData?.subscriptionCoveragePercent || 0;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Segmented View Switcher ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Equities &amp; Stock Portfolio
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            US Equities · Index ETFs · Casablanca BVC · Synchronized with TrueSpend Wallets &amp; Cash Flow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            <button
              type="button"
              onClick={() => setActiveView('portfolio')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'portfolio'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Portfolio ({positions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('discover')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'discover'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Stock Radar &amp; Market
            </button>
            <button
              type="button"
              onClick={() => setActiveView('payday')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'payday'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Payday Splitter &amp; Ledger ({orders.length})
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => openAddPositionModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Stock</span>
          </Button>
        </div>
      </div>

      {/* ── Row 1: 4-Column Executive Portfolio & TrueSpend Buying Power Strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Equity Value */}
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Stock Portfolio Value</span>
              <span className="font-mono tabular-nums">1 USD = {rates.USD_TO_MAD.toFixed(2)} MAD</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {totalValueMad.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-semibold text-gray-500">MAD</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-gray-500 dark:text-gray-400">
                ≈ ${totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
              </span>
              <span
                className={`inline-flex items-center gap-0.5 font-semibold ${
                  totalPnlMad >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {totalPnlMad >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {totalPnlMad >= 0 ? '+' : ''}
                {totalPnlMad.toFixed(0)} MAD ({totalPnlPercent >= 0 ? '+' : ''}
                {totalPnlPercent.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: TrueSpend Safe Buying Power */}
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>TrueSpend Buying Power</span>
              <button
                type="button"
                onClick={() => setActiveTab('budgets')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                {buyingPower.monthlyInvestmentBudgetMad > 0
                  ? `Budget: ${buyingPower.monthlyInvestmentBudgetMad.toFixed(0)} MAD`
                  : 'Set Budget →'}
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {buyingPower.deployableSurplusMad.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-xs font-semibold text-gray-500">MAD</span>
              <span className="text-xs font-mono tabular-nums text-gray-400">
                (${buyingPower.deployableSurplusUsd.toFixed(0)})
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                Safe-to-Spend: <strong className="font-mono tabular-nums text-gray-700 dark:text-gray-300">{buyingPower.safeToSpendMad.toFixed(0)} MAD</strong>
              </span>
              <span>·</span>
              <span>
                Invested this cycle: <strong className="font-mono tabular-nums text-gray-700 dark:text-gray-300">{buyingPower.investedThisCycleMad.toFixed(0)} MAD</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Passive Dividend Engine */}
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Projected Annual Dividends</span>
              <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                {portfolioYield.toFixed(2)}% Yield
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                {annualDividendMad.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-xs font-semibold text-gray-500">MAD / yr</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-mono tabular-nums">
                {monthlyDividendMad.toFixed(0)} MAD / month
              </span>
              <span>·</span>
              <span>
                Covers <strong className="font-mono tabular-nums text-gray-700 dark:text-gray-300">{subCoverage.toFixed(0)}%</strong> of Subscriptions
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Realized Gains & Cash Collected */}
        <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Realized P&amp;L + Dividends Paid</span>
              <button
                type="button"
                onClick={() => setActiveView('payday')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Order Log →
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold font-mono tabular-nums ${
                  (investmentsData?.totalRealizedPnlMad || 0) +
                    (investmentsData?.totalDividendsCollectedMad || 0) >=
                  0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {(investmentsData?.totalRealizedPnlMad || 0) +
                  (investmentsData?.totalDividendsCollectedMad || 0) >=
                0
                  ? '+'
                  : ''}
                {(
                  (investmentsData?.totalRealizedPnlMad || 0) +
                  (investmentsData?.totalDividendsCollectedMad || 0)
                ).toFixed(0)}
              </span>
              <span className="text-xs font-semibold text-gray-500">MAD</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
              <span>
                Realized: {(investmentsData?.totalRealizedPnlMad || 0).toFixed(0)} MAD
              </span>
              <span>·</span>
              <span>
                Divs Paid: {(investmentsData?.totalDividendsCollectedMad || 0).toFixed(0)} MAD
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── TrueSpend Brokerage Reserve (Investment Wallet) & Cash-Flow Hub ── */}
      <Card className="border-amber-200/70 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/40 via-white to-indigo-50/30 dark:from-amber-950/15 dark:via-gray-900 dark:to-indigo-950/15">
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 mt-0.5">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  Brokerage Reserve Wallet ({investmentWalletsList.length > 0 ? investmentWalletsList.map((w) => w.name).join(' · ') : 'No Investment Wallet Yet'})
                </span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-xs font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-300">
                  Uninvested Cash: {buyingPower.investmentWalletBalanceMad.toLocaleString()} MAD
                </span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                  Stock Equity: {totalValueMad.toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                </span>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-xs font-mono tabular-nums font-bold text-gray-900 dark:text-white">
                  Total Brokerage Account: {(buyingPower.investmentWalletBalanceMad + totalValueMad).toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {buyingPower.guidanceText}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onFundInvestmentWallet && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const defaultSource =
                    fundingSourceWallets.find((w) => w.type === 'Bank' && w.isMain) ||
                    fundingSourceWallets[0];
                  setFundSourceWalletId(defaultSource?.id || '');
                  setFundDestWalletId(investmentWalletsList[0]?.id || '');
                  setFundAmountMad(
                    buyingPower.remainingInvestmentBudgetMad > 0
                      ? String(Math.round(buyingPower.remainingInvestmentBudgetMad))
                      : '1000'
                  );
                  setFundNotes('');
                  setFundError('');
                  setShowFundWalletModal(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs flex items-center gap-1.5 whitespace-nowrap"
              >
                <WalletCards className="h-3.5 w-3.5" />
                <span>
                  {investmentWalletsList.length > 0
                    ? 'Fund Brokerage Wallet'
                    : 'Create & Fund Brokerage Wallet'}
                </span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveView('payday')}
              className="text-xs whitespace-nowrap"
            >
              Payday Stock Splitter →
            </Button>
            <button
              type="button"
              onClick={() => onRefresh()}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white px-2 py-1"
              title="Refresh Live Stock Quotes"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════════
          VIEW 1: MY STOCK POSITIONS & PORTFOLIO ALLOCATION
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeView === 'portfolio' && (
        <div className="space-y-6">
          {/* Allocation & Sector Strip (shown when user has active positions) */}
          {positions.length > 0 && (
            <Card className="border-gray-200 dark:border-gray-800">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Portfolio Weight &amp; Sector Exposure
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Actual allocation across {positions.length} active equity positions
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    {investmentsData?.marketBreakdown.map((m, idx) => (
                      <React.Fragment key={m.market}>
                        {idx > 0 && <span>·</span>}
                        <span>
                          <strong className="text-gray-800 dark:text-gray-200">{m.market}</strong>:{' '}
                          {m.weightPercent.toFixed(1)}% ({m.valueMad.toFixed(0)} MAD)
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Single Stacked Allocation Bar */}
                <div className="h-3 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 flex">
                  {positions.map((pos, idx) => (
                    <div
                      key={pos.id}
                      style={{ width: `${Math.max(2, pos.actualWeightPercent)}%` }}
                      className={`${
                        ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
                      } h-full transition-all border-r border-white/20 last:border-r-0`}
                      title={`${pos.ticker}: ${pos.actualWeightPercent.toFixed(1)}% (${pos.marketValueMad.toFixed(0)} MAD)`}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  {positions.map((pos, idx) => {
                    const targetW = parseFloat(pos.targetWeightPercent || '0') || 0;
                    return (
                      <div key={pos.id} className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-xs ${
                            ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
                          }`}
                        />
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {pos.ticker}
                        </span>
                        <span className="font-mono tabular-nums text-gray-600 dark:text-gray-400">
                          {pos.actualWeightPercent.toFixed(1)}%
                        </span>
                        {targetW > 0 && (
                          <span className="font-mono tabular-nums text-gray-400 text-[11px]">
                            (Target {targetW.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Market Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              {(['ALL', 'US', 'ETF', 'BVC'] as const).map((mkt) => (
                <button
                  key={mkt}
                  type="button"
                  onClick={() => setMarketFilter(mkt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    marketFilter === mkt
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {mkt === 'ALL'
                    ? 'All Markets'
                    : mkt === 'US'
                    ? 'US Equities'
                    : mkt === 'ETF'
                    ? 'Index & Dividend ETFs'
                    : 'Casablanca BVC'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveView('discover')}
                className="text-xs whitespace-nowrap shrink-0"
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                Browse Stock Catalog
              </Button>
            </div>
          </div>

          {/* Empty State if no positions yet */}
          {filteredPositions.length === 0 ? (
            <Card className="border-gray-200 dark:border-gray-800">
              <CardContent className="py-12 px-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {positions.length === 0
                    ? 'Build Your Stock & Equity Portfolio'
                    : 'No positions in this market filter'}
                </h3>
                <p className="mx-auto max-w-md text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">
                  Track US tech compounders (NVDA, AAPL, MSFT), S&amp;P 500 ETFs (VOO, QQQ, SCHD), or Casablanca BVC blue-chips (ATW, IAM, TGCC) with 1-click TrueSpend wallet synchronization.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openAddPositionModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add First Stock Position
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveView('discover')}
                    className="text-xs"
                  >
                    Explore Popular Stocks &amp; ETFs
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* High-Density Scannable Stock Positions Table */
            <Card className="border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="py-3 px-4">Ticker &amp; Company</th>
                      <th className="py-3 px-3 text-right">Shares &amp; Cost</th>
                      <th className="py-3 px-3 text-right">Live Price</th>
                      <th className="py-3 px-3 text-right">Market Value</th>
                      <th className="py-3 px-3 text-right">Total Return</th>
                      <th className="py-3 px-3 text-right">Annual Div</th>
                      <th className="py-3 px-4 text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs sm:text-sm">
                    {filteredPositions.map((pos) => {
                      const isPositive = pos.unrealizedPnlMad >= 0;
                      const isDayPositive = pos.change24hPercent >= 0;
                      return (
                        <tr
                          key={pos.id}
                          className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          {/* Ticker & Metadata */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 font-mono text-xs font-bold text-gray-900 dark:text-white">
                                {pos.ticker.slice(0, 4)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 dark:text-white">
                                    {pos.ticker}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                                    {pos.companyName}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  <span>{pos.market}</span>
                                  <span>·</span>
                                  <span>{pos.sector}</span>
                                  {pos.walletName && (
                                    <>
                                      <span>·</span>
                                      <span>{pos.walletName}</span>
                                    </>
                                  )}
                                  {pos.affordableSharesFromSurplus > 0 && (
                                    <>
                                      <span>·</span>
                                      <span className="text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                                        Surplus buys +{pos.affordableSharesFromSurplus.toFixed(1)} sh
                                      </span>
                                    </>
                                  )}
                                </div>
                                {pos.convictionThesis && (
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-xs mt-0.5">
                                    {pos.convictionThesis}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Shares & Avg Cost */}
                          <td className="py-3.5 px-3 text-right align-middle font-mono tabular-nums">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {pos.sharesNum.toLocaleString('en-US', {
                                maximumFractionDigits: 4,
                              })}{' '}
                              sh
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              Avg {pos.avgCostNum.toFixed(2)} {pos.currency}
                            </div>
                          </td>

                          {/* Live Price & 24h Change */}
                          <td className="py-3.5 px-3 text-right align-middle font-mono tabular-nums">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {pos.currentPriceNum.toFixed(2)} {pos.currency}
                            </div>
                            <div
                              className={`text-[11px] font-medium ${
                                isDayPositive
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isDayPositive ? '+' : ''}
                              {pos.change24hPercent.toFixed(2)}% (24h)
                            </div>
                          </td>

                          {/* Market Value (MAD + Native) */}
                          <td className="py-3.5 px-3 text-right align-middle font-mono tabular-nums">
                            <div className="font-bold text-gray-900 dark:text-white">
                              {pos.marketValueMad.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}{' '}
                              MAD
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {pos.currency !== 'MAD'
                                ? `${pos.marketValueNative.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} ${pos.currency} · `
                                : ''}
                              {pos.actualWeightPercent.toFixed(1)}% wt
                            </div>
                          </td>

                          {/* Total Unrealized P&L */}
                          <td className="py-3.5 px-3 text-right align-middle font-mono tabular-nums">
                            <div
                              className={`font-semibold ${
                                isPositive
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {pos.unrealizedPnlMad.toFixed(0)} MAD
                            </div>
                            <div
                              className={`text-[11px] ${
                                isPositive
                                  ? 'text-emerald-600/80 dark:text-emerald-400/80'
                                  : 'text-rose-600/80 dark:text-rose-400/80'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {pos.unrealizedPnlPercent.toFixed(2)}%
                            </div>
                          </td>

                          {/* Annual Dividend */}
                          <td className="py-3.5 px-3 text-right align-middle font-mono tabular-nums">
                            {pos.annualDividendMad > 0 ? (
                              <>
                                <div className="font-semibold text-gray-900 dark:text-white">
                                  {pos.annualDividendMad.toFixed(0)} MAD/yr
                                </div>
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                  {pos.dividendYieldPercent.toFixed(2)}% yield
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">Growth</span>
                            )}
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4 text-right align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openOrderModal(pos, 'BUY')}
                                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-colors whitespace-nowrap shrink-0"
                              >
                                + Buy
                              </button>
                              <button
                                type="button"
                                onClick={() => openOrderModal(pos, 'SELL')}
                                className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap shrink-0"
                              >
                                Sell
                              </button>
                              <button
                                type="button"
                                onClick={() => openOrderModal(pos, 'DIVIDEND')}
                                className="px-2 py-1 text-xs font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                                title="Collect Cash Dividend into TrueSpend Wallet"
                              >
                                + Div
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditPositionModal(pos)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md"
                                title="Edit Position & Target Weight"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeletePosition(pos.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md"
                                title="Remove Stock Position"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Watchlist / Radar Positions Section */}
          {watchlistPositions.length > 0 && (
            <Card className="border-gray-200 dark:border-gray-800">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                  Stocks on Your Watchlist Radar ({watchlistPositions.length})
                </CardTitle>
                <span className="text-xs text-gray-500">
                  Ready to buy when price hits your target
                </span>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {watchlistPositions.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5 bg-gray-50/40 dark:bg-gray-800/30"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white">
                            {w.ticker}
                          </span>
                          <span className="text-xs text-gray-500 truncate">
                            {w.companyName}
                          </span>
                        </div>
                        <div className="text-xs font-mono tabular-nums text-gray-600 dark:text-gray-300 mt-1">
                          {w.currentPriceNum.toFixed(2)} {w.currency} ·{' '}
                          <span
                            className={
                              w.change24hPercent >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {w.change24hPercent >= 0 ? '+' : ''}
                            {w.change24hPercent.toFixed(2)}%
                          </span>
                        </div>
                        {w.affordableSharesFromSurplus > 0 && (
                          <div className="text-[11px] font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                            Safe surplus buys {w.affordableSharesFromSurplus.toFixed(1)} shares
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openOrderModal(w, 'BUY')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1"
                        >
                          Buy Shares
                        </Button>
                        <button
                          type="button"
                          onClick={() => onDeletePosition(w.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md"
                          title="Remove from Radar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          VIEW 2: DISCOVER & STOCK RADAR (US, ETFs & CASABLANCA BVC)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeView === 'discover' && (
        <div className="space-y-5">
          {/* Search & Market Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <form onSubmit={handleRunSearch} className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim()) setRemoteSearchResults(null);
                  }}
                  placeholder="Search any ticker or company (e.g. NVDA, AAPL, VOO, ATW, IAM, TSLA)..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={isSearching}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs whitespace-nowrap shrink-0"
              >
                {isSearching ? 'Searching...' : 'Search Ticker'}
              </Button>
            </form>

            <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1 self-start">
              {(['ALL', 'US', 'ETF', 'BVC'] as const).map((mkt) => (
                <button
                  key={mkt}
                  type="button"
                  onClick={() => setMarketFilter(mkt)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    marketFilter === mkt
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {mkt === 'ALL'
                    ? 'All'
                    : mkt === 'US'
                    ? 'US Compounders'
                    : mkt === 'ETF'
                    ? 'Core ETFs'
                    : 'Casablanca BVC'}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedCatalog.map((item) => {
              const affordableShares =
                item.priceInMad > 0
                  ? Math.floor((buyingPower.deployableSurplusMad / item.priceInMad) * 100) / 100
                  : 0;
              const isPos = item.change24hPercent >= 0;

              return (
                <Card
                  key={item.ticker}
                  className="border-gray-200 dark:border-gray-800 flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-gray-900 dark:text-white">
                            {item.ticker}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {item.market} · {item.sector}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate mt-0.5">
                          {item.companyName}
                        </p>
                      </div>

                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          {item.price.toFixed(2)} {item.currency}
                        </div>
                        <div
                          className={`text-[11px] font-medium ${
                            isPos
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {item.change24hPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {item.thesis}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums pt-1 border-t border-gray-100 dark:border-gray-800">
                      <span>≈ {item.priceInMad.toFixed(0)} MAD / sh</span>
                      <span>·</span>
                      <span>
                        {item.dividendYieldPercent > 0
                          ? `Div Yield ${item.dividendYieldPercent.toFixed(2)}%`
                          : 'Growth Compounder'}
                      </span>
                      {affordableShares > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-indigo-600 dark:text-indigo-400">
                            Can buy {affordableShares.toFixed(1)} sh
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openAddPositionModal(item, false)}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                      >
                        {item.inPortfolio ? '+ Buy More Shares' : 'Buy Shares'}
                      </Button>
                      {!item.inPortfolio && !item.inWatchlist && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            onUpsertPosition({
                              ticker: item.ticker,
                              companyName: item.companyName,
                              market: item.market,
                              sector: item.sector,
                              currentPrice: item.price,
                              currency: item.currency,
                              annualDividendPerShare: item.annualDividendPerShare,
                              convictionThesis: item.thesis,
                              isWatchlistOnly: true,
                            })
                          }
                          className="text-xs whitespace-nowrap shrink-0"
                        >
                          + Watchlist
                        </Button>
                      )}
                      {item.inWatchlist && (
                        <span className="text-xs text-gray-500 px-2">On Radar</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          VIEW 3: PAYDAY STOCK SPLITTER & SYNCED ORDER LEDGER
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeView === 'payday' && (
        <div className="space-y-6">
          {/* Interactive Payday Stock Splitter */}
          <Card className="border-gray-200 dark:border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calculator className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Payday Stock Splitter &amp; Portfolio Auto-Allocator</span>
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Enter how much MAD you want to invest this cycle — TrueSpend calculates exact share counts across your stocks and syncs the purchase with your wallet.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setPaydayBudgetMad(String(Math.round(buyingPower.deployableSurplusMad || 2000)))
                    }
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 whitespace-nowrap"
                  >
                    Use Safe Surplus ({buyingPower.deployableSurplusMad.toFixed(0)} MAD)
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {positions.length === 0 ? (
                <div className="py-6 text-center text-xs sm:text-sm text-gray-500">
                  Add at least one stock to your portfolio first to use the Payday Stock Splitter.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Capital to Deploy (MAD)
                      </label>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={paydayBudgetMad}
                        onChange={(e) => setPaydayBudgetMad(e.target.value)}
                        placeholder={String(effectivePaydayAmountMad)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Allocation Rule
                      </label>
                      <div className="flex items-center gap-1 rounded-lg bg-gray-200/70 dark:bg-gray-800 p-1">
                        <button
                          type="button"
                          onClick={() => setPaydaySplitMode('target')}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            paydaySplitMode === 'target'
                              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          By Target Weight
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaydaySplitMode('equal')}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            paydaySplitMode === 'equal'
                              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          Equal Split
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Funding TrueSpend Wallet
                      </label>
                      <select
                        value={paydayWalletId || defaultWallet?.id || ''}
                        onChange={(e) => setPaydayWalletId(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                      >
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.type} · {w.balance.toFixed(0)} MAD)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Allocation Preview Table */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-[11px] uppercase text-gray-500">
                          <th className="py-2.5 px-4">Stock</th>
                          <th className="py-2.5 px-3 text-right">Split Weight</th>
                          <th className="py-2.5 px-3 text-right">Live Price</th>
                          <th className="py-2.5 px-3 text-right">Allocated MAD</th>
                          <th className="py-2.5 px-4 text-right">Shares to Buy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono tabular-nums">
                        {paydayPlanRows.map((row) => (
                          <tr key={row.position.id}>
                            <td className="py-2.5 px-4 font-sans">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {row.position.ticker}
                              </span>{' '}
                              <span className="text-xs text-gray-500">
                                · {row.position.companyName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-300">
                              {row.weightPercent.toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-300">
                              {row.position.currentPriceNum.toFixed(2)} {row.position.currency}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                              {row.allocatedMad.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0,
                              })}{' '}
                              MAD
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                              +{row.estimatedShares.toFixed(3)} sh
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paydaySyncWallet}
                        onChange={(e) => setPaydaySyncWallet(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        Automatically deduct {effectivePaydayAmountMad.toLocaleString()} MAD from selected TrueSpend wallet (📈 Investments)
                      </span>
                    </label>

                    <Button
                      type="button"
                      size="sm"
                      disabled={isSaving}
                      onClick={handleRunPaydayAllocation}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs whitespace-nowrap shrink-0"
                    >
                      {isSaving
                        ? 'Executing Batch Buy...'
                        : `Execute Payday Buy (${effectivePaydayAmountMad.toLocaleString()} MAD)`}
                    </Button>
                  </div>

                  {paydaySuccessMsg && (
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                      {paydaySuccessMsg}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Synced Stock Orders & Dividend History */}
          <Card className="border-gray-200 dark:border-gray-800 overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Stock Order &amp; Dividend Ledger ({orders.length})
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Every Buy, Sell, and Cash Dividend with direct 2-way link to TrueSpend Wallets
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('transactions')}
                className="text-xs text-indigo-600 dark:text-indigo-400"
              >
                View Main Ledger →
              </Button>
            </CardHeader>

            {orders.length === 0 ? (
              <CardContent className="py-8 text-center text-xs sm:text-sm text-gray-500">
                No stock orders or dividend payouts recorded yet.
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-[11px] uppercase text-gray-500">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-3">Action &amp; Stock</th>
                      <th className="py-2.5 px-3 text-right">Shares × Price</th>
                      <th className="py-2.5 px-3 text-right">Settled MAD</th>
                      <th className="py-2.5 px-3">TrueSpend Wallet Sync</th>
                      <th className="py-2.5 px-4 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {orders.map((ord) => {
                      const shares = parseFloat(ord.shares || '0') || 0;
                      const price = parseFloat(ord.pricePerShare || '0') || 0;
                      const madAmt = parseFloat(ord.totalMadAmount || '0') || 0;
                      const realizedPnl = parseFloat(ord.realizedPnlMad || '0') || 0;

                      return (
                        <tr
                          key={ord.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                        >
                          <td className="py-3 px-4 font-mono tabular-nums text-xs text-gray-500 whitespace-nowrap">
                            {format(new Date(ord.executedAt), 'MMM d, yyyy')}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono text-xs font-bold ${
                                  ord.action === 'BUY'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : ord.action === 'SELL'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {ord.action}
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white">
                                {ord.ticker || 'STOCK'}
                              </span>
                              <span className="text-xs text-gray-500 truncate max-w-[160px]">
                                {ord.notes || ord.companyName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-xs text-gray-600 dark:text-gray-300">
                            {ord.action === 'DIVIDEND'
                              ? `${parseFloat(ord.totalNativeAmount).toFixed(2)} ${ord.currency}`
                              : `${shares.toFixed(3)} sh @ ${price.toFixed(2)} ${ord.currency}`}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums">
                            <div
                              className={`font-semibold ${
                                ord.action === 'BUY'
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {ord.action === 'BUY' ? '-' : '+'}
                              {madAmt.toFixed(2)} MAD
                            </div>
                            {ord.action === 'SELL' && realizedPnl !== 0 && (
                              <div
                                className={`text-[11px] ${
                                  realizedPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                P&amp;L: {realizedPnl >= 0 ? '+' : ''}
                                {realizedPnl.toFixed(0)} MAD
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs text-gray-500 dark:text-gray-400">
                            {ord.walletName ? (
                              <span>
                                {ord.walletName}
                                {ord.linkedTransactionId ? ' · Synced to Ledger' : ''}
                              </span>
                            ) : (
                              <span>Portfolio Track Only</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onDeleteOrder(ord.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded-md"
                              title="Delete order (and linked wallet transaction if synced)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODAL 1: ADD / EDIT STOCK POSITION
         ═══════════════════════════════════════════════════════════════════════════ */}
      {showPositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingPosition
                  ? `Edit ${editingPosition.ticker} Position`
                  : 'Add Stock to Portfolio or Watchlist'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPositionModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePosition} className="p-5 space-y-4">
              {!editingPosition && (
                <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                  <button
                    type="button"
                    onClick={() => setPosIsWatchlist(false)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      !posIsWatchlist
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Own / Buy Shares Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosIsWatchlist(true)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      posIsWatchlist
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Watchlist Radar Only
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ticker Symbol *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingPosition)}
                    value={posTicker}
                    onChange={(e) => setPosTicker(e.target.value.toUpperCase())}
                    placeholder="e.g. NVDA, VOO, ATW"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono uppercase text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company / ETF Name
                  </label>
                  <input
                    type="text"
                    value={posCompanyName}
                    onChange={(e) => setPosCompanyName(e.target.value)}
                    placeholder="Auto-filled if left blank"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Market
                  </label>
                  <select
                    value={posMarket}
                    onChange={(e) => {
                      const m = e.target.value as StockMarketType;
                      setPosMarket(m);
                      if (m === 'BVC') setPosCurrency('MAD');
                      else if (posCurrency === 'MAD') setPosCurrency('USD');
                    }}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                  >
                    <option value="US">US Equities</option>
                    <option value="ETF">Index / ETF</option>
                    <option value="BVC">Casablanca BVC</option>
                    <option value="GLOBAL">Global</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={posCurrency}
                    onChange={(e) => setPosCurrency(e.target.value as any)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-xs sm:text-sm font-mono text-gray-900 dark:text-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="MAD">MAD (DH)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sector
                  </label>
                  <input
                    type="text"
                    value={posSector}
                    onChange={(e) => setPosSector(e.target.value)}
                    placeholder="Technology"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {!posIsWatchlist && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Number of Shares *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      required={!posIsWatchlist}
                      value={posShares}
                      onChange={(e) => setPosShares(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Buy Price / Share ({posCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={posAvgCost}
                      onChange={(e) => setPosAvgCost(e.target.value)}
                      placeholder="Auto live price if empty"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Annual Dividend / Share ({posCurrency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={posDividendPerShare}
                    onChange={(e) => setPosDividendPerShare(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Portfolio Weight (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={posTargetWeight}
                    onChange={(e) => setPosTargetWeight(e.target.value)}
                    placeholder="15"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  1-Line Conviction Thesis / Note
                </label>
                <input
                  type="text"
                  value={posThesis}
                  onChange={(e) => setPosThesis(e.target.value)}
                  placeholder="e.g. Core S&P 500 compounder / Casablanca dividend anchor"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                />
              </div>

              {!posIsWatchlist && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Linked TrueSpend Settlement Wallet
                    </label>
                    {!editingPosition && (
                      <label className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={posSyncWallet}
                          onChange={(e) => setPosSyncWallet(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span>Deduct purchase from wallet balance</span>
                      </label>
                    )}
                  </div>
                  <select
                    value={posWalletId}
                    onChange={(e) => setPosWalletId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">No Linked Wallet (Track Position Only)</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.type} · {w.balance.toFixed(0)} MAD)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{modalError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPositionModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingPosition
                    ? 'Save Changes'
                    : posIsWatchlist
                    ? 'Add to Radar'
                    : 'Save Stock Position'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODAL 2: EXECUTE STOCK ORDER (BUY / SELL / DIVIDEND)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {orderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {orderAction === 'BUY'
                    ? `Buy ${orderTarget.ticker} Shares`
                    : orderAction === 'SELL'
                    ? `Sell ${orderTarget.ticker} Shares`
                    : `Collect ${orderTarget.ticker} Cash Dividend`}
                </h3>
                <p className="text-xs text-gray-500">
                  {orderTarget.companyName} · Held: {orderTarget.sharesNum} sh @ Avg{' '}
                  {orderTarget.avgCostNum.toFixed(2)} {orderTarget.currency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrderTarget(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-5 space-y-4">
              {/* Action Selector */}
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
                {(['BUY', 'SELL', 'DIVIDEND'] as const).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => openOrderModal(orderTarget, act)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      orderAction === act
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {act === 'BUY' ? 'Buy More' : act === 'SELL' ? 'Sell Shares' : 'Cash Dividend'}
                  </button>
                ))}
              </div>

              {orderAction === 'DIVIDEND' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Dividend Amount Received ({orderTarget.currency}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={orderTotalNative}
                    onChange={(e) => setOrderTotalNative(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                  />
                  <p className="text-[11px] text-gray-500 mt-1 font-mono tabular-nums">
                    Settled Value: +
                    {toMad(parseFloat(orderTotalNative || '0') || 0, orderTarget.currency).toFixed(
                      2
                    )}{' '}
                    MAD
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Shares *
                      </label>
                      {orderAction === 'SELL' && orderTarget.sharesNum > 0 && (
                        <button
                          type="button"
                          onClick={() => setOrderShares(String(orderTarget.sharesNum))}
                          className="text-[11px] text-indigo-600 hover:underline font-mono"
                        >
                          Max ({orderTarget.sharesNum})
                        </button>
                      )}
                      {orderAction === 'BUY' && orderTarget.affordableSharesFromSurplus > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setOrderShares(String(orderTarget.affordableSharesFromSurplus))
                          }
                          className="text-[11px] text-indigo-600 hover:underline font-mono"
                        >
                          Surplus ({orderTarget.affordableSharesFromSurplus})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      value={orderShares}
                      onChange={(e) => setOrderShares(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price / Share ({orderTarget.currency}) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Live Order Summary Box */}
              {orderAction !== 'DIVIDEND' && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3 text-xs font-mono tabular-nums space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Order Total ({orderTarget.currency}):</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {(
                        (parseFloat(orderShares || '0') || 0) *
                        (parseFloat(orderPrice || '0') || 0)
                      ).toFixed(2)}{' '}
                      {orderTarget.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">TrueSpend MAD Settlement:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {toMad(
                        (parseFloat(orderShares || '0') || 0) *
                          (parseFloat(orderPrice || '0') || 0),
                        orderTarget.currency
                      ).toFixed(2)}{' '}
                      MAD
                    </span>
                  </div>
                  {orderAction === 'SELL' && (
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-gray-500">Estimated Realized P&amp;L:</span>
                      <span
                        className={`font-bold ${
                          (parseFloat(orderPrice || '0') - orderTarget.avgCostNum) *
                            parseFloat(orderShares || '0') >=
                          0
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {toMad(
                          (parseFloat(orderPrice || '0') - orderTarget.avgCostNum) *
                            (parseFloat(orderShares || '0') || 0),
                          orderTarget.currency
                        ).toFixed(2)}{' '}
                        MAD
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TrueSpend Wallet Sync */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5 space-y-2">
                <label className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                  <span>
                    {orderAction === 'BUY'
                      ? 'Deduct cost from TrueSpend Wallet'
                      : 'Deposit proceeds into TrueSpend Wallet'}
                  </span>
                  <input
                    type="checkbox"
                    checked={orderSyncWallet}
                    onChange={(e) => setOrderSyncWallet(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600"
                  />
                </label>

                {orderSyncWallet && (
                  <>
                    <select
                      value={orderWalletId}
                      onChange={(e) => setOrderWalletId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.type === 'Investment' ? '📈 ' : w.type === 'Bank' ? '🏦 ' : '💵 '}
                          {w.name} ({w.type} · {w.balance.toFixed(0)} MAD)
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const selectedW = wallets.find((w) => w.id === orderWalletId);
                      if (!selectedW) return null;
                      if (selectedW.type === 'Investment') {
                        return (
                          <p className="text-[11px] text-amber-700 dark:text-amber-300">
                            {orderAction === 'BUY'
                              ? 'Uses protected Brokerage Reserve cash — does not reduce your Safe-to-Spend or double-count against your 📈 Investments budget.'
                              : 'Deposits proceeds into your protected Brokerage Reserve cash for future stock reinvestment.'}
                          </p>
                        );
                      }
                      return (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {orderAction === 'BUY'
                            ? 'Paid directly from Bank/Cash — counts toward your 📈 Investments budget and reduces Safe-to-Spend.'
                            : 'Deposits proceeds directly into your spendable Bank/Cash liquidity.'}
                        </p>
                      );
                    })()}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Order Note (Optional)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Monthly dip buy / Q3 dividend"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                />
              </div>

              {orderError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{orderError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOrderTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className={
                    orderAction === 'DIVIDEND'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }
                >
                  {isSaving
                    ? 'Processing...'
                    : orderAction === 'BUY'
                    ? 'Confirm Buy Order'
                    : orderAction === 'SELL'
                    ? 'Confirm Sell Order'
                    : 'Record Cash Dividend'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          MODAL 3: FUND BROKERAGE WALLET (1-CLICK TRANSFER TO INVESTMENT RESERVE)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {showFundWalletModal && onFundInvestmentWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Fund Brokerage Reserve Wallet
                </h3>
                <p className="text-xs text-gray-500">
                  Transfer cash from Bank/Cash into your protected Investment Reserve
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFundWalletModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFundError('');
                try {
                  const amt = parseFloat(fundAmountMad || '0');
                  if (!amt || amt <= 0) {
                    setFundError('Please enter a valid amount in MAD.');
                    return;
                  }
                  await onFundInvestmentWallet({
                    sourceWalletId: fundSourceWalletId || undefined,
                    destinationWalletId: fundDestWalletId || undefined,
                    amountMad: amt,
                    notes: fundNotes || undefined,
                  });
                  setShowFundWalletModal(false);
                } catch (err: any) {
                  setFundError(err?.message || 'Failed to transfer funds to Investment wallet.');
                }
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Spendable Wallet (Bank / Cash)
                </label>
                <select
                  value={fundSourceWalletId}
                  onChange={(e) => setFundSourceWalletId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                >
                  {fundingSourceWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type} · {w.balance.toFixed(2)} MAD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Brokerage Reserve Wallet (Investment)
                </label>
                {investmentWalletsList.length > 0 ? (
                  <select
                    value={fundDestWalletId}
                    onChange={(e) => setFundDestWalletId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                  >
                    {investmentWalletsList.map((w) => (
                      <option key={w.id} value={w.id}>
                        📈 {w.name} (Current Reserve: {w.balance.toFixed(2)} MAD)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                    A new <strong>&ldquo;Brokerage Reserve&rdquo; (Investment)</strong> wallet will be automatically created and funded for you.
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Transfer Amount (MAD) *
                  </label>
                  {buyingPower.remainingInvestmentBudgetMad > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setFundAmountMad(String(Math.round(buyingPower.remainingInvestmentBudgetMad)))
                      }
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-mono"
                    >
                      Remaining Budget ({buyingPower.remainingInvestmentBudgetMad.toFixed(0)} MAD)
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={fundAmountMad}
                  onChange={(e) => setFundAmountMad(e.target.value)}
                  placeholder="1000"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Recorded as a <code className="font-mono">Transfer</code> under{' '}
                  <strong>📈 Investments</strong> — counts toward your monthly investment target and moves cash into your protected Brokerage Reserve.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={fundNotes}
                  onChange={(e) => setFundNotes(e.target.value)}
                  placeholder="e.g. Monthly brokerage funding for stock buys"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs sm:text-sm text-gray-900 dark:text-white"
                />
              </div>

              {fundError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{fundError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFundWalletModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isSaving ? 'Transferring...' : 'Transfer to Brokerage Reserve'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
