import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  CategoryBudget,
  CommitmentOccurrence,
  DashboardTab,
  Debt,
  ExternalWealthItem,
  FinancialIntegrityReport,
  FinancialReviewItem,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Subscription,
  Transaction,
  WalletsWorkbenchSection,
} from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { computeFourPillarBreakdown } from '../../lib/finance';
import { getCurrentFinancialMonth } from '../../lib/financialMonth';
import { useAuth } from '../../context/AuthContext';
import { GettingStartedChecklist } from '../onboarding/GettingStartedChecklist';
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flame,
  Landmark,
  Shield,
  TrendingUp,
  User,
  WalletCards,
} from 'lucide-react';
import { usePrivacy } from '../../context/PrivacyContext';
import {
  AnimatedMetricValue,
  AnimatedProgressBar,
} from '../ui/MotionPrimitives';
import { ProgressiveSection } from '../ui/ProgressiveSection';
import { AnimatePresence, motion } from 'motion/react';
import { computeDailyDisciplineStreak } from './overview/overviewHelpers';

// Deferred chart & modal modules — never needed for Frame-1 Safe-to-Spend KPIs
const CycleDailyBurnChart = lazy(() =>
  import('./OverviewCharts').then((m) => ({ default: m.CycleDailyBurnChart })),
);
const FinancialInsightModal = lazy(() =>
  import('./FinancialInsightModal').then((m) => ({ default: m.FinancialInsightModal })),
);

// Viewport-lazy lower overview bands (each chunks independently + avoids computing/rendering offscreen)
const OverviewBand2HealthAndCategories = lazy(() =>
  import('./overview/OverviewBand2HealthAndCategories').then((m) => ({
    default: m.OverviewBand2HealthAndCategories,
  })),
);
const OverviewBand3WealthAndTrajectory = lazy(() =>
  import('./overview/OverviewBand3WealthAndTrajectory').then((m) => ({
    default: m.OverviewBand3WealthAndTrajectory,
  })),
);
const OverviewBand4OperationalRadar = lazy(() =>
  import('./overview/OverviewBand4OperationalRadar').then((m) => ({
    default: m.OverviewBand4OperationalRadar,
  })),
);
const OverviewBand5ActivityAndWealth = lazy(() =>
  import('./overview/OverviewBand5ActivityAndWealth').then((m) => ({
    default: m.OverviewBand5ActivityAndWealth,
  })),
);
const OverviewBand6GoalsAndSignals = lazy(() =>
  import('./overview/OverviewBand6GoalsAndSignals').then((m) => ({
    default: m.OverviewBand6GoalsAndSignals,
  })),
);

export interface OperationalRadarPayload {
  upcomingCommitments: CommitmentOccurrence[];
  pendingReviews: FinancialReviewItem[];
  integritySummary: FinancialIntegrityReport | null;
  externalWealthSummary: {
    items: ExternalWealthItem[];
    totalExternalAssetsMad: number;
    totalExternalLiabilitiesMad: number;
    netExternalWealthMad: number;
    staleCount: number;
  } | null;
}

interface OverviewTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  investmentsData?: InvestmentsData | null;
  initialOperationalRadar?: OperationalRadarPayload | null;
  isHydratingRadar?: boolean;
  isHydratingInvestments?: boolean;
  onEnsureRadarLoaded?: (force?: boolean) => Promise<void> | void;
  setActiveTab: (tab: DashboardTab) => void;
  openTransaction: (transactionId: string) => void;
  handleSettle: (
    debtId: string,
    amount: number,
    category?: string,
    walletId?: string,
  ) => Promise<void> | void;
  payrolls: Payroll[];
  handleCreateWallet?: (payload: {
    name: string;
    type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
    isMain?: boolean;
    initialBalance?: number;
  }) => Promise<any>;
  handleUpdateWallet?: (
    id: string,
    payload: {
      name?: string;
      type?: 'Bank' | 'Cash' | 'Savings' | 'Investment';
      isMain?: boolean;
      initialBalance?: number;
    },
  ) => Promise<any>;
  handleDeleteWallet?: (id: string, reassignToWalletId?: string) => Promise<any>;
  onDataChange?: () => Promise<void> | void;
  onOpenQuickTransaction?: (type: 'Expense' | 'Income' | 'Transfer') => void;
  onOpenSmartCalculator?: () => void;
  onOpenCommandPalette?: () => void;
}

