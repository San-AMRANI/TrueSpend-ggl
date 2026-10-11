import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Coins,
  DollarSign,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Layers,
  Percent,
  Sliders,
  Award,
  Wallet as WalletIcon,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  History,
  Activity,
  PieChart,
  Zap,
  ArrowRightLeft,
  ChevronRight,
  Sparkles,
  Star,
  Search,
  HelpCircle,
  Info,
  ExternalLink,
  Flame,
  Globe,
  CircleAlert,
  Calculator,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  InvestmentsData,
  InvestmentHolding,
  InvestmentTransaction,
  DcaPlan,
  Wallet,
  InvestmentAssetType,
  InvestmentTradeType,
  CoinGeckoMarketCoin,
  WatchlistItem,
  KPI,
  Debt,
} from '../../types';
import { dashboardService } from '../../services/api/dashboardService';

interface InvestmentsTabProps {
  data: InvestmentsData | null;
  loading: boolean;
  wallets: Wallet[];
  kpis: KPI | null;
  debts: Debt[];
  onRefresh: () => Promise<void>;
  onCreateHolding: (payload: Partial<InvestmentHolding>) => Promise<any>;
  onUpdateHolding: (id: string, payload: Partial<InvestmentHolding>) => Promise<any>;
  onDeleteHolding: (id: string) => Promise<any>;
  onExecuteTrade: (payload: {
    holdingId: string;
    type: InvestmentTradeType;
    units?: number;
    pricePerUnit?: number;
    totalAmount?: number;
    fees?: number;
    walletId?: string | null;
    notes?: string;
  }) => Promise<any>;
  onCreateDcaPlan: (payload: Partial<DcaPlan>) => Promise<any>;
  onUpdateDcaPlan: (id: string, payload: Partial<DcaPlan>) => Promise<any>;
  onDeleteDcaPlan: (id: string) => Promise<any>;
  onAddToWatchlist?: (payload: { coinId: string; symbol: string; name: string }) => Promise<any>;
  onRemoveFromWatchlist?: (coinId: string) => Promise<any>;
  onCreateWallet?: (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => Promise<any>;
  setActiveTab?: (tab: string) => void;
}

type SubTab = 'holdings' | 'market' | 'safe-to-invest' | 'allocation' | 'stress-test' | 'ledger';
type InfoModalType = 'safe-to-invest' | 'dca' | 'fire' | null;

export const INVESTMENT_WALLET_TEMPLATES = [
  { id: 'binance', name: 'Binance Account', desc: 'Crypto exchange & spot trading', icon: '🟡' },
  { id: 'ibkr', name: 'Interactive Brokers (IBKR)', desc: 'US & Global stocks / ETFs', icon: '🔵' },
  { id: 'bybit', name: 'Bybit / Crypto Exchange', desc: 'Crypto trading & staking', icon: '🟣' },
  { id: 'sarwa', name: 'Sarwa / Global Broker', desc: 'Passive index investing', icon: '🟢' },
  { id: 'bvc', name: 'Casablanca BVC Broker', desc: 'Moroccan local equities', icon: '🏛️' },
  { id: 'cold_wallet', name: 'Hardware / Cold Ledger', desc: 'Self-custody crypto storage', icon: '🛡️' },
  { id: 'custom', name: 'Custom Investment Wallet', desc: 'Private or alternative brokerage', icon: '💼' },
];

const POPULAR_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', assetType: 'crypto', currency: 'USD' },
  { symbol: 'ETH', name: 'Ethereum', assetType: 'crypto', currency: 'USD' },
  { symbol: 'SOL', name: 'Solana', assetType: 'crypto', currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', assetType: 'etf', currency: 'USD' },
  { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq 100)', assetType: 'etf', currency: 'USD' },
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', assetType: 'stock', currency: 'USD' },
  { symbol: 'ATW', name: 'Attijariwafa Bank (BVC)', assetType: 'bourse_local', currency: 'MAD' },
  { symbol: 'BCP', name: 'Banque Centrale Populaire', assetType: 'bourse_local', currency: 'MAD' },
  { symbol: 'IAM', name: 'Maroc Telecom', assetType: 'bourse_local', currency: 'MAD' },
  { symbol: 'GOLD', name: 'Physical Gold / Precious Metals', assetType: 'commodity', currency: 'USD' },
];

const NET_WORTH_MILESTONES = [
  { threshold: 10000, label: '10K MAD Club', icon: '🥉' },
  { threshold: 50000, label: '50K MAD Milestone', icon: '🥈' },
  { threshold: 100000, label: '100K MAD Wealth Builder', icon: '🥇' },
  { threshold: 250000, label: 'Quarter Million MAD', icon: '💎' },
  { threshold: 500000, label: 'Half Million MAD', icon: '👑' },
  { threshold: 1000000, label: '1 Million MAD Capitalist', icon: '🚀' },
];

export const InvestmentsTab: React.FC<InvestmentsTabProps> = ({
  data,
  loading,
  wallets,
  kpis,
  debts,
  onRefresh,
  onCreateHolding,
  onUpdateHolding,
  onDeleteHolding,
  onExecuteTrade,
  onCreateDcaPlan,
  onUpdateDcaPlan,
  onDeleteDcaPlan,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onCreateWallet,
  setActiveTab,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('holdings');
  const [displayCurrency, setDisplayCurrency] = useState<'MAD' | 'USD' | 'EUR'>('MAD');
  const [assetFilter, setAssetFilter] = useState<string>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Investment Wallets tracking
  const investmentWallets = useMemo(() => wallets.filter((w) => w.type === 'Investment'), [wallets]);
  const nonInvestmentWallets = useMemo(() => wallets.filter((w) => w.type !== 'Investment'), [wallets]);
  const totalInvestmentWalletsCash = useMemo(
    () => investmentWallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0),
    [investmentWallets]
  );

  // Quick Create Investment Wallet Modal state
  const [showCreateInvestmentWalletModal, setShowCreateInvestmentWalletModal] = useState(false);
  const [newWalletName, setNewWalletName] = useState('Binance Account');
  const [newWalletInitialBalance, setNewWalletInitialBalance] = useState('0');
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletCreationError, setWalletCreationError] = useState<string | null>(null);

