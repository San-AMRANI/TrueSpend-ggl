import type {
  CategoryBudget,
  Debt,
  KPI,
  Payroll,
  Transaction,
  Goal,
  Subscription,
  FinancialContext,
  InvestmentsData,
  CommitmentOccurrence,
  FinancialReviewItem,
  FinancialIntegrityReport,
  ExternalWealthItem,
  User,
} from '../types/index.js';
import {
  financialPeriodLabel,
  getCurrentFinancialMonth,
  getPreviousFinancialMonth,
} from './financialMonth.js';
import { computeHolisticForecast } from './predictiveEngine.js';
import { generateFinancialPeriodsLedger } from './cashFlowEngine.js';
import { netExpenseOf, isReimbursementIncome } from './finance.js';

export type AiDataFocusScope =
  | 'all'
  | 'investments'
  | 'transactions'
  | 'wallets'
  | 'budgets'
  | 'debts_goals'
  | 'assets_radar'
  | 'forecast';

export type AiResponseDepth = 'deep_creative' | 'balanced' | 'concise';

export interface AiOperationalRadarSnapshot {
  upcomingCommitments?: CommitmentOccurrence[];
  pendingReviews?: FinancialReviewItem[];
  integritySummary?: FinancialIntegrityReport | null;
  externalWealthSummary?: {
    items: ExternalWealthItem[];
    totalExternalAssetsMad: number;
    totalExternalLiabilitiesMad: number;
    netExternalWealthMad: number;
    staleCount: number;
  } | null;
}

const amountOf = (value: string | number | null | undefined) =>
  Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0;

const dateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
};

const daysUntilDate = (value: string | Date | null | undefined): number | null => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtc - todayUtc) / 86_400_000);
};

const normalizedMonthlySubCost = (amount: number, cycle?: string | null): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const raw = (cycle || 'monthly').trim().toLowerCase();
  if (raw === 'weekly') return amountOf((amount * 52) / 12);
  if (raw === 'biweekly') return amountOf((amount * 26) / 12);
  if (raw === 'yearly') return amountOf(amount / 12);
  if (raw === 'quarterly' || raw === 'every_3_months') return amountOf(amount / 3);
  if (raw === 'every_2_months') return amountOf(amount / 2);
  if (raw === 'every_6_months') return amountOf(amount / 6);
  if (raw === 'every_10_months') return amountOf(amount / 10);
  const customMonths = raw.match(/^every_(\d+)_months?$/);
  if (customMonths) return amountOf(amount / Math.max(1, parseInt(customMonths[1], 10)));
  const customDays = raw.match(/^every_(\d+)_days?$/);
  if (customDays) return amountOf((amount * 30.4375) / Math.max(1, parseInt(customDays[1], 10)));
  return amountOf(amount);
};

