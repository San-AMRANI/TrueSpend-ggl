import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  DollarSign,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Landmark,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  HelpCircle,
  BarChart3,
  CheckCircle2,
  PieChart,
  Tag,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import type {
  FinancialHomeResponse,
  InvestmentAccount,
  InvestmentAsset,
  InvestmentEvent,
  PortfolioSummary,
  RiskLevel,
  Wallet as UserWallet,
} from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

interface PortfolioTabProps {
  home: FinancialHomeResponse | null;
  portfolio: PortfolioSummary | null;
  accounts: InvestmentAccount[];
  assets: InvestmentAsset[];
  events: InvestmentEvent[];
  wallets: UserWallet[];
  saving: boolean;
  onRefreshPrices: () => Promise<unknown>;
  onCreateAccount: (account: Partial<InvestmentAccount>) => Promise<InvestmentAccount | undefined>;
  onCreateAsset: (asset: Partial<InvestmentAsset>) => Promise<InvestmentAsset | undefined>;
  onCreateEvent: (payload: {
    investmentAccountId: string;
    assetId?: string | null;
    type: InvestmentEvent['type'];
    tradeDate?: string;
    units?: number;
    unitPrice?: number;
    quoteCurrency?: string;
    grossAmount: number;
    feeAmount?: number;
    feeCurrency?: string;
    exchangeRateToBase?: number;
    notes?: string;
  }) => Promise<unknown>;
  onRecordManualPrice: (payload: { assetId: string; price: number; currency: string; capturedAt?: string }) => Promise<unknown>;
  onFundAccount: (id: string, payload: { sourceWalletId: string; amount: number; date?: string; note?: string }) => Promise<unknown>;
  onWithdrawAccount: (id: string, payload: { destinationWalletId: string; amount: number; date?: string; note?: string }) => Promise<unknown>;
  onSearchCrypto: (query: string) => Promise<Array<{ id: string; name: string; symbol: string; market_cap_rank?: number }>>;
}

