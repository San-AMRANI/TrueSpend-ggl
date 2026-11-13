import { apiClient } from './apiClient';
import {
  CategoryBudget,
  KPI,
  Transaction,
  Debt,
  Payroll,
  UserSettings,
  Wallet,
  FinancialContext,
  Goal,
  Subscription,
  SubscriptionPlanChangePayload,
  SubscriptionPlanChangeResult,
  DetectedSubscription,
  InvestmentsData,
  BinanceAccountOverview,
  BinancePersonalTrade,
  BinanceSymbolTradeSummary,
  StockPosition,
  StockOrder,
  StockCatalogItem,
  StockMarketType,
  StockOrderAction,
  CyclePeriodSummary,
  CycleRetrospectiveData,
  ManagedUser,
  RoleDefinition,
  UserAuditLog,
  User,
  UserRole,
  UserStatus,
  WorkspaceMode,
  UserPermissions,
  JournalAuditSummary,
  ExchangeRateRecord,
  StatementBatchWithRows,
  FinancialReviewItem,
  CommitmentOccurrence,
  GoalContributionEvent,
  SavedWhatIfScenario,
  FinancialRuleItem,
  FinancialRuleLogItem,
  ExternalWealthItem,
  BackupValidationPreview,
  AiActionImpactSimulation,
  CounterpartyRecord,
  FinancialPositionSnapshot,
  NetWorthChangeBridge,
  FinancialIntegrityReport,
} from '../../types';