export function buildAiContextSnapshot({
  kpis,
  transactions,
  debts,
  budgets,
  payrolls,
  goals = [],
  subscriptions = [],
  contexts = [],
  investmentsData = null,
  operationalRadar = null,
  userSettings = null,
  userProfile = null,
  focusScopes = ['all'],
  responseDepth = 'deep_creative',
}: {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  budgets: CategoryBudget[];
  payrolls: Payroll[];
  goals?: Goal[];
  subscriptions?: Subscription[];
  contexts?: FinancialContext[];
  investmentsData?: InvestmentsData | null;
  operationalRadar?: AiOperationalRadarSnapshot | null;
  userSettings?: Record<string, any> | null;
  userProfile?: Partial<User> | null;
  focusScopes?: AiDataFocusScope[];
  responseDepth?: AiResponseDepth;
}) {
  const activeScopes: AiDataFocusScope[] =
    !focusScopes || focusScopes.length === 0 ? ['all'] : focusScopes;
  const isAll = activeScopes.includes('all');
  const hasScope = (s: AiDataFocusScope) => isAll || activeScopes.includes(s);

  const current = getCurrentFinancialMonth(payrolls);
  const previous = current ? getPreviousFinancialMonth(payrolls, current) : null;
  const inPeriod = (transaction: Transaction, period = current) =>
    Boolean(
      period &&
        new Date(transaction.createdAt) >= period.start &&
        new Date(transaction.createdAt) <= period.end
    );

  const periodTransactions = transactions.filter((transaction) => inPeriod(transaction));
  const previousTransactions = transactions.filter((transaction) =>
    inPeriod(transaction, previous)
  );
  const income = periodTransactions
    .filter((transaction) => transaction.type === 'Income' && !isReimbursementIncome(transaction))
    .reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);
  const expenses = periodTransactions
    .filter(
      (transaction) =>
        transaction.type === 'Expense' || transaction.type === 'Debt Repayment'
    )
    .reduce(
      (sum, transaction) =>
        sum + (transaction.type === 'Expense' ? netExpenseOf(transaction) : amountOf(transaction.amount)),
      0
    );

  const forecast = computeHolisticForecast({
    kpis,
    transactions,
    payrolls,
    budgets,
    subscriptions,
    debts,
    goals,
    investmentsData,
    contexts,
  });

  // Aggregate category-by-category NET spending (after deducting linked reimbursements) across active period and all-time
  const periodCategoryTotals: Record<string, { spentMad: number; count: number }> = {};
  for (const tx of periodTransactions) {
    if (tx.type === 'Expense') {
      const cat = tx.category || 'Uncategorized';
      if (!periodCategoryTotals[cat]) {
        periodCategoryTotals[cat] = { spentMad: 0, count: 0 };
      }
      periodCategoryTotals[cat].spentMad = amountOf(
        periodCategoryTotals[cat].spentMad + netExpenseOf(tx)
      );
      periodCategoryTotals[cat].count += 1;
    }
  }

  const allTimeCategoryTotals: Record<string, { spentMad: number; count: number }> = {};
  const merchantSpendMap = new Map<
    string,
    { label: string; category: string; netSpentMad: number; count: number; lastDate: string }
  >();
  for (const tx of transactions) {
    if (tx.type === 'Expense') {
      const cat = tx.category || 'Uncategorized';
      const net = netExpenseOf(tx);
      if (!allTimeCategoryTotals[cat]) {
        allTimeCategoryTotals[cat] = { spentMad: 0, count: 0 };
      }
      allTimeCategoryTotals[cat].spentMad = amountOf(allTimeCategoryTotals[cat].spentMad + net);
      allTimeCategoryTotals[cat].count += 1;

      const rawLabel = (tx.notes || '').trim();
      if (rawLabel) {
        const key = rawLabel.toLowerCase().slice(0, 48);
        const existing = merchantSpendMap.get(key);
        const txDate = dateKey(tx.createdAt);
        if (existing) {
          existing.netSpentMad = amountOf(existing.netSpentMad + net);
          existing.count += 1;
          if (txDate > existing.lastDate) existing.lastDate = txDate;
        } else {
          merchantSpendMap.set(key, {
            label: rawLabel.slice(0, 60),
            category: cat,
            netSpentMad: amountOf(net),
            count: 1,
            lastDate: txDate,
          });
        }
      }
    }
  }

  const topMerchantsByNetSpend = Array.from(merchantSpendMap.values())
    .sort((a, b) => b.netSpentMad - a.netSpentMad)
    .slice(0, 20);

  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  // Determine how many transactions to include based on focus
  const txLimit = hasScope('transactions') ? 160 : 60;

  const binance = investmentsData?.binance;
  const reconciliation = investmentsData?.capitalReconciliation;
  const usdToMad = investmentsData?.rates?.USD_TO_MAD || 9.95;

  const walletNameMap = new Map<string, string>();
  (kpis?.accounts || []).forEach((w) => walletNameMap.set(w.id, w.name));

  const externalWealthSummary = operationalRadar?.externalWealthSummary || null;
  const externalAssetsMad = amountOf(externalWealthSummary?.totalExternalAssetsMad);
  const externalLiabilitiesMad = amountOf(externalWealthSummary?.totalExternalLiabilitiesMad);
  const netExternalWealthMad = amountOf(externalWealthSummary?.netExternalWealthMad);

  const creditCardLiabilitiesMad = amountOf(
    (kpis?.accounts || []).reduce((sum, w) => {
      const subtype = (w as any).accountSubtype;
      if (subtype === 'CreditCard' || subtype === 'Overdraft') {
        return sum + Math.max(0, amountOf((w as any).liabilityBalance));
      }
      return sum;
    }, 0)
  );

  const resolvedUserProfile = {
    name: userProfile?.displayName || userProfile?.username || userSettings?.displayName || null,
    employmentType:
      userSettings?.employmentType || userProfile?.employmentType || 'salaried',
    financialCycleMode:
      userSettings?.financialCycleMode ||
      userProfile?.financialCycleMode ||
      (payrolls.length >= 2 ? 'payday' : 'calendar'),
    paydayDayOfMonth: userSettings?.payday ?? userProfile?.payday ?? null,
    configuredMonthlySalaryMad: amountOf(
      userSettings?.salary ?? userProfile?.salary ?? kpis?.salary ?? 0
    ),
    baseCurrency: userSettings?.baseCurrency || userProfile?.baseCurrency || 'MAD',
    emergencyBufferTargetMad: amountOf(
      userSettings?.emergencyBuffer ??
        userProfile?.emergencyBuffer ??
        kpis?.emergencyBuffer ??
        0
    ),
    experienceTier: userSettings?.experienceTier || userProfile?.experienceTier || 'basic',
  };

  return {
    asOf: dateKey(new Date()),
    currency: resolvedUserProfile.baseCurrency || 'MAD',
    activeFocusScopes: activeScopes,
    requestedResponseDepth: responseDepth,
    userProfile: resolvedUserProfile,
    financialPeriod: current
      ? {
          label: financialPeriodLabel(current),
          start: dateKey(current.start),
          end: dateKey(current.end),
          startsWithPayroll: amountOf(current.startPayroll.amount),
          closesWithPayroll: dateKey(current.endPayroll.scheduledFor),
        }
      : {
          configured: false,
          message:
            'No complete financial period is configured. Add consecutive payroll dates in Financial Calendar.',
        },
    // Core KPIs & Wallets are always included for grounding, with full credit card / subtype / reconciliation metadata
    wallets: kpis
      ? kpis.accounts.map((w) => {
          const creditLimit = amountOf((w as any).creditLimit);
          const liabilityBalance = amountOf((w as any).liabilityBalance);
          const creditUtilizationPct =
            creditLimit > 0 ? amountOf((liabilityBalance / creditLimit) * 100) : null;
          return {
            id: w.id,
            name: w.name,
            type: w.type,
            accountSubtype: (w as any).accountSubtype || null,
            institutionName: (w as any).institutionName || null,
            currency: (w as any).currency || 'MAD',
            isMain: Boolean((w as any).isMain),
            balanceMad: amountOf(w.balance),
            initialBalanceMad: amountOf((w as any).initialBalance),
            ...(creditLimit > 0 || liabilityBalance > 0
              ? {
                  creditLimitMad: creditLimit,
                  liabilityBalanceMad: liabilityBalance,
                  creditUtilizationPct,
                  statementClosingDay: (w as any).statementClosingDay ?? null,
                  paymentDueDay: (w as any).paymentDueDay ?? null,
                  minimumPaymentMad: amountOf((w as any).minimumPayment),
                }
              : {}),
            valuationStatus: (w as any).valuationStatus || 'verified',
            lastReconciledAt: (w as any).lastReconciledAt
              ? dateKey((w as any).lastReconciledAt)
              : null,
          };
        })
      : [],
    kpis: kpis
      ? {
          safeToSpendMad: amountOf(kpis.safeToSpend),
          totalLiquidityMad: amountOf(kpis.totalLiquidity),
          bankBalanceMad: amountOf(kpis.bankBalance),
          cashOnHandMad: amountOf(kpis.cashOnHand),
          emergencyBufferMad: amountOf(kpis.emergencyBuffer),
          investmentReserveMad: amountOf(kpis.investmentReserve),
          pendingPayablesMad: amountOf(kpis.pendingPayables),
          creditCardLiabilitiesMad,
          monthlyIncomeMad: amountOf(kpis.monthlyIncome),
          monthlyExpensesMad: amountOf(kpis.monthlyExpenses),
          adjustedTrueSpendMad: amountOf(kpis.adjustedTrueSpend),
          dailyAllowanceMad: amountOf(kpis.dailyAllowance),
          dailySpentMad: amountOf(kpis.dailySpent),
          dailyRemainingMad: amountOf(kpis.dailyRemaining),
          avgDailySpendMad: amountOf(kpis.avgDailySpend),
          daysUntilPayroll: kpis.daysUntilPayday,
          runwayDays: kpis.runwayDays,
        }
      : null,

    // Historical Financial Periods Ledger (Exact opening/closing liquidity, net cashflow saved, and living spend per payroll period)
    historicalFinancialPeriods: generateFinancialPeriodsLedger(
      transactions,
      payrolls,
      amountOf(kpis?.totalLiquidity),
      kpis?.accounts || []
    ).map((p) => ({
      label: p.label,
      dateRangeLabel: p.displayLabel,
      startDate: p.startDate,
      endDate: p.endDate,
      isCurrentActivePeriod: p.isCurrent,
      openingLiquidityMad: p.openingLiquidity,
      salaryIncomeMad: p.salaryIncome,
      otherIncomeMad: p.otherIncome,
      totalIncomeMad: p.totalIncome,
      grossOutflowMad: p.grossOutflow,
      netLivingExpenseMad: p.netLivingExpense,
      reimbursableFrontedMad: p.reimbursableAmount,
      debtRepaymentsMad: p.debtRepayments,
      investmentDeployedMad: p.investmentDeployed,
      netCashflowSavedMad: p.netCashflowSaved,
      netEconomicSavedMad: p.netEconomicSaved,
      endingLiquidityMad: p.closingLiquidity,
      savingsRatePercent: p.cashSavingsRate,
      transactionCount: p.transactionCount,
    })),

    // Unified Net Worth Breakdown (Liquid + Live Investments + External Physical Assets - Debts & External/Credit Liabilities)
    unifiedNetWorthBreakdown: kpis
      ? (() => {
          const totalLiquidity = amountOf(kpis.totalLiquidity);
          const invReserve = amountOf(kpis.investmentReserve);
          const nonInvestmentLiquidity = amountOf(totalLiquidity - invReserve);
          const liveInvestmentVal =
            investmentsData && investmentsData.totalPortfolioValueMad > 0
              ? amountOf(investmentsData.totalPortfolioValueMad)
              : invReserve;
          const actualLiquidAndInvestedHoldings = amountOf(
            nonInvestmentLiquidity + liveInvestmentVal
          );
          const pendingReceivables = amountOf(
            debts
              .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
              .reduce((s, d) => s + amountOf(d.remainingBalance ?? d.originalAmount), 0)
          );
          const pendingPayables = amountOf(
            debts
              .filter((d) => d.type === 'Payable' && d.status === 'Pending')
              .reduce((s, d) => s + amountOf(d.remainingBalance ?? d.originalAmount), 0)
          );
          const netDebtPosition = amountOf(pendingReceivables - pendingPayables);
          const liquidAndInvestmentNetWorthMad = amountOf(
            actualLiquidAndInvestedHoldings + netDebtPosition - creditCardLiabilitiesMad
          );
          const totalUnifiedNetWorthMad = amountOf(
            liquidAndInvestmentNetWorthMad + netExternalWealthMad
          );
          return {
            actualLiquidAndInvestedHoldingsMad: actualLiquidAndInvestedHoldings,
            totalWalletLiquidityMad: totalLiquidity,
            nonInvestmentCashAndSavingsMad: nonInvestmentLiquidity,
            investmentReserveWalletMad: invReserve,
            liveSyncedInvestmentPortfolioMad: liveInvestmentVal,
            pendingReceivablesOwedToUserMad: pendingReceivables,
            pendingPayablesUserOwesMad: pendingPayables,
            creditCardLiabilitiesMad,
            netReceivablesMinusPayablesMad: netDebtPosition,
            liquidAndInvestmentNetWorthMad,
            externalPhysicalAssetsMad: externalAssetsMad,
            externalLiabilitiesMad,
            netExternalWealthMad,
            estimatedUnifiedNetWorthMad: totalUnifiedNetWorthMad,
            explanation:
              'Total Unified Net Worth = Liquid/Investment Net Worth (Non-Investment Wallets + Live Investment Value without double-counting + Pending Receivables - Pending Payables - Credit Card Liabilities) + Net External Wealth (Declared Physical/Off-Platform Assets - External Liabilities). Always distinguish spendable liquid cash from illiquid physical assets.',
          };
        })()
      : null,

    // External Wealth (Physical Assets like Electronics, Vehicles, Gold, Real Estate, and External Liabilities)
    externalWealth:
      externalWealthSummary && (hasScope('assets_radar') || hasScope('wallets') || isAll)
        ? {
            totalExternalAssetsMad: externalAssetsMad,
            totalExternalLiabilitiesMad: externalLiabilitiesMad,
            netExternalWealthMad,
            staleValuationsCount: externalWealthSummary.staleCount || 0,
            items: (externalWealthSummary.items || []).slice(0, 40).map((item) => ({
              id: item.id,
              name: item.name,
              itemClass: item.itemClass,
              kind: item.isLiability ? 'Liability' : 'Asset',
              isLiquid: Boolean(item.isLiquid),
              estimatedValue: amountOf(item.estimatedValue),
              currency: item.currency || 'MAD',
              valueMad: amountOf(item.valueMad ?? item.estimatedValue),
              valuationDate: dateKey(item.valuationDate),
              valuationSource: item.valuationSource || 'manual_estimate',
              confidenceLevel: item.confidenceLevel || 'medium',
              isStale: Boolean(item.isStaleEstimate),
              ageDays: item.ageDays ?? null,
              notes: item.notes || null,
            })),
          }
        : null,

    // Operational Radar (Upcoming 90d Commitments, Pending Review Inbox, Financial Integrity Report)
    operationalRadar:
      operationalRadar &&
      (hasScope('assets_radar') || hasScope('forecast') || hasScope('debts_goals') || isAll)
        ? {
            upcomingCommitments: (operationalRadar.upcomingCommitments || [])
              .slice(0, 25)
              .map((c) => ({
                id: c.id,
                title: c.title,
                sourceType: c.sourceType,
                expectedAmountMad: amountOf(c.expectedAmount),
                currency: c.currency || 'MAD',
                dueDate: dateKey(c.expectedDate),
                daysUntilDue: daysUntilDate(c.expectedDate),
                status: c.status,
                paidAmountMad: c.paidAmount != null ? amountOf(c.paidAmount) : 0,
                varianceAmountMad: amountOf(c.varianceAmount),
                notes: c.notes || null,
              })),
            pendingReviews: (operationalRadar.pendingReviews || []).slice(0, 20).map((r) => ({
              id: r.id,
              sourceType: r.sourceType,
              description: r.parsedDescription,
              category: r.parsedCategory,
              parsedType: r.parsedType,
              parsedAmount: amountOf(r.parsedAmount),
              currency: r.parsedCurrency || 'MAD',
              parsedDate: dateKey(r.parsedDate),
              walletId: r.walletId || null,
              walletName: r.walletId ? walletNameMap.get(r.walletId) || null : null,
              confidenceScore: amountOf(r.confidenceScore),
              status: r.status,
              createdAt: dateKey(r.createdAt),
            })),
            integritySummary: operationalRadar.integritySummary
              ? {
                  healthy: Boolean(operationalRadar.integritySummary.healthy),
                  checkedAt: dateKey(operationalRadar.integritySummary.checkedAt),
                  totalExceptions: operationalRadar.integritySummary.totalExceptions ?? 0,
                  unbalancedEntriesCount:
                    operationalRadar.integritySummary.checks?.unbalancedJournalEntries?.length ?? 0,
                  unjournaledTransactionsCount:
                    operationalRadar.integritySummary.checks?.unjournaledTransactions?.length ?? 0,
                  duplicateJournalPostingsCount:
                    operationalRadar.integritySummary.checks?.duplicateJournalPostings?.length ?? 0,
                  unreconciledGoalsCount:
                    operationalRadar.integritySummary.checks?.unreconciledGoals?.length ?? 0,
                  staleExternalValuationsCount:
                    operationalRadar.integritySummary.checks?.staleExternalValuations?.length ?? 0,
                }
              : null,
          }
        : null,

    // Deep Investments, Live Binance Multi-Wallet, Trade Forensics & Stock Intelligence
    stockPortfolio:
      investmentsData && (hasScope('investments') || hasScope('wallets') || isAll)
        ? {
            exchangeRates: investmentsData.rates,
            totalPortfolioValueMad: investmentsData.totalPortfolioValueMad,
            totalPortfolioValueUsd: investmentsData.totalPortfolioValueUsd,
            totalCostBasisMad: investmentsData.totalCostBasisMad,
            totalCostBasisUsd: amountOf(investmentsData.totalCostBasisMad / usdToMad),
            totalUnrealizedPnlMad: investmentsData.totalUnrealizedPnlMad,
            totalUnrealizedPnlUsd: amountOf(investmentsData.totalUnrealizedPnlMad / usdToMad),
            totalUnrealizedPnlPercent: investmentsData.totalUnrealizedPnlPercent,
            totalFeesPaidMad: investmentsData.totalFeesPaidMad || 0,
            totalFeesPaidUsd: investmentsData.totalFeesPaidUsd || 0,
            totalNetPnlAfterFeesMad:
              reconciliation?.netCapitalPnlMad ?? investmentsData.totalUnrealizedPnlMad,
            totalNetPnlAfterFeesUsd:
              reconciliation?.netCapitalPnlUsd ??
              amountOf(investmentsData.totalUnrealizedPnlMad / usdToMad),
            annualDividendIncomeMad: investmentsData.annualPassiveIncomeMad,
            monthlyDividendIncomeMad: investmentsData.monthlyPassiveIncomeMad,
            totalAccruedDividendsMad:
              reconciliation?.accruedDividendsMad ?? investmentsData.totalDividendsCollectedMad,
            deployableBuyingPowerMad: investmentsData.buyingPower.deployableSurplusMad,
            deployableBuyingPowerUsd: investmentsData.buyingPower.deployableSurplusUsd,
            buyingPowerGuidance: investmentsData.buyingPower.guidanceText,

            // Capital Reserve Reconciliation (Initial Capital vs Live Value)
            capitalReconciliation: reconciliation
              ? {
                  initialCapitalMad: reconciliation.initialCapitalMad,
                  initialCapitalUsd: reconciliation.initialCapitalUsd,
                  currentLiveValueMad: reconciliation.currentLiveValueMad,
                  currentLiveValueUsd: reconciliation.currentLiveValueUsd,
                  grossMarketPnlMad: reconciliation.grossMarketPnlMad,
                  grossMarketPnlUsd: reconciliation.grossMarketPnlUsd,
                  totalFeesPaidMad: reconciliation.totalFeesPaidMad,
                  totalFeesPaidUsd: reconciliation.totalFeesPaidUsd,
                  estimatedExitFeesMad: reconciliation.estimatedExitFeesMad,
                  estimatedExitFeesUsd: reconciliation.estimatedExitFeesUsd,
                  totalFeeDragMad: reconciliation.totalFeeDragMad,
                  totalFeeDragUsd: reconciliation.totalFeeDragUsd,
                  feeDragPercentOfCapital: reconciliation.feeDragPercentOfCapital,
                  dividendsEarnedMad: reconciliation.dividendsEarnedMad,
                  accruedDividendsMad: reconciliation.accruedDividendsMad,
                  fxAndFundingSpreadMad: reconciliation.fxAndFundingSpreadMad,
                  netCapitalPnlMad: reconciliation.netCapitalPnlMad,
                  netCapitalPnlUsd: reconciliation.netCapitalPnlUsd,
                  netCapitalPnlPercent: reconciliation.netCapitalPnlPercent,
                  recoveryNeededMad: reconciliation.recoveryNeededMad,
                  recoveryNeededUsd: reconciliation.recoveryNeededUsd,
                  recoveryNeededPercent: reconciliation.recoveryNeededPercent,
                  isProfitable: reconciliation.isGain,
                  verdict: reconciliation.isGain
                    ? `Net Gain of +${reconciliation.netCapitalPnlMad.toFixed(2)} MAD (+$${reconciliation.netCapitalPnlUsd.toFixed(2)})`
                    : `Net Drawdown of ${reconciliation.netCapitalPnlMad.toFixed(2)} MAD ($${reconciliation.netCapitalPnlUsd.toFixed(2)}) vs ${reconciliation.initialCapitalMad.toFixed(2)} MAD initial capital`,
                }
              : null,

            // Live Binance Account Overview (Spot + Funding + Earn)
            binanceLiveOverview: binance
              ? {
                  connected: binance.connected,
                  accountType: binance.accountType,
                  lastSyncedAt: binance.lastSyncedAt,
                  totalCombinedValueUsd: binance.totalCombinedValueUsd,
                  totalCombinedValueMad: binance.totalCombinedValueMad,
                  totalSpotValueUsd: binance.totalSpotValueUsd,
                  totalSpotValueMad: binance.totalSpotValueMad,
                  totalFundingValueUsd: binance.totalFundingValueUsd,
                  totalFundingValueMad: binance.totalFundingValueMad,
                  totalEarnValueUsd: binance.totalEarnValueUsd,
                  totalEarnValueMad: binance.totalEarnValueMad,
                  stockEquityUsd: binance.stockEquityUsd,
                  stockEquityMad: binance.stockEquityMad,
                  cryptoEquityUsd: binance.cryptoEquityUsd,
                  cryptoEquityMad: binance.cryptoEquityMad,
                  stablecoinReserveUsd: binance.stablecoinReserveUsd,
                  stablecoinReserveMad: binance.stablecoinReserveMad,
                  change24hUsd: binance.change24hUsd,
                  change24hMad: binance.change24hMad,
                  change24hPercent: binance.change24hPercent,
                  walletBreakdown: binance.walletBreakdown || [],
                  balances: binance.balances.map((b) => ({
                    asset: b.asset,
                    assetName: b.assetName,
                    walletType: b.walletType,
                    category: b.category,
                    qty: b.total,
                    free: b.free,
                    locked: b.locked,
                    priceUsd: b.priceUsd,
                    priceMad: b.priceMad,
                    valueUsd: b.valueUsd,
                    valueMad: b.valueMad,
                    change24hPercent: b.change24hPercent,
                    weightPercent: b.portfolioWeightPercent,
                    avgBuyPriceUsd: b.avgBuyPriceUsd,
                    costBasisUsd: b.costBasisUsd,
                    costBasisMad: b.costBasisMad,
                    unrealizedPnlUsd: b.unrealizedPnlUsd,
                    unrealizedPnlMad: b.unrealizedPnlMad,
                    unrealizedPnlPercent: b.unrealizedPnlPercent,
                    feesPaidUsd: b.feesPaidUsd,
                    feesPaidMad: b.feesPaidMad,
                    estimatedExitFeeUsd: b.estimatedExitFeeUsd,
                    totalFeeLossUsd: b.totalFeeLossUsd,
                    totalFeeLossMad: b.totalFeeLossMad,
                    feeDragPercent: b.feeDragPercent,
                    netPnlAfterFeesUsd: b.netPnlAfterFeesUsd,
                    netPnlAfterFeesMad: b.netPnlAfterFeesMad,
                    breakevenPriceUsd: b.breakevenPriceUsd,
                    distanceToBreakevenPercent: b.distanceToBreakevenPercent,
                    dividendYieldPercent: b.dividendYieldPercent,
                    annualDividendUsd: b.annualDividendUsd,
                    accruedDividendUsd: b.accruedDividendUsd,
                    totalReturnWithDividendUsd: b.totalReturnWithDividendUsd,
                    costBasisSource: b.costBasisSource,
                  })),
                  recentTrades: (binance.recentTrades || []).slice(0, 35).map((t) => ({
                    symbol: t.symbol,
                    side: t.side,
                    status: t.tradeStatusLabel || (t.isCompletedTrade ? 'CLOSED' : 'OPEN_LOT'),
                    time: t.executedAt,
                    execPriceUsd: t.price,
                    currentPriceUsd: t.currentMarketPriceUsd,
                    qty: t.qty,
                    entryCostUsd: t.quoteQtyUsd,
                    entryCostMad: t.quoteQtyMad,
                    currentValueUsd: t.currentLotValueUsd,
                    currentValueMad: t.currentLotValueMad,
                    entryFeeUsd: t.commissionUsd,
                    estExitFeeUsd: t.estimatedExitFeeUsd,
                    totalFeeLossUsd: t.totalFeeLossUsd,
                    totalFeeLossMad: t.totalFeeLossMad,
                    feeDragPercent: t.feeDragPercent,
                    grossPnlUsd: t.grossTradePnlUsd,
                    grossPnlMad: t.grossTradePnlMad,
                    netPnlAfterFeesUsd: t.netTradePnlUsd,
                    netPnlAfterFeesMad: t.netTradePnlMad,
                    netPnlPercent: t.netTradePnlPercent,
                    breakevenPriceUsd: t.breakevenPriceUsd,
                    accruedDividendUsd: t.accruedDividendUsd,
                    totalReturnWithDividendUsd: t.totalReturnWithDividendUsd,
                    holdingDays: t.holdingDays,
                  })),
                  tradeSummary: binance.symbolSummaries || null,
                }
              : null,

            // Unified Positions (Equities, Stocks, ETFs, Crypto) with Forensics & DRIP
            positions: investmentsData.positions.map((p) => ({
              id: p.id,
              ticker: p.ticker,
              company: p.companyName,
              market: p.market,
              sector: p.sector,
              source: p.source,
              shares: p.sharesNum,
              avgCost: p.avgCostNum,
              currentPrice: p.currentPriceNum,
              currency: p.currency,
              change24hPercent: p.change24hPercent,
              costBasisMad: p.costBasisMad,
              costBasisUsd: p.costBasisUsd,
              valueMad: p.marketValueMad,
              valueUsd: p.marketValueUsd,
              grossPnlMad: p.unrealizedPnlMad,
              grossPnlUsd: p.unrealizedPnlUsd,
              grossPnlPercent: p.unrealizedPnlPercent,
              feesPaidMad: p.feesPaidMad,
              estimatedExitFeeMad: p.estimatedExitFeeMad,
              totalFeeLossMad: p.totalFeeLossMad,
              totalFeeLossUsd: p.totalFeeLossUsd,
              feeDragPercent: p.feeDragPercent,
              netPnlAfterFeesMad: p.netPnlAfterFeesMad,
              netPnlAfterFeesUsd: p.netPnlAfterFeesUsd,
              netPnlAfterFeesPercent: p.netPnlAfterFeesPercent,
              breakevenPriceNative: p.breakevenPriceNative,
              breakevenPriceUsd: p.breakevenPriceUsd,
              distanceToBreakevenPercent: p.distanceToBreakevenPercent,
              dividendYieldPercent: p.dividendYieldPercent,
              yieldOnCostPercent: p.yieldOnCostPercent,
              annualDividendMad: p.annualDividendMad,
              accruedDividendMad: p.accruedDividendMad,
              totalReturnWithDividendMad: p.totalReturnWithDividendMad,
              drip5YearProjectedValueMad: p.drip5YearProjectedValueMad,
              drip5YearProjectedIncomeMad: p.drip5YearProjectedIncomeMad,
              weightPercent: p.actualWeightPercent,
              holdingDays: p.holdingDays,
              thesis: p.convictionThesis,
            })),

            manualStockOrders: (investmentsData.orders || []).slice(0, 30),
            smartInsights: investmentsData.smartInsights || [],
            sectorBreakdown: investmentsData.sectorBreakdown || [],
            marketBreakdown: investmentsData.marketBreakdown || [],
            curatedStockCatalogSample: (investmentsData.catalog || []).slice(0, 25).map((c) => ({
              ticker: c.ticker,
              company: c.companyName,
              market: c.market,
              sector: c.sector,
              price: c.price,
              currency: c.currency,
              priceInMad: c.priceInMad,
              dividendYieldPercent: c.dividendYieldPercent,
              thesis: c.thesis,
            })),
          }
        : null,

    predictiveForecast:
      hasScope('forecast') || hasScope('budgets') || isAll
        ? {
            projectedNetWorth90d: forecast.projectedNetWorth90d,
            projectedNetWorth12m: forecast.projectedNetWorth12m,
            projectedNetSavingsMonthly: forecast.monthlyNetSavingsBaseline,
            lowest30dBalance: forecast.lowest30dBalance,
            lowest30dDate: forecast.lowest30dDateLabel,
            survivalRunwayDays: forecast.survivalRunwayDays,
            hasLiquidityPinchBeforePayday: forecast.hasLiquidityPinchBeforePayday,
            dayOfWeekSpendingPatterns: (forecast.dayOfWeekPatterns || []).map((d) => ({
              day: d.shortName,
              avgSpendMad: amountOf(d.avgSpendMad),
              relativeMultiplier: amountOf(d.relativeMultiplier),
              txCount: d.txCount,
              isPeakDay: d.relativeMultiplier >= 1.25,
            })),
            topSignals: forecast.signals.slice(0, 8).map((s) => ({
              title: s.title,
              detail: s.detail,
              severity: s.severity,
            })),
            categoryRadar: forecast.categoryPredictions.slice(0, 14).map((c) => ({
              category: c.category,
              spentSoFar: c.spentSoFar,
              budgetLimit: c.budgetCap,
              projectedCycleEnd: c.projectedEndOfCycle,
              status: c.status,
              exhaustionDate: c.exhaustionDateLabel,
            })),
          }
        : null,

    financialPeriodSummary: {
      income: amountOf(income),
      expenses: amountOf(expenses),
      netPosition: amountOf(income - expenses),
      previousPeriodExpenses: previousTransactions
        .filter((transaction) => transaction.type === 'Expense')
        .reduce((sum, transaction) => sum + netExpenseOf(transaction), 0),
      totalTransactionsCount: transactions.length,
      currentPeriodTransactionsCount: periodTransactions.length,
      periodCategoryBreakdown: periodCategoryTotals,
      allTimeCategoryBreakdown: allTimeCategoryTotals,
      topMerchantsByNetSpend: hasScope('transactions') || isAll ? topMerchantsByNetSpend : topMerchantsByNetSpend.slice(0, 8),
    },

    payrolls: payrolls.map((payroll) => ({
      id: payroll.id,
      date: dateKey(payroll.scheduledFor),
      amount: amountOf(payroll.amount),
      status: payroll.status || 'expected',
      walletId: payroll.walletId || null,
      walletName:
        payroll.walletName ||
        (payroll.walletId ? walletNameMap.get(payroll.walletId) || null : null),
      confirmedAmount:
        payroll.confirmedAmount != null ? amountOf(payroll.confirmedAmount) : null,
      confirmedAt: payroll.confirmedAt ? dateKey(payroll.confirmedAt) : null,
      varianceAmount:
        payroll.varianceAmount != null ? amountOf(payroll.varianceAmount) : null,
    })),

    budgets:
      hasScope('budgets') || isAll
        ? budgets.slice(0, 50).map((budget) => ({
            category: budget.category,
            amount: amountOf(budget.amount),
            year: budget.year,
            month: budget.month,
          }))
        : [],

    emergencyBuffer: kpis ? amountOf(kpis.emergencyBuffer) : 0,

    debts:
      hasScope('debts_goals') || hasScope('assets_radar') || isAll
        ? debts.slice(0, 40).map((debt) => ({
            id: debt.id,
            contact: debt.contactName,
            counterpartyType: debt.counterpartyType || 'Person',
            type: debt.type,
            status: debt.status,
            currency: debt.currency || 'MAD',
            totalAmount: amountOf(debt.originalAmount),
            remaining: amountOf(debt.remainingBalance),
            dueDate: dateKey(debt.dueDate),
            daysUntilDue: daysUntilDate(debt.dueDate),
            interestRateApr: amountOf(debt.interestRateApr),
            rateType: debt.rateType || 'none',
            installmentAmount: debt.installmentAmount ? amountOf(debt.installmentAmount) : null,
            installmentFrequency: debt.installmentFrequency || 'one_time',
            feesAmount: amountOf(debt.feesAmount),
            forgivenAmount: debt.forgivenAmount ? amountOf(debt.forgivenAmount) : 0,
            estimatedMonthsRemaining: debt.estimatedMonthsRemaining || null,
            earlySettlementSavingsMad: amountOf(debt.earlySettlementSavingsMad),
            totalPayoffWithFeesMad: debt.totalPayoffWithFeesMad
              ? amountOf(debt.totalPayoffWithFeesMad)
              : amountOf(debt.remainingBalance),
          }))
        : [],

    goals:
      hasScope('debts_goals') || isAll
        ? goals.map((goal) => {
            const linkedWallet = kpis?.accounts?.find((w) => w.id === goal.walletId);
            const target = amountOf(goal.targetAmount);
            const currentAmt = amountOf(goal.currentAmount);
            return {
              id: goal.id,
              name: goal.name,
              category: goal.category,
              targetAmount: target,
              currentAmount: currentAmt,
              remainingToTargetMad: amountOf(Math.max(0, target - currentAmt)),
              progressPercent: target > 0 ? amountOf((currentAmt / target) * 100) : 0,
              walletId: goal.walletId || null,
              linkedWalletName: linkedWallet ? `${linkedWallet.name} (${linkedWallet.type})` : null,
              autoSyncBalance: Boolean(goal.autoSyncBalance),
              fundingCadence: goal.fundingCadence || 'monthly',
              plannedContributionAmount: goal.plannedContributionAmount
                ? amountOf(goal.plannedContributionAmount)
                : null,
              deadline: dateKey(goal.deadline),
              daysUntilDeadline: daysUntilDate(goal.deadline),
              notes: goal.notes,
            };
          })
        : [],

    subscriptions:
      hasScope('debts_goals') || hasScope('budgets') || hasScope('assets_radar') || isAll
        ? subscriptions.map((sub) => {
            const amt = amountOf(sub.amount);
            return {
              id: sub.id,
              name: sub.name,
              amountMad: amt,
              currency: sub.currency || 'MAD',
              billingCycle: sub.billingCycle,
              normalizedMonthlyMad: normalizedMonthlySubCost(amt, sub.billingCycle),
              category: sub.category,
              walletId: sub.walletId || null,
              walletName:
                sub.walletName ||
                (sub.walletId ? walletNameMap.get(sub.walletId) || null : null),
              nextBillingDate: dateKey(sub.nextBillingDate),
              daysUntilNextBilling: daysUntilDate(sub.nextBillingDate),
              status: sub.status,
              notes: sub.notes || null,
            };
          })
        : [],

    spendingContexts:
      hasScope('transactions') || hasScope('assets_radar') || isAll
        ? contexts.map((ctx) => ({
            id: ctx.id,
            name: ctx.name,
            type: ctx.type,
            budgetMad: amountOf(ctx.budget),
            status: ctx.status,
            startDate: ctx.startDate ? dateKey(ctx.startDate) : null,
            endDate: ctx.endDate ? dateKey(ctx.endDate) : null,
            notes: ctx.notes || null,
          }))
        : [],

    currentPeriodTransactions: periodTransactions
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, txLimit)
      .map((transaction) => ({
        id: transaction.id,
        date: dateKey(transaction.createdAt),
        amount: amountOf(transaction.amount),
        netExpenseMad:
          transaction.type === 'Expense' ? amountOf(netExpenseOf(transaction)) : undefined,
        type: transaction.type,
        category: transaction.category,
        walletId: transaction.walletId,
        destinationWalletId: transaction.destinationWalletId || null,
        contextId: transaction.contextId || null,
        sourceWallet: transaction.sourceWallet,
        currency: transaction.currency || 'MAD',
        ...(transaction.currency && transaction.currency !== 'MAD'
          ? {
              nativeAmount: amountOf(transaction.nativeAmount),
              exchangeRateUsed: amountOf(transaction.exchangeRateUsed),
            }
          : {}),
        note: transaction.notes,
        reimbursableAmount: amountOf(transaction.reimbursableAmount),
        ...(transaction.isPartialPayment
          ? {
              isPartialPayment: true,
              unpaidAmount: amountOf(transaction.unpaidAmount),
              unpaidRemainingBalance: amountOf(transaction.unpaidRemainingBalance),
              unpaidContactName: transaction.unpaidContactName || null,
            }
          : {}),
        ...(transaction.splits && transaction.splits.length > 0
          ? {
              splits: transaction.splits.map((s) => ({
                contactName: s.linkedContactName || null,
                reimbursableAmount: amountOf(s.reimbursableAmount),
                remainingBalance: s.remainingBalance != null ? amountOf(s.remainingBalance) : null,
                status: s.status || null,
              })),
            }
          : {}),
      })),

    allRecentTransactions: sortedTransactions.slice(0, txLimit).map((transaction) => ({
      id: transaction.id,
      date: dateKey(transaction.createdAt),
      amount: amountOf(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      walletId: transaction.walletId,
      destinationWalletId: transaction.destinationWalletId || null,
      contextId: transaction.contextId || null,
      sourceWallet: transaction.sourceWallet,
      currency: transaction.currency || 'MAD',
      note: transaction.notes,
      reimbursableAmount: amountOf(transaction.reimbursableAmount),
    })),
  };
}