  // Info modal state
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);

  // Market coins & Watchlist state
  const [marketCoins, setMarketCoins] = useState<CoinGeckoMarketCoin[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketCategory, setMarketCategory] = useState<'all' | 'watchlist' | 'gainers' | 'l1' | 'defi' | 'memes'>('all');
  const [marketSearch, setMarketSearch] = useState('');
  const [marketSearchResults, setMarketSearchResults] = useState<any[]>([]);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);

  // CoinGecko Trending Coins state
  const [trendingCoins, setTrendingCoins] = useState<any[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);

  // CoinGecko Deep Details Modal state
  const [selectedCoinDetail, setSelectedCoinDetail] = useState<any | null>(null);
  const [loadingCoinDetail, setLoadingCoinDetail] = useState(false);

  // Modals state
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);
  const [tradeModalHolding, setTradeModalHolding] = useState<InvestmentHolding | null>(null);
  const [tradeType, setTradeType] = useState<InvestmentTradeType>('BUY');
  const [showDcaModal, setShowDcaModal] = useState(false);

  // Live Spot Price fetching for forms
  const [fetchingSpotPrice, setFetchingSpotPrice] = useState(false);
  const [liveSpotQuote, setLiveSpotQuote] = useState<{ symbol: string; priceUsd: number; priceEur: number; priceMad: number; change24h: number } | null>(null);

  // Holding modal CoinGecko search & smart dual-calculator state
  const [holdingSearchQuery, setHoldingSearchQuery] = useState('');
  const [holdingSearchResults, setHoldingSearchResults] = useState<any[]>([]);
  const [isSearchingHolding, setIsSearchingHolding] = useState(false);
  const [holdingTotalCash, setHoldingTotalCash] = useState('');
  const [distributingTargets, setDistributingTargets] = useState(false);

  // Trade form state
  const [tradeUnits, setTradeUnits] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeTotal, setTradeTotal] = useState('');
  const [tradeFees, setTradeFees] = useState('0');
  const [tradeWalletId, setTradeWalletId] = useState('');
  const [tradeNotes, setTradeNotes] = useState('');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Holding form state
  const [holdingForm, setHoldingForm] = useState({
    symbol: '',
    name: '',
    assetType: 'crypto' as InvestmentAssetType,
    units: '',
    buyPriceAvg: '',
    currentPrice: '',
    currency: 'USD',
    walletId: '',
    targetAllocationPercent: '0',
    dividendYieldPercent: '0',
    notes: '',
  });
  const [holdingSubmitting, setHoldingSubmitting] = useState(false);
  const [holdingError, setHoldingError] = useState<string | null>(null);

  // DCA form state
  const [dcaForm, setDcaForm] = useState({
    symbol: 'BTC',
    assetName: 'Bitcoin',
    assetType: 'crypto' as InvestmentAssetType,
    targetAmount: '500',
    currency: 'MAD',
    frequency: 'post_payday' as 'daily' | 'weekly' | 'monthly' | 'post_payday',
    dayOffsetAfterPayday: 2,
    walletId: '',
  });
  const [dcaSubmitting, setDcaSubmitting] = useState(false);
  const [dcaError, setDcaError] = useState<string | null>(null);

  // Stress-Test sliders
  const [cryptoDrop, setCryptoDrop] = useState<number>(30); // percentage drop
  const [equitiesDrop, setEquitiesDrop] = useState<number>(15);

  const rates = useMemo(() => {
    return data?.rates || { USD_TO_MAD: 10.05, EUR_TO_MAD: 10.95, USD_TO_EUR: 0.92 };
  }, [data?.rates]);

  // Convert MAD value to user's selected display currency
  const formatAmount = (madAmount: number) => {
    if (displayCurrency === 'USD') {
      const usd = madAmount / rates.USD_TO_MAD;
      return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (displayCurrency === 'EUR') {
      const eur = madAmount / rates.EUR_TO_MAD;
      return `€${eur.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${madAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
  };

  const handleRefreshQuotes = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Debts and net worth calculations
  const pendingReceivables = useMemo(() => {
    return debts
      .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
      .reduce((sum, d) => sum + (parseFloat(d.remainingBalance) || 0), 0);
  }, [debts]);

  const pendingPayables = useMemo(() => {
    return debts
      .filter((d) => d.type === 'Payable' && d.status === 'Pending')
      .reduce((sum, d) => sum + (parseFloat(d.remainingBalance) || 0), 0);
  }, [debts]);

  const totalLiquidCash = kpis?.totalLiquidity || 0;
  const totalInvestmentMad = data?.totalPortfolioValueMad || 0;
  const netWorthMad = totalLiquidCash + totalInvestmentMad + pendingReceivables - pendingPayables;

  // Next milestone
  const currentMilestone = NET_WORTH_MILESTONES.slice().reverse().find((m) => netWorthMad >= m.threshold);
  const nextMilestone = NET_WORTH_MILESTONES.find((m) => netWorthMad < m.threshold);
  const milestoneProgress = nextMilestone
    ? Math.min(100, Math.max(0, (netWorthMad / nextMilestone.threshold) * 100))
    : 100;

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    if (!data?.holdings) return [];
    return data.holdings.filter((h) => {
      const matchesType =
        assetFilter === 'all' ||
        (assetFilter === 'crypto' && h.assetType === 'crypto') ||
        (assetFilter === 'stocks' && (h.assetType === 'stock' || h.assetType === 'etf')) ||
        (assetFilter === 'bourse_local' && h.assetType === 'bourse_local') ||
        (assetFilter === 'other' && ['commodity', 'real_estate', 'custom'].includes(h.assetType));

      const matchesSearch =
        !searchQuery ||
        h.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesWallet = walletFilter === 'all' || h.walletId === walletFilter;

      return matchesType && matchesSearch && matchesWallet;
    });
  }, [data?.holdings, assetFilter, searchQuery, walletFilter]);

  // Portfolio Imbalance and Target Allocation Analysis
  const holdingsImbalanceAnalysis = useMemo(() => {
    if (!data?.holdings || data.holdings.length === 0) {
      return { items: [], totalDrift: 0, hasImbalance: false };
    }
    const totalMad = data.totalPortfolioValueMad || 1;
    let sumAbsoluteDrift = 0;

    const items = data.holdings.map((h) => {
      const units = parseFloat(h.units || '0') || 0;
      const currPrice = parseFloat(h.currentPrice || '0') || 0;
      const marketValLocal = units * currPrice;
      let marketValMad = marketValLocal;
      if (h.currency === 'USD') marketValMad = marketValLocal * rates.USD_TO_MAD;
      else if (h.currency === 'EUR') marketValMad = marketValLocal * rates.EUR_TO_MAD;

      const actualWeight = totalMad > 0 ? (marketValMad / totalMad) * 100 : 0;
      const targetWeight = parseFloat(h.targetAllocationPercent || '0') || 0;
      const drift = actualWeight - targetWeight;
      const isTargetSet = targetWeight > 0;

      let status: 'balanced' | 'overweight' | 'underweight' | 'no_target' = 'no_target';
      if (isTargetSet) {
        if (drift > 2) status = 'overweight';
        else if (drift < -2) status = 'underweight';
        else status = 'balanced';
      }

      // Desired monetary value at target allocation
      const targetValMad = (targetWeight / 100) * totalMad;
      // rebalanceDiffMad: positive means need to buy, negative means need to sell
      const rebalanceDiffMad = targetValMad - marketValMad;

      // Local currency amount needed
      let rebalanceDiffLocal = Math.abs(rebalanceDiffMad);
      if (h.currency === 'USD') rebalanceDiffLocal = rebalanceDiffLocal / rates.USD_TO_MAD;
      else if (h.currency === 'EUR') rebalanceDiffLocal = rebalanceDiffLocal / rates.EUR_TO_MAD;

      const rebalanceUnits = currPrice > 0 ? rebalanceDiffLocal / currPrice : 0;

      if (isTargetSet) {
        sumAbsoluteDrift += Math.abs(drift);
      }

      return {
        holding: h,
        units,
        currPrice,
        marketValLocal,
        marketValMad,
        actualWeight,
        targetWeight,
        drift,
        isTargetSet,
        status,
        targetValMad,
        rebalanceDiffMad,
        rebalanceDiffLocal,
        rebalanceUnits,
      };
    });

    const totalDrift = Math.round((sumAbsoluteDrift / 2) * 10) / 10;
    const hasImbalance = items.some((i) => i.status === 'overweight' || i.status === 'underweight');

    return { items, totalDrift, hasImbalance };
  }, [data?.holdings, data?.totalPortfolioValueMad, rates]);

  // Asset class breakdown
  const allocationBreakdown = useMemo(() => {
    if (!data?.holdings || data.holdings.length === 0) return [];
    const groups: Record<string, { label: string; totalMad: number; count: number; color: string }> = {
      crypto: { label: 'Crypto Assets', totalMad: 0, count: 0, color: 'bg-amber-500' },
      stock: { label: 'Equities & Stocks', totalMad: 0, count: 0, color: 'bg-blue-500' },
      etf: { label: 'Index & ETFs', totalMad: 0, count: 0, color: 'bg-indigo-500' },
      bourse_local: { label: 'Bourse de Casablanca', totalMad: 0, count: 0, color: 'bg-emerald-500' },
      commodity: { label: 'Commodities & Gold', totalMad: 0, count: 0, color: 'bg-yellow-500' },
      real_estate: { label: 'Real Estate / Land', totalMad: 0, count: 0, color: 'bg-orange-500' },
      custom: { label: 'Private / Custom', totalMad: 0, count: 0, color: 'bg-purple-500' },
    };

    let totalVal = 0;
    for (const h of data.holdings) {
      const units = parseFloat(h.units || '0') || 0;
      const price = parseFloat(h.currentPrice || '0') || 0;
      const localVal = units * price;
      let madVal = localVal;
      if (h.currency === 'USD') madVal = localVal * rates.USD_TO_MAD;
      else if (h.currency === 'EUR') madVal = localVal * rates.EUR_TO_MAD;

      const group = groups[h.assetType] || groups.custom;
      group.totalMad += madVal;
      group.count += 1;
      totalVal += madVal;
    }

    return Object.entries(groups)
      .filter(([_, g]) => g.totalMad > 0)
      .map(([key, g]) => ({
        key,
        label: g.label,
        totalMad: g.totalMad,
        count: g.count,
        percent: totalVal > 0 ? (g.totalMad / totalVal) * 100 : 0,
        color: g.color,
      }))
      .sort((a, b) => b.totalMad - a.totalMad);
  }, [data?.holdings, rates]);

  // Stress-Test computation
  const stressTestResult = useMemo(() => {
    let simulatedInvestmentsMad = 0;
    let cryptoDrawdownMad = 0;
    let equitiesDrawdownMad = 0;

    if (data?.holdings) {
      for (const h of data.holdings) {
        const units = parseFloat(h.units || '0') || 0;
        const price = parseFloat(h.currentPrice || '0') || 0;
        const localVal = units * price;
        let madVal = localVal;
        if (h.currency === 'USD') madVal = localVal * rates.USD_TO_MAD;
        else if (h.currency === 'EUR') madVal = localVal * rates.EUR_TO_MAD;

        if (h.assetType === 'crypto') {
          const dropLoss = (madVal * cryptoDrop) / 100;
          cryptoDrawdownMad += dropLoss;
          simulatedInvestmentsMad += madVal - dropLoss;
        } else if (['stock', 'etf', 'bourse_local'].includes(h.assetType)) {
          const dropLoss = (madVal * equitiesDrop) / 100;
          equitiesDrawdownMad += dropLoss;
          simulatedInvestmentsMad += madVal - dropLoss;
        } else {
          simulatedInvestmentsMad += madVal;
        }
      }
    }

    const totalDrawdownMad = cryptoDrawdownMad + equitiesDrawdownMad;
    const simulatedNetWorthMad = totalLiquidCash + simulatedInvestmentsMad + pendingReceivables - pendingPayables;

    return {
      simulatedInvestmentsMad,
      simulatedNetWorthMad,
      totalDrawdownMad,
      cryptoDrawdownMad,
      equitiesDrawdownMad,
      runwaySafe: totalLiquidCash >= (kpis?.emergencyBuffer || 0),
    };
  }, [data?.holdings, cryptoDrop, equitiesDrop, rates, totalLiquidCash, pendingReceivables, pendingPayables, kpis?.emergencyBuffer]);

  // Fetch Market Coins from CoinGecko
  const fetchMarketCoins = async (forceRefresh = false) => {
    setMarketLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const vsCurr = displayCurrency === 'MAD' ? 'mad' : displayCurrency === 'EUR' ? 'eur' : 'usd';
      const coins = await dashboardService.getMarketCoins(vsCurr, 60, forceRefresh, token);
      if (Array.isArray(coins)) {
        setMarketCoins(coins);
      }
    } catch (e) {
      console.warn('Failed to fetch CoinGecko market coins:', e);
    } finally {
      setMarketLoading(false);
    }
  };

  // Trigger market fetch when market tab is active or display currency changes
  useEffect(() => {
    if (activeSubTab === 'market') {
      fetchMarketCoins();
    }
  }, [activeSubTab, displayCurrency]);

  // Coin search with CoinGecko
  useEffect(() => {
    if (!marketSearch.trim()) {
      setMarketSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingMarket(true);
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const results = await dashboardService.searchCoins(marketSearch.trim(), token);
        setMarketSearchResults(results || []);
      } catch (err) {
        console.warn('Search coins error:', err);
      } finally {
        setIsSearchingMarket(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [marketSearch]);

  // Fetch live spot price helper
  const fetchSpotPriceQuote = async (symbol: string, coinId?: string) => {
    if (!symbol) return null;
    setFetchingSpotPrice(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const quote = await dashboardService.getSpotPrice(symbol, coinId, token);
      if (quote) {
        setLiveSpotQuote(quote);
        return quote;
      }
    } catch (e) {
      console.warn('Spot price query error:', e);
    } finally {
      setFetchingSpotPrice(false);
    }
    return null;
  };

  // Fetch Trending Coins from CoinGecko
  const fetchTrendingCoins = async () => {
    setTrendingLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const coins = await dashboardService.getTrendingCoins(token);
      if (Array.isArray(coins)) {
        setTrendingCoins(coins);
      }
    } catch (e) {
      console.warn('Failed to fetch CoinGecko trending coins:', e);
    } finally {
      setTrendingLoading(false);
    }
  };

  // Fetch deep coin market details
  const openCoinDetails = async (coinId: string) => {
    if (!coinId) return;
    setLoadingCoinDetail(true);
    setSelectedCoinDetail(null);
    try {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const details = await dashboardService.getCoinDetails(coinId, token);
      if (details) {
        setSelectedCoinDetail(details);
      }
    } catch (e) {
      console.warn('Failed to fetch coin details:', e);
    } finally {
      setLoadingCoinDetail(false);
    }
  };

  // Quick Buy helper for any coin from CoinGecko
  const handleQuickBuy = (coin: { symbol: string; name: string; id?: string; current_price?: number; priceMad?: number; priceUsd?: number }) => {
    const sym = (coin.symbol || '').toUpperCase();
    const existingHolding = (data?.holdings || []).find((h) => h.symbol.toUpperCase() === sym);
    if (existingHolding) {
      openTradeModal(existingHolding, 'BUY');
    } else {
      openAddHoldingForCoin({
        symbol: sym,
        name: coin.name,
        current_price: coin.current_price || coin.priceUsd,
        id: coin.id,
      });
    }
  };

  // Initial fetch of trending coins
  useEffect(() => {
    fetchTrendingCoins();
  }, []);

  // Watchlist set
  const watchlistSet = useMemo(() => {
    const set = new Set<string>();
    if (data?.watchlist) {
      for (const w of data.watchlist) {
        set.add(w.coinId);
        set.add(w.symbol.toUpperCase());
      }
    }
    return set;
  }, [data?.watchlist]);

  const handleToggleWatchlist = async (coin: { id: string; symbol: string; name: string }) => {
    const isWatched = watchlistSet.has(coin.id) || watchlistSet.has(coin.symbol.toUpperCase());
    try {
      if (isWatched) {
        if (onRemoveFromWatchlist) {
          await onRemoveFromWatchlist(coin.id);
        }
      } else {
        if (onAddToWatchlist) {
          await onAddToWatchlist({
            coinId: coin.id,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
          });
        }
      }
      // Update local state if needed
      setMarketCoins((prev) =>
        prev.map((c) => (c.id === coin.id ? { ...c, isWatched: !isWatched } : c))
      );
    } catch (e: any) {
      console.error('Watchlist toggle error:', e);
    }
  };

  // Hook for instant CoinGecko search in Add Holding Modal
  useEffect(() => {
    if (!showAddHoldingModal || !holdingSearchQuery.trim()) {
      setHoldingSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingHolding(true);
      try {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
        const results = await dashboardService.searchCoins(holdingSearchQuery.trim(), token);
        setHoldingSearchResults(results || []);
      } catch (err) {
        console.warn('Holding search coins error:', err);
      } finally {
        setIsSearchingHolding(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [showAddHoldingModal, holdingSearchQuery]);

  // Create Investment Wallet submit
  const handleCreateInvestmentWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) {
      setWalletCreationError('Please enter a wallet name');
      return;
    }
    if (!onCreateWallet) {
      setWalletCreationError('Wallet creation handler is not provided');
      return;
    }
    setIsCreatingWallet(true);
    setWalletCreationError(null);
    try {
      const created = await onCreateWallet({
        name: newWalletName.trim(),
        type: 'Investment',
        initialBalance: parseFloat(newWalletInitialBalance) || 0,
      });
      setShowCreateInvestmentWalletModal(false);
      setNewWalletName('Binance Account');
      setNewWalletInitialBalance('0');
      if (created?.id) {
        setHoldingForm((prev) => ({ ...prev, walletId: created.id }));
        setTradeWalletId(created.id);
      }
      await onRefresh();
    } catch (err: any) {
      setWalletCreationError(err?.message || 'Failed to create investment wallet');
    } finally {
      setIsCreatingWallet(false);
    }
  };

  // Instant selection of coin from CoinGecko search or popular chips
  const handleSelectCoinForHolding = async (coin: { symbol: string; name: string; id?: string }) => {
    setHoldingSearchQuery('');
    setHoldingSearchResults([]);
    const curr = displayCurrency === 'MAD' ? 'MAD' : displayCurrency === 'EUR' ? 'EUR' : 'USD';
    setHoldingForm((prev) => ({
      ...prev,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      assetType: 'crypto',
      currency: curr,
      walletId: prev.walletId || investmentWallets[0]?.id || wallets[0]?.id || '',
    }));
    const quote = await fetchSpotPriceQuote(coin.symbol, coin.id);
    if (quote) {
      let p = quote.priceUsd;
      if (curr === 'MAD') p = quote.priceMad;
      else if (curr === 'EUR') p = quote.priceEur;
      if (p > 0) {
        setHoldingForm((prev) => {
          const nextForm = {
            ...prev,
            currentPrice: p.toString(),
            buyPriceAvg: prev.buyPriceAvg || p.toString(),
          };
          if (holdingTotalCash && parseFloat(holdingTotalCash) > 0) {
            nextForm.units = ((parseFloat(holdingTotalCash) || 0) / p).toFixed(6);
          }
          return nextForm;
        });
      }
    }
  };

  // 1-Click Open Rebalancing Trade
  const handleOpenRebalanceTrade = (item: (typeof holdingsImbalanceAnalysis.items)[0]) => {
    const h = item.holding;
    const isUnder = item.rebalanceDiffMad > 0;
    const tType: InvestmentTradeType = isUnder ? 'BUY' : 'SELL';

    setTradeModalHolding(h);
    setTradeType(tType);
    setTradePrice(item.currPrice.toString());
    setTradeUnits(item.rebalanceUnits.toFixed(6));
    setTradeTotal(item.rebalanceDiffLocal.toFixed(2));
    setTradeFees('0');
    setTradeWalletId(h.walletId || investmentWallets[0]?.id || wallets[0]?.id || '');
    setTradeNotes(
      `Auto-rebalance ${h.symbol} to target ${item.targetWeight}% allocation (drift: ${item.drift > 0 ? '+' : ''}${item.drift.toFixed(1)}%)`
    );
    setTradeError(null);
  };

  // Auto-distribute equal target allocation across all holdings
  const handleAutoDistributeEqualTargets = async () => {
    if (!data?.holdings || data.holdings.length === 0) return;
    setDistributingTargets(true);
    try {
      const equalPercent = Math.floor(100 / data.holdings.length);
      for (const h of data.holdings) {
        await onUpdateHolding(h.id, { targetAllocationPercent: equalPercent.toString() });
      }
      await onRefresh();
    } catch (e: any) {
      console.warn('Error distributing targets:', e);
    } finally {
      setDistributingTargets(false);
    }
  };

  // Open Trade Modal
  const openTradeModal = async (holding: InvestmentHolding, type: InvestmentTradeType = 'BUY') => {
    setTradeModalHolding(holding);
    setTradeType(type);
    const currPrice = parseFloat(holding.currentPrice || '0') || 0;
    setTradePrice(currPrice.toString());
    setTradeUnits('');
    setTradeTotal('');
    setTradeFees('0');
    setTradeWalletId(holding.walletId || investmentWallets[0]?.id || wallets[0]?.id || '');
    setTradeNotes('');
    setTradeError(null);

    // Fetch freshest live price from CoinGecko in background to prefill
    const spot = await fetchSpotPriceQuote(holding.symbol);
    if (spot) {
      let targetPrice = spot.priceUsd;
      if (holding.currency === 'MAD') targetPrice = spot.priceMad;
      else if (holding.currency === 'EUR') targetPrice = spot.priceEur;
      if (targetPrice > 0) {
        setTradePrice(targetPrice.toString());
      }
    }
  };

  // Open Add Holding Modal from Market Coin
  const openAddHoldingForCoin = (coin: { symbol: string; name: string; current_price?: number; id?: string }) => {
    setEditingHolding(null);
    setHoldingSearchQuery('');
    setHoldingSearchResults([]);
    setHoldingTotalCash('');
    let currPrice = coin.current_price?.toString() || '';
    setHoldingForm({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      assetType: 'crypto',
      units: '',
      buyPriceAvg: currPrice,
      currentPrice: currPrice,
      currency: displayCurrency === 'MAD' ? 'MAD' : displayCurrency === 'EUR' ? 'EUR' : 'USD',
      walletId: investmentWallets[0]?.id || wallets[0]?.id || '',
      targetAllocationPercent: '0',
      dividendYieldPercent: '0',
      notes: '',
    });
    setHoldingError(null);
    setShowAddHoldingModal(true);
    fetchSpotPriceQuote(coin.symbol, coin.id);
  };

  // Open DCA for Coin
  const openDcaForCoin = (coin: { symbol: string; name: string; id?: string; current_price?: number }) => {
    setDcaForm({
      symbol: coin.symbol.toUpperCase(),
      assetName: coin.name,
      assetType: 'crypto',
      targetAmount: '500',
      currency: displayCurrency,
      frequency: 'post_payday',
      dayOffsetAfterPayday: 2,
      walletId: investmentWallets[0]?.id || wallets[0]?.id || '',
    });
    setDcaError(null);
    setShowDcaModal(true);
  };

  // Open Add Holding Modal
  const openAddHoldingModal = (preset?: typeof POPULAR_ASSETS[0]) => {
    setEditingHolding(null);
    setHoldingSearchQuery('');
    setHoldingSearchResults([]);
    setHoldingTotalCash('');
    setHoldingForm({
      symbol: preset?.symbol || '',
      name: preset?.name || '',
      assetType: (preset?.assetType as any) || 'crypto',
      units: '',
      buyPriceAvg: '',
      currentPrice: '',
      currency: preset?.currency || (displayCurrency === 'MAD' ? 'MAD' : displayCurrency === 'EUR' ? 'EUR' : 'USD'),
      walletId: investmentWallets[0]?.id || wallets[0]?.id || '',
      targetAllocationPercent: '0',
      dividendYieldPercent: '0',
      notes: '',
    });
    setHoldingError(null);
    setShowAddHoldingModal(true);
    if (preset?.symbol) {
      fetchSpotPriceQuote(preset.symbol);
    }
  };

  // Open Edit Holding Modal
  const openEditHoldingModal = (h: InvestmentHolding) => {
    setEditingHolding(h);
    setHoldingForm({
      symbol: h.symbol,
      name: h.name,
      assetType: h.assetType,
      units: h.units || '0',
      buyPriceAvg: h.buyPriceAvg || '0',
      currentPrice: h.currentPrice || '0',
      currency: h.currency || 'USD',
      walletId: h.walletId || '',
      targetAllocationPercent: h.targetAllocationPercent || '0',
      dividendYieldPercent: h.dividendYieldPercent || '0',
      notes: h.notes || '',
    });
    setHoldingError(null);
    setShowAddHoldingModal(true);
  };

  // Handle Save Holding
  const handleSaveHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdingForm.symbol.trim()) {
      setHoldingError('Please specify asset symbol (e.g. BTC, AAPL, VOO)');
      return;
    }
    setHoldingSubmitting(true);
    setHoldingError(null);
    try {
      if (editingHolding) {
        await onUpdateHolding(editingHolding.id, {
          symbol: holdingForm.symbol.toUpperCase().trim(),
          name: holdingForm.name.trim() || holdingForm.symbol.toUpperCase().trim(),
          assetType: holdingForm.assetType,
          units: holdingForm.units || '0',
          buyPriceAvg: holdingForm.buyPriceAvg || '0',
          currentPrice: holdingForm.currentPrice || holdingForm.buyPriceAvg || '0',
          currency: holdingForm.currency,
          walletId: holdingForm.walletId || null,
          targetAllocationPercent: holdingForm.targetAllocationPercent || '0',
          dividendYieldPercent: holdingForm.dividendYieldPercent || '0',
          notes: holdingForm.notes || null,
        });
      } else {
        await onCreateHolding({
          symbol: holdingForm.symbol.toUpperCase().trim(),
          name: holdingForm.name.trim() || holdingForm.symbol.toUpperCase().trim(),
          assetType: holdingForm.assetType,
          units: holdingForm.units || '0',
          buyPriceAvg: holdingForm.buyPriceAvg || '0',
          currentPrice: holdingForm.currentPrice || holdingForm.buyPriceAvg || '0',
          currency: holdingForm.currency,
          walletId: holdingForm.walletId || null,
          targetAllocationPercent: holdingForm.targetAllocationPercent || '0',
          dividendYieldPercent: holdingForm.dividendYieldPercent || '0',
          notes: holdingForm.notes || null,
        });
      }
      setShowAddHoldingModal(false);
      setEditingHolding(null);
    } catch (err: any) {
      setHoldingError(err.message || 'Failed to save holding');
    } finally {
      setHoldingSubmitting(false);
    }
  };

  // Handle Execute Trade
  const handleExecuteTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tradeModalHolding) return;
    const units = parseFloat(tradeUnits) || 0;
    const price = parseFloat(tradePrice) || 0;
    const total = parseFloat(tradeTotal) || units * price;
    const fees = parseFloat(tradeFees) || 0;

    if (tradeType !== 'DIVIDEND' && tradeType !== 'STAKING_REWARD' && units <= 0) {
      setTradeError('Units must be greater than 0');
      return;
    }
    if (total <= 0) {
      setTradeError('Total amount must be greater than 0');
      return;
    }

    setTradeSubmitting(true);
    setTradeError(null);
    try {
      await onExecuteTrade({
        holdingId: tradeModalHolding.id,
        type: tradeType,
        units,
        pricePerUnit: price,
        totalAmount: total,
        fees,
        walletId: tradeWalletId || null,
        notes: tradeNotes || undefined,
      });
      setTradeModalHolding(null);
    } catch (err: any) {
      setTradeError(err.message || 'Failed to execute trade');
    } finally {
      setTradeSubmitting(false);
    }
  };

  // Handle Save DCA Plan
  const handleSaveDcaPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmount = parseFloat(dcaForm.targetAmount);
    if (!targetAmount || targetAmount <= 0) {
      setDcaError('Please enter a valid recurring target amount');
      return;
    }
    setDcaSubmitting(true);
    setDcaError(null);
    try {
      await onCreateDcaPlan({
        symbol: dcaForm.symbol.toUpperCase().trim(),
        assetName: dcaForm.assetName.trim(),
        assetType: dcaForm.assetType,
        targetAmount: dcaForm.targetAmount,
        currency: dcaForm.currency,
        frequency: dcaForm.frequency,
        dayOffsetAfterPayday: dcaForm.dayOffsetAfterPayday,
        walletId: dcaForm.walletId || null,
      });
      setShowDcaModal(false);
    } catch (err: any) {
      setDcaError(err.message || 'Failed to create DCA plan');
    } finally {
      setDcaSubmitting(false);
    }
  };

  const getAssetBadge = (type: InvestmentAssetType) => {
    switch (type) {
      case 'crypto':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">🪙 Crypto</span>;
      case 'stock':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">📈 Stock</span>;
      case 'etf':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">📊 ETF</span>;
      case 'bourse_local':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">🏛️ Bourse BVC</span>;
      case 'commodity':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300">🥇 Gold/Metals</span>;
      case 'real_estate':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300">🏡 Real Estate</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">💼 Custom</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-sm">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Investment & Wealth Operating System
                <span className="text-xs px-2 py-0.5 font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full">
                  Live Feeds
                </span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track crypto, stocks, local bourse, and compute your predictive Safe-to-Invest runway.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Currency Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            {(['MAD', 'USD', 'EUR'] as const).map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => setDisplayCurrency(curr)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  displayCurrency === curr
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshQuotes}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Prices</span>
          </Button>

          <Button
            size="sm"
            onClick={() => openAddHoldingModal()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Hero Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Investment Portfolio</span>
              <Coins className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatAmount(data?.totalPortfolioValueMad || 0)}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Cost Basis:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {formatAmount(data?.totalCostBasisMad || 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Unrealized P&L */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Unrealized P&L</span>
              {(data?.totalUnrealizedPnlMad || 0) >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  (data?.totalUnrealizedPnlMad || 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {(data?.totalUnrealizedPnlMad || 0) >= 0 ? '+' : ''}
                {formatAmount(data?.totalUnrealizedPnlMad || 0)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  (data?.totalUnrealizedPnlPercent || 0) >= 0
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                }`}
              >
                {(data?.totalUnrealizedPnlPercent || 0) >= 0 ? '+' : ''}
                {(data?.totalUnrealizedPnlPercent || 0).toFixed(2)}%
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Live paper return on current holdings
            </p>
          </CardContent>
        </Card>

        {/* Safe-to-Invest Monthly Surplus */}
        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-transparent dark:from-emerald-950/20 shadow-sm relative group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <span>Safe-to-Invest (This Month)</span>
                <button
                  type="button"
                  onClick={() => setInfoModal('safe-to-invest')}
                  className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors"
                  title="What is Safe-to-Invest? Click for explanation"
                >
                  <CircleAlert className="h-3.5 w-3.5" />
                </button>
              </div>
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {formatAmount(data?.safeToInvest?.safeToInvestMonthly || 0)}
            </div>
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 truncate flex items-center justify-between">
              <span>
                {data?.safeToInvest?.surplusAfterDca !== undefined && (
                  <>Surplus after DCA: {formatAmount(data.safeToInvest.surplusAfterDca)}</>
                )}
              </span>
              <button
                type="button"
                onClick={() => setInfoModal('safe-to-invest')}
                className="text-[11px] underline font-medium hover:text-emerald-800 dark:hover:text-emerald-200"
              >
                Why Safe?
              </button>
            </p>
          </CardContent>
        </Card>

        {/* Passive Income & FIRE Progress */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm relative group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <span>Passive Yield & FIRE</span>
                <button
                  type="button"
                  onClick={() => setInfoModal('fire')}
                  className="text-amber-500 hover:text-amber-700 dark:text-amber-400 transition-colors"
                  title="What is Passive Yield & FIRE? Click for explanation"
                >
                  <CircleAlert className="h-3.5 w-3.5" />
                </button>
              </div>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatAmount(data?.annualPassiveIncomeMad || 0)}
              <span className="text-xs font-normal text-gray-500 ml-1">/yr</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Living Costs Covered:</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {(data?.fireCoveragePercent || 0).toFixed(1)}% FIRE
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* COINGECKO LIVE TRENDING TICKER & QUICK LAUNCH */}
      {trendingCoins && trendingCoins.length > 0 && (
        <div className="rounded-2xl border border-orange-200/70 dark:border-orange-950/40 bg-gradient-to-r from-orange-50/40 via-white to-amber-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-orange-950/20 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-orange-950 dark:text-orange-200 tracking-tight">
                <Flame className="h-4 w-4 text-orange-500 fill-orange-500 animate-pulse" />
                CoinGecko Live Trending Ticker
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/70 dark:text-orange-300 font-bold border border-orange-200 dark:border-orange-900/40">
                Top {trendingCoins.length} Real-Time
              </span>
            </div>
            <button
              type="button"
              onClick={fetchTrendingCoins}
              disabled={trendingLoading}
              className="text-[11px] text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 font-medium transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${trendingLoading ? 'animate-spin' : ''}`} />
              <span>{trendingLoading ? 'Updating...' : 'Sync Ticker'}</span>
            </button>
          </div>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {trendingCoins.map((coin) => (
              <div
                key={coin.id}
                onClick={() => openCoinDetails(coin.coinId || coin.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200/90 dark:border-gray-800 bg-white/90 dark:bg-gray-800/80 shrink-0 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer group shadow-2xs hover:shadow-xs"
                title={`Click for deep real-time CoinGecko analytics on ${coin.name}`}
              >
                {coin.thumb ? (
                  <img src={coin.thumb} alt={coin.name} className="w-5 h-5 rounded-full shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                    {coin.symbol?.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {coin.symbol}
                    </span>
                    {coin.marketCapRank && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 font-semibold">
                        #{coin.marketCapRank}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {displayCurrency === 'USD' ? `$${coin.priceUsd}` : `${coin.priceMad?.toFixed(2)} MAD`}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        coin.change24h >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {coin.change24h >= 0 ? '+' : ''}{coin.change24h}%
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickBuy(coin);
                  }}
                  className="ml-1 px-2 py-1 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/60 dark:hover:bg-indigo-600 dark:text-indigo-300 transition-colors shadow-2xs"
                  title="Quick Log / Buy Position"
                >
                  + Hold
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADVISORY BANNER: NO INVESTMENT WALLET FOUND */}
      {investmentWallets.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-indigo-50/70 dark:from-indigo-950/30 dark:via-blue-950/20 dark:to-indigo-950/30 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
                <WalletIcon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Connect an Investment Wallet (e.g. Binance, IBKR, Crypto Exchange)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Recommended Setup
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                  You don't have an <strong>Investment Wallet</strong> yet. In TrueSpend, money in Investment Wallets is treated like <strong>Savings</strong>: strictly ring-fenced from everyday checking, excluded from daily living expenses, and omitted from Safe-to-Spend calculations. Create one now to track uninvested trading cash and link your assets!
                </p>
                <div className="flex items-center gap-4 pt-1 text-[11px] text-indigo-700 dark:text-indigo-300 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Excluded from Living Expenses
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ring-fenced from Safe-to-Spend
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Auto-sync Buy/Sell Trades
                  </span>
                </div>
              </div>
            </div>
            {onCreateWallet && (
              <Button
                onClick={() => {
                  setNewWalletName('Binance Account');
                  setNewWalletInitialBalance('0');
                  setShowCreateInvestmentWalletModal(true);
                }}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create Investment Wallet
              </Button>
            )}
          </div>
        </div>
      )}

      {/* CONNECTED INVESTMENT WALLETS & BROKERAGE CASH WIDGET */}
      {investmentWallets.length > 0 && (
        <Card className="border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-indigo-950/20 shadow-xs">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100/60 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      Investment Wallets & Brokerage Cash
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Excluded from Living Expenses
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Total Brokerage Cash: <strong className="text-indigo-600 dark:text-indigo-400">{formatAmount(totalInvestmentWalletsCash)}</strong> across {investmentWallets.length} wallet(s). Ring-fenced like Savings.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {walletFilter !== 'all' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setWalletFilter('all')}
                    className="text-xs text-gray-500 hover:text-gray-700 h-8"
                  >
                    Clear Filter ({walletFilter})
                  </Button>
                )}
                {onCreateWallet && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewWalletName('');
                      setNewWalletInitialBalance('0');
                      setShowCreateInvestmentWalletModal(true);
                    }}
                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 h-8 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New Investment Wallet
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3">
              {investmentWallets.map((w) => {
                const linkedHoldingsCount = (data?.holdings || []).filter((h) => h.walletId === w.id).length;
                const isFiltered = walletFilter === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => setWalletFilter(isFiltered ? 'all' : w.id)}
                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                      isFiltered
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {w.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                        Investment
                      </span>
                    </div>
                    <div className="mt-2 text-base font-extrabold text-gray-950 dark:text-white">
                      {formatAmount(Number(w.balance) || 0)}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{linkedHoldingsCount} linked asset(s)</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                        {isFiltered ? 'Filtered ✓' : 'Filter by'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Balance Sheet & Net Worth Section */}
      <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-850 dark:to-gray-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  Unified Net Worth Engine
                </span>
                {currentMilestone && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                    <span>{currentMilestone.icon}</span>
                    <span>{currentMilestone.label}</span>
                  </span>
                )}
              </div>
              <div className="text-3xl font-extrabold text-gray-950 dark:text-white">
                {formatAmount(netWorthMad)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Liquid Wallets + Investments + Receivables - Payables
              </p>
            </div>

            {/* Formula Breakdown chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Liquid Cash</span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatAmount(totalLiquidCash)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">+ Investments</span>
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {formatAmount(totalInvestmentMad)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">+ Receivables</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatAmount(pendingReceivables)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-gray-500 dark:text-gray-400 block">- Payables</span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {formatAmount(pendingPayables)}
                </span>
              </div>
            </div>
          </div>

          {/* Milestone Progress Bar */}
          {nextMilestone && (
            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1.5">
                <span className="flex items-center gap-1 font-medium">
                  <span>Next Wealth Milestone:</span>
                  <span className="text-gray-900 dark:text-gray-100 font-bold">{nextMilestone.label}</span>
                </span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {milestoneProgress.toFixed(0)}% ({formatAmount(nextMilestone.threshold - netWorthMad)} remaining)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${milestoneProgress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('holdings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'holdings'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Coins className="h-4 w-4" />
          Holdings & Positions ({data?.holdings?.length || 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('market')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'market'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Globe className="h-4 w-4" />
          Markets & Watchlist (CoinGecko Live)
          {data?.watchlist && data.watchlist.length > 0 && (
            <span className="ml-1 text-[11px] px-1.5 py-0.2 bg-amber-400 text-gray-900 font-bold rounded-full">
              {data.watchlist.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('safe-to-invest')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'safe-to-invest'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Safe-to-Invest & DCA Planner
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('allocation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'allocation'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <PieChart className="h-4 w-4" />
          Asset Allocation & Rebalancing
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('stress-test')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'stress-test'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Market Stress-Test (What-If)
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 ${
            activeSubTab === 'ledger'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <History className="h-4 w-4" />
          Trade & Dividend Ledger ({data?.transactions?.length || 0})
        </button>
      </div>

      {/* SUB-TAB 1: HOLDINGS & POSITIONS */}
      {activeSubTab === 'holdings' && (
        <div className="space-y-4">
          {/* Filter Bar & Quick presets */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: 'All Assets' },
                { id: 'crypto', label: '🪙 Crypto' },
                { id: 'stocks', label: '📈 Stocks & ETFs' },
                { id: 'bourse_local', label: '🏛️ Bourse BVC' },
                { id: 'other', label: '🥇 Gold & Others' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAssetFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    assetFilter === f.id
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-xs'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <Input
                type="text"
                placeholder="Search symbol or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs h-9 bg-white dark:bg-gray-800"
              />
            </div>
          </div>

          {/* Quick Popular Asset Chips when portfolio is empty or for easy adds */}
          {(!data?.holdings || data.holdings.length === 0) && (
            <Card className="border-dashed border-2 border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-850/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    No investment holdings yet
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mt-1">
                    Start tracking your crypto bags, international stock portfolios, or Casablanca BVC shares. Live prices update automatically.
                  </p>
                </div>

                <div className="pt-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-2">
                    Popular Assets:
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {POPULAR_ASSETS.slice(0, 8).map((preset) => (
                      <button
                        key={preset.symbol}
                        type="button"
                        onClick={() => openAddHoldingModal(preset)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-500 text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 shadow-xs transition-all"
                      >
                        <Plus className="h-3.5 w-3.5 text-blue-500" />
                        {preset.symbol} ({preset.name})
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Holdings Grid / Table */}
          {filteredHoldings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHoldings.map((h) => {
                const units = parseFloat(h.units || '0') || 0;
                const buyPrice = parseFloat(h.buyPriceAvg || '0') || 0;
                const currPrice = parseFloat(h.currentPrice || '0') || 0;
                const marketValLocal = units * currPrice;
                const costBasisLocal = units * buyPrice;
                const pnlLocal = marketValLocal - costBasisLocal;
                const pnlPct = costBasisLocal > 0 ? (pnlLocal / costBasisLocal) * 100 : 0;
                const change24h = h.change24h || 0;

                let marketValMad = marketValLocal;
                if (h.currency === 'USD') marketValMad = marketValLocal * rates.USD_TO_MAD;
                else if (h.currency === 'EUR') marketValMad = marketValLocal * rates.EUR_TO_MAD;

                const linkedWallet = wallets.find((w) => w.id === h.walletId);
                const imbItem = holdingsImbalanceAnalysis.items.find((i) => i.holding.id === h.id);

                return (
                  <Card
                    key={h.id}
                    className="border-gray-200 dark:border-gray-800 hover:shadow-md transition-all group overflow-hidden"
                  >
                    <CardContent className="p-5 space-y-3.5">
                      {/* Card Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                              {h.symbol}
                            </span>
                            {getAssetBadge(h.assetType)}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                              {h.name}
                            </p>
                            {linkedWallet ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                💼 {linkedWallet.name}
                              </span>
                            ) : (
                              <span className="text-[10px] px-1 py-0.2 rounded text-gray-400">
                                Unlinked
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 24h ticker badge */}
                        <div
                          className={`text-right text-xs px-2 py-0.5 rounded-md font-semibold flex items-center gap-0.5 ${
                            change24h >= 0
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          }`}
                        >
                          {change24h >= 0 ? '+' : ''}
                          {change24h.toFixed(2)}%
                        </div>
                      </div>

                      {/* Position Values */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <div>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Position Value</span>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                            {formatAmount(marketValMad)}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {units.toLocaleString()} {h.symbol}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Unrealized P&L</span>
                          <span
                            className={`text-base font-bold ${
                              pnlLocal >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {pnlLocal >= 0 ? '+' : ''}
                            {pnlPct.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {pnlLocal >= 0 ? '+' : ''}
                            {formatAmount(
                              h.currency === 'USD'
                                ? pnlLocal * rates.USD_TO_MAD
                                : h.currency === 'EUR'
                                ? pnlLocal * rates.EUR_TO_MAD
                                : pnlLocal
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Target vs Actual Imbalance Bar */}
                      {imbItem && imbItem.isTargetSet && (
                        <div className="bg-indigo-50/40 dark:bg-indigo-950/20 px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between border border-indigo-100/60 dark:border-indigo-900/30">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">Target / Actual:</span>
                            <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100">
                              {imbItem.targetWeight}% ➔ {imbItem.actualWeight.toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            {imbItem.status === 'balanced' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Balanced ✓
                              </span>
                            )}
                            {imbItem.status === 'overweight' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                                +{imbItem.drift.toFixed(1)}% Over
                              </span>
                            )}
                            {imbItem.status === 'underweight' && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                {imbItem.drift.toFixed(1)}% Under
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pricing Details */}
                      <div className="bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-lg text-xs flex justify-between items-center text-gray-600 dark:text-gray-400">
                        <div>
                          <span className="block text-[10px] text-gray-400">Current Spot Price</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {currPrice.toLocaleString()} {h.currency}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-gray-400">Avg Cost Basis</span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {buyPrice.toLocaleString()} {h.currency}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2 flex items-center justify-between gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openTradeModal(h, 'BUY')}
                            className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                          >
                            + Buy
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openTradeModal(h, 'SELL')}
                            className="h-8 px-2.5 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-medium"
                          >
                            - Sell
                          </Button>
                          {imbItem && (imbItem.status === 'overweight' || imbItem.status === 'underweight') && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenRebalanceTrade(imbItem)}
                              className="h-8 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1 shadow-xs"
                              title={`1-Click Rebalance: ${imbItem.rebalanceDiffMad > 0 ? 'Buy' : 'Sell'} ${formatAmount(Math.abs(imbItem.rebalanceDiffMad))}`}
                            >
                              <Sparkles className="h-3 w-3" />
                              Rebalance
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openTradeModal(h, 'DIVIDEND')}
                            title="Record Dividend / Staking Yield"
                            className="h-8 px-2 text-xs border-amber-300 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          >
                            Yield
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditHoldingModal(h)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Edit Holding"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete holding ${h.symbol}?`)) {
                                onDeleteHolding(h.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Delete Holding"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: MARKETS & COIN WATCHLIST (COINGECKO LIVE) */}
      {activeSubTab === 'market' && (
        <div className="space-y-6">
          {/* Header & Category Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-500" />
                Live Crypto Markets & Personal Watchlist
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Powered by CoinGecko API. Live spot quotes converted in real-time to {displayCurrency}.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMarketCoins(true)}
                disabled={marketLoading}
                className="text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${marketLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Quotes</span>
              </Button>
            </div>
          </div>

          {/* Search and Category Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'all', label: '🔥 Top 50 Global' },
                { id: 'watchlist', label: `⭐ My Watchlist (${data?.watchlist?.length || 0})` },
                { id: 'gainers', label: '🚀 Top Gainers (24h)' },
                { id: 'l1', label: '⛓️ Layer 1 / Major' },
                { id: 'defi', label: '🏦 DeFi' },
                { id: 'memes', label: '🐶 Memes' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setMarketCategory(c.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    marketCategory === c.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search CoinGecko Input */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search any token (e.g. SUI, PEPE, SOL)..."
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                className="pl-8 text-xs h-9 bg-white dark:bg-gray-800"
              />
              {isSearchingMarket && (
                <RefreshCw className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Search Results Dropdown/Box if user is searching */}
          {marketSearch.trim() && marketSearchResults.length > 0 && (
            <Card className="border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-indigo-100 dark:border-indigo-900/30">
                <CardTitle className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                  <span>CoinGecko Search Results for "{marketSearch}"</span>
                  <span className="text-[11px] font-normal text-gray-500">{marketSearchResults.length} found</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {marketSearchResults.map((coin) => {
                    const isWatched = watchlistSet.has(coin.id) || watchlistSet.has(coin.symbol.toUpperCase());
                    return (
                      <div
                        key={coin.id}
                        className="p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-2 shadow-2xs hover:border-indigo-400 transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {coin.thumb && (
                            <img src={coin.thumb} alt={coin.name} className="w-6 h-6 rounded-full" />
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block truncate">
                              {coin.symbol.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                              {coin.name} {coin.market_cap_rank ? `#${coin.market_cap_rank}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleWatchlist(coin)}
                            className={`p-1.5 rounded-md text-xs transition-colors ${
                              isWatched
                                ? 'text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                                : 'text-gray-400 hover:text-amber-500'
                            }`}
                            title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
                          >
                            <Star className={`h-4 w-4 ${isWatched ? 'fill-amber-500' : ''}`} />
                          </button>
                          <Button
                            size="sm"
                            onClick={() => openAddHoldingForCoin(coin)}
                            className="h-7 px-2 text-[11px] bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            + Hold
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Market Coins Table */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {marketLoading && marketCoins.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                  <span>Connecting to CoinGecko Real-Time Market Feeds...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-gray-800">
                      <tr>
                        <th className="px-3 py-3 w-8 text-center">⭐</th>
                        <th className="px-3 py-3">#</th>
                        <th className="px-4 py-3">Coin / Asset</th>
                        <th className="px-4 py-3">Price ({displayCurrency})</th>
                        <th className="px-4 py-3">24h Change</th>
                        <th className="px-4 py-3 hidden sm:table-cell">24h High / Low</th>
                        <th className="px-4 py-3 hidden md:table-cell">Market Cap</th>
                        <th className="px-4 py-3 hidden lg:table-cell">24h Volume</th>
                        <th className="px-4 py-3 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {marketCoins
                        .filter((coin) => {
                          if (marketCategory === 'watchlist') {
                            return watchlistSet.has(coin.id) || watchlistSet.has(coin.symbol.toUpperCase());
                          }
                          if (marketCategory === 'gainers') {
                            return (coin.price_change_percentage_24h || 0) > 0;
                          }
                          if (marketCategory === 'l1') {
                            return ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'cardano', 'avalanche-2', 'sui', 'near', 'polkadot', 'tron', 'the-open-network'].includes(coin.id);
                          }
                          if (marketCategory === 'defi') {
                            return ['uniswap', 'chainlink', 'aave', 'maker', 'injective-protocol', 'render-token', 'fetch-ai'].includes(coin.id);
                          }
                          if (marketCategory === 'memes') {
                            return ['dogecoin', 'shiba-inu', 'pepe', 'bonk', 'dogwifcoin', 'floki'].includes(coin.id);
                          }
                          return true;
                        })
                        .sort((a, b) => {
                          if (marketCategory === 'gainers') {
                            return (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0);
                          }
                          return (a.market_cap_rank || 999) - (b.market_cap_rank || 999);
                        })
                        .map((coin) => {
                          const isWatched = watchlistSet.has(coin.id) || watchlistSet.has(coin.symbol.toUpperCase());
                          const change = coin.price_change_percentage_24h || 0;
                          let priceFormatted = `${coin.current_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${displayCurrency}`;
                          if (displayCurrency === 'USD') {
                            priceFormatted = `$${coin.current_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
                          } else if (displayCurrency === 'EUR') {
                            priceFormatted = `€${coin.current_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
                          } else if (displayCurrency === 'MAD') {
                            priceFormatted = `${coin.current_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} MAD`;
                          }

                          return (
                            <tr
                              key={coin.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-850/60 transition-colors group"
                            >
                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleWatchlist(coin)}
                                  className={`transition-colors ${
                                    isWatched
                                      ? 'text-amber-500'
                                      : 'text-gray-300 dark:text-gray-600 hover:text-amber-500'
                                  }`}
                                  title={isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
                                >
                                  <Star className={`h-4 w-4 ${isWatched ? 'fill-amber-500' : ''}`} />
                                </button>
                              </td>
                              <td className="px-3 py-3 text-gray-400 font-medium">
                                #{coin.market_cap_rank || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  {coin.image && (
                                    <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" />
                                  )}
                                  <div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                      <span>{coin.name}</span>
                                      <span className="text-[10px] uppercase font-semibold text-gray-400 px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800">
                                        {coin.symbol}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                                {priceFormatted}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                    change >= 0
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                  }`}
                                >
                                  {change >= 0 ? '+' : ''}
                                  {change.toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                                <div className="text-[11px]">
                                  <span className="text-emerald-600">H: {coin.high_24h?.toLocaleString()}</span>
                                  <span className="mx-1 text-gray-300">/</span>
                                  <span className="text-red-600">L: {coin.low_24h?.toLocaleString()}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium hidden md:table-cell">
                                {coin.market_cap ? `${(coin.market_cap / 1e9).toFixed(2)}B ${displayCurrency}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                                {coin.total_volume ? `${(coin.total_volume / 1e6).toFixed(1)}M ${displayCurrency}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openCoinDetails(coin.id)}
                                    className="h-7 px-2 text-[11px] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                    title="View Real-Time CoinGecko Stats & Sparkline"
                                  >
                                    <Activity className="h-3.5 w-3.5 mr-0.5" />
                                    Stats
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => openAddHoldingForCoin(coin)}
                                    className="h-7 px-2.5 text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs"
                                  >
                                    + Hold
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDcaForCoin(coin)}
                                    className="h-7 px-2 text-[11px] text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                                    title="Automate DCA plan"
                                  >
                                    DCA
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 2: SAFE-TO-INVEST & DCA PLANNER */}
      {activeSubTab === 'safe-to-invest' && (
        <div className="space-y-6">
          {/* Safe-to-Invest Intelligence Card */}
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-50 to-indigo-50/30 dark:from-emerald-950/30 dark:to-indigo-950/10 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    TrueSpend "Safe-to-Invest" Runway Engine
                    <button
                      type="button"
                      onClick={() => setInfoModal('safe-to-invest')}
                      className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 transition-colors ml-1"
                      title="Learn how Safe-to-Invest protects your cash flow"
                    >
                      <CircleAlert className="h-4 w-4" />
                    </button>
                  </CardTitle>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Calculates how much money you can invest this cycle without risking your rent, groceries, debt obligations, or emergency buffer.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">Safe Deployable Surplus</span>
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatAmount(data?.safeToInvest?.safeToInvestMonthly || 0)}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Recommendation Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-sm text-blue-950 dark:text-blue-200 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">TrueSpend Advisor Recommendation:</span>
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                    {data?.safeToInvest?.recommendationText || 'Your cash flow supports steady disciplined investing.'}
                  </p>
                </div>
              </div>

              {/* Step-by-Step Cash Flow Watermark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-1 relative group">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span>Monthly Income</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">Base</span>
                  </div>
                  <div className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {formatAmount(data?.safeToInvest?.monthlyIncome || 0)}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">
                    Salary & verified inflows
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10 space-y-1 relative group">
                  <div className="flex items-center justify-between text-[11px] text-red-700 dark:text-red-400 font-medium">
                    <span>- Fixed Budgets</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">Budgets</span>
                  </div>
                  <div className="text-base font-bold text-red-600 dark:text-red-400">
                    {formatAmount(data?.safeToInvest?.fixedObligations || 0)}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">
                    Configured fixed category budgets
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 space-y-1 relative group">
                  <div className="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                    <span>- Variable Budgets</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">Budgets</span>
                  </div>
                  <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                    {formatAmount(data?.safeToInvest?.variableSpendPace || 0)}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">
                    Configured living category budgets
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/20 dark:bg-purple-950/10 space-y-1 relative group">
                  <div className="flex items-center justify-between text-[11px] text-purple-800 dark:text-purple-400 font-medium">
                    <span>- Savings Reserve</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">Savings Wallets</span>
                  </div>
                  <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                    {formatAmount(data?.safeToInvest?.emergencyBufferDeficiency || 0)}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 block leading-tight">
                    Protected in Savings Wallets
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-1 relative shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
                    <span>= Safe Surplus</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">Surplus</span>
                  </div>
                  <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
                    {formatAmount(data?.safeToInvest?.safeToInvestMonthly || 0)}
                  </div>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 block leading-tight">
                    100% safe deployable capital
                  </span>
                </div>
              </div>

              {/* BUDGET INTEGRATION CARD: Link between BudgetsTab and Investments */}
              <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-r from-indigo-50/60 via-blue-50/30 to-purple-50/40 dark:from-indigo-950/30 dark:via-gray-900 dark:to-purple-950/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
                      <PieChart className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
                        Budget-Connected Investment Runway
                        {(data?.safeToInvest?.totalInvestmentBudget || 0) > 0 ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                            Budget Configured
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold">
                            Dynamic Surplus
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400">
                        Investments are directly synchronized with your <strong>📈 Investments</strong> budget and automated wallet transfers.
                      </p>
                    </div>
                  </div>
                  {setActiveTab && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('budgets')}
                      className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 shrink-0"
                    >
                      Configure in Budgets Tab →
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-indigo-100 dark:border-gray-700">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 block">
                      Monthly Investment Budget
                    </span>
                    <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {formatAmount(data?.safeToInvest?.totalInvestmentBudget || 0)}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      {(data?.safeToInvest?.totalInvestmentBudget || 0) > 0
                        ? 'Set in Monthly Budgets'
                        : 'Uncapped (uses cash surplus)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-indigo-100 dark:border-gray-700">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 block">
                      Funded This Month
                    </span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {formatAmount(data?.safeToInvest?.investedThisMonth || 0)}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Transfers to Inv. Wallets + Trades
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-indigo-100 dark:border-gray-700">
                    <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400 block">
                      Remaining Safe Room
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {formatAmount(data?.safeToInvest?.remainingInvestmentBudget || 0)}
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Available to deploy this cycle
                    </span>
                  </div>
                </div>

                {/* DCA Budget Status Pill */}
                {data?.safeToInvest?.dcaBudgetStatus && (
                  <div className="pt-1 flex items-center justify-between text-xs border-t border-indigo-100/60 dark:border-gray-800 text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      Monthly DCA Commitments ({formatAmount(data.safeToInvest.currentMonthlyDcaTarget)}):
                    </span>
                    <span className="font-bold flex items-center gap-1">
                      {data.safeToInvest.dcaBudgetStatus === 'fully_budgeted' && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          🛡️ Fully Covered by Investments Budget ({data.safeToInvest.dcaBudgetCoveragePercent}% allocation)
                        </span>
                      )}
                      {data.safeToInvest.dcaBudgetStatus === 'covered_by_surplus' && (
                        <span className="text-blue-600 dark:text-blue-400">
                          ✅ Covered by Safe Cash Flow Surplus
                        </span>
                      )}
                      {data.safeToInvest.dcaBudgetStatus === 'over_budget' && (
                        <span className="text-amber-600 dark:text-amber-400">
                          ⚠️ Exceeds Monthly Investments Budget
                        </span>
                      )}
                      {data.safeToInvest.dcaBudgetStatus === 'exceeds_capacity' && (
                        <span className="text-red-600 dark:text-red-400">
                          🚨 Exceeds Available Cash Capacity
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* DCA Recurring Planner Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-500" />
                Dollar-Cost Averaging (DCA) Automation Planner
                <button
                  type="button"
                  onClick={() => setInfoModal('dca')}
                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 transition-colors ml-1"
                  title="What is Dollar-Cost Averaging? Click for explanation"
                >
                  <CircleAlert className="h-4 w-4" />
                </button>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Schedule recurring investments linked to your Financial Calendar and Payday cycles.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowDcaModal(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="h-4 w-4" />
              New DCA Plan
            </Button>
          </div>

          {/* DCA Plans List */}
          {(!data?.dcaPlans || data.dcaPlans.length === 0) ? (
            <Card className="border-dashed border-2 border-gray-200 dark:border-gray-800">
              <CardContent className="p-8 text-center space-y-2">
                <Calendar className="h-8 w-8 text-gray-400 mx-auto" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  No active Dollar-Cost Averaging plans
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                  Automate recurring investments (e.g., "Invest 1,500 MAD into S&P 500 or Bitcoin 2 days after payday") to build wealth consistently.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.dcaPlans.map((plan) => {
                const planAmt = parseFloat(plan.targetAmount) || 0;
                let scheduleText = 'Every month';
                if (plan.frequency === 'post_payday') {
                  scheduleText = `${plan.dayOffsetAfterPayday} days after Payday`;
                } else if (plan.frequency === 'weekly') {
                  scheduleText = 'Every week';
                } else if (plan.frequency === 'daily') {
                  scheduleText = 'Every day';
                }

                return (
                  <Card key={plan.id} className="border-gray-200 dark:border-gray-800 shadow-xs">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {plan.symbol}
                            {getAssetBadge(plan.assetType)}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{plan.assetName}</p>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            plan.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {plan.status}
                        </span>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Target Amount:</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {planAmt.toLocaleString()} {plan.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Execution Schedule:</span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {scheduleText}
                          </span>
                        </div>
                        {plan.walletName && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Funding Wallet:</span>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">
                              {plan.walletName}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onUpdateDcaPlan(plan.id, {
                              status: plan.status === 'active' ? 'paused' : 'active',
                            });
                          }}
                          className="text-xs h-7"
                        >
                          {plan.status === 'active' ? 'Pause' : 'Activate'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => onDeleteDcaPlan(plan.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ASSET ALLOCATION & REBALANCING */}
      {activeSubTab === 'allocation' && (
        <div className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-indigo-500" />
                Portfolio Asset Allocation Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stacked Allocation Bar */}
              <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-800">
                {allocationBreakdown.map((item) => (
                  <div
                    key={item.key}
                    style={{ width: `${item.percent}%` }}
                    className={`${item.color} h-full transition-all`}
                    title={`${item.label}: ${item.percent.toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Allocation List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {allocationBreakdown.map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {item.percent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                      <span>Value: {formatAmount(item.totalMad)}</span>
                      <span>{item.count} position(s)</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rebalancing Intelligence Alert */}
              {allocationBreakdown.find((a) => a.key === 'crypto' && a.percent > 40) && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm block mb-1">Portfolio Risk Warning: High Crypto Concentration</span>
                    <p className="leading-relaxed">
                      Crypto currently represents {allocationBreakdown.find((a) => a.key === 'crypto')?.percent.toFixed(0)}% of your investment portfolio. Because crypto assets carry high volatility, TrueSpend recommends taking partial profits or rebalancing into stable assets (ETFs, gold, or liquid savings) to protect capital.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AUTOMATED PORTFOLIO REBALANCER & IMBALANCE ANALYSIS */}
          <Card className="border-indigo-100 dark:border-indigo-900/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-850 dark:to-indigo-950/30 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    Automated Portfolio Rebalancer & Target Imbalance
                  </CardTitle>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Target allocations vs live asset values. Execute 1-click rebalancing trades automatically without manual calculations.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={distributingTargets || !data?.holdings || data.holdings.length === 0}
                    onClick={handleAutoDistributeEqualTargets}
                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-medium"
                    title="Automatically assigns equal target weights to all assets (e.g. 25% each)"
                  >
                    <Sliders className="h-3.5 w-3.5 mr-1" />
                    {distributingTargets ? 'Setting...' : '⚖️ Auto-Distribute Equal Targets'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Drift & Imbalance Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block">
                    Portfolio Drift Index
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                      {holdingsImbalanceAnalysis.totalDrift}%
                    </span>
                    <span className="text-xs text-gray-400">total weight drift</span>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-center">
                  {holdingsImbalanceAnalysis.totalDrift <= 5 ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 w-full">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span><strong>Well Balanced:</strong> Your assets closely track your target distribution. No urgent rebalancing needed.</span>
                    </div>
                  ) : holdingsImbalanceAnalysis.totalDrift <= 15 ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50 w-full">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                      <span><strong>Moderate Imbalance:</strong> Some positions have grown or dipped beyond target tolerances. Rebalance to maintain risk limits.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 rounded-lg border border-red-200 dark:border-red-900/50 w-full">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span><strong>High Imbalance:</strong> Significant portfolio drift detected! One-click rebalance below to trim overweight bags or top up laggards.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Holdings Imbalance Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Current Value</th>
                      <th className="px-4 py-3">Target Weight</th>
                      <th className="px-4 py-3">Actual Weight</th>
                      <th className="px-4 py-3">Imbalance / Drift</th>
                      <th className="px-4 py-3">Suggested Rebalance</th>
                      <th className="px-4 py-3 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {holdingsImbalanceAnalysis.items.map((item) => {
                      const h = item.holding;
                      return (
                        <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{h.symbol}</span>
                              <span className="text-gray-400 font-normal">({h.name})</span>
                              {getAssetBadge(h.assetType)}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                            {formatAmount(item.marketValMad)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-gray-900 dark:text-gray-100">
                              {item.targetWeight}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-gray-100 w-12">
                                {item.actualWeight.toFixed(1)}%
                              </span>
                              <div className="w-16 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${Math.min(100, item.actualWeight)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'balanced' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" /> Balanced
                              </span>
                            )}
                            {item.status === 'overweight' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                <ArrowUpRight className="h-3 w-3" /> +{item.drift.toFixed(1)}% Overweight
                              </span>
                            )}
                            {item.status === 'underweight' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                <ArrowDownRight className="h-3 w-3" /> {item.drift.toFixed(1)}% Underweight
                              </span>
                            )}
                            {item.status === 'no_target' && (
                              <span className="text-gray-400 italic text-[11px]">
                                No target set
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {item.status === 'balanced' ? (
                              <span className="text-gray-400 font-normal">No trade needed</span>
                            ) : item.status === 'overweight' ? (
                              <span className="text-red-600 dark:text-red-400">
                                SELL {formatAmount(Math.abs(item.rebalanceDiffMad))}
                              </span>
                            ) : item.status === 'underweight' ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                BUY {formatAmount(item.rebalanceDiffMad)}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.status !== 'balanced' && item.status !== 'no_target' ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenRebalanceTrade(item)}
                                className="h-7 px-2.5 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs flex items-center gap-1 ml-auto"
                              >
                                <Sparkles className="h-3 w-3" />
                                ⚡ Rebalance
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditHoldingModal(h)}
                                className="h-7 px-2 text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                              >
                                Edit Target
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Target Allocation Quick Tuner */}
              <div className="p-4 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Sliders className="h-4 w-4 text-indigo-500" />
                    Quick Target Allocation Tuner
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Total Target:{' '}
                    <strong className={
                      holdingsImbalanceAnalysis.items.reduce((s, i) => s + i.targetWeight, 0) === 100
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }>
                      {holdingsImbalanceAnalysis.items.reduce((s, i) => s + i.targetWeight, 0)}%
                    </strong>
                    {' '}/ 100%
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {holdingsImbalanceAnalysis.items.map((item) => (
                    <div key={item.holding.id} className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{item.holding.symbol}</span>
                        <span className="text-[10px] text-gray-400">{item.actualWeight.toFixed(0)}% act.</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          defaultValue={item.targetWeight}
                          onBlur={async (e) => {
                            const val = e.target.value;
                            if (val !== item.targetWeight.toString()) {
                              await onUpdateHolding(item.holding.id, { targetAllocationPercent: val });
                              await onRefresh();
                            }
                          }}
                          className="h-7 text-xs px-1.5 text-center font-bold"
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 4: MARKET STRESS-TEST (WHAT-IF SIMULATOR) */}
      {activeSubTab === 'stress-test' && (
        <div className="space-y-6">
          <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-red-50/50 to-amber-50/50 dark:from-red-950/20 dark:to-amber-950/20 border-b border-gray-200 dark:border-gray-800">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <Sliders className="h-5 w-5 text-red-500" />
                Portfolio Volatility Stress-Testing Simulator
              </CardTitle>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Simulate sudden crypto crashes or equity market drawdowns to verify that your emergency runway and living buffer remain safe.
              </p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-amber-700 dark:text-amber-300">Crypto Crash Severity</span>
                    <span className="text-red-600 font-bold">-{cryptoDrop}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={cryptoDrop}
                    onChange={(e) => setCryptoDrop(parseInt(e.target.value, 10))}
                    className="w-full accent-red-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Mild (-10%)</span>
                    <span>Severe (-50%)</span>
                    <span>Extreme (-80%)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-blue-700 dark:text-blue-300">Stock & Bourse Market Correction</span>
                    <span className="text-red-600 font-bold">-{equitiesDrop}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={equitiesDrop}
                    onChange={(e) => setEquitiesDrop(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Pullback (-5%)</span>
                    <span>Correction (-20%)</span>
                    <span>Bear Market (-50%)</span>
                  </div>
                </div>
              </div>

              {/* Stress Test Simulation Results */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Simulated Net Worth</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatAmount(stressTestResult.simulatedNetWorthMad)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-1">
                    Baseline: {formatAmount(netWorthMad)}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">
                  <span className="text-xs text-red-700 dark:text-red-300 block mb-1">Total Paper Drawdown</span>
                  <span className="text-xl font-bold text-red-600 dark:text-red-400">
                    -{formatAmount(stressTestResult.totalDrawdownMad)}
                  </span>
                  <span className="text-[10px] text-red-600/80 block mt-1">
                    Crypto: -{formatAmount(stressTestResult.cryptoDrawdownMad)} | Equities: -{formatAmount(stressTestResult.equitiesDrawdownMad)}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <span className="text-xs text-emerald-800 dark:text-emerald-300 block mb-1">Runway & Liquidity Status</span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Liquid Cash Protected
                  </span>
                  <span className="text-[10px] text-emerald-600/80 block mt-1">
                    {formatAmount(totalLiquidCash)} remains untouched in liquid wallets
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUB-TAB 5: TRADE & DIVIDEND LEDGER */}
      {activeSubTab === 'ledger' && (
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-500" />
              Complete Investment Trade & Dividend History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(!data?.transactions || data.transactions.length === 0) ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No recorded buy, sell, or dividend transactions yet. Trades executed via the "+ Buy", "- Sell", or "Yield" buttons will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 uppercase tracking-wider text-[10px] border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Asset</th>
                      <th className="px-4 py-3">Units</th>
                      <th className="px-4 py-3">Price / Unit</th>
                      <th className="px-4 py-3">Total Amount</th>
                      <th className="px-4 py-3">Realized P&L</th>
                      <th className="px-4 py-3">Wallet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.transactions.map((t) => {
                      const units = parseFloat(t.units) || 0;
                      const price = parseFloat(t.pricePerUnit) || 0;
                      const total = parseFloat(t.totalAmount) || 0;
                      const realizedPnl = parseFloat(t.realizedPnl || '0') || 0;

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-850">
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                t.type === 'BUY'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : t.type === 'SELL'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {t.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                            {t.holdingSymbol || 'Asset'}
                          </td>
                          <td className="px-4 py-3">{units.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {price.toLocaleString()} {t.currency}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                            {total.toLocaleString()} {t.currency}
                          </td>
                          <td className="px-4 py-3">
                            {t.type === 'SELL' ? (
                              <span
                                className={`font-semibold ${
                                  realizedPnl >= 0 ? 'text-emerald-600' : 'text-red-600'
                                }`}
                              >
                                {realizedPnl >= 0 ? '+' : ''}
                                {realizedPnl.toFixed(2)} {t.currency}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {t.walletName || 'External'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: ADD / EDIT HOLDING */}
      {showAddHoldingModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {editingHolding ? `Edit Position: ${editingHolding.symbol}` : 'Add New Investment Holding'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddHoldingModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHolding} className="space-y-4">
              {/* Quick Pick Popular Assets from CoinGecko */}
              {!editingHolding && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      Quick Pick from CoinGecko & Markets:
                    </span>
                    <span className="text-[10px] text-gray-400">Autofills live price</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {POPULAR_ASSETS.map((preset) => (
                      <button
                        key={preset.symbol}
                        type="button"
                        onClick={() => handleSelectCoinForHolding(preset)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-800 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shrink-0 transition-all flex items-center gap-1"
                      >
                        <span>{preset.symbol}</span>
                        <span className="text-[10px] text-gray-400 font-normal">({preset.currency})</span>
                      </button>
                    ))}
                  </div>

                  {/* CoinGecko Live Search Bar with Dropdown */}
                  <div className="relative">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <span className="flex items-center gap-1">
                        <Search className="h-3.5 w-3.5 text-indigo-500" />
                        Search CoinGecko Live Directory
                      </span>
                      {isSearchingHolding && (
                        <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                          <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Searching live...
                        </span>
                      )}
                    </div>
                    <Input
                      type="text"
                      placeholder="Search any crypto or ticker (e.g. Bitcoin, S&P 500, Pepe, Kaspa)..."
                      value={holdingSearchQuery}
                      onChange={(e) => setHoldingSearchQuery(e.target.value)}
                      className="text-xs"
                    />
                    {holdingSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl max-h-48 overflow-y-auto p-1 divide-y divide-gray-100 dark:divide-gray-700">
                        {holdingSearchResults.map((coin) => (
                          <div
                            key={coin.id}
                            onClick={() => handleSelectCoinForHolding(coin)}
                            className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer rounded-lg flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {coin.thumb && (
                                <img src={coin.thumb} alt={coin.name} className="w-5 h-5 rounded-full" />
                              )}
                              <span className="font-bold text-gray-900 dark:text-gray-100">
                                {coin.symbol?.toUpperCase()}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[150px]">
                                {coin.name} {coin.market_cap_rank ? `#${coin.market_cap_rank}` : ''}
                              </span>
                            </div>
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                              + Autofill
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ticker Symbol</label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. BTC, ETH, AAPL"
                    value={holdingForm.symbol}
                    onChange={(e) => setHoldingForm({ ...holdingForm, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Name</label>
                  <Input
                    required
                    type="text"
                    placeholder="e.g. Bitcoin, Apple"
                    value={holdingForm.name}
                    onChange={(e) => setHoldingForm({ ...holdingForm, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Class</label>
                  <Select
                    value={holdingForm.assetType}
                    onChange={(e) => setHoldingForm({ ...holdingForm, assetType: e.target.value as any })}
                  >
                    <option value="crypto">🪙 Crypto Currency</option>
                    <option value="stock">📈 US/EU Stock</option>
                    <option value="etf">📊 ETF / Index Fund</option>
                    <option value="bourse_local">🏛️ Bourse de Casablanca (BVC)</option>
                    <option value="commodity">🥇 Gold / Commodities</option>
                    <option value="real_estate">🏡 Real Estate</option>
                    <option value="custom">💼 Custom / Private</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <Select
                    value={holdingForm.currency}
                    onChange={(e) => setHoldingForm({ ...holdingForm, currency: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="MAD">MAD (Dirham)</option>
                    <option value="EUR">EUR (€)</option>
                  </Select>
                </div>
              </div>

              {/* Smart Dual Calculator: Total Cash Invested <-> Units */}
              <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5 text-indigo-500" />
                    Smart Capital & Units Calculator
                  </span>
                  <span className="text-[10px] text-gray-500 font-normal">
                    Enter either units OR total money allocated
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                      Total Capital Allocated ({holdingForm.currency})
                    </label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 5000"
                      value={holdingTotalCash}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHoldingTotalCash(val);
                        const p = parseFloat(holdingForm.currentPrice || holdingForm.buyPriceAvg) || 0;
                        if (p > 0 && val) {
                          setHoldingForm((prev) => ({
                            ...prev,
                            units: ((parseFloat(val) || 0) / p).toFixed(6),
                          }));
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                      Target Portfolio Weight %
                    </label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="e.g. 20"
                      value={holdingForm.targetAllocationPercent}
                      onChange={(e) => setHoldingForm({ ...holdingForm, targetAllocationPercent: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Units Held</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={holdingForm.units}
                    onChange={(e) => {
                      const u = e.target.value;
                      setHoldingForm({ ...holdingForm, units: u });
                      const p = parseFloat(holdingForm.currentPrice || holdingForm.buyPriceAvg) || 0;
                      if (p > 0 && u) {
                        setHoldingTotalCash(((parseFloat(u) || 0) * p).toFixed(2));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Avg Buy Price</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={holdingForm.buyPriceAvg}
                    onChange={(e) => setHoldingForm({ ...holdingForm, buyPriceAvg: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Current Price</label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!holdingForm.symbol) return;
                        const quote = await fetchSpotPriceQuote(holdingForm.symbol);
                        if (quote) {
                          let p = quote.priceUsd;
                          if (holdingForm.currency === 'MAD') p = quote.priceMad;
                          else if (holdingForm.currency === 'EUR') p = quote.priceEur;
                          if (p > 0) {
                            setHoldingForm((prev) => ({
                              ...prev,
                              currentPrice: p.toString(),
                              buyPriceAvg: prev.buyPriceAvg || p.toString(),
                            }));
                            if (holdingTotalCash && parseFloat(holdingTotalCash) > 0) {
                              setHoldingForm((prev) => ({
                                ...prev,
                                units: ((parseFloat(holdingTotalCash) || 0) / p).toFixed(6),
                              }));
                            }
                          }
                        }
                      }}
                      disabled={fetchingSpotPrice || !holdingForm.symbol}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-0.5"
                      title="Fetch live market price from CoinGecko"
                    >
                      <Zap className={`h-2.5 w-2.5 ${fetchingSpotPrice ? 'animate-spin' : ''}`} />
                      Sync Live
                    </button>
                  </div>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={holdingForm.currentPrice}
                    onChange={(e) => {
                      const p = e.target.value;
                      setHoldingForm({ ...holdingForm, currentPrice: p });
                      if (holdingTotalCash && parseFloat(holdingTotalCash) > 0 && parseFloat(p) > 0) {
                        setHoldingForm((prev) => ({
                          ...prev,
                          units: ((parseFloat(holdingTotalCash) || 0) / parseFloat(p)).toFixed(6),
                        }));
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Dividend / Staking Yield % (yr)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 4.5"
                    value={holdingForm.dividendYieldPercent}
                    onChange={(e) => setHoldingForm({ ...holdingForm, dividendYieldPercent: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Brokerage Wallet</label>
                    {investmentWallets.length === 0 && onCreateWallet && (
                      <button
                        type="button"
                        onClick={() => setShowCreateInvestmentWalletModal(true)}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        + Create Wallet
                      </button>
                    )}
                  </div>
                  <Select
                    value={holdingForm.walletId}
                    onChange={(e) => setHoldingForm({ ...holdingForm, walletId: e.target.value })}
                  >
                    <option value="">None / External Exchange</option>
                    {investmentWallets.length > 0 && (
                      <optgroup label="⭐ Investment Wallets (Ring-fenced from living expenses)">
                        {investmentWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} — Bal: {formatAmount(w.balance || 0)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {wallets.filter((w) => w.type !== 'Investment').length > 0 && (
                      <optgroup label="Other Cash & Checking Accounts">
                        {wallets
                          .filter((w) => w.type !== 'Investment')
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.type}) — Bal: {formatAmount(w.balance || 0)}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </Select>
                </div>
              </div>

              {holdingError && (
                <p className="text-xs text-red-600 dark:text-red-400">{holdingError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddHoldingModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={holdingSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {holdingSubmitting ? 'Saving...' : 'Save Holding'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EXECUTE TRADE (BUY / SELL / DIVIDEND) */}
      {tradeModalHolding && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  Execute Trade: {tradeModalHolding.symbol}
                </h3>
                <span className="text-xs text-gray-500">
                  Current Units: {parseFloat(tradeModalHolding.units || '0').toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTradeModalHolding(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Trade Type Selector */}
            <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              {(['BUY', 'SELL', 'DIVIDEND'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTradeType(t)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    tradeType === t
                      ? t === 'BUY'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : t === 'SELL'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {t === 'DIVIDEND' ? 'Yield / Div' : t}
                </button>
              ))}
            </div>

            {/* Live CoinGecko Spot Price Ticker Bar */}
            <div className="flex items-center justify-between text-xs bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[10px]">
                  Market Spot ({tradeModalHolding.currency}):
                </span>
                <span className="font-extrabold text-indigo-700 dark:text-indigo-300 text-sm">
                  {tradePrice ? `${parseFloat(tradePrice).toLocaleString()} ${tradeModalHolding.currency}` : '—'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const spot = await fetchSpotPriceQuote(tradeModalHolding.symbol);
                  if (spot) {
                    let p = spot.priceUsd;
                    if (tradeModalHolding.currency === 'MAD') p = spot.priceMad;
                    else if (tradeModalHolding.currency === 'EUR') p = spot.priceEur;
                    if (p > 0) {
                      setTradePrice(p.toString());
                      const u = parseFloat(tradeUnits) || 0;
                      if (u > 0) setTradeTotal((u * p).toFixed(2));
                    }
                  }
                }}
                disabled={fetchingSpotPrice}
                className="h-7 text-[11px] text-indigo-600 border-indigo-200 hover:bg-indigo-100/50 flex items-center gap-1 font-semibold"
              >
                <Zap className={`h-3 w-3 ${fetchingSpotPrice ? 'animate-spin' : ''}`} />
                Sync CoinGecko
              </Button>
            </div>

            <form onSubmit={handleExecuteTradeSubmit} className="space-y-3">
              {/* Quick Sizing Buttons */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-gray-500 font-medium">Quick Sizing:</span>
                <div className="flex items-center gap-1">
                  {[0.25, 0.5, 0.75, 1.0].map((frac) => (
                    <button
                      key={frac}
                      type="button"
                      onClick={() => {
                        if (tradeType === 'SELL') {
                          const curUnits = parseFloat(tradeModalHolding.units || '0') || 0;
                          const u = (curUnits * frac).toFixed(6);
                          setTradeUnits(u);
                          const p = parseFloat(tradePrice) || 0;
                          if (p > 0) setTradeTotal(((parseFloat(u) || 0) * p).toFixed(2));
                        } else {
                          const selectedW = wallets.find((w) => w.id === tradeWalletId);
                          if (selectedW && Number(selectedW.balance) > 0) {
                            const maxCash = Number(selectedW.balance) * frac;
                            const cashInHoldingCurr =
                              tradeModalHolding.currency === 'MAD' ? maxCash : maxCash / (rates.USD_TO_MAD || 10);
                            setTradeTotal(cashInHoldingCurr.toFixed(2));
                            const p = parseFloat(tradePrice) || 0;
                            if (p > 0) setTradeUnits((cashInHoldingCurr / p).toFixed(6));
                          } else {
                            const presetAmt = frac === 0.25 ? 100 : frac === 0.5 ? 250 : frac === 0.75 ? 500 : 1000;
                            setTradeTotal(presetAmt.toString());
                            const p = parseFloat(tradePrice) || 0;
                            if (p > 0) setTradeUnits((presetAmt / p).toFixed(6));
                          }
                        }
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-800 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 transition-colors"
                    >
                      {frac === 1 ? (tradeType === 'SELL' ? 'Max (100%)' : '100%') : `${frac * 100}%`}
                    </button>
                  ))}
                </div>
              </div>

              {tradeType !== 'DIVIDEND' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Units</label>
                    <Input
                      required
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={tradeUnits}
                      onChange={(e) => {
                        const u = e.target.value;
                        setTradeUnits(u);
                        const p = parseFloat(tradePrice) || 0;
                        if (p > 0 && u) setTradeTotal(((parseFloat(u) || 0) * p).toFixed(2));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Price / Unit ({tradeModalHolding.currency})
                    </label>
                    <Input
                      required
                      type="number"
                      step="any"
                      value={tradePrice}
                      onChange={(e) => {
                        const p = e.target.value;
                        setTradePrice(p);
                        const u = parseFloat(tradeUnits) || 0;
                        if (u > 0 && p) setTradeTotal((u * (parseFloat(p) || 0)).toFixed(2));
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Total Amount ({tradeModalHolding.currency})
                  </label>
                  <Input
                    required
                    type="number"
                    step="any"
                    value={tradeTotal}
                    onChange={(e) => {
                      const tot = e.target.value;
                      setTradeTotal(tot);
                      const p = parseFloat(tradePrice) || 0;
                      if (p > 0 && tot) setTradeUnits(((parseFloat(tot) || 0) / p).toFixed(6));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Fees / Slippage</label>
                  <Input
                    type="number"
                    step="any"
                    value={tradeFees}
                    onChange={(e) => setTradeFees(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {tradeType === 'BUY'
                      ? 'Debit Cash From Wallet'
                      : tradeType === 'SELL'
                      ? 'Credit Net Proceeds To Wallet'
                      : 'Credit Dividend Income To Wallet'}
                  </label>
                  {investmentWallets.length === 0 && onCreateWallet && (
                    <button
                      type="button"
                      onClick={() => setShowCreateInvestmentWalletModal(true)}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                    >
                      + Create Investment Wallet
                    </button>
                  )}
                </div>
                <Select
                  value={tradeWalletId}
                  onChange={(e) => setTradeWalletId(e.target.value)}
                >
                  <option value="">Do not touch cash wallets (Holdings only)</option>
                  {investmentWallets.length > 0 && (
                    <optgroup label="⭐ Investment Wallets (Ring-fenced from living expenses)">
                      {investmentWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} — Balance: {formatAmount(w.balance || 0)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {wallets.filter((w) => w.type !== 'Investment').length > 0 && (
                    <optgroup label="Other Cash & Checking Accounts">
                      {wallets
                        .filter((w) => w.type !== 'Investment')
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.type}) — Balance: {formatAmount(w.balance || 0)}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </Select>
                <p className="text-[11px] text-gray-500">
                  Selecting an Investment Wallet synchronizes cash without touching everyday spending.
                </p>
                {investmentWallets.length === 0 && onCreateWallet && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                    <span>💡 Tip: Create an Investment Wallet to strictly ring-fence trade capital from checking.</span>
                    <button
                      type="button"
                      onClick={() => setShowCreateInvestmentWalletModal(true)}
                      className="font-bold underline shrink-0 ml-2"
                    >
                      + Create
                    </button>
                  </div>
                )}
              </div>

              {tradeError && (
                <p className="text-xs text-red-600 dark:text-red-400">{tradeError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setTradeModalHolding(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={tradeSubmitting}
                  className={
                    tradeType === 'BUY'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : tradeType === 'SELL'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }
                >
                  {tradeSubmitting ? 'Processing...' : `Confirm ${tradeType}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NEW DCA PLAN */}
      {showDcaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-500" />
                Schedule Recurring DCA Plan
              </h3>
              <button
                type="button"
                onClick={() => setShowDcaModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDcaPlan} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Ticker Symbol</label>
                  <Input
                    required
                    type="text"
                    placeholder="BTC, VOO, AAPL"
                    value={dcaForm.symbol}
                    onChange={(e) => setDcaForm({ ...dcaForm, symbol: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Asset Name</label>
                  <Input
                    required
                    type="text"
                    value={dcaForm.assetName}
                    onChange={(e) => setDcaForm({ ...dcaForm, assetName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Recurring Amount</label>
                  <Input
                    required
                    type="number"
                    step="any"
                    value={dcaForm.targetAmount}
                    onChange={(e) => setDcaForm({ ...dcaForm, targetAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Currency</label>
                  <Select
                    value={dcaForm.currency}
                    onChange={(e) => setDcaForm({ ...dcaForm, currency: e.target.value })}
                  >
                    <option value="MAD">MAD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Frequency</label>
                <Select
                  value={dcaForm.frequency}
                  onChange={(e) => setDcaForm({ ...dcaForm, frequency: e.target.value as any })}
                >
                  <option value="post_payday">Post-Payday Cycle (TrueSpend Recommended)</option>
                  <option value="monthly">Monthly (1st of month)</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </Select>
              </div>

              {dcaForm.frequency === 'post_payday' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Days after Payday
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="15"
                    value={dcaForm.dayOffsetAfterPayday}
                    onChange={(e) => setDcaForm({ ...dcaForm, dayOffsetAfterPayday: parseInt(e.target.value, 10) || 0 })}
                  />
                  <p className="text-[11px] text-gray-500">
                    Allows salary deposits to clear before execution.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Funding Wallet</label>
                <Select
                  value={dcaForm.walletId}
                  onChange={(e) => setDcaForm({ ...dcaForm, walletId: e.target.value })}
                >
                  <option value="">Default Primary Bank Wallet</option>
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </option>
                  ))}
                </Select>
              </div>

              {dcaError && <p className="text-xs text-red-600 dark:text-red-400">{dcaError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDcaModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={dcaSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {dcaSubmitting ? 'Creating...' : 'Create DCA Rule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RICH EXPLANATION & METHODOLOGY MODAL */}
      {infoModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {infoModal === 'safe-to-invest' && 'What is "Safe-to-Invest"?'}
                    {infoModal === 'dca' && 'What is Dollar-Cost Averaging (DCA)?'}
                    {infoModal === 'fire' && 'Passive Yield & FIRE Explained'}
                  </h3>
                  <p className="text-xs text-gray-500">TrueSpend Predictive Wealth Intelligence</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SAFE TO INVEST EXPLANATION */}
            {infoModal === 'safe-to-invest' && (
              <div className="space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-950 dark:text-emerald-200 space-y-1.5">
                  <span className="font-bold block text-sm">💡 The TrueSpend Principle:</span>
                  <p>
                    Never invest money you will need in the next 30 to 90 days. Standalone crypto and stock apps encourage depositing blindly. TrueSpend connects directly to your cash flow, ensuring you only deploy truly surplus capital.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-xs block">
                    Mathematical Formula:
                  </span>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/80 font-mono text-[11px] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                    Safe-to-Invest = Total Liquid Cash - Fixed Bills - Daily Living Buffer - Emergency Reserve - Debt Obligations
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-xs block">
                    Why this protects you:
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>
                      <strong>Zero Forced Selling:</strong> If the market drops 40%, you will never be forced to sell at a loss to pay your rent or groceries.
                    </li>
                    <li>
                      <strong>Savings Wallets Shield:</strong> Your Savings Wallets balance ({formatAmount(kpis?.emergencyBuffer || 0)}) is always ring-fenced and isolated so it is never depleted by investment purchases.
                    </li>
                    <li>
                      <strong>DCA Budget Check:</strong> TrueSpend verifies whether your scheduled DCA plans fit comfortably inside your monthly safe surplus.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* DCA EXPLANATION */}
            {infoModal === 'dca' && (
              <div className="space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-indigo-950 dark:text-indigo-200 space-y-1.5">
                  <span className="font-bold block text-sm">⏱️ Timing the Market vs. Time IN the Market:</span>
                  <p>
                    <strong>Dollar-Cost Averaging (DCA)</strong> is the proven investment strategy of investing fixed amounts of money at regular intervals, regardless of whether the asset price goes up or down.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-xs block">
                    Key Advantages:
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>
                      <strong>Smooths Volatility:</strong> When prices are high you purchase fewer units; when prices drop, you automatically buy more units at a discount.
                    </li>
                    <li>
                      <strong>Post-Payday Automation:</strong> TrueSpend schedules your DCA rules 2-3 days after your salary arrives, capturing cash before it leaks into discretionary spending.
                    </li>
                    <li>
                      <strong>Eliminates Emotion & FOMO:</strong> You never have to guess the top or bottom of a crypto or stock chart.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* FIRE & PASSIVE YIELD EXPLANATION */}
            {infoModal === 'fire' && (
              <div className="space-y-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-950 dark:text-amber-200 space-y-1.5">
                  <span className="font-bold block text-sm">🔥 FIRE: Financial Independence, Retire Early</span>
                  <p>
                    FIRE is achieved when the annual passive yield from your investments (stock dividends, real estate cash flow, and crypto staking rewards) equals or exceeds your annual living expenses.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-gray-900 dark:text-gray-100 text-xs block">
                    How TrueSpend Tracks Your FIRE Journey:
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>
                      <strong>Passive Yield Projection:</strong> Multiplies your dividend yields and staking rates across your portfolio to calculate annual passive cash flow ({formatAmount(data?.annualPassiveIncomeMad || 0)}/yr).
                    </li>
                    <li>
                      <strong>Living Costs Coverage:</strong> Measures what percentage of your basic monthly living obligations is completely paid for by investment yield without you having to work.
                    </li>
                    <li>
                      <strong>The 4% Safe Withdrawal Rule:</strong> When your Net Worth reaches 25x your annual expenses, you have achieved permanent Financial Independence.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={() => setInfoModal(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Got It, Thanks!
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE INVESTMENT WALLET */}
      {showCreateInvestmentWalletModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Create Investment Wallet
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Track uninvested brokerage cash & trade settlement
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateInvestmentWalletModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Explanatory callout: Ring-fenced like Savings */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-100">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Ring-Fenced Capital (Treated like Savings)
              </div>
              <p className="leading-relaxed">
                Money kept inside an <strong>Investment Wallet</strong> is strictly excluded from your daily living expenses, excluded from Safe-to-Spend calculations, and never counted against monthly budget burn.
              </p>
            </div>

            {/* Popular Broker / Exchange Templates */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                Quick Preset Templates:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {INVESTMENT_WALLET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setNewWalletName(tmpl.name);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-start gap-2 ${
                      newWalletName === tmpl.name
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-indigo-500'
                        : 'border-gray-200 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-800/50 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-lg leading-none shrink-0">{tmpl.icon}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block truncate">
                        {tmpl.name}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                        {tmpl.desc}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateInvestmentWalletSubmit} className="space-y-4 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Wallet / Broker Name
                </label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Binance, Interactive Brokers, BVC"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Initial Cash Balance (MAD)
                </label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={newWalletInitialBalance}
                  onChange={(e) => setNewWalletInitialBalance(e.target.value)}
                />
                <p className="text-[11px] text-gray-500">
                  Uninvested liquid cash deposited in this brokerage account.
                </p>
              </div>

              {walletCreationError && (
                <p className="text-xs text-red-600 dark:text-red-400">{walletCreationError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateInvestmentWalletModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatingWallet}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {isCreatingWallet ? 'Creating...' : 'Create Investment Wallet'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COINGECKO DEEP DETAILS & ANALYTICS MODAL */}
      {(selectedCoinDetail || loadingCoinDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-8">
            {loadingCoinDetail ? (
              <div className="p-12 text-center text-xs text-gray-500 flex flex-col items-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Fetching Real-Time CoinGecko Market Data...
                </span>
              </div>
            ) : selectedCoinDetail ? (
              <div>
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-gray-50 via-indigo-50/30 to-blue-50/20 dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {selectedCoinDetail.image && (
                      <img
                        src={selectedCoinDetail.image}
                        alt={selectedCoinDetail.name}
                        className="w-10 h-10 rounded-full shadow-xs"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {selectedCoinDetail.name}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-md font-extrabold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          {selectedCoinDetail.symbol}
                        </span>
                        {selectedCoinDetail.marketCapRank && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                            Rank #{selectedCoinDetail.marketCapRank}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                          {displayCurrency === 'USD'
                            ? `$${selectedCoinDetail.currentPriceUsd?.toLocaleString()}`
                            : `${selectedCoinDetail.currentPriceMad?.toLocaleString()} MAD`}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            (selectedCoinDetail.priceChangePercentage24h || 0) >= 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {(selectedCoinDetail.priceChangePercentage24h || 0) >= 0 ? '+' : ''}
                          {(selectedCoinDetail.priceChangePercentage24h || 0).toFixed(2)}% (24h)
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCoinDetail(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Key Statistics Grid */}
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">24h High</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ${selectedCoinDetail.high24h?.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">24h Low</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">
                        ${selectedCoinDetail.low24h?.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">All-Time High</span>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        ${selectedCoinDetail.ath?.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-red-500 block font-semibold">
                        {selectedCoinDetail.athChangePercentage?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">7d Change</span>
                      <span
                        className={`text-xs font-bold ${
                          (selectedCoinDetail.priceChangePercentage7d || 0) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {(selectedCoinDetail.priceChangePercentage7d || 0) >= 0 ? '+' : ''}
                        {(selectedCoinDetail.priceChangePercentage7d || 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  {/* 7-Day Sparkline SVG */}
                  {selectedCoinDetail.sparkline7d && selectedCoinDetail.sparkline7d.length > 5 && (
                    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-indigo-500" />
                          7-Day Price Trajectory (CoinGecko)
                        </span>
                        <span className="text-[11px] text-gray-500">Live Tick Data</span>
                      </div>
                      <div className="h-20 w-full flex items-end">
                        {(() => {
                          const pts: number[] = selectedCoinDetail.sparkline7d;
                          const min = Math.min(...pts);
                          const max = Math.max(...pts);
                          const range = max - min || 1;
                          const isUp = pts[pts.length - 1] >= pts[0];
                          const strokeColor = isUp ? '#10b981' : '#ef4444';
                          const width = 500;
                          const height = 70;
                          const polylinePoints = pts
                            .map((p, idx) => {
                              const x = (idx / (pts.length - 1)) * width;
                              const y = height - ((p - min) / range) * (height - 10) - 5;
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            })
                            .join(' ');
                          return (
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                              <polyline
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={polylinePoints}
                              />
                            </svg>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleWatchlist({
                          id: selectedCoinDetail.id,
                          symbol: selectedCoinDetail.symbol,
                          name: selectedCoinDetail.name,
                        });
                      }}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5"
                    >
                      <Star className="h-4 w-4 text-amber-500" />
                      Watchlist
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const c = selectedCoinDetail;
                          setSelectedCoinDetail(null);
                          openDcaForCoin({
                            id: c.id,
                            symbol: c.symbol,
                            name: c.name,
                            current_price: c.currentPriceUsd,
                          });
                        }}
                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs"
                      >
                        Automate DCA
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const c = selectedCoinDetail;
                          setSelectedCoinDetail(null);
                          openAddHoldingForCoin({
                            id: c.id,
                            symbol: c.symbol,
                            name: c.name,
                            current_price: c.currentPriceUsd,
                          });
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                      >
                        + Add to Portfolio
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
