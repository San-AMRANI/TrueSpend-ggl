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
} from '../types/index.js';
import {
  financialPeriodLabel,
  getCurrentFinancialMonth,
  getPreviousFinancialMonth,
} from './financialMonth.js';
import { computeHolisticForecast } from './predictiveEngine.js';

export type AiDataFocusScope =
  | 'all'
  | 'investments'
  | 'transactions'
  | 'wallets'
  | 'budgets'
  | 'debts_goals'
  | 'forecast';

export type AiResponseDepth = 'deep_creative' | 'balanced' | 'concise';

const amountOf = (value: string | number | null | undefined) =>
  Number.isFinite(Number(value)) ? Number(Number(value).toFixed(2)) : 0;

const dateKey = (value: string | Date | null | undefined) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : 'unknown';
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
    .filter((transaction) => transaction.type === 'Income')
    .reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);
  const expenses = periodTransactions
    .filter(
      (transaction) =>
        transaction.type === 'Expense' || transaction.type === 'Debt Repayment'
    )
    .reduce((sum, transaction) => sum + amountOf(transaction.amount), 0);

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

  // Aggregate category-by-category spending across active period and all-time
  const periodCategoryTotals: Record<string, { spentMad: number; count: number }> = {};
  for (const tx of periodTransactions) {
    if (tx.type === 'Expense') {
      const cat = tx.category || 'Uncategorized';
      if (!periodCategoryTotals[cat]) {
        periodCategoryTotals[cat] = { spentMad: 0, count: 0 };
      }
      periodCategoryTotals[cat].spentMad = amountOf(
        periodCategoryTotals[cat].spentMad + amountOf(tx.amount)
      );
      periodCategoryTotals[cat].count += 1;
    }
  }

  const allTimeCategoryTotals: Record<string, { spentMad: number; count: number }> = {};
  for (const tx of transactions) {
    if (tx.type === 'Expense') {
      const cat = tx.category || 'Uncategorized';
      if (!allTimeCategoryTotals[cat]) {
        allTimeCategoryTotals[cat] = { spentMad: 0, count: 0 };
      }
      allTimeCategoryTotals[cat].spentMad = amountOf(
        allTimeCategoryTotals[cat].spentMad + amountOf(tx.amount)
      );
      allTimeCategoryTotals[cat].count += 1;
    }
  }

  const sortedTransactions = [...transactions].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  // Determine how many transactions to include based on focus
  const txLimit = hasScope('transactions') ? 160 : 60;

  const binance = investmentsData?.binance;
  const reconciliation = investmentsData?.capitalReconciliation;
  const usdToMad = investmentsData?.rates?.USD_TO_MAD || 9.95;

  return {
    asOf: dateKey(new Date()),
    currency: 'MAD',
    activeFocusScopes: activeScopes,
    requestedResponseDepth: responseDepth,
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
    // Core KPIs & Wallets are always included for grounding, with extra detail when 'wallets' or 'all' is selected
    wallets: kpis
      ? kpis.accounts.map((w) => ({
          id: w.id,
          name: w.name,
          type: w.type,
          isMain: Boolean((w as any).isMain),
          balanceMad: amountOf(w.balance),
          initialBalanceMad: amountOf((w as any).initialBalance),
        }))
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

            // Capital Reserve Reconciliation ($879 MAD vs Live Value)
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
            topSignals: forecast.signals.slice(0, 6).map((s) => ({
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
        .reduce((sum, transaction) => sum + amountOf(transaction.amount), 0),
      totalTransactionsCount: transactions.length,
      currentPeriodTransactionsCount: periodTransactions.length,
      periodCategoryBreakdown: periodCategoryTotals,
      allTimeCategoryBreakdown: allTimeCategoryTotals,
    },

    payrolls: payrolls.map((payroll) => ({
      date: dateKey(payroll.scheduledFor),
      amount: amountOf(payroll.amount),
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
      hasScope('debts_goals') || isAll
        ? debts.slice(0, 40).map((debt) => ({
            id: debt.id,
            contact: debt.contactName,
            type: debt.type,
            status: debt.status,
            totalAmount: amountOf(debt.originalAmount),
            remaining: amountOf(debt.remainingBalance),
            dueDate: dateKey(debt.dueDate),
          }))
        : [],

    goals:
      hasScope('debts_goals') || isAll
        ? goals.map((goal) => {
            const linkedWallet = kpis?.accounts?.find((w) => w.id === goal.walletId);
            return {
              id: goal.id,
              name: goal.name,
              category: goal.category,
              targetAmount: amountOf(goal.targetAmount),
              currentAmount: amountOf(goal.currentAmount),
              walletId: goal.walletId || null,
              linkedWalletName: linkedWallet ? `${linkedWallet.name} (${linkedWallet.type})` : null,
              autoSyncBalance: Boolean(goal.autoSyncBalance),
              deadline: dateKey(goal.deadline),
              notes: goal.notes,
            };
          })
        : [],

    subscriptions:
      hasScope('debts_goals') || hasScope('budgets') || isAll
        ? subscriptions.map((sub) => ({
            id: sub.id,
            name: sub.name,
            amountMad: amountOf(sub.amount),
            billingCycle: sub.billingCycle,
            category: sub.category,
            nextBillingDate: dateKey(sub.nextBillingDate),
            status: sub.status,
          }))
        : [],

    spendingContexts:
      hasScope('transactions') || isAll
        ? contexts.map((ctx) => ({
            id: ctx.id,
            name: ctx.name,
            type: ctx.type,
            budgetMad: amountOf(ctx.budget),
            status: ctx.status,
          }))
        : [],

    currentPeriodTransactions: periodTransactions
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, txLimit)
      .map((transaction) => ({
        id: transaction.id,
        date: dateKey(transaction.createdAt),
        amount: amountOf(transaction.amount),
        type: transaction.type,
        category: transaction.category,
        walletId: transaction.walletId,
        sourceWallet: transaction.sourceWallet,
        note: transaction.notes,
        reimbursableAmount: amountOf(transaction.reimbursableAmount),
      })),

    allRecentTransactions: sortedTransactions.slice(0, txLimit).map((transaction) => ({
      id: transaction.id,
      date: dateKey(transaction.createdAt),
      amount: amountOf(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      walletId: transaction.walletId,
      sourceWallet: transaction.sourceWallet,
      note: transaction.notes,
    })),
  };
}
