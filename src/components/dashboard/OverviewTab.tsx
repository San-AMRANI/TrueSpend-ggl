import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  CategoryBudget,
  DashboardTab,
  Debt,
  KPI,
  Payroll,
  Transaction,
  Goal,
  Subscription,
  InvestmentsData,
  CommitmentOccurrence,
  FinancialReviewItem,
  FinancialIntegrityReport,
  ExternalWealthItem,
  WalletsWorkbenchSection,
} from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { SettleDebtModal } from '../SettleDebtModal';
import {
  computeFourPillarBreakdown,
  getSpendingPace,
  isInMonth,
  netExpenseOf,
  reimbursedAmountOf,
} from '../../lib/finance';
import { getCurrentFinancialMonth } from '../../lib/financialMonth';
import { generateFacts, selectFacts } from '../../lib/financialFacts';
import { FinancialFactsCarousel } from './FinancialFactsCarousel';
import { FinancialInsightModal } from './FinancialInsightModal';
import {
  CycleDailyBurnChart,
  MultiCycleCashflowChart,
  WealthAllocationChart,
} from './OverviewCharts';
import { computeHolisticForecast } from '../../lib/predictiveEngine';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  FileCheck2,
  Flame,
  Heart,
  Inbox,
  Landmark,
  Layers,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  Repeat,
  Scale,
  Shield,
  Target,
  TrendingUp,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { normalizeCategory } from '../../lib/categories';
import { usePrivacy } from '../../context/PrivacyContext';
import {
  AnimatedMetricValue,
  AnimatedProgressBar,
  MotionModal,
  StaggerItem,
  StaggerList,
} from '../ui/MotionPrimitives';
import { AnimatePresence, motion } from 'motion/react';

interface OverviewTabProps {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  investmentsData?: InvestmentsData | null;
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

export const OverviewTab: React.FC<OverviewTabProps> = ({
  kpis,
  transactions,
  debts,
  budgets,
  goals = [],
  subscriptions = [],
  investmentsData = null,
  payrolls,
  setActiveTab,
  openTransaction,
  handleSettle,
  onDataChange,
}) => {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const { token } = useAuth();
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const [showWaterfall, setShowWaterfall] = useState(false);
  const [insightModalType, setInsightModalType] = useState<'forecast' | 'health' | null>(null);
  const [wealthTab, setWealthTab] = useState<'pillars' | 'allocation'>('pillars');

  // Live Operational Radar state (Commitments, Review Inbox, Ledger Integrity, External Wealth)
  const [upcomingCommitments, setUpcomingCommitments] = useState<CommitmentOccurrence[]>([]);
  const [pendingReviews, setPendingReviews] = useState<FinancialReviewItem[]>([]);
  const [integritySummary, setIntegritySummary] = useState<FinancialIntegrityReport | null>(null);
  const [externalWealthSummary, setExternalWealthSummary] = useState<{
    items: ExternalWealthItem[];
    totalExternalAssetsMad: number;
    totalExternalLiabilitiesMad: number;
    netExternalWealthMad: number;
    staleCount: number;
  } | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  // Commitment settlement confirmation modal state
  const [settlingOccurrence, setSettlingOccurrence] = useState<CommitmentOccurrence | null>(null);
  const [occAction, setOccAction] = useState<'pay' | 'partial' | 'skip'>('pay');
  const [occAmount, setOccAmount] = useState('');
  const [occDate, setOccDate] = useState(new Date().toISOString().slice(0, 10));
  const [occWalletId, setOccWalletId] = useState('');
  const [occNotes, setOccNotes] = useState('');

  const openAccountsSection = (section: WalletsWorkbenchSection) => {
    window.dispatchEvent(new CustomEvent('truespend:openAccountsSection', { detail: section }));
  };

  const loadOperationalRadar = useCallback(async () => {
    if (!token) return;
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const twoWeeksIso = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      const [occList, revList, intRes, extWealth] = await Promise.all([
        dashboardService.getCommitmentOccurrences(token).catch(() => [] as CommitmentOccurrence[]),
        dashboardService.getReviewInbox(token).catch(() => [] as FinancialReviewItem[]),
        dashboardService.getFinancialIntegrityReport(token).catch(() => null),
        dashboardService.getExternalWealthItems(token).catch(() => null),
      ]);
      const planned = (Array.isArray(occList) ? occList : [])
        .filter(
          (o) =>
            (o.status === 'scheduled' || o.status === 'overdue' || o.status === 'partial') &&
            o.expectedDate >= todayIso &&
            o.expectedDate <= twoWeeksIso,
        )
        .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
      setUpcomingCommitments(planned);
      const pending = (Array.isArray(revList) ? revList : []).filter(
        (item) => item.status === 'Captured' || item.status === 'Needs Review',
      );
      setPendingReviews(pending);
      if (intRes) setIntegritySummary(intRes);
      if (extWealth) {
        const items = Array.isArray(extWealth.items) ? extWealth.items : [];
        const staleCount = items.filter((item) => item.isStaleEstimate).length;
        setExternalWealthSummary({
          items,
          totalExternalAssetsMad: Number(extWealth.totalExternalAssetsMad) || 0,
          totalExternalLiabilitiesMad: Number(extWealth.totalExternalLiabilitiesMad) || 0,
          netExternalWealthMad: Number(extWealth.netExternalWealthMad) || 0,
          staleCount,
        });
      }
    } catch {
      // Non-blocking operational radar load
    }
  }, [token]);