export const dashboardService = {
  getSubscriptions: (token: string | null) => apiClient.get<Subscription[]>('/api/subscriptions', token),
  createSubscription: (payload: Partial<Subscription>, token: string | null) =>
    apiClient.post<Subscription>('/api/subscriptions', payload, token),
  updateSubscription: (id: string, payload: Partial<Subscription>, token: string | null) =>
    apiClient.put<Subscription>(`/api/subscriptions/${id}`, payload, token),
  deleteSubscription: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/subscriptions/${id}`, token),
  paySubscription: (id: string, payload: { walletId?: string; date?: string }, token: string | null) =>
    apiClient.post<{ subscription: Subscription; transaction: Transaction }>(`/api/subscriptions/${id}/pay`, payload, token),
  changeSubscriptionPlan: (id: string, payload: SubscriptionPlanChangePayload, token: string | null) =>
    apiClient.post<SubscriptionPlanChangeResult>(`/api/subscriptions/${id}/change-plan`, payload, token),
  detectSubscriptions: (token: string | null) =>
    apiClient.get<DetectedSubscription[]>('/api/subscriptions/detect', token),
  getGoals: (token: string | null) => apiClient.get<Goal[]>('/api/goals', token),
  createGoal: (payload: { name: string; targetAmount: number; currentAmount?: number; walletId?: string | null; autoSyncBalance?: boolean; deadline?: string | null; category?: string; notes?: string }, token: string | null) =>
    apiClient.post<Goal>('/api/goals', payload, token),
  updateGoal: (id: string, payload: { name?: string; targetAmount?: number; currentAmount?: number; walletId?: string | null; autoSyncBalance?: boolean; deadline?: string | null; category?: string; notes?: string }, token: string | null) =>
    apiClient.put<Goal>(`/api/goals/${id}`, payload, token),
  contributeToGoal: (id: string, payload: { amount: number; walletId?: string; destinationWalletId?: string; note?: string; date?: string }, token: string | null) =>
    apiClient.post<{ goal: Goal; transaction: Transaction | null }>(`/api/goals/${id}/contribute`, payload, token),
  withdrawFromGoal: (id: string, payload: { amount: number; walletId?: string; destinationWalletId?: string; note?: string; date?: string }, token: string | null) =>
    apiClient.post<{ goal: Goal; transaction: Transaction | null }>(`/api/goals/${id}/withdraw`, payload, token),
  deleteGoal: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/goals/${id}`, token),
  getContexts: (token: string | null) => apiClient.get<FinancialContext[]>('/api/contexts', token),
  createContext: (payload: Partial<FinancialContext>, token: string | null) =>
    apiClient.post<FinancialContext>('/api/contexts', payload, token),
  updateContext: (id: string, payload: Partial<FinancialContext>, token: string | null) =>
    apiClient.put<FinancialContext>(`/api/contexts/${id}`, payload, token),
  deleteContext: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/contexts/${id}`, token),
  linkTransactionsToContext: (transactionIds: string[], contextId: string | null, token: string | null) =>
    apiClient.post<{ success: boolean; count: number }>('/api/contexts/link-transactions', { transactionIds, contextId }, token),
  getKpis: (token: string | null) => apiClient.get<KPI>('/api/kpis', token),
  getWallets: (token: string | null) => apiClient.get<Wallet[]>('/api/wallets', token),
  createWallet: (
    payload: {
      name: string;
      type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
      accountSubtype?: string;
      institutionName?: string | null;
      currency?: string;
      creditLimit?: number | null;
      statementClosingDay?: number | null;
      paymentDueDay?: number | null;
      isMain?: boolean;
      initialBalance?: number;
    },
    token: string | null
  ) => apiClient.post<Wallet>('/api/wallets', payload, token),
  updateWallet: (
    id: string,
    payload: {
      name?: string;
      type?: 'Bank' | 'Cash' | 'Savings' | 'Investment';
      accountSubtype?: string;
      institutionName?: string | null;
      currency?: string;
      creditLimit?: number | null;
      statementClosingDay?: number | null;
      paymentDueDay?: number | null;
      valuationStatus?: string;
      isMain?: boolean;
      initialBalance?: number;
    },
    token: string | null
  ) => apiClient.put<Wallet>(`/api/wallets/${id}`, payload, token),
  deleteWallet: (id: string, reassignToWalletId: string | undefined, token: string | null) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/wallets/${id}${reassignToWalletId ? `?reassignTo=${reassignToWalletId}` : ''}`, token),
  getTransactions: (token: string | null) => apiClient.get<Transaction[]>('/api/transactions', token),
  createTransaction: (payload: Record<string, unknown>, token: string | null) =>
    apiClient.post<{ message: string; transaction: Transaction }>('/api/transactions', payload, token),
  getPayrolls: (token: string | null) => apiClient.get<Payroll[]>('/api/payrolls', token),
  createPayroll: (payload: { scheduledFor: string; amount: number }, token: string | null) =>
    apiClient.post<Payroll>('/api/payrolls', payload, token),
  confirmPayroll: (
    id: string,
    payload: { confirmedAmount?: number; confirmedDate?: string; walletId?: string; varianceNotes?: string },
    token: string | null
  ) =>
    apiClient.post<{ payroll: Payroll; transaction: Transaction; variance: number; alreadyConfirmed?: boolean }>(
      `/api/payrolls/${id}/confirm`,
      payload,
      token
    ),
  deletePayroll: (id: string, token: string | null) => apiClient.delete<{ success: boolean }>(`/api/payrolls/${id}`, token),
  deleteTransaction: (id: string, token: string | null) =>
    apiClient.delete<{ message: string }>(`/api/transactions/${id}`, token),
  updateTransaction: (id: string, payload: Record<string, unknown>, token: string | null) =>
    apiClient.put<{ message: string; transaction: Transaction }>(`/api/transactions/${id}`, payload, token),
  getCategoryBudgets: (token: string | null) => apiClient.get<CategoryBudget[]>('/api/category-budgets', token),
  saveCategoryBudget: (payload: { category: string; year: number; month: number; amount: number }, token: string | null) =>
    apiClient.put<CategoryBudget>('/api/category-budgets', payload, token),
  saveCategoryBudgetsBatch: (budgets: { category: string; year: number; month: number; amount: number }[], token: string | null) =>
    apiClient.put<CategoryBudget[]>('/api/category-budgets/batch', { budgets }, token),
  copyPreviousMonthBudgets: (year: number, month: number, token: string | null) =>
    apiClient.post<{ copied: number }>('/api/category-budgets/copy-previous', { year, month }, token),
  clearCategoryBudgetsMonth: (year: number, month: number, token: string | null) =>
    apiClient.delete<{ count: number }>(`/api/category-budgets/month/${year}/${month}`, token),
  deleteCategoryBudget: (id: string, token: string | null) =>
    apiClient.delete<CategoryBudget>(`/api/category-budgets/${id}`, token),
  generateSpexBudgetPlan: (
    payload: { year: number; month: number; userNotes?: string; targetIncomeMad?: number },
    token: string | null
  ) =>
    apiClient.post<{
      planName: string;
      executiveSummary: string;
      patternInsights: string[];
      userNotesApplied: string;
      targetYear: number;
      targetMonth: number;
      targetIncomeMad: number;
      totalReimbursementsStrippedMad: number;
      periodsAnalyzed: Array<{
        periodIndex: number;
        periodLabel: string;
        monthName: string;
        isCurrentPeriod: boolean;
        netIncomeMad: number;
        netLivingSpentMad: number;
        reimbursedStrippedMad: number;
        spentOnObligationsMad: number;
        spentOnMyselfMad: number;
        investedMad: number;
        retainedInBankMad: number;
      }>;
      allocations: Array<{
        category: string;
        pillar: string;
        amount: number;
        pctOfIncome: number;
        historicalAvgNetMad: number;
        historicalMedianNetMad: number;
        totalReimbursedDeductedMad: number;
        activePeriods: string;
        patternType: string;
        trendDirection: string;
        reasoning: string;
      }>;
      pillarBreakdown: {
        obligationsMad: number;
        obligationsPct: number;
        myselfMad: number;
        myselfPct: number;
        investmentsMad: number;
        investmentsPct: number;
        bankRetentionSavingsMad: number;
        bankRetentionSavingsPct: number;
      };
      modelUsed: string;
    }>('/api/category-budgets/ai-plan', payload, token),
  getDebts: (token: string | null) => apiClient.get<Debt[]>('/api/debts', token),
  settleDebt: (debtId: string, amount: number, token: string | null, category?: string, walletId?: string) =>
    apiClient.post<{ message: string }>('/api/debts', { debt_id: debtId, amount, category, walletId }, token),
  forgiveDebt: (
    debtId: string,
    payload: { amount?: number; reason?: string; note?: string },
    token: string | null
  ) =>
    apiClient.post<{ message: string; forgivenAmount: number; remainingBalance: number; status: string }>(
      `/api/debts/${debtId}/forgive`,
      payload,
      token
    ),
  updateDebt: (debtId: string, payload: { amount: number; contact: string; type: string }, token: string | null) =>
    apiClient.put<{ message: string }>(`/api/debts/${debtId}`, payload, token),
  deleteDebt: (debtId: string, token: string | null) =>
    apiClient.delete<{ message: string }>(`/api/debts/${debtId}`, token),
  getSettings: (token: string | null) => apiClient.get<UserSettings>('/api/settings', token),
  updateSettings: (
    payload: {
      emergencyBuffer?: number;
      payday?: number;
      salary?: number;
      automatedDriveBackups?: boolean;
      lastDriveBackupDate?: string;
      driveBackupFrequency?: 'daily' | '3days' | 'weekly';
      googleDriveToken?: string;
    },
    token: string | null
  ) =>
    apiClient.post<{ success: boolean; payday?: number; emergencyBuffer?: number; automatedDriveBackups?: number; driveBackupFrequency?: string }>(
      '/api/settings',
      payload,
      token
    ),
  backupToDrive: (accessToken: string | null, token: string | null) =>
    apiClient.post<{ success: boolean; fileId: string; lastDriveBackupDate: string }>(
      '/api/settings/backup-drive',
      { accessToken },
      token
    ),
  getSqlBlob: async (token: string | null) => {
    const response = await fetch('/api/settings/export-sql', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Failed to download SQL export');
    }
    return await response.blob();
  },
  exportSql: async (token: string | null) => {
    const response = await fetch('/api/settings/export-sql', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event('auth:unauthorized'));
      throw new Error('Failed to download SQL export');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truespend_database_backup_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  importSql: (sql: string, token: string | null) =>
    apiClient.post<{ success: boolean; message: string; restored: Record<string, number> }>('/api/settings/import-sql', { sql }, token),
  seedData: (token: string | null) => apiClient.post<{ success: boolean }>('/api/seed', {}, token),

  // Binance Spot Read-Only & Stock Portfolio APIs
  getInvestmentsData: (token: string | null, forceRefresh?: boolean) =>
    apiClient.get<InvestmentsData>(`/api/investments${forceRefresh ? '?refresh=true' : ''}`, token),
  getBinanceAccount: (token: string | null, forceRefresh?: boolean) =>
    apiClient.get<BinanceAccountOverview>(`/api/investments/binance/account${forceRefresh ? '?refresh=true' : ''}`, token),
  getBinanceTrades: (
    params: {
      symbol: string;
      limit?: number;
      startTime?: number;
      endTime?: number;
      fromId?: number;
      refresh?: boolean;
    },
    token: string | null
  ) => {
    const query = new URLSearchParams();
    query.set('symbol', params.symbol.trim().toUpperCase());
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.startTime !== undefined) query.set('startTime', String(params.startTime));
    if (params.endTime !== undefined) query.set('endTime', String(params.endTime));
    if (params.fromId !== undefined) query.set('fromId', String(params.fromId));
    if (params.refresh) query.set('refresh', 'true');
    return apiClient.get<{ trades: BinancePersonalTrade[]; summary: BinanceSymbolTradeSummary }>(
      `/api/investments/binance/trades?${query.toString()}`,
      token
    );
  },
  syncBinanceWallet: (
    payload: {
      walletId?: string;
      mode?: 'stablecoins_only' | 'full_spot_balance';
    },
    token: string | null
  ) =>
    apiClient.post<{
      success: boolean;
      walletId: string;
      walletName: string;
      mode: 'stablecoins_only' | 'full_spot_balance';
      previousBalanceMad: number;
      syncedBalanceMad: number;
      deltaMad: number;
      binanceSpotValueMad: number;
      binanceStablecoinReserveMad: number;
      message: string;
    }>('/api/investments/binance/sync-wallet', payload, token),
  logWalletCapitalTransfer: (
    payload: {
      direction: 'deposit' | 'withdrawal';
      bankWalletId?: string;
      investmentWalletId?: string;
      amountMad: number;
      notes?: string;
    },
    token: string | null
  ) =>
    apiClient.post<{
      success: boolean;
      direction: 'deposit' | 'withdrawal';
      amountMad: number;
      transaction: Transaction;
      bankWallet: Wallet;
      investmentWallet: Wallet;
    }>('/api/investments/wallet-transfer', payload, token),
  searchStocks: (q: string, token: string | null) =>
    apiClient.get<StockCatalogItem[]>(`/api/investments/stocks/search?q=${encodeURIComponent(q)}`, token),
  upsertStockPosition: (
    payload: {
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
    },
    token: string | null
  ) => apiClient.post<StockPosition>('/api/investments/positions', payload, token),
  updateStockPosition: (
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
    },
    token: string | null
  ) => apiClient.put<StockPosition>(`/api/investments/positions/${id}`, payload, token),
  deleteStockPosition: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/investments/positions/${id}`, token),
  executeStockOrder: (
    payload: {
      positionId?: string;
      ticker?: string;
      action: StockOrderAction;
      shares?: number;
      pricePerShare?: number;
      totalNativeAmount?: number;
      walletId?: string | null;
      syncWithWallet?: boolean;
      notes?: string;
    },
    token: string | null
  ) => apiClient.post<{ success: boolean; order: StockOrder }>('/api/investments/orders', payload, token),
  deleteStockOrder: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/investments/orders/${id}`, token),
  executePaydayAllocation: (
    payload: {
      walletId?: string | null;
      syncWithWallet?: boolean;
      allocations: { positionId: string; amountMad: number }[];
    },
    token: string | null
  ) => apiClient.post<{ success: boolean; executedCount: number }>('/api/investments/payday-allocate', payload, token),
  fundInvestmentWallet: (
    payload: {
      sourceWalletId?: string;
      destinationWalletId?: string;
      amountMad: number;
      notes?: string;
    },
    token: string | null
  ) => apiClient.post<{ success: boolean; transaction: Transaction; destinationWallet: Wallet }>('/api/investments/fund-wallet', payload, token),

  // AI Cycle Wrap-Up & Payday Retrospective (Report Card)
  getCycles: (token: string | null) =>
    apiClient.get<CyclePeriodSummary[]>('/api/reports/cycles', token),
  getCycleRetrospective: (
    params: { cycleId?: string; model?: string; forceRefresh?: boolean },
    token: string | null
  ) => {
    const query = new URLSearchParams();
    if (params.cycleId) query.set('cycleId', params.cycleId);
    if (params.model) query.set('model', params.model);
    if (params.forceRefresh) query.set('forceRefresh', 'true');
    return apiClient.get<CycleRetrospectiveData>(`/api/reports/cycle-retrospective?${query.toString()}`, token);
  },
  generateCycleRetrospective: (
    payload: { cycleId?: string; preferredModel?: string; allowFallback?: boolean; forceRefresh?: boolean },
    token: string | null
  ) =>
    apiClient.post<CycleRetrospectiveData>('/api/reports/cycle-retrospective/generate', payload, token),

  // User Management & Role-Based Access Control (RBAC)
  getAuthMe: (token: string | null) =>
    apiClient.get<{ user: User }>('/api/auth/me', token),
  getUsersAndRoles: (token: string | null) =>
    apiClient.get<{
      users: ManagedUser[];
      roles: RoleDefinition[];
      auditLogs: UserAuditLog[];
    }>('/api/users', token),
  createManagedUser: (
    payload: {
      username: string;
      displayName?: string;
      email: string;
      password: string;
      role?: UserRole;
      workspaceMode?: WorkspaceMode;
      permissions?: Partial<UserPermissions>;
      avatarColor?: string;
      notes?: string;
      salary?: number;
      payday?: number;
      emergencyBuffer?: number;
      seedDefaultWallets?: boolean;
    },
    token: string | null
  ) => apiClient.post<ManagedUser>('/api/users', payload, token),
  updateManagedUser: (
    id: string,
    payload: {
      username?: string;
      displayName?: string;
      email?: string;
      role?: UserRole;
      status?: UserStatus;
      workspaceMode?: WorkspaceMode;
      permissions?: Partial<UserPermissions>;
      avatarColor?: string;
      notes?: string | null;
      password?: string;
    },
    token: string | null
  ) => apiClient.put<ManagedUser>(`/api/users/${id}`, payload, token),
  deleteManagedUser: (id: string, token: string | null) =>
    apiClient.delete<{ deletedId: string }>(`/api/users/${id}`, token),
  impersonateManagedUser: (id: string, token: string | null) =>
    apiClient.post<{ token: string; user: User }>(`/api/users/${id}/impersonate`, {}, token),

  // Core Audit Recommendations (Items A - P)
  validateBackupSql: (sql: string, token: string | null) =>
    apiClient.post<BackupValidationPreview>('/api/settings/validate-backup', { sql }, token),
  getJournalAuditSummary: (token: string | null) =>
    apiClient.get<JournalAuditSummary>('/api/audit/journal', token),
  backfillJournalEntries: (token: string | null) =>
    apiClient.post<{ backfilledCount: number; skippedCount: number; summary: JournalAuditSummary }>(
      '/api/audit/journal/backfill',
      {},
      token
    ),
  getExchangeRates: (token: string | null) =>
    apiClient.get<ExchangeRateRecord[]>('/api/audit/fx-rates', token),
  upsertExchangeRate: (
    payload: { baseCurrency: string; quoteCurrency?: string; rate: number; effectiveDate?: string; source?: string },
    token: string | null
  ) => apiClient.post<ExchangeRateRecord>('/api/audit/fx-rates', payload, token),
  getStatementBatches: (token: string | null) =>
    apiClient.get<StatementBatchWithRows[]>('/api/audit/statements', token),
  importStatementBatch: (
    payload: {
      walletId: string;
      fileName: string;
      fileFormat?: string;
      rawContent: string;
      statementOpeningBalance?: number;
      statementClosingBalance?: number;
      columnMap?: { dateCol?: number; descCol?: number; amountCol?: number; currencyCol?: number; refCol?: number };
    },
    token: string | null
  ) =>
    apiClient.post<{
      batch: StatementBatchWithRows;
      rows: StatementBatchWithRows['rows'];
    }>('/api/audit/statements/import', payload, token),
  resolveStatementRow: (
    rowId: string,
    payload: { action: 'confirm_match' | 'create_transaction' | 'ignore'; linkedTransactionId?: string; category?: string },
    token: string | null
  ) => apiClient.post<StatementBatchWithRows['rows'][number]>(`/api/audit/statements/rows/${rowId}/resolve`, payload, token),
  getReviewInbox: (token: string | null, status?: string) =>
    apiClient.get<FinancialReviewItem[]>(`/api/audit/review-inbox${status ? `?status=${encodeURIComponent(status)}` : ''}`, token),
  createReviewItem: (payload: Record<string, unknown>, token: string | null) =>
    apiClient.post<FinancialReviewItem>('/api/audit/review-inbox', payload, token),
  decideReviewItem: (
    id: string,
    payload: {
      action: 'post_transaction' | 'link_existing' | 'reject' | 'mark_duplicate';
      linkedTransactionId?: string;
      walletId?: string;
      category?: string;
      amount?: number;
      description?: string;
      decisionNotes?: string;
    },
    token: string | null
  ) => apiClient.post<{ item: FinancialReviewItem; transaction: Transaction | null }>(`/api/audit/review-inbox/${id}/decide`, payload, token),
  getCommitmentOccurrences: (token: string | null) =>
    apiClient.get<CommitmentOccurrence[]>('/api/audit/occurrences', token),
  createRecurringIncomeCommitment: (
    payload: { title: string; expectedAmount: number; expectedDate: string; cadence?: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'once'; currency?: string },
    token: string | null
  ) => apiClient.post<CommitmentOccurrence>('/api/audit/occurrences/income', payload, token),
  settleCommitmentOccurrence: (
    id: string,
    payload: {
      action: 'pay' | 'partial' | 'skip' | 'reschedule' | 'renegotiate' | 'cancel';
      actualAmount?: number;
      actualDate?: string;
      newDate?: string;
      newAmount?: number;
      walletId?: string;
      linkedTransactionId?: string;
      isNonCashEvent?: boolean;
      reason?: string;
      varianceNotes?: string;
      notes?: string;
    },
    token: string | null
  ) =>
    apiClient.post<{
      occurrence: CommitmentOccurrence;
      transactionId: string | null;
    }>(`/api/audit/occurrences/${id}/settle`, payload, token),
  getGoalContributionEvents: (token: string | null, goalId?: string) =>
    apiClient.get<GoalContributionEvent[]>(`/api/audit/goal-events${goalId ? `?goalId=${encodeURIComponent(goalId)}` : ''}`, token),
  getSavedScenarios: (token: string | null) =>
    apiClient.get<SavedWhatIfScenario[]>('/api/audit/scenarios', token),
  saveScenario: (
    payload: {
      id?: string;
      name: string;
      description?: string;
      baselineSnapshot: Record<string, unknown>;
      events: unknown[];
      assumptions: Record<string, unknown>;
      projectedSummary: Record<string, unknown>;
      isApprovedPlan?: boolean;
    },
    token: string | null
  ) => apiClient.post<SavedWhatIfScenario>('/api/audit/scenarios', payload, token),
  deleteScenario: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/audit/scenarios/${id}`, token),
  getFinancialRules: (token: string | null) =>
    apiClient.get<{ rules: FinancialRuleItem[]; logs: FinancialRuleLogItem[] }>('/api/audit/rules', token),
  upsertFinancialRule: (payload: Record<string, unknown>, token: string | null) =>
    apiClient.post<FinancialRuleItem>('/api/audit/rules', payload, token),
  dryRunFinancialRule: (
    payload: {
      ruleId?: string;
      name?: string;
      triggerType: string;
      conditions: Record<string, unknown>;
      actionType: string;
      actionPayload?: Record<string, unknown>;
      approvalPolicy?: string;
      sampleEvent: Record<string, unknown>;
    },
    token: string | null
  ) =>
    apiClient.post<{
      matched: boolean;
      matchedConditions: string[];
      failedConditions: string[];
      triggerType: string;
      actionType: string;
      proposedResultSummary: string;
      requiresApproval: boolean;
      sideEffects: string;
    }>('/api/audit/rules/dry-run', payload, token),
  deleteFinancialRule: (id: string, token: string | null) =>
    apiClient.delete<{ deletedId: string }>(`/api/audit/rules/${id}`, token),
  getExternalWealthItems: (token: string | null) =>
    apiClient.get<{
      items: ExternalWealthItem[];
      totalExternalAssetsMad: number;
      totalExternalLiabilitiesMad: number;
      netExternalWealthMad: number;
    }>('/api/audit/external-wealth', token),
  upsertExternalWealthItem: (payload: Record<string, unknown>, token: string | null) =>
    apiClient.post<ExternalWealthItem>('/api/audit/external-wealth', payload, token),
  deleteExternalWealthItem: (id: string, token: string | null) =>
    apiClient.delete<{ deletedId: string }>(`/api/audit/external-wealth/${id}`, token),
  getFinancialPositionHistory: (token: string | null) =>
    apiClient.get<{ snapshots: FinancialPositionSnapshot[]; bridge: NetWorthChangeBridge | null }>(
      '/api/audit/position-history',
      token
    ),
  captureFinancialPositionSnapshot: (token: string | null) =>
    apiClient.post<FinancialPositionSnapshot>('/api/audit/position-snapshot', {}, token),
  getCounterparties: (token: string | null) =>
    apiClient.get<CounterpartyRecord[]>('/api/audit/counterparties', token),
  upsertCounterparty: (
    payload: {
      id?: string;
      canonicalName: string;
      counterpartyType?: string;
      aliases?: string[];
      defaultCategory?: string | null;
      notes?: string | null;
    },
    token: string | null
  ) => apiClient.post<CounterpartyRecord>('/api/audit/counterparties', payload, token),
  mergeCounterparties: (sourceId: string, targetId: string, token: string | null) =>
    apiClient.post<{ mergedIntoId: string; aliases: string[] }>(
      '/api/audit/counterparties/merge',
      { sourceId, targetId },
      token
    ),
  getFinancialIntegrityReport: (token: string | null) =>
    apiClient.get<FinancialIntegrityReport>('/api/audit/integrity-report', token),
  simulateAiActions: (actions: unknown[], token: string | null) =>
    apiClient.post<{ impact: AiActionImpactSimulation }>('/api/chat/simulate-actions', { actions }, token),
};

