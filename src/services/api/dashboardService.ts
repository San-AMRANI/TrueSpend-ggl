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
  DetectedSubscription,
  FinancialHomeResponse,
  FinancialPlan,
  FinancialProfile,
  InvestmentAccount,
  InvestmentAsset,
  InvestmentEvent,
  PortfolioSummary,
  PriceSnapshot,
  Recommendation,
  BudgetCategoryPreference,
} from '../../types';

export const dashboardService = {
  getFinancialHome: (token: string | null) => apiClient.get<FinancialHomeResponse>('/api/financial-home', token),
  getFinancialProfile: (token: string | null) => apiClient.get<{ profile: FinancialProfile; isComplete: boolean }>('/api/financial-profile', token),
  updateFinancialProfile: (payload: Partial<FinancialProfile>, token: string | null) => apiClient.put<FinancialProfile>('/api/financial-profile', payload, token),
  completeFinancialCheckup: (payload: Partial<FinancialProfile>, token: string | null) => apiClient.post<{ profile: FinancialProfile; completed: boolean }>('/api/financial-profile/checkup', payload, token),
  getBudgetCategoryPreferences: (token: string | null) => apiClient.get<BudgetCategoryPreference[]>('/api/budget-category-preferences', token),
  updateBudgetCategoryPreference: (payload: Pick<BudgetCategoryPreference, 'category' | 'classification' | 'isLocked' | 'neverAutoChange'>, token: string | null) =>
    apiClient.put<BudgetCategoryPreference>('/api/budget-category-preferences', payload, token),
  getFinancialPlans: (token: string | null) => apiClient.get<FinancialPlan[]>('/api/financial-plans', token),
  getFinancialPlan: (id: string, token: string | null) => apiClient.get<FinancialPlan>(`/api/financial-plans/${id}`, token),
  createFinancialPlanDraft: (payload: { incomeAmount: number; payrollId?: string; sourceTransactionId?: string; periodStart?: string; periodEnd?: string }, token: string | null) =>
    apiClient.post<FinancialPlan>('/api/financial-plans/draft', payload, token),
  updateFinancialPlan: (id: string, allocations: Array<{ id: string; amount?: string; name?: string; category?: string | null; goalId?: string | null; investmentAccountId?: string | null; sourceWalletId?: string | null; destinationWalletId?: string | null }>, token: string | null) =>
    apiClient.put<FinancialPlan>(`/api/financial-plans/${id}`, { allocations }, token),
  approveFinancialPlan: (id: string, payload: { allocationIds: string[]; sourceWalletId?: string; confirmWarnings?: string[] }, token: string | null) =>
    apiClient.post<FinancialPlan>(`/api/financial-plans/${id}/approve`, payload, token),
  replanFinancialPlan: (id: string, token: string | null) => apiClient.post<FinancialPlan>(`/api/financial-plans/${id}/replan`, {}, token),
  cancelFinancialPlan: (id: string, token: string | null) => apiClient.post<FinancialPlan>(`/api/financial-plans/${id}/cancel`, {}, token),
  getRecommendations: (token: string | null) => apiClient.get<Recommendation[]>('/api/recommendations', token),
  updateRecommendationStatus: (id: string, action: 'viewed' | 'dismiss' | 'snooze' | 'approve', payload: { until?: string } | undefined, token: string | null) =>
    apiClient.post<Recommendation>(`/api/recommendations/${id}/${action}`, payload || {}, token),
  getInvestmentAccounts: (token: string | null) => apiClient.get<InvestmentAccount[]>('/api/investment-accounts', token),
  createInvestmentAccount: (payload: Omit<InvestmentAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isArchived'>, token: string | null) =>
    apiClient.post<InvestmentAccount>('/api/investment-accounts', payload, token),
  updateInvestmentAccount: (id: string, payload: Partial<InvestmentAccount>, token: string | null) => apiClient.put<InvestmentAccount>(`/api/investment-accounts/${id}`, payload, token),
  archiveInvestmentAccount: (id: string, token: string | null) => apiClient.delete<InvestmentAccount>(`/api/investment-accounts/${id}`, token),
  fundInvestmentAccount: (id: string, payload: { sourceWalletId: string; amount: number; date?: string; note?: string }, token: string | null) =>
    apiClient.post<{ event: InvestmentEvent; transaction: Transaction }>(`/api/investment-accounts/${id}/fund`, payload, token),
  withdrawInvestmentAccount: (id: string, payload: { destinationWalletId: string; amount: number; date?: string; note?: string }, token: string | null) =>
    apiClient.post<{ event: InvestmentEvent; transaction: Transaction }>(`/api/investment-accounts/${id}/withdraw`, payload, token),
  getInvestmentAssets: (token: string | null) => apiClient.get<InvestmentAsset[]>('/api/investment-assets', token),
  createInvestmentAsset: (payload: Omit<InvestmentAsset, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isActive'>, token: string | null) =>
    apiClient.post<InvestmentAsset>('/api/investment-assets', payload, token),
  getInvestmentEvents: (token: string | null) => apiClient.get<InvestmentEvent[]>('/api/investment-events', token),
  createInvestmentEvent: (payload: { investmentAccountId: string; assetId?: string | null; type: InvestmentEvent['type']; tradeDate?: string; units?: number; unitPrice?: number; quoteCurrency?: string; grossAmount: number; feeAmount?: number; feeCurrency?: string; exchangeRateToBase?: number; notes?: string }, token: string | null) =>
    apiClient.post<InvestmentEvent>('/api/investment-events', payload, token),
  createInvestmentEventCorrection: (id: string, payload: { grossAmount: number; notes?: string }, token: string | null) => apiClient.post<InvestmentEvent>(`/api/investment-events/${id}/correct`, payload, token),
  getPortfolio: (token: string | null) => apiClient.get<PortfolioSummary>('/api/portfolio', token),
  recordManualPrice: (payload: { assetId: string; price: number; currency: string; capturedAt?: string }, token: string | null) => apiClient.post<PriceSnapshot>('/api/portfolio/prices', payload, token),
  refreshPortfolioPrices: (token: string | null) => apiClient.post<{ refreshed: number; stale: boolean; message: string }>('/api/market-data/prices/refresh', {}, token),
  searchCryptoAssets: (query: string, token: string | null) => apiClient.get<Array<{ id: string; name: string; symbol: string; marketCapRank: number | null; image: string | null }>>(`/api/market-data/assets/search?q=${encodeURIComponent(query)}`, token),
  getSubscriptions: (token: string | null) => apiClient.get<Subscription[]>('/api/subscriptions', token),
  createSubscription: (payload: Partial<Subscription>, token: string | null) =>
    apiClient.post<Subscription>('/api/subscriptions', payload, token),
  updateSubscription: (id: string, payload: Partial<Subscription>, token: string | null) =>
    apiClient.put<Subscription>(`/api/subscriptions/${id}`, payload, token),
  deleteSubscription: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/subscriptions/${id}`, token),
  paySubscription: (id: string, payload: { walletId?: string; date?: string }, token: string | null) =>
    apiClient.post<{ subscription: Subscription; transaction: Transaction }>(`/api/subscriptions/${id}/pay`, payload, token),
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
  createWallet: (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: number }, token: string | null) =>
    apiClient.post<Wallet>('/api/wallets', payload, token),
  updateWallet: (id: string, payload: { name?: string; type?: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: number }, token: string | null) =>
    apiClient.put<Wallet>(`/api/wallets/${id}`, payload, token),
  deleteWallet: (id: string, reassignToWalletId: string | undefined, token: string | null) =>
    apiClient.delete<{ success: boolean; message: string }>(`/api/wallets/${id}${reassignToWalletId ? `?reassignTo=${reassignToWalletId}` : ''}`, token),
  getTransactions: (token: string | null) => apiClient.get<Transaction[]>('/api/transactions', token),
  createTransaction: (payload: Record<string, unknown>, token: string | null) =>
    apiClient.post<{ message: string; transaction: Transaction }>('/api/transactions', payload, token),
  getPayrolls: (token: string | null) => apiClient.get<Payroll[]>('/api/payrolls', token),
  createPayroll: (payload: { scheduledFor: string; amount: number }, token: string | null) =>
    apiClient.post<Payroll>('/api/payrolls', payload, token),
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
  getDebts: (token: string | null) => apiClient.get<Debt[]>('/api/debts', token),
  settleDebt: (debtId: string, amount: number, token: string | null, category?: string, walletId?: string) =>
    apiClient.post<{ message: string }>('/api/debts', { debt_id: debtId, amount, category, walletId }, token),
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
};