function BandSuspenseSkeleton({ heightClass = 'h-64' }: { heightClass?: string }) {
  return (
    <div
      className={`${heightClass} w-full rounded-xl border border-gray-200/70 dark:border-gray-800/70 bg-gray-100/70 dark:bg-gray-900/40 animate-pulse`}
      aria-hidden="true"
    />
  );
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  kpis,
  transactions,
  debts,
  budgets,
  goals = [],
  subscriptions = [],
  investmentsData = null,
  initialOperationalRadar = null,
  isHydratingRadar = false,
  isHydratingInvestments = false,
  onEnsureRadarLoaded,
  payrolls,
  setActiveTab,
  openTransaction,
  handleSettle,
  onDataChange,
}) => {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const { user } = useAuth();
  const isAdvanced = user?.experienceTier === 'advanced';
  const [showWaterfall, setShowWaterfall] = useState(false);
  const [insightModalType, setInsightModalType] = useState<'forecast' | 'health' | null>(null);

  const externalWealthSummary = initialOperationalRadar?.externalWealthSummary ?? null;

  const openAccountsSection = (section: WalletsWorkbenchSection) => {
    window.dispatchEvent(new CustomEvent('truespend:openAccountsSection', { detail: section }));
  };

  const currentFm = useMemo(() => getCurrentFinancialMonth(payrolls), [payrolls]);
  const year = currentFm?.year ?? -1;
  const month = currentFm?.month ?? -1;

  const activeReceivables = useMemo(
    () =>
      debts
        .filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending')
        .reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0),
    [debts],
  );

  const activePayables = useMemo(
    () =>
      debts
        .filter((debt) => debt.type === 'Payable' && debt.status === 'Pending')
        .reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0),
    [debts],
  );

  const stockPortfolioMad = investmentsData?.totalPortfolioValueMad ?? 0;
  const activeStockPositions = useMemo(
    () => (investmentsData?.positions || []).filter((p) => !p.isWatchlistOnly && p.sharesNum > 0),
    [investmentsData],
  );

  // Prevent double-counting: kpis.totalLiquidity already includes kpis.investmentReserve.
  const investmentReserveMad = kpis?.investmentReserve ?? 0;
  const nonInvestmentLiquidity = Math.max(0, (kpis?.totalLiquidity ?? 0) - investmentReserveMad);
  const effectiveInvestmentMad = stockPortfolioMad > 0 ? stockPortfolioMad : investmentReserveMad;
  const actualHoldingsNetWorth = nonInvestmentLiquidity + effectiveInvestmentMad;
  const netDebtAdjustment = activeReceivables - activePayables;
  const netWorth = actualHoldingsNetWorth + netDebtAdjustment;

  const dailyStatusStyles = {
    on_track: 'text-indigo-600 dark:text-indigo-400',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-rose-600 dark:text-rose-400',
  };

  // Light Frame-1 30-day discipline counter (heavy 50/30/20 & anomaly math lives in Band 3/4)
  const disciplineStats = useMemo(
    () => computeDailyDisciplineStreak(transactions, kpis?.dailyAllowance ?? 0),
    [transactions, kpis?.dailyAllowance],
  );

  // Cycle summary metrics for Adjusted True Spend card
  const hasServerKpiSummary =
    typeof kpis?.monthlyIncome === 'number' && typeof kpis?.adjustedTrueSpend === 'number';

  const fallbackFourPillars = useMemo(() => {
    if (hasServerKpiSummary) return null;
    return computeFourPillarBreakdown({
      transactions,
      budgets,
      year,
      month,
      payrolls,
      wallets: kpis?.accounts,
      isCurrentMonth: true,
    });
  }, [hasServerKpiSummary, transactions, budgets, year, month, payrolls, kpis?.accounts]);

  const cycleIncome = kpis?.monthlyIncome ?? fallbackFourPillars?.periodIncome ?? 0;
  const cycleTrueSpend = kpis?.adjustedTrueSpend ?? fallbackFourPillars?.totalLivingSpent ?? 0;
  const cycleSavingsRatePct =
    cycleIncome > 0
      ? Math.max(-99, Math.min(100, Math.round(((cycleIncome - cycleTrueSpend) / cycleIncome) * 100)))
      : 0;

  // Subscriptions metrics (shared cleanly by Band 1 compact line & Band 5)
  const activeSubs = useMemo(
    () => subscriptions.filter((s) => s.status === 'active'),
    [subscriptions],
  );
  const monthlySubBurn = useMemo(() => {
    return activeSubs.reduce((sum, s) => {
      const amt = parseFloat(s.amount) || 0;
      const raw = (s.billingCycle || 'monthly').trim().toLowerCase();
      if (raw === 'yearly') return sum + amt / 12;
      if (raw === 'every_6_months') return sum + amt / 6;
      if (raw === 'quarterly' || raw === 'every_3_months') return sum + amt / 3;
      if (raw === 'every_2_months') return sum + amt / 2;
      if (raw === 'weekly') return sum + (amt * 52) / 12;
      if (raw === 'biweekly') return sum + (amt * 26) / 12;
      const customMonths = raw.match(/^every_(\d+)_months?$/);
      if (customMonths) return sum + amt / Math.max(1, parseInt(customMonths[1], 10));
      const customDays = raw.match(/^every_(\d+)_days?$/);
      if (customDays) return sum + (amt * 30.4375) / Math.max(1, parseInt(customDays[1], 10));
      return sum + amt;
    }, 0);
  }, [activeSubs]);

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 sm:space-y-5">
      <GettingStartedChecklist
        onNavigateTab={setActiveTab}
        onRelaunchWizard={() => window.dispatchEvent(new CustomEvent('truespend:openOnboarding'))}
      />

      {!currentFm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            Your financial period is not set yet. Configure your current cycle and next payday so Safe-to-Spend, budgets, and forecasts align with your payday.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.dispatchEvent(new CustomEvent('truespend:openOnboarding'))}
            >
              Guided Period Setup
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab('calendar')}>
              Open Calendar
            </Button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 1 — ASYMMETRIC HERO COCKPIT (Frame-1 Immediate Render)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
        {/* LEFT: Safe to Spend Hero Card */}
        <div className="xl:col-span-5 flex flex-col">
          <Card className="flex-1 min-w-0 border-transparent bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 text-white flex flex-col justify-between">
            <div>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-400">
                  <Shield className="h-4 w-4 text-indigo-400" /> Safe to Spend
                  <button
                    type="button"
                    onClick={togglePrivacyMode}
                    title={isPrivacyMode ? 'Click to show balances' : 'Click to hide balances with stars'}
                    className="ml-1 p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800/80 transition-colors cursor-pointer"
                  >
                    {isPrivacyMode ? (
                      <EyeOff className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                    )}
                  </button>
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowWaterfall((prev) => !prev)}
                    className="text-xs font-medium text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-800 border border-gray-700 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    title="View Liquidity-to-Safe-to-Spend Waterfall Math"
                  >
                    <span>Waterfall</span>
                    {showWaterfall ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAccountsSection('wallets')}
                    className="text-xs font-medium text-indigo-300 hover:text-white bg-indigo-900/40 hover:bg-indigo-900/80 border border-indigo-700/60 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <WalletCards className="h-3.5 w-3.5" /> Accounts
                  </button>
                </div>
              </CardHeader>

              <CardContent className="pt-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="break-words text-3xl font-bold sm:text-4xl font-mono tabular-nums tracking-tight">
                    <AnimatedMetricValue
                      value={kpis?.safeToSpend ?? 0}
                      masked={isPrivacyMode}
                      maskText="******"
                    />{' '}
                    <span className="text-lg text-gray-400 font-normal">MAD</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono tabular-nums font-semibold text-indigo-300">
                      {kpis?.runwayDays ?? 0}d runway
                    </span>
                  </div>
                </div>

                {/* All Individual Wallets & Bank Balances */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 w-full text-xs text-gray-300 font-mono tabular-nums bg-gray-950/40 rounded-xl p-2.5 border border-gray-800/70">
                    {kpis?.accounts?.map((acc) => {
                      const accCommitted = subscriptions
                        .filter((s) => s.status === 'active' && (s.walletId === acc.id || (!s.walletId && acc.isMain)))
                        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
                      const isLow = acc.type !== 'Investment' && acc.balance < accCommitted && accCommitted > 0;

                      return (
                        <span key={acc.id} className="flex items-center justify-between gap-2 min-w-0">
                          <span className="flex items-center gap-1.5 min-w-0 text-gray-400">
                            {acc.type === 'Bank' ? (
                              <Landmark className="h-3 w-3 shrink-0 text-indigo-400" />
                            ) : acc.type === 'Cash' ? (
                              <Banknote className="h-3 w-3 shrink-0 text-emerald-400" />
                            ) : acc.type === 'Investment' ? (
                              <TrendingUp className="h-3 w-3 shrink-0 text-amber-400" />
                            ) : (
                              <WalletCards className="h-3 w-3 shrink-0 text-sky-400" />
                            )}
                            <span className="truncate">{acc.name}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-white">
                            {isPrivacyMode ? '****' : acc.balance.toFixed(2)}
                            {isLow && (
                              <span
                                className="ml-1 text-rose-400 font-bold"
                                title={`Upcoming bills (${accCommitted.toFixed(0)} MAD) exceed balance`}
                              >
                                !
                              </span>
                            )}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Expandable Waterfall Math */}
                <AnimatePresence initial={false} mode="wait">
                  {showWaterfall ? (
                    <motion.div
                      key="waterfall-expanded"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className="mt-3 rounded-xl border border-gray-800 bg-gray-950/70 p-3 space-y-1.5 text-xs font-mono tabular-nums"
                    >
                      <div className="flex justify-between text-gray-300">
                        <span>Total Liquid Accounts</span>
                        <span className="font-semibold text-white">
                          {isPrivacyMode ? '******' : `${(kpis?.totalLiquidity ?? 0).toFixed(2)} MAD`}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>− Emergency Safety Buffer</span>
                        <span className="text-amber-300">
                          {isPrivacyMode ? '−****' : `−${(kpis?.emergencyBuffer ?? 0).toFixed(2)} MAD`}
                        </span>
                      </div>
                      {(kpis?.investmentReserve ?? 0) > 0 && (
                        <div className="flex justify-between text-gray-400">
                          <span>− Brokerage Capital Reserve</span>
                          <span className="text-amber-300">
                            {isPrivacyMode ? '−****' : `−${(kpis?.investmentReserve ?? 0).toFixed(2)} MAD`}
                          </span>
                        </div>
                      )}
                      {(kpis?.pendingPayables ?? 0) > 0 && (
                        <div className="flex justify-between text-gray-400">
                          <span>− Pending Debt Payables</span>
                          <span className="text-rose-300">
                            {isPrivacyMode ? '−****' : `−${(kpis?.pendingPayables ?? 0).toFixed(2)} MAD`}
                          </span>
                        </div>
                      )}
                      <div className="border-t border-gray-800 pt-1.5 flex justify-between font-bold text-indigo-300">
                        <span>= True Safe to Spend</span>
                        <span>{isPrivacyMode ? '******' : `${(kpis?.safeToSpend ?? 0).toFixed(2)} MAD`}</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="waterfall-compact"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.14 }}
                      className="mt-3 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-mono tabular-nums text-gray-400"
                    >
                      <span>Liquidity {isPrivacyMode ? '****' : (kpis?.totalLiquidity ?? 0).toFixed(0)}</span>
                      {stockPortfolioMad > 0 && (
                        <span className="text-emerald-400">
                          · Stocks {isPrivacyMode ? '****' : `+${stockPortfolioMad.toFixed(0)}`}
                        </span>
                      )}
                      <span>· Buffer {isPrivacyMode ? '****' : `−${(kpis?.emergencyBuffer ?? 0).toFixed(0)}`}</span>
                      {(kpis?.investmentReserve ?? 0) > 0 && (
                        <span className="text-amber-400">
                          · Inv Reserve {isPrivacyMode ? '****' : `−${(kpis?.investmentReserve ?? 0).toFixed(0)}`}
                        </span>
                      )}
                      {monthlySubBurn > 0 && (
                        <span className="text-purple-400">
                          · Subs {isPrivacyMode ? '****' : `${monthlySubBurn.toFixed(0)}/mo`}
                        </span>
                      )}
                      {(kpis?.pendingPayables ?? 0) > 0 && (
                        <span>· Payables {isPrivacyMode ? '****' : `−${(kpis?.pendingPayables ?? 0).toFixed(0)}`}</span>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Net Worth & External Wealth Footer */}
                <div className="mt-4 pt-3.5 border-t border-gray-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-400">
                        Estimated Unified Net Worth{' '}
                        <span className="text-[10px] text-gray-500">(incl. Net Debts)</span>
                      </p>
                      <p className="text-lg font-semibold text-white font-mono tabular-nums">
                        <AnimatedMetricValue
                          value={netWorth}
                          masked={isPrivacyMode}
                          maskText="******"
                          suffix=" MAD"
                        />
                      </p>
                    </div>
                    {isAdvanced && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('investments')}
                        className="text-xs font-medium text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-800/60 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>
                          {activeStockPositions.length > 0
                            ? `${activeStockPositions.length} Positions`
                            : 'Investments'}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono tabular-nums text-gray-400 bg-gray-950/50 rounded-lg px-2.5 py-1.5 border border-gray-800/80">
                    <span className="text-gray-200 font-medium">
                      Actual Holdings: {isPrivacyMode ? '****' : `${actualHoldingsNetWorth.toFixed(2)} MAD`}
                    </span>
                    <span>
                      {isPrivacyMode
                        ? '(Cash & Savings **** + Inv ****)'
                        : `(Cash & Savings ${nonInvestmentLiquidity.toFixed(2)} + Inv ${effectiveInvestmentMad.toFixed(2)})`}
                    </span>
                    {(activeReceivables > 0 || activePayables > 0) && (
                      <span className={netDebtAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {isPrivacyMode
                          ? '· Net Debts ****'
                          : `· Net Debts ${netDebtAdjustment >= 0 ? '+' : ''}${netDebtAdjustment.toFixed(2)} (+${activeReceivables.toFixed(2)} owed to you − ${activePayables.toFixed(2)} payable)`}
                      </span>
                    )}
                  </div>

                  {isAdvanced && externalWealthSummary && externalWealthSummary.items.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-gray-300 bg-gray-950/60 rounded-lg px-2.5 py-1.5 border border-gray-800">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-indigo-300 font-semibold">
                          External Wealth (Off-Ledger):{' '}
                          {isPrivacyMode
                            ? '****'
                            : `${externalWealthSummary.netExternalWealthMad >= 0 ? '+' : ''}${externalWealthSummary.netExternalWealthMad.toFixed(0)} MAD`}
                        </span>
                        <span className="text-gray-400">
                          {isPrivacyMode
                            ? '(Assets **** · Liabilities ****)'
                            : `(Assets +${externalWealthSummary.totalExternalAssetsMad.toFixed(0)} · Liabilities −${externalWealthSummary.totalExternalLiabilitiesMad.toFixed(0)})`}
                        </span>
                        {externalWealthSummary.staleCount > 0 && (
                          <span className="text-amber-300">
                            · {externalWealthSummary.staleCount} stale valuation
                            {externalWealthSummary.staleCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openAccountsSection('external_wealth_fx')}
                        className="text-indigo-300 hover:text-white underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Manage →
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </div>
          </Card>
        </div>

        {/* RIGHT: Telemetry Pair + Deferred Daily Burn Chart */}
        <div className="xl:col-span-7 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Daily Allowance + Discipline Streak */}
            <Card className="min-w-0">
              <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Daily Allowance
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-gray-400">
                      {kpis?.daysUntilPayday ?? 0}d to payday
                    </span>
                  </div>
                  <div
                    className={`mt-1.5 text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
                      dailyStatusStyles[kpis?.dailyStatus || 'on_track']
                    }`}
                  >
                    <AnimatedMetricValue
                      value={kpis?.dailyRemaining ?? 0}
                      masked={isPrivacyMode}
                      maskText="******"
                    />{' '}
                    <span className="text-sm font-normal text-gray-400">MAD</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    {isPrivacyMode
                      ? '•••• spent of •••• MAD'
                      : `${(kpis?.dailySpent ?? 0).toFixed(2)} spent of ${(kpis?.dailyAllowance ?? 0).toFixed(2)} MAD`}
                  </p>
                  <AnimatedProgressBar
                    className="mt-2.5"
                    trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                    percent={kpis?.dailyUsagePercent ?? 0}
                    barClassName={
                      (kpis?.dailyUsagePercent ?? 0) > 100
                        ? 'bg-rose-500'
                        : (kpis?.dailyUsagePercent ?? 0) > 80
                        ? 'bg-amber-500'
                        : 'bg-indigo-600'
                    }
                  />
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-mono tabular-nums font-bold">{disciplineStats.streakDays}d</span> streak
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    {disciplineStats.daysUnderIn30d}/30d under cap
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Adjusted True Spend + Cycle Net Retention */}
            <Card className="min-w-0">
              <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Adjusted True Spend
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-gray-400">
                      {isPrivacyMode ? '••••/day' : `${(kpis?.avgDailySpend ?? 0).toFixed(0)} MAD/day`}
                    </span>
                  </div>
                  <div className="mt-1.5 text-2xl sm:text-3xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                    <AnimatedMetricValue
                      value={cycleTrueSpend}
                      masked={isPrivacyMode}
                      maskText="******"
                    />{' '}
                    <span className="text-sm font-normal text-gray-400">MAD</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Net expenses excluding reimbursements &amp; splits
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                  <div>
                    <span className="text-[11px] font-sans text-gray-400 block">Cycle Inflow</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{isPrivacyMode ? '••••' : `${cycleIncome.toFixed(0)} MAD`}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-sans text-gray-400 block">Net Retention</span>
                    <span
                      className={`font-semibold ${
                        cycleSavingsRatePct >= 20
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : cycleSavingsRatePct >= 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {cycleSavingsRatePct}% saved
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deferred Daily Living Burn vs Cap Chart */}
          <div className="flex-1 min-h-0">
            <Suspense fallback={<BandSuspenseSkeleton heightClass="h-64" />}>
              <CycleDailyBurnChart
                transactions={transactions}
                currentFm={currentFm}
                dailyAllowance={kpis?.dailyAllowance ?? 0}
                safeToSpend={kpis?.safeToSpend ?? 0}
                daysUntilPayday={kpis?.daysUntilPayday ?? 0}
                wallets={kpis?.accounts}
                isPrivacyMode={isPrivacyMode}
              />
            </Suspense>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 2 — CATEGORY PRESSURE, FORECAST SCENARIOS & FINANCIAL HEALTH
          ═════════════════════════════════════════════════════════════════════ */}
      <ProgressiveSection
        minHeight={310}
        label="Category Burn & Financial Health"
        render={() => (
          <Suspense fallback={<BandSuspenseSkeleton heightClass="h-[310px]" />}>
            <OverviewBand2HealthAndCategories
              kpis={kpis}
              transactions={transactions}
              budgets={budgets}
              payrolls={payrolls}
              currentFm={currentFm}
              isPrivacyMode={isPrivacyMode}
              setActiveTab={setActiveTab}
              onOpenInsightModal={setInsightModalType}
            />
          </Suspense>
        )}
      />

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 3 — WEALTH ALLOCATION / 4 PILLARS + MULTI-CYCLE CASHFLOW & FORECAST
          ═════════════════════════════════════════════════════════════════════ */}
      <ProgressiveSection
        minHeight={320}
        label="Wealth Architecture & Multi-Cycle Cashflow"
        render={() => (
          <Suspense fallback={<BandSuspenseSkeleton heightClass="h-[320px]" />}>
            <OverviewBand3WealthAndTrajectory
              kpis={kpis}
              transactions={transactions}
              budgets={budgets}
              payrolls={payrolls}
              subscriptions={subscriptions}
              debts={debts}
              goals={goals}
              investmentsData={investmentsData}
              stockPortfolioMad={stockPortfolioMad}
              activeReceivables={activeReceivables}
              externalAssetsMad={externalWealthSummary?.totalExternalAssetsMad ?? 0}
              currentFm={currentFm}
              isPrivacyMode={isPrivacyMode}
              setActiveTab={setActiveTab}
            />
          </Suspense>
        )}
      />

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 4 — OPERATIONAL RADAR (On-Demand Radar Slice Fetch on Viewport Entry)
          ═════════════════════════════════════════════════════════════════════ */}
      <ProgressiveSection
        minHeight={220}
        label="Commitments, Review Inbox & Anomaly Radar"
        onHydrate={() => onEnsureRadarLoaded?.()}
        render={() => (
          <Suspense fallback={<BandSuspenseSkeleton heightClass="h-[220px]" />}>
            <OverviewBand4OperationalRadar
              kpis={kpis}
              transactions={transactions}
              payrolls={payrolls}
              currentFm={currentFm}
              operationalRadar={initialOperationalRadar}
              isHydratingRadar={isHydratingRadar}
              onEnsureRadarLoaded={onEnsureRadarLoaded}
              onDataChange={onDataChange}
              isPrivacyMode={isPrivacyMode}
              setActiveTab={setActiveTab}
              openTransaction={openTransaction}
              openAccountsSection={openAccountsSection}
            />
          </Suspense>
        )}
      />

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 5 — RECENT TRANSACTIONS, DEBTS/RECEIVABLES & RECURRING / INVESTMENTS
          ═════════════════════════════════════════════════════════════════════ */}
      <ProgressiveSection
        minHeight={320}
        label="Recent Activity, Receivables & Investments"
        render={() => (
          <Suspense fallback={<BandSuspenseSkeleton heightClass="h-[320px]" />}>
            <OverviewBand5ActivityAndWealth
              kpis={kpis}
              transactions={transactions}
              debts={debts}
              activeReceivables={activeReceivables}
              activeSubs={activeSubs}
              monthlySubBurn={monthlySubBurn}
              investmentsData={investmentsData}
              stockPortfolioMad={stockPortfolioMad}
              isHydratingInvestments={isHydratingInvestments}
              isPrivacyMode={isPrivacyMode}
              setActiveTab={setActiveTab}
              openTransaction={openTransaction}
              handleSettle={handleSettle}
            />
          </Suspense>
        )}
      />

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 6 — SAVINGS GOALS & FINANCIAL SIGNALS CAROUSEL
          ═════════════════════════════════════════════════════════════════════ */}
      <ProgressiveSection
        minHeight={220}
        label="Savings Goals & Financial Signals"
        render={() => (
          <Suspense fallback={<BandSuspenseSkeleton heightClass="h-[220px]" />}>
            <OverviewBand6GoalsAndSignals
              kpis={kpis}
              transactions={transactions}
              debts={debts}
              budgets={budgets}
              payrolls={payrolls}
              goals={goals}
              investmentsData={investmentsData}
              isPrivacyMode={isPrivacyMode}
              setActiveTab={setActiveTab}
            />
          </Suspense>
        )}
      />

      {insightModalType && (
        <Suspense fallback={null}>
          <FinancialInsightModal
            type={insightModalType}
            isOpen={true}
            onClose={() => setInsightModalType(null)}
            kpis={kpis}
          />
        </Suspense>
      )}
    </div>
  );
};