  useEffect(() => {
    loadOperationalRadar();
  }, [loadOperationalRadar, transactions.length]);

  const handleQuickApproveReview = async (item: FinancialReviewItem) => {
    if (!token) return;
    setBusyActionId(item.id);
    try {
      await dashboardService.decideReviewItem(
        item.id,
        {
          action: 'post_transaction',
          walletId: item.walletId || kpis?.accounts?.find((w) => w.isMain)?.id || kpis?.accounts?.[0]?.id,
          category: item.parsedCategory || undefined,
          description: item.parsedDescription || undefined,
          amount: Number(item.parsedAmount) || undefined,
        },
        token,
      );
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: 'Review item approved and posted to ledger', type: 'success' },
        }),
      );
      await Promise.all([loadOperationalRadar(), Promise.resolve(onDataChange?.())]);
    } catch (e: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: e.message || 'Failed to approve review item', type: 'error' },
        }),
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const openOccurrenceSettleModal = (occ: CommitmentOccurrence) => {
    const remaining = Math.max(0, Number(occ.expectedAmount || 0) - Number(occ.paidAmount || 0));
    setSettlingOccurrence(occ);
    setOccAction('pay');
    setOccAmount(remaining > 0 ? remaining.toFixed(2) : String(occ.expectedAmount || '0'));
    setOccDate(new Date().toISOString().slice(0, 10));
    setOccWalletId(kpis?.accounts?.find((w) => w.isMain)?.id || kpis?.accounts?.[0]?.id || '');
    setOccNotes('');
  };

  const handleConfirmSettleOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !settlingOccurrence) return;
    setBusyActionId(settlingOccurrence.id);
    try {
      const parsedAmount = Number(occAmount);
      await dashboardService.settleCommitmentOccurrence(
        settlingOccurrence.id,
        {
          action: occAction,
          ...(occAction !== 'skip' && Number.isFinite(parsedAmount) && parsedAmount > 0
            ? { actualAmount: parsedAmount }
            : {}),
          ...(occAction !== 'skip' && occDate ? { actualDate: occDate } : {}),
          ...(occAction !== 'skip' && occWalletId ? { walletId: occWalletId } : {}),
          ...(occNotes.trim() ? { notes: occNotes.trim(), reason: occNotes.trim() } : {}),
        },
        token,
      );
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: `${settlingOccurrence.title} updated and journaled`, type: 'success' },
        }),
      );
      setSettlingOccurrence(null);
      await Promise.all([loadOperationalRadar(), Promise.resolve(onDataChange?.())]);
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: err?.message || 'Failed to settle commitment', type: 'error' },
        }),
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const currentFm = getCurrentFinancialMonth(payrolls);
  const year = currentFm?.year ?? -1;
  const month = currentFm?.month ?? -1;

  const monthlyBudget = budgets
    .filter((budget) => budget.year === year && budget.month === month)
    .reduce((sum, budget) => sum + Number.parseFloat(budget.amount), 0);
  const monthlyActual = transactions
    .filter((transaction) => currentFm && transaction.type === 'Expense' && isInMonth(transaction, year, month, payrolls))
    .reduce((sum, transaction) => sum + netExpenseOf(transaction), 0);
  const pace = getSpendingPace(monthlyActual, monthlyBudget, year, month, payrolls);

  const activeReceivables = debts
    .filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending')
    .reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0);

  const activePayables = debts
    .filter((debt) => debt.type === 'Payable' && debt.status === 'Pending')
    .reduce((sum, debt) => sum + Number.parseFloat(debt.remainingBalance), 0);

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

  // Four-pillar cycle breakdown & top category breakdown
  const fourPillars = useMemo(
    () =>
      computeFourPillarBreakdown({
        transactions,
        budgets,
        year,
        month,
        payrolls,
        wallets: kpis?.accounts,
        isCurrentMonth: true,
      }),
    [transactions, budgets, year, month, payrolls, kpis?.accounts],
  );

  const topCategories = useMemo(() => {
    const merged = [...fourPillars.myselfCategories, ...fourPillars.obligationsCategories];
    return merged
      .filter((item) => item.spent > 0 || item.budgeted > 0)
      .sort((a, b) => b.spent - a.spent || b.budgeted - a.budgeted)
      .slice(0, 6);
  }, [fourPillars]);

  // Subscriptions metrics
  const activeSubs = useMemo(() => subscriptions.filter((s) => s.status === 'active'), [subscriptions]);
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

  const facts = useMemo(
    () => selectFacts(generateFacts(kpis, transactions, debts, budgets, payrolls, investmentsData)),
    [kpis, transactions, debts, budgets, payrolls, investmentsData],
  );

  const holisticForecast = useMemo(
    () =>
      computeHolisticForecast({
        kpis,
        transactions,
        payrolls,
        budgets,
        subscriptions,
        debts,
        goals,
        contexts: [],
        investmentsData,
      }),
    [kpis, transactions, payrolls, budgets, subscriptions, debts, goals, investmentsData],
  );

  // Behavioral Memory: Discipline Streak, 50/30/20 Macro Benchmark & Anomaly Radar
  const behavioralInsights = useMemo(() => {
    const allowance = kpis?.dailyAllowance && kpis.dailyAllowance > 0 ? kpis.dailyAllowance : 200;
    const now = new Date();
    const dailySpendMap = new Map<string, number>();

    transactions.forEach((tx) => {
      if (tx.type !== 'Expense') return;
      const dayKey = new Date(tx.createdAt).toISOString().slice(0, 10);
      dailySpendMap.set(dayKey, (dailySpendMap.get(dayKey) || 0) + netExpenseOf(tx));
    });

    let streakDays = 0;
    let daysUnderIn30d = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const spent = dailySpendMap.get(key) || 0;
      if (spent <= allowance) {
        daysUnderIn30d++;
        if (streakDays === i) streakDays++;
      }
    }

    const needsCats = new Set([
      '🏢 Housing & Utilities',
      '🛒 Groceries',
      '🚗 Transportation',
      '🩺 Health & Medical',
      '📱 Telecom & Subscriptions',
      '🛡️ Insurance / Annual Costs',
      '🏠 Household & Family',
    ]);
    const savingsAndDebtCats = new Set([
      '🛟 Emergency & goals Fund',
      '📈 Investments',
      '💳 Debt & Obligations',
    ]);

    let needsAmt = 0;
    let wantsAmt = 0;
    let savingsAmt = Math.max(0, (kpis?.monthlyIncome ?? 0) - (kpis?.monthlyExpenses ?? 0));

    const cycleTxs = transactions.filter((tx) => currentFm && isInMonth(tx, year, month, payrolls));
    cycleTxs.forEach((tx) => {
      if (tx.type === 'Expense') {
        const norm = normalizeCategory(tx.category);
        const amt = netExpenseOf(tx);
        if (savingsAndDebtCats.has(norm)) savingsAmt += amt;
        else if (needsCats.has(norm)) needsAmt += amt;
        else wantsAmt += amt;
      }
    });

    const totalMacroDenominator = Math.max(1, needsAmt + wantsAmt + savingsAmt);
    const needsPct = Math.round((needsAmt / totalMacroDenominator) * 100);
    const wantsPct = Math.round((wantsAmt / totalMacroDenominator) * 100);
    const savingsPct = Math.max(0, 100 - needsPct - wantsPct);

    const catStats = new Map<string, { sum: number; count: number }>();
    transactions.forEach((tx) => {
      if (tx.type !== 'Expense') return;
      const norm = normalizeCategory(tx.category) || 'Uncategorized';
      const amt = netExpenseOf(tx);
      if (amt <= 0) return;
      const cur = catStats.get(norm) || { sum: 0, count: 0 };
      cur.sum += amt;
      cur.count += 1;
      catStats.set(norm, cur);
    });

    const anomalies: {
      txId: string;
      title: string;
      category: string;
      amount: number;
      categoryAvg: number;
      multiplier: number;
      dateLabel: string;
    }[] = [];

    cycleTxs.forEach((tx) => {
      if (tx.type !== 'Expense') return;
      const norm = normalizeCategory(tx.category) || 'Uncategorized';
      const amt = netExpenseOf(tx);
      const stat = catStats.get(norm);
      if (stat && stat.count >= 2 && amt >= 150) {
        const avg = stat.sum / stat.count;
        if (avg > 0 && amt >= avg * 2.1) {
          anomalies.push({
            txId: tx.id,
            title: tx.notes || norm,
            category: norm,
            amount: amt,
            categoryAvg: avg,
            multiplier: Number((amt / avg).toFixed(1)),
            dateLabel: format(new Date(tx.createdAt), 'MMM d'),
          });
        }
      }
    });

    anomalies.sort((a, b) => b.amount - a.amount);

    return {
      streakDays,
      daysUnderIn30d,
      needsPct,
      wantsPct,
      savingsPct,
      anomalies: anomalies.slice(0, 3),
    };
  }, [kpis, transactions, currentFm, year, month, payrolls]);

  const cycleIncome = kpis?.monthlyIncome ?? fourPillars.periodIncome;
  const cycleTrueSpend = kpis?.adjustedTrueSpend ?? fourPillars.totalLivingSpent;
  const cycleSavingsRatePct =
    cycleIncome > 0
      ? Math.max(-99, Math.min(100, Math.round(((cycleIncome - cycleTrueSpend) / cycleIncome) * 100)))
      : 0;

  const healthColor = (score: number) =>
    score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-500';
  const healthBg = (score: number) =>
    score >= 75
      ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200/60 dark:border-emerald-900/50'
      : score >= 50
      ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200/60 dark:border-amber-900/50'
      : 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/60 dark:border-rose-900/50';
  const healthLabel = (score: number) =>
    score >= 85
      ? 'Excellent'
      : score >= 70
      ? 'Good'
      : score >= 50
      ? 'Fair'
      : score >= 30
      ? 'Needs Attention'
      : 'Critical';

  const maskMoney = (amount: number, decimals = 0, suffix = ' MAD') =>
    isPrivacyMode ? `••••${suffix ? suffix : ''}` : `${amount.toFixed(decimals)}${suffix}`;

  return (
    <div className="min-w-0 overflow-x-hidden space-y-4 sm:space-y-5">
      {!currentFm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            Your financial period is not set yet. Configure current and next payroll dates in Financial Calendar so budgets and forecasts align with your payday.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setActiveTab('calendar')}>
            Open Calendar
          </Button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 1 — ASYMMETRIC HERO COCKPIT
          Left (5 cols): Full Detailed Safe to Spend Hero Card (PRESERVED!)
          Right (7 cols): Daily Allowance + Adjusted True Spend + Daily Burn Chart
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 items-stretch">
        {/* LEFT: Preserved Full Safe to Spend Card */}
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

                  {externalWealthSummary && externalWealthSummary.items.length > 0 && (
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

        {/* RIGHT: Telemetry Pair + Daily Living Burn / Cumulative Flow Chart (Zero Empty Space!) */}
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
                    <span className="font-mono tabular-nums font-bold">{behavioralInsights.streakDays}d</span> streak
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    {behavioralInsights.daysUnderIn30d}/30d under cap
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

          {/* Interactive Daily Living Burn vs Cap Chart filling exact remaining height */}
          <div className="flex-1 min-h-0">
            <CycleDailyBurnChart
              transactions={transactions}
              currentFm={currentFm}
              dailyAllowance={kpis?.dailyAllowance ?? 0}
              safeToSpend={kpis?.safeToSpend ?? 0}
              daysUntilPayday={kpis?.daysUntilPayday ?? 0}
              wallets={kpis?.accounts}
              isPrivacyMode={isPrivacyMode}
            />
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 2 — CATEGORY PRESSURE, FORECAST SCENARIOS & FINANCIAL HEALTH
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Top Spending Categories vs Budget */}
        <Card className="min-w-0 lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Category Burn &amp; Pace</span>
            </CardTitle>
            <button
              type="button"
              onClick={() => setActiveTab('budgets')}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Budgets →
            </button>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            {topCategories.length > 0 ? (
              <div className="space-y-2.5">
                {topCategories.map((cat) => {
                  const pct =
                    cat.budgeted > 0
                      ? Math.min(100, (cat.spent / cat.budgeted) * 100)
                      : cat.spent > 0
                      ? 100
                      : 0;
                  const over = cat.budgeted > 0 && cat.spent > cat.budgeted;
                  const near = cat.budgeted > 0 && cat.spent >= cat.budgeted * 0.8 && !over;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                          {cat.category}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] shrink-0">
                          <span
                            className={`font-semibold ${
                              over
                                ? 'text-rose-600 dark:text-rose-400'
                                : near
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {isPrivacyMode ? '••••' : cat.spent.toFixed(0)}
                          </span>
                          {cat.budgeted > 0 ? (
                            <span className="text-gray-400">
                              {' '}
                              / {isPrivacyMode ? '••••' : cat.budgeted.toFixed(0)}
                            </span>
                          ) : (
                            <span className="text-gray-400"> MAD</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            over
                              ? 'bg-rose-500'
                              : near
                              ? 'bg-amber-500'
                              : cat.budgeted > 0
                              ? 'bg-indigo-500'
                              : 'bg-gray-400 dark:bg-gray-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                No category expenses recorded yet in this cycle.
              </div>
            )}

            {/* Spending Pace Footer Summary */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
              {monthlyBudget > 0 ? (
                <>
                  <span className="text-gray-500 dark:text-gray-400">Budget Pace</span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      pace.difference > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {isPrivacyMode ? '••••' : `${Math.abs(pace.difference).toFixed(0)} MAD`}{' '}
                    {pace.difference > 0 ? 'ahead' : 'under pace'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-gray-500 dark:text-gray-400">No monthly budgets configured</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('budgets')}
                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
                  >
                    Set Limits →
                  </button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* End-of-Period Forecast */}
        <Card className="min-w-0 lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>End-of-Period Forecast</span>
            </CardTitle>
            <button
              type="button"
              onClick={() => setInsightModalType('forecast')}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 cursor-pointer"
              title="Click for clarification and calculation formula"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Formula</span>
            </button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {kpis?.forecast && kpis.forecast.totalDays > 0 ? (
              <div className="space-y-3.5">
                <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    Expected Closing Balance
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
                      kpis.forecast.expected >= 0
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {maskMoney(kpis.forecast.expected, 2)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    At {isPrivacyMode ? '••••' : `${kpis.avgDailySpend.toFixed(1)} MAD/day`} variable avg
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
                  <div className="rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5">
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Best (-30%)
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {isPrivacyMode ? '••••' : kpis.forecast.best.toFixed(0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-2.5">
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Expected
                    </p>
                    <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                      {isPrivacyMode ? '••••' : kpis.forecast.expected.toFixed(0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-2.5">
                    <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Stress (+50%)
                    </p>
                    <p className="mt-1 text-sm font-bold text-rose-700 dark:text-rose-300">
                      {isPrivacyMode ? '••••' : kpis.forecast.worst.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    <span>
                      Day {kpis.forecast.elapsedDays} of {kpis.forecast.totalDays}
                    </span>
                    <span>{kpis.forecast.daysRemaining}d left</span>
                  </div>
                  <AnimatedProgressBar
                    trackClassName="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                    percent={
                      kpis.forecast.totalDays > 0
                        ? (kpis.forecast.elapsedDays / kpis.forecast.totalDays) * 100
                        : 0
                    }
                    barClassName="bg-gradient-to-r from-blue-500 to-indigo-500"
                  />
                  {kpis.forecast.spendingPacePercent > 0 && (
                    <p
                      className={`text-xs font-medium ${
                        kpis.forecast.spendingPacePercent > 110
                          ? 'text-rose-600 dark:text-rose-400'
                          : kpis.forecast.spendingPacePercent > 100
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {kpis.forecast.spendingPacePercent > 100
                        ? `${(kpis.forecast.spendingPacePercent - 100).toFixed(1)}% ahead of budget pace`
                        : `${(100 - kpis.forecast.spendingPacePercent).toFixed(1)}% under budget pace`}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                Set up payroll cycle dates to generate your period forecast.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Financial Health Score */}
        <Card className="min-w-0 lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Heart className="h-4 w-4 text-rose-500" />
              <span>Financial Health Score</span>
            </CardTitle>
            <button
              type="button"
              onClick={() => setInsightModalType('health')}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
              title="Click for clarification and scoring methodology"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Scoring</span>
            </button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {kpis ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-4 rounded-xl border p-3 ${healthBg(kpis.healthScore)}`}>
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-gray-200 dark:text-gray-800"
                      />
                      <motion.circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke="currentColor"
                        className={healthColor(kpis.healthScore)}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: Math.max(0, Math.min(1, kpis.healthScore / 100)) }}
                        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </svg>
                    <AnimatedMetricValue
                      value={kpis.healthScore}
                      decimals={0}
                      className={`absolute text-lg font-bold font-mono tabular-nums ${healthColor(kpis.healthScore)}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-base font-bold ${healthColor(kpis.healthScore)}`}>
                      {healthLabel(kpis.healthScore)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Weighted 6-pillar diagnostic (0–100)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {kpis.healthFactors?.map((factor, idx) => (
                    <div key={factor.name} className="min-w-0">
                      <div className="flex justify-between text-[11px] gap-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                          {factor.name}
                        </span>
                        <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                          {factor.score}/{factor.maxPoints}
                        </span>
                      </div>
                      <AnimatedProgressBar
                        className="mt-1"
                        delay={idx * 0.04}
                        trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                        percent={factor.maxPoints > 0 ? (factor.score / factor.maxPoints) * 100 : 0}
                        barClassName={
                          factor.score / factor.maxPoints >= 0.7
                            ? 'bg-emerald-500'
                            : factor.score / factor.maxPoints >= 0.4
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-gray-500">Loading diagnostic...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 3 — WEALTH STRUCTURE & MULTI-CYCLE TRAJECTORY
          Left (5 cols): 4-Pillar Flow + 50/30/20 + Asset Allocation Donut
          Right (7 cols): Multi-Cycle Cashflow Chart + 90d/12m Predictive Signals
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
        {/* Wealth Structure & 4 Pillars */}
        <Card className="min-w-0 lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              {wealthTab === 'pillars' ? (
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              ) : (
                <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              )}
              <span>{wealthTab === 'pillars' ? '4-Pillar Cashflow Split' : 'Gross Asset Mix'}</span>
            </CardTitle>

            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 p-0.5">
              <button
                type="button"
                onClick={() => setWealthTab('pillars')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  wealthTab === 'pillars'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                4-Pillar
              </button>
              <button
                type="button"
                onClick={() => setWealthTab('allocation')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  wealthTab === 'allocation'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Asset Mix
              </button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col justify-between space-y-4">
            {wealthTab === 'pillars' ? (
              <div className="space-y-3">
                {[
                  {
                    label: 'Obligations & Essentials',
                    amt: fourPillars.spentOnObligations,
                    pct: fourPillars.obligationsPctOfIncome,
                    bar: 'bg-indigo-500',
                    text: 'text-indigo-600 dark:text-indigo-400',
                  },
                  {
                    label: 'Spent on Myself (Lifestyle)',
                    amt: fourPillars.spentOnMyself,
                    pct: fourPillars.myselfPctOfIncome,
                    bar: 'bg-amber-500',
                    text: 'text-amber-600 dark:text-amber-400',
                  },
                  {
                    label: 'Invested Capital',
                    amt: fourPillars.investedAmount,
                    pct: fourPillars.investedPctOfIncome,
                    bar: 'bg-sky-500',
                    text: 'text-sky-600 dark:text-sky-400',
                  },
                  {
                    label: 'Saved & Retained in Bank',
                    amt: fourPillars.totalActualRetainedAndSaved,
                    pct: fourPillars.savedPctOfIncome,
                    bar: 'bg-emerald-500',
                    text: 'text-emerald-600 dark:text-emerald-400',
                  },
                ].map((pillar) => (
                  <div key={pillar.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {pillar.label}
                      </span>
                      <span className="font-mono tabular-nums">
                        <span className={`font-semibold ${pillar.text}`}>
                          {isPrivacyMode ? '••••' : `${pillar.amt.toFixed(0)} MAD`}
                        </span>
                        <span className="text-gray-400 ml-1.5">({pillar.pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full ${pillar.bar}`}
                        style={{ width: `${Math.min(100, Math.max(0, pillar.pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2">
                <WealthAllocationChart
                  kpis={kpis}
                  stockPortfolioMad={stockPortfolioMad}
                  activeReceivables={activeReceivables}
                  externalAssetsMad={externalWealthSummary?.totalExternalAssetsMad ?? 0}
                  isPrivacyMode={isPrivacyMode}
                />
              </div>
            )}

            {/* 50 / 30 / 20 Macro Target Strip */}
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-indigo-500" />
                  50 / 30 / 20 Macro Benchmark
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('budgets')}
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer"
                >
                  Adjust →
                </button>
              </div>
              <div className="flex justify-between text-xs font-mono tabular-nums font-semibold text-gray-900 dark:text-white">
                <span>Needs {behavioralInsights.needsPct}%</span>
                <span>Wants {behavioralInsights.wantsPct}%</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Save {behavioralInsights.savingsPct}%
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div className="bg-indigo-500" style={{ width: `${behavioralInsights.needsPct}%` }} />
                <div className="bg-amber-500" style={{ width: `${behavioralInsights.wantsPct}%` }} />
                <div className="bg-emerald-500" style={{ width: `${behavioralInsights.savingsPct}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Cycle Cashflow History + Cross-Domain Predictive Trajectory */}
        <Card className="min-w-0 lg:col-span-7 flex flex-col justify-between">
          <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
            <MultiCycleCashflowChart
              transactions={transactions}
              budgets={budgets}
              payrolls={payrolls}
              wallets={kpis?.accounts}
              isPrivacyMode={isPrivacyMode}
            />

            {/* Predictive Horizon Telemetry Strip */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Predictive Net Worth &amp; Cash Horizon
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('forecast')}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Predictive Hub</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">90d Net Worth</p>
                  <p className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                    {maskMoney(holisticForecast.projectedNetWorth90d, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">12m Net Worth</p>
                  <p className="text-sm font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {maskMoney(holisticForecast.projectedNetWorth12m, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">30d Lowest Cash</p>
                  <p
                    className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                      holisticForecast.hasLiquidityPinchBeforePayday
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {maskMoney(holisticForecast.lowest30dBalance, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 p-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">At-Risk Budgets</p>
                  <p className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                    {
                      holisticForecast.categoryPredictions.filter(
                        (c) => c.status === 'breached' || c.status === 'breach_imminent',
                      ).length
                    }{' '}
                    / {holisticForecast.categoryPredictions.length}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 4 — LIVE OPERATIONS, REVIEW INBOX & INTEGRITY/ANOMALY RADAR
          ═════════════════════════════════════════════════════════════════════ */}
      <StaggerList className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Upcoming 14-Day Commitment Occurrences */}
        <StaggerItem className="min-w-0">
          <Card className="min-w-0 h-full border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  <span>14-Day Commitments Radar</span>
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Calendar ({upcomingCommitments.length}) →
                </button>
              </div>

              {upcomingCommitments.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {upcomingCommitments.slice(0, 3).map((occ) => (
                    <div
                      key={occ.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {occ.title}
                        </p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          Due {occ.expectedDate} ·{' '}
                          {isPrivacyMode
                            ? '••••'
                            : `${parseFloat(String(occ.expectedAmount)).toFixed(0)} MAD`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyActionId === occ.id}
                        onClick={() => openOccurrenceSettleModal(occ)}
                        className="h-7 px-2.5 text-[11px] whitespace-nowrap shrink-0"
                      >
                        {busyActionId === occ.id ? '...' : 'Settle'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    All Near-Term Bills Clear
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    No unsettled recurring bills or installments due in the next 14 days.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 2. Financial Review Inbox Queue */}
        <StaggerItem className="min-w-0">
          <Card className="min-w-0 h-full border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Inbox className="h-4 w-4 text-emerald-500" />
                  <span>Financial Review Inbox</span>
                </p>
                <button
                  type="button"
                  onClick={() => openAccountsSection('review_inbox')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Inbox ({pendingReviews.length}) →
                </button>
              </div>

              {pendingReviews.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {pendingReviews.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">
                          {item.parsedDescription || item.parsedCategory || 'Review Item'}
                        </p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          {item.parsedAmount
                            ? `${isPrivacyMode ? '••••' : parseFloat(String(item.parsedAmount)).toFixed(0)} ${
                                item.parsedCurrency || 'MAD'
                              } · `
                            : ''}
                          {item.parsedDate} · {item.sourceType.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyActionId === item.id}
                        onClick={() => handleQuickApproveReview(item)}
                        className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0"
                      >
                        {busyActionId === item.id ? '...' : 'Confirm'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Inbox Zero Achieved
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    All OCR receipts, statement imports, and rule drafts are reconciled.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* 3. Spending Anomaly Radar & Double-Entry Integrity */}
        <StaggerItem className="min-w-0">
          <Card className="min-w-0 h-full border-gray-200 dark:border-gray-800">
            <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span>Anomaly Radar</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Analytics →
                  </button>
                </div>

                {behavioralInsights.anomalies.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {behavioralInsights.anomalies.slice(0, 2).map((anom) => (
                      <button
                        key={anom.txId}
                        type="button"
                        onClick={() => openTransaction(anom.txId)}
                        className="w-full flex items-center justify-between gap-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 px-2.5 py-1.5 text-left text-xs hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-white">
                            {anom.title}
                          </p>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-mono tabular-nums">
                            {anom.dateLabel} · {anom.multiplier}× avg ({isPrivacyMode ? '••••' : anom.categoryAvg.toFixed(0)} MAD)
                          </p>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-amber-700 dark:text-amber-300 shrink-0">
                          {isPrivacyMode ? '••••' : `${anom.amount.toFixed(0)} MAD`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    No outlier spikes (&gt;2.1× category average) detected this cycle.
                  </p>
                )}
              </div>

              {/* Trial Balance Footer */}
              <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCheck2 className="h-4 w-4 text-teal-500 shrink-0" />
                  <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                    {integritySummary?.healthy !== false
                      ? 'Trial Balance Verified'
                      : 'Reconciliation Needed'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openAccountsSection('journal_audit')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Journal ({integritySummary ? integritySummary.journalEntryCount : transactions.length}) →
                </button>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerList>

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 5 — ACTIVITY STREAM + RECEIVABLES / RECURRING / BINANCE
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-12 items-stretch">
        {/* Recent Transactions */}
        <Card className="min-w-0 lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm sm:text-base">Recent Transactions</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab('transactions')}>
              View all →
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 flex-1">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {transactions.slice(0, 6).map((transaction) => {
                const gross = Number.parseFloat(transaction.amount) || 0;
                const reimb = reimbursedAmountOf(transaction);
                const netAmt = netExpenseOf(transaction);
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => openTransaction(transaction.id)}
                    className="flex w-full min-w-0 items-center justify-between gap-2.5 py-2.5 text-left first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg px-1.5 -mx-1.5 transition-colors cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          transaction.type === 'Income'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : transaction.type === 'Transfer'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {transaction.type === 'Income' ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : transaction.type === 'Transfer' ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {transaction.notes || transaction.category || transaction.type}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(transaction.createdAt), 'MMM d')} ·{' '}
                          {kpis?.accounts?.find((w) => w.id === transaction.walletId)?.name || 'Wallet'}
                          {transaction.type === 'Transfer' && transaction.destinationWalletId && (
                            <> → {kpis?.accounts?.find((w) => w.id === transaction.destinationWalletId)?.name || 'Wallet'}</>
                          )}
                          {reimb > 0 && (
                            <span className="ml-1.5 text-teal-600 dark:text-teal-400 font-mono">
                              (Net {isPrivacyMode ? '••••' : netAmt.toFixed(0)})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 whitespace-nowrap text-sm font-semibold font-mono tabular-nums ${
                        transaction.type === 'Income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {transaction.type === 'Expense' ? '−' : transaction.type === 'Income' ? '+' : ''}
                      {isPrivacyMode ? '••••' : `${gross.toFixed(2)} MAD`}
                    </span>
                  </button>
                );
              })}
              {transactions.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No transactions yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Stack: Pending Receivables + Recurring Subscriptions + Investments */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Pending Receivables */}
          <Card className="min-w-0">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <WalletCards className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>Pending Receivables</span>
              </CardTitle>
              <button
                type="button"
                onClick={() => setActiveTab('debts')}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Debts &amp; Splits →
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  <AnimatedMetricValue
                    value={activeReceivables}
                    masked={isPrivacyMode}
                    maskText="******"
                    suffix=" MAD"
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Owed to you
                </span>
              </div>
              <div className="space-y-2">
                {debts
                  .filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending')
                  .slice(0, 2)
                  .map((debt) => (
                    <div
                      key={debt.id}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                          {debt.contactName}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                          Bal: {maskMoney(Number.parseFloat(debt.remainingBalance), 2)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs shrink-0"
                        onClick={() => setSettlingDebt(debt)}
                      >
                        Settle
                      </Button>
                    </div>
                  ))}
                {activeReceivables === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No pending receivables owed to you.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recurring Subscriptions + Investments Pulse */}
          <Card className="min-w-0 flex-1 flex flex-col justify-between">
            <CardContent className="p-4 space-y-3.5">
              {/* Subscriptions */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-indigo-500" />
                    Monthly Recurring Burn
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                    {maskMoney(monthlySubBurn, 0)}
                    <span className="text-xs font-normal text-gray-400">
                      {' '}/mo ({activeSubs.length} active)
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('subscriptions')}
                  className="text-xs shrink-0"
                >
                  Prune &amp; Manage →
                </Button>
              </div>

              {activeSubs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeSubs.slice(0, 4).map((sub) => (
                    <span
                      key={sub.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300"
                    >
                      <span>{sub.icon || '📱'}</span>
                      <span className="truncate max-w-[85px] font-medium">{sub.name}</span>
                      <span className="font-mono tabular-nums text-gray-400">
                        {isPrivacyMode ? '••' : parseFloat(sub.amount).toFixed(0)}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Binance Spot & Investments Snapshot */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Investments &amp; Binance Spot
                  </p>
                  <p className="text-base font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                    {isPrivacyMode
                      ? '•••••• MAD'
                      : `${(
                          stockPortfolioMad +
                          (investmentsData?.buyingPower?.investmentWalletBalanceMad ?? 0)
                        ).toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD`}
                    {investmentsData && investmentsData.totalUnrealizedPnlMad !== 0 && !isPrivacyMode && (
                      <span
                        className={`ml-2 text-xs ${
                          investmentsData.totalUnrealizedPnlMad >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        ({investmentsData.totalUnrealizedPnlMad >= 0 ? '+' : ''}
                        {investmentsData.totalUnrealizedPnlPercent.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActiveTab('investments')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                >
                  Portfolio →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          BAND 6 — SAVINGS GOALS & FINANCIAL FACTS CAROUSEL
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-12 items-stretch">
        {/* Savings Goals */}
        <Card className="min-w-0 lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Target className="h-4 w-4 text-indigo-500" />
              <span>Savings Goals</span>
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-indigo-600 dark:text-indigo-400"
              onClick={() => setActiveTab('goals')}
            >
              Manage ({goals.length}) →
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  No savings goals yet
                </p>
                <p className="max-w-xs text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                  Track emergency buffers, trips, or planned purchases.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActiveTab('goals')}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Goal
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {goals.slice(0, 3).map((g) => {
                  const target = parseFloat(g.targetAmount) || 0;
                  const current = parseFloat(g.currentAmount) || 0;
                  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
                  const isCompleted = current >= target && target > 0;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setActiveTab('goals')}
                      className="cursor-pointer rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 p-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-gray-900 dark:text-white truncate">
                          {g.name}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-bold ${
                            isCompleted ? 'text-emerald-500' : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                      <AnimatedProgressBar
                        className="mt-1.5"
                        trackClassName="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                        percent={progress}
                        barClassName={isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}
                      />
                      <div className="mt-1 flex justify-between text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                        <span>{isPrivacyMode ? '••••' : `${current.toLocaleString()} MAD`}</span>
                        <span>{isPrivacyMode ? '••••' : `${target.toLocaleString()} MAD`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Facts Carousel */}
        <Card className="min-w-0 lg:col-span-7 overflow-hidden flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm sm:text-base">Financial Facts &amp; Signals</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab('analytics')}>
              Full Analytics →
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden pb-4 flex-1 flex items-center">
            {facts.length > 0 ? (
              <FinancialFactsCarousel facts={facts} />
            ) : (
              <p className="w-full py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Add transactions to unlock personalized financial facts.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <SettleDebtModal
        debt={settlingDebt}
        wallets={kpis?.accounts}
        onClose={() => setSettlingDebt(null)}
        onConfirm={async (debtId, amount, category, walletId) => {
          await handleSettle(debtId, amount, category, walletId);
        }}
      />

      <MotionModal
        isOpen={Boolean(settlingOccurrence)}
        onClose={() => setSettlingOccurrence(null)}
        zIndexClass="z-[85]"
        containerClassName="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-2xl"
      >
        {settlingOccurrence && (
          <form onSubmit={handleConfirmSettleOccurrence} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Settle Commitment
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {settlingOccurrence.title} · Expected{' '}
                  {Number(settlingOccurrence.expectedAmount || 0).toFixed(2)}{' '}
                  {settlingOccurrence.currency || 'MAD'} on {settlingOccurrence.expectedDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettlingOccurrence(null)}
                aria-label="Close settle commitment"
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['pay', 'partial', 'skip'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOccAction(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    occAction === mode
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {mode === 'pay' ? 'Full Settle' : mode === 'partial' ? 'Partial' : 'Skip'}
                </button>
              ))}
            </div>

            {occAction !== 'skip' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Actual Amount ({settlingOccurrence.currency || 'MAD'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={occAmount}
                      onChange={(e) => setOccAmount(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-mono tabular-nums text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Settlement Date
                    </label>
                    <input
                      type="date"
                      required
                      value={occDate}
                      onChange={(e) => setOccDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Posting Wallet / Account
                  </label>
                  <select
                    value={occWalletId}
                    onChange={(e) => setOccWalletId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
                  >
                    {(kpis?.accounts || []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.balance.toFixed(2)} {w.currency || 'MAD'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {occAction === 'skip'
                  ? 'Skip Reason (Optional)'
                  : 'Notes / Variance Reason (Optional)'}
              </label>
              <input
                type="text"
                value={occNotes}
                onChange={(e) => setOccNotes(e.target.value)}
                placeholder={
                  occAction === 'skip' ? 'e.g. Waived this month' : 'e.g. Paid via CIH transfer'
                }
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSettlingOccurrence(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busyActionId === settlingOccurrence.id}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {busyActionId === settlingOccurrence.id
                  ? 'Posting...'
                  : occAction === 'skip'
                  ? 'Confirm Skip'
                  : 'Confirm & Post'}
              </Button>
            </div>
          </form>
        )}
      </MotionModal>

      <FinancialInsightModal
        type={insightModalType || 'forecast'}
        isOpen={Boolean(insightModalType)}
        onClose={() => setInsightModalType(null)}
        kpis={kpis}
      />
    </div>
  );
};