const formatMoney = (amount: number | string | undefined | null, currency = 'MAD') =>
  `${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export const PortfolioTab: React.FC<PortfolioTabProps> = ({
  home,
  portfolio,
  accounts,
  assets,
  events,
  wallets,
  saving,
  onRefreshPrices,
  onCreateAccount,
  onCreateAsset,
  onCreateEvent,
  onRecordManualPrice,
  onFundAccount,
  onWithdrawAccount,
  onSearchCrypto,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'holdings' | 'accounts' | 'trades' | 'allocation'>('holdings');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modals
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  // Account Form
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<InvestmentAccount['type']>('Exchange');
  const [accInstitution, setAccInstitution] = useState('');

  // Asset Form
  const [assetMode, setAssetMode] = useState<'crypto' | 'custom'>('crypto');
  const [cryptoSearch, setCryptoSearch] = useState('');
  const [cryptoResults, setCryptoResults] = useState<Array<{ id: string; name: string; symbol: string }>>([]);
  const [searchingCrypto, setSearchingCrypto] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState<{ id: string; name: string; symbol: string } | null>(null);

  const [customAssetName, setCustomAssetName] = useState('');
  const [customAssetSymbol, setCustomAssetSymbol] = useState('');
  const [customAssetClass, setCustomAssetClass] = useState<InvestmentAsset['assetClass']>('Stock');
  const [customAssetRisk, setCustomAssetRisk] = useState<RiskLevel>('Medium');

  // Trade / Event Form
  const [tradeAccountId, setTradeAccountId] = useState('');
  const [tradeAssetId, setTradeAssetId] = useState('');
  const [tradeType, setTradeType] = useState<InvestmentEvent['type']>('Buy');
  const [tradeUnits, setTradeUnits] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeFees, setTradeFees] = useState('0');
  const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tradeNotes, setTradeNotes] = useState('');

  // Fund / Withdraw Form
  const [fundAccountId, setFundAccountId] = useState('');
  const [fundWalletId, setFundWalletId] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [fundNote, setFundNote] = useState('');

  const [withdrawAccountId, setWithdrawAccountId] = useState('');
  const [withdrawWalletId, setWithdrawWalletId] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');

  // Price Update Form
  const [priceAssetId, setPriceAssetId] = useState('');
  const [newManualPrice, setNewManualPrice] = useState('');

  const currency = portfolio?.baseCurrency || home?.profile?.baseCurrency || 'MAD';
  const holdings = portfolio?.holdings || [];
  const marketValue = portfolio?.marketValue || 0;
  const unrealizedGain = portfolio?.unrealizedGain || 0;
  const totalReturnPercent = portfolio?.totalReturnPercent || 0;
  const costBasis = portfolio?.costBasis || 0;

  // Net Worth Calculation
  const liquidCash = home?.snapshot?.liquidCash ?? wallets.filter((w) => w.type === 'Bank' || w.type === 'Cash').reduce((s, w) => s + w.balance, 0);
  const savingsCash = wallets.filter((w) => w.type === 'Savings').reduce((s, w) => s + w.balance, 0);
  const receivables = home?.snapshot?.pendingReceivables ?? 0;
  const payables = home?.snapshot?.pendingPayables ?? home?.snapshot?.totalDebt ?? 0;
  const netWorth = home?.snapshot?.netWorth ?? (liquidCash + savingsCash + marketValue + receivables - payables);

  // Investment Capacity
  const investmentCapacity = home?.snapshot?.investmentCapacity ?? Math.max(0, liquidCash - (home?.snapshot?.protectedEmergencyCash || 0));
  const bufferGap = Math.max(0, (home?.snapshot?.buffer?.target || 0) - (home?.snapshot?.buffer?.current || 0));

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshPrices();
      showNotification('Market prices refreshed from CoinGecko.');
    } catch (err: any) {
      showNotification(err?.message || 'Unable to refresh market prices.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearchCryptoQuery = async (query: string) => {
    setCryptoSearch(query);
    if (!query.trim() || query.length < 2) {
      setCryptoResults([]);
      return;
    }
    setSearchingCrypto(true);
    try {
      const results = await onSearchCrypto(query);
      setCryptoResults(results || []);
    } catch {
      setCryptoResults([]);
    } finally {
      setSearchingCrypto(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    try {
      await onCreateAccount({
        name: accName.trim(),
        type: accType,
        institution: accInstitution.trim() || undefined,
        baseCurrency: currency,
        includeInNetWorth: true,
      });
      setAccName('');
      setAccInstitution('');
      setShowAccountModal(false);
      showNotification('Investment account created successfully.');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to create account.', 'error');
    }
  };

  const handleCreateAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (assetMode === 'crypto') {
        if (!selectedCrypto) {
          showNotification('Please search and select a crypto asset.', 'error');
          return;
        }
        await onCreateAsset({
          name: selectedCrypto.name,
          symbol: selectedCrypto.symbol.toUpperCase(),
          assetClass: 'Crypto',
          coinGeckoCoinId: selectedCrypto.id,
          quoteCurrency: 'USD',
          riskLevel: 'High',
          unitsPrecision: 8,
          marketDataProvider: 'CoinGecko',
        });
      } else {
        if (!customAssetName.trim() || !customAssetSymbol.trim()) {
          showNotification('Please provide both asset name and symbol.', 'error');
          return;
        }
        await onCreateAsset({
          name: customAssetName.trim(),
          symbol: customAssetSymbol.trim().toUpperCase(),
          assetClass: customAssetClass,
          quoteCurrency: currency,
          riskLevel: customAssetRisk,
          unitsPrecision: customAssetClass === 'PreciousMetal' ? 4 : 2,
          marketDataProvider: 'Manual',
        });
      }
      setSelectedCrypto(null);
      setCryptoSearch('');
      setCustomAssetName('');
      setCustomAssetSymbol('');
      setShowAssetModal(false);
      showNotification('Asset added to tracker.');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to create asset.', 'error');
    }
  };

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const units = Number(tradeUnits);
    const unitPrice = Number(tradePrice);
    const fees = Number(tradeFees) || 0;
    if (!tradeAccountId) {
      showNotification('Select an investment account.', 'error');
      return;
    }
    if (!tradeAssetId && (tradeType === 'Buy' || tradeType === 'Sell')) {
      showNotification('Select an asset for this trade.', 'error');
      return;
    }
    if ((tradeType === 'Buy' || tradeType === 'Sell') && (!units || units <= 0 || !unitPrice || unitPrice <= 0)) {
      showNotification('Units and price per unit must be greater than zero.', 'error');
      return;
    }

    const grossAmount = tradeType === 'Buy' || tradeType === 'Sell' ? units * unitPrice : Number(tradePrice);

    try {
      await onCreateEvent({
        investmentAccountId: tradeAccountId,
        assetId: tradeAssetId || null,
        type: tradeType,
        units: units || undefined,
        unitPrice: unitPrice || undefined,
        grossAmount,
        feeAmount: fees,
        tradeDate: tradeDate ? new Date(tradeDate).toISOString() : new Date().toISOString(),
        notes: tradeNotes.trim() || undefined,
      });
      setTradeUnits('');
      setTradePrice('');
      setTradeFees('0');
      setTradeNotes('');
      setShowTradeModal(false);
      showNotification('Investment event recorded and lots updated.');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to record event.', 'error');
    }
  };

  const handleFundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(fundAmount);
    if (!fundAccountId || !fundWalletId || !amt || amt <= 0) {
      showNotification('Please choose an account, wallet, and valid amount.', 'error');
      return;
    }
    try {
      await onFundAccount(fundAccountId, {
        sourceWalletId: fundWalletId,
        amount: amt,
        note: fundNote.trim() || undefined,
      });
      setFundAmount('');
      setFundNote('');
      setShowFundModal(false);
      showNotification(`Funded ${amt.toLocaleString()} ${currency} into investment account.`);
    } catch (err: any) {
      showNotification(err?.message || 'Funding transfer failed.', 'error');
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(withdrawAmount);
    if (!withdrawAccountId || !withdrawWalletId || !amt || amt <= 0) {
      showNotification('Please choose an account, wallet, and valid amount.', 'error');
      return;
    }
    try {
      await onWithdrawAccount(withdrawAccountId, {
        destinationWalletId: withdrawWalletId,
        amount: amt,
        note: withdrawNote.trim() || undefined,
      });
      setWithdrawAmount('');
      setWithdrawNote('');
      setShowWithdrawModal(false);
      showNotification(`Withdrew ${amt.toLocaleString()} ${currency} to wallet.`);
    } catch (err: any) {
      showNotification(err?.message || 'Withdrawal failed.', 'error');
    }
  };

  const handlePriceUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(newManualPrice);
    if (!priceAssetId || !p || p <= 0) {
      showNotification('Enter a valid price greater than zero.', 'error');
      return;
    }
    try {
      await onRecordManualPrice({
        assetId: priceAssetId,
        price: p,
        currency,
      });
      setNewManualPrice('');
      setShowPriceModal(false);
      showNotification('Valuation price snapshot saved.');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to record price.', 'error');
    }
  };

  const activeAccounts = accounts.filter((a) => !a.isArchived);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      {/* ── Title & Quick Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
              Wealth & Net Worth Hub
            </span>
            <span className="text-xs text-gray-500">Separated from spendable cash</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
            Investment Portfolio & Net Worth
          </h2>
          <p className="text-sm text-gray-500">
            Track assets, cost basis, live crypto valuations, and non-dilutive portfolio funding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing || saving}
            onClick={handleRefresh}
            className="shadow-sm"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Prices
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTradeModal(true)}
            className="border-indigo-200 hover:border-indigo-300 dark:border-indigo-800"
          >
            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
            Record Trade
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFundModal(true)}
          >
            <Landmark className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Deposit Cash
          </Button>

          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            onClick={() => setShowAssetModal(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Asset
          </Button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border p-3.5 text-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
          }`}
        >
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} className="text-xs font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Net Worth Master Banner ── */}
      <Card className="border-indigo-200/80 dark:border-indigo-900/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg overflow-hidden relative">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
                Total Financial Net Worth
              </p>
              <h3 className="text-4xl font-extrabold tracking-tight mt-1 text-white">
                {formatMoney(netWorth, currency)}
              </h3>
              <p className="text-xs text-indigo-200/80 mt-1">
                Authoritative balance across liquid cash, emergency savings, priced investments, and outstanding debts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm border border-white/10">
                <p className="text-xs text-indigo-200">Portfolio Market Value</p>
                <p className="text-lg font-bold text-white">{formatMoney(marketValue, currency)}</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm border border-white/10">
                <p className="text-xs text-indigo-200">Unrealized P&L</p>
                <p className={`text-lg font-bold flex items-center gap-1 ${unrealizedGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {unrealizedGain >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {formatMoney(unrealizedGain, currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-xs">
            <div className="rounded-lg bg-white/5 p-2.5">
              <span className="text-indigo-200 block">💵 Liquid Cash</span>
              <span className="font-semibold text-white text-sm">{formatMoney(liquidCash, currency)}</span>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5">
              <span className="text-indigo-200 block">🛡️ Protected Savings</span>
              <span className="font-semibold text-white text-sm">{formatMoney(savingsCash, currency)}</span>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5">
              <span className="text-indigo-200 block">📈 Investments</span>
              <span className="font-semibold text-white text-sm">{formatMoney(marketValue, currency)}</span>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5">
              <span className="text-indigo-200 block">🤝 Net Debts / Payables</span>
              <span className="font-semibold text-red-300 text-sm">−{formatMoney(payables, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Investment Capacity Guidance ── */}
      <Card className="border-indigo-100 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 shadow-sm mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Investment Capacity Ceiling
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-200/60 dark:bg-indigo-900/60 font-medium">
                  {formatMoney(investmentCapacity, currency)} safely available
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Calculated after protecting your emergency buffer, known recurring bills, and short-term debt repayments.
                {bufferGap > 0 && (
                  <span className="text-amber-700 dark:text-amber-400 font-medium block mt-0.5">
                    ⚠️ You still have {formatMoney(bufferGap, currency)} to fund before your protected emergency target is reached.
                  </span>
                )}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                ⚖️ <strong>Regulatory Notice:</strong> TrueSpend provides deterministic planning guidance based on user data. This is not regulated investment advice or a promise of returns.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFundModal(true)}
              className="bg-white dark:bg-gray-900"
            >
              Fund Account
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWithdrawModal(true)}
              className="bg-white dark:bg-gray-900"
            >
              Withdraw Cash
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveSubTab('holdings')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'holdings'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Coins className="h-4 w-4" />
          Holdings ({holdings.length})
        </button>

        <button
          onClick={() => setActiveSubTab('accounts')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'accounts'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Wallet className="h-4 w-4" />
          Accounts ({activeAccounts.length})
        </button>

        <button
          onClick={() => setActiveSubTab('trades')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'trades'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Trades & Activity ({events.length})
        </button>

        <button
          onClick={() => setActiveSubTab('allocation')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeSubTab === 'allocation'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <PieChart className="h-4 w-4" />
          Allocation & Risk
        </button>
      </div>

      {/* ── Sub-Tab 1: Holdings ── */}
      {activeSubTab === 'holdings' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Tracked Asset Holdings</CardTitle>
              <CardDescription>Live market pricing with automatic multi-currency conversion to {currency}.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPriceModal(true)}>
                <Tag className="mr-1.5 h-3.5 w-3.5" /> Manual Price
              </Button>
              <Button size="sm" onClick={() => setShowAssetModal(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Track New Asset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {holdings.length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                  <Coins className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">No investment holdings yet</h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto mt-1">
                    Add an investment account, track your crypto or traditional assets, and record buys to view automated valuations.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button size="sm" onClick={() => setShowAccountModal(true)}>Create Account</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAssetModal(true)}>Add Asset</Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-gray-400 dark:border-gray-800">
                      <th className="py-3 px-3">Asset</th>
                      <th className="py-3 px-2">Class</th>
                      <th className="py-3 px-2 text-right">Units</th>
                      <th className="py-3 px-2 text-right">Latest Price</th>
                      <th className="py-3 px-2 text-right">Cost Basis</th>
                      <th className="py-3 px-2 text-right">Market Value</th>
                      <th className="py-3 px-2 text-right">Unrealized P&L</th>
                      <th className="py-3 px-2 text-center">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {holdings.map((h, i) => (
                      <tr key={`${h.accountId}-${h.asset.id}-${i}`} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                        <td className="py-3 px-3">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{h.asset.name}</p>
                          <span className="text-xs text-gray-400 font-mono uppercase">{h.asset.symbol}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-medium">
                            {h.asset.assetClass}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-medium">
                          {h.units.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-gray-600 dark:text-gray-300">
                          {h.latestPrice !== undefined ? formatMoney(h.latestPrice, currency) : '—'}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-gray-500">
                          {formatMoney(h.costBasis, currency)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                          {formatMoney(h.marketValue, currency)}
                        </td>
                        <td
                          className={`py-3 px-2 text-right font-mono font-bold ${
                            h.unrealizedGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {h.unrealizedGain >= 0 ? '+' : ''}
                          {formatMoney(h.unrealizedGain, currency)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              h.asset.marketDataProvider === 'CoinGecko'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {h.asset.marketDataProvider || 'Manual'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sub-Tab 2: Accounts ── */}
      {activeSubTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Investment Accounts</h3>
              <p className="text-xs text-gray-500">Exchanges, brokerages, retirement custodians, and physical assets.</p>
            </div>
            <Button size="sm" onClick={() => setShowAccountModal(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Account
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAccounts.length === 0 ? (
              <p className="col-span-full text-sm text-gray-500 text-center py-8">
                No accounts set up yet. Create an account to begin tracking trades.
              </p>
            ) : (
              activeAccounts.map((acc) => (
                <Card key={acc.id} className="relative overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-bold">{acc.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {acc.type} · {acc.institution || 'Self-managed'}
                        </CardDescription>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                        {acc.baseCurrency}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between text-gray-500">
                        <span>Net worth inclusion</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {acc.includeInNetWorth ? 'Yes' : 'Excluded'}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Emergency reserve eligibility</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {acc.includeInEmergencyReserve ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFundAccountId(acc.id);
                          setShowFundModal(true);
                        }}
                      >
                        Deposit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setWithdrawAccountId(acc.id);
                          setShowWithdrawModal(true);
                        }}
                      >
                        Withdraw
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Sub-Tab 3: Trades & Activity ── */}
      {activeSubTab === 'trades' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Investment Activity Log</CardTitle>
              <CardDescription>Immutable record of buys, sells, account funding, and cash withdrawals.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowTradeModal(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Record Trade
            </Button>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No trades or events recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase text-gray-400">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-2">Type</th>
                      <th className="py-2.5 px-2">Account</th>
                      <th className="py-2.5 px-2 text-right">Units</th>
                      <th className="py-2.5 px-2 text-right">Price</th>
                      <th className="py-2.5 px-2 text-right">Total Amount</th>
                      <th className="py-2.5 px-2 text-right">Fee</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {events.map((ev) => {
                      const acc = accounts.find((a) => a.id === ev.investmentAccountId);
                      return (
                        <tr key={ev.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                          <td className="py-2.5 px-3 font-mono text-xs text-gray-500">
                            {new Date(ev.tradeDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                ev.type === 'Buy'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                  : ev.type === 'Sell'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : ev.type === 'Funding'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {ev.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                            {acc?.name || 'Account'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-xs">
                            {ev.units ? Number(ev.units).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-xs">
                            {ev.unitPrice ? formatMoney(ev.unitPrice, currency) : '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono font-semibold text-xs">
                            {formatMoney(ev.grossAmount, currency)}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-xs text-gray-400">
                            {Number(ev.feeAmount) > 0 ? formatMoney(ev.feeAmount, currency) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-500 truncate max-w-xs">
                            {ev.notes || '—'}
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

      {/* ── Sub-Tab 4: Allocation & Risk ── */}
      {activeSubTab === 'allocation' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-indigo-600" />
                Asset Class Allocation
              </CardTitle>
              <CardDescription>Breakdown by asset classification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {portfolio?.allocationByAssetClass && portfolio.allocationByAssetClass.length > 0 ? (
                portfolio.allocationByAssetClass.map((item) => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{item.name}</span>
                      <span>{item.percent.toFixed(1)}% ({formatMoney(item.value, currency)})</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600"
                        style={{ width: `${Math.min(100, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No holdings to compute asset class allocation.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Risk Concentration
              </CardTitle>
              <CardDescription>Distribution across risk tiers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {portfolio?.riskConcentration && portfolio.riskConcentration.length > 0 ? (
                portfolio.riskConcentration.map((item) => (
                  <div key={item.risk} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{item.risk} Risk</span>
                      <span>{item.percent.toFixed(1)}% ({formatMoney(item.value, currency)})</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full ${
                          item.risk === 'Low'
                            ? 'bg-emerald-500'
                            : item.risk === 'Medium'
                            ? 'bg-indigo-500'
                            : item.risk === 'High'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No holdings to compute risk concentration.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Modal: Create Account */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Create Investment Account</CardTitle>
              <CardDescription>Accounts are separate from spendable cash wallets.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAccountSubmit} className="space-y-3">
                <label className="block text-xs font-semibold">
                  Account Name
                  <input
                    required
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="e.g. Binance, Interactive Brokers, Gold Vault"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Account Class
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as any)}
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  >
                    <option value="Exchange">Exchange (Crypto / Web3)</option>
                    <option value="Brokerage">Brokerage (Stocks / ETFs / Funds)</option>
                    <option value="Retirement">Retirement / Pension</option>
                    <option value="PreciousMetals">Precious Metals / Physical</option>
                    <option value="Manual">Manual / Other</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold">
                  Institution / Custodian (Optional)
                  <input
                    value={accInstitution}
                    onChange={(e) => setAccInstitution(e.target.value)}
                    placeholder="e.g. Binance, Vanguard, CIH Custody"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowAccountModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Save Account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Add Asset */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Track an Asset</CardTitle>
              <CardDescription>Support for live CoinGecko crypto valuations and manual traditional assets.</CardDescription>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant={assetMode === 'crypto' ? 'default' : 'outline'}
                  onClick={() => setAssetMode('crypto')}
                  type="button"
                >
                  <Sparkles className="mr-1 h-3.5 w-3.5" /> CoinGecko Crypto
                </Button>
                <Button
                  size="sm"
                  variant={assetMode === 'custom' ? 'default' : 'outline'}
                  onClick={() => setAssetMode('custom')}
                  type="button"
                >
                  <Tag className="mr-1 h-3.5 w-3.5" /> Traditional / Other
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAssetSubmit} className="space-y-4">
                {assetMode === 'crypto' ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold">
                      Search CoinGecko (Live Crypto)
                      <div className="relative mt-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          value={cryptoSearch}
                          onChange={(e) => handleSearchCryptoQuery(e.target.value)}
                          placeholder="Search Bitcoin, Ethereum, Solana, etc."
                          className="w-full rounded-md border p-2 pl-9 bg-transparent text-sm"
                        />
                      </div>
                    </label>

                    {searchingCrypto && <p className="text-xs text-gray-400 animate-pulse">Searching CoinGecko…</p>}

                    {cryptoResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-md border divide-y text-xs">
                        {cryptoResults.map((coin) => (
                          <div
                            key={coin.id}
                            onClick={() => setSelectedCrypto(coin)}
                            className={`p-2.5 cursor-pointer flex justify-between items-center transition-colors ${
                              selectedCrypto?.id === coin.id
                                ? 'bg-indigo-50 dark:bg-indigo-950 font-semibold'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span>{coin.name} ({coin.symbol.toUpperCase()})</span>
                            <span className="text-[10px] text-gray-400 font-mono">{coin.id}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedCrypto && (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                        Selected: <strong>{selectedCrypto.name} ({selectedCrypto.symbol.toUpperCase()})</strong> with CoinGecko ID <code>{selectedCrypto.id}</code>.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold">
                        Asset Name
                        <input
                          required
                          value={customAssetName}
                          onChange={(e) => setCustomAssetName(e.target.value)}
                          placeholder="e.g. Apple Inc., Physical Gold 24k"
                          className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold">
                        Symbol / Code
                        <input
                          required
                          value={customAssetSymbol}
                          onChange={(e) => setCustomAssetSymbol(e.target.value)}
                          placeholder="e.g. AAPL, GOLD-1G"
                          className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold">
                        Asset Class
                        <select
                          value={customAssetClass}
                          onChange={(e) => setCustomAssetClass(e.target.value as any)}
                          className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                        >
                          <option value="Stock">Stock</option>
                          <option value="ETF">ETF</option>
                          <option value="MutualFund">Mutual Fund</option>
                          <option value="PreciousMetal">Precious Metal (Gold/Silver)</option>
                          <option value="Bond">Bond</option>
                          <option value="CashEquivalent">Cash Equivalent</option>
                          <option value="Other">Other</option>
                        </select>
                      </label>

                      <label className="block text-xs font-semibold">
                        Risk Tier
                        <select
                          value={customAssetRisk}
                          onChange={(e) => setCustomAssetRisk(e.target.value as any)}
                          className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="VeryHigh">Very High</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAssetModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Add Asset
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Record Trade */}
      {showTradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Record Trade / Investment Event</CardTitle>
              <CardDescription>Creates an auditable event and recalculates holding lots.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTradeSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold">
                    Event Type
                    <select
                      value={tradeType}
                      onChange={(e) => setTradeType(e.target.value as any)}
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm font-semibold"
                    >
                      <option value="Buy">Buy Asset</option>
                      <option value="Sell">Sell Asset</option>
                      <option value="Dividend">Dividend / Yield</option>
                      <option value="Interest">Interest</option>
                      <option value="Fee">Account Fee</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold">
                    Account
                    <select
                      required
                      value={tradeAccountId}
                      onChange={(e) => setTradeAccountId(e.target.value)}
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                    >
                      <option value="">Select account</option>
                      {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                      ))}
                    </select>
                  </label>
                </div>

                {(tradeType === 'Buy' || tradeType === 'Sell') && (
                  <label className="block text-xs font-semibold">
                    Asset
                    <select
                      required
                      value={tradeAssetId}
                      onChange={(e) => setTradeAssetId(e.target.value)}
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                    >
                      <option value="">Select asset</option>
                      {assets.map((ast) => (
                        <option key={ast.id} value={ast.id}>{ast.name} ({ast.symbol})</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold">
                    Units / Quantity
                    <input
                      type="number"
                      step="any"
                      min="0.00000001"
                      value={tradeUnits}
                      onChange={(e) => setTradeUnits(e.target.value)}
                      placeholder="e.g. 0.05"
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                    />
                  </label>

                  <label className="block text-xs font-semibold">
                    Price per Unit ({currency})
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={tradePrice}
                      onChange={(e) => setTradePrice(e.target.value)}
                      placeholder="e.g. 680000"
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold">
                    Trade Fees ({currency})
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={tradeFees}
                      onChange={(e) => setTradeFees(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                    />
                  </label>

                  <label className="block text-xs font-semibold">
                    Trade Date
                    <input
                      type="date"
                      value={tradeDate}
                      onChange={(e) => setTradeDate(e.target.value)}
                      className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold">
                  Notes (Optional)
                  <input
                    value={tradeNotes}
                    onChange={(e) => setTradeNotes(e.target.value)}
                    placeholder="e.g. Monthly DCA, Binance order #1234"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowTradeModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Record Event
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Fund Account */}
      {showFundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Deposit / Fund Investment Account</CardTitle>
              <CardDescription>
                Transfers cash from your Bank or Cash wallet into your investment account. This does not count as an expense or alter your spendable budget.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFundSubmit} className="space-y-3">
                <label className="block text-xs font-semibold">
                  Destination Investment Account
                  <select
                    required
                    value={fundAccountId}
                    onChange={(e) => setFundAccountId(e.target.value)}
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  >
                    <option value="">Select investment account</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold">
                  Source Wallet
                  <select
                    required
                    value={fundWalletId}
                    onChange={(e) => setFundWalletId(e.target.value)}
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  >
                    <option value="">Select bank/cash wallet</option>
                    {wallets.filter((w) => w.type === 'Bank' || w.type === 'Cash').map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatMoney(w.balance, currency)})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold">
                  Amount ({currency})
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm font-semibold"
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Note (Optional)
                  <input
                    value={fundNote}
                    onChange={(e) => setFundNote(e.target.value)}
                    placeholder="e.g. Wire transfer to exchange"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowFundModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Transfer & Fund
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Withdraw Cash */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Withdraw Cash from Investment Account</CardTitle>
              <CardDescription>
                Returns cash from an investment account back to your bank wallet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleWithdrawSubmit} className="space-y-3">
                <label className="block text-xs font-semibold">
                  Source Investment Account
                  <select
                    required
                    value={withdrawAccountId}
                    onChange={(e) => setWithdrawAccountId(e.target.value)}
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  >
                    <option value="">Select investment account</option>
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold">
                  Destination Bank/Cash Wallet
                  <select
                    required
                    value={withdrawWalletId}
                    onChange={(e) => setWithdrawWalletId(e.target.value)}
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  >
                    <option value="">Select destination wallet</option>
                    {wallets.filter((w) => w.type === 'Bank' || w.type === 'Cash').map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold">
                  Amount ({currency})
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm font-semibold"
                  />
                </label>

                <label className="block text-xs font-semibold">
                  Note (Optional)
                  <input
                    value={withdrawNote}
                    onChange={(e) => setWithdrawNote(e.target.value)}
                    placeholder="e.g. Bank withdrawal after crypto sale"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowWithdrawModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Withdraw to Wallet
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Manual Price Snapshot */}
      {showPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-xl">
            <CardHeader>
              <CardTitle>Update Asset Valuation</CardTitle>
              <CardDescription>
                Record a manual price snapshot for traditional or physical assets (Gold, Stocks, Real Estate).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePriceUpdateSubmit} className="space-y-3">
                <label className="block text-xs font-semibold">
                  Asset
                  <select
                    required
                    value={priceAssetId}
                    onChange={(e) => setPriceAssetId(e.target.value)}
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm"
                  >
                    <option value="">Select asset to price</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.symbol})</option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-semibold">
                  Current Price per Unit ({currency})
                  <input
                    required
                    type="number"
                    step="any"
                    min="0.0001"
                    value={newManualPrice}
                    onChange={(e) => setNewManualPrice(e.target.value)}
                    placeholder="e.g. 750"
                    className="mt-1 w-full rounded-md border p-2 bg-transparent text-sm font-semibold"
                  />
                </label>

                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" onClick={() => setShowPriceModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Save Price Snapshot
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
