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
  ImpulseItem,
  ImpulseStats,
  FireProfile,
  ResilienceAudit,
  CustomStressSimulationResult,
} from '../../types';

export const dashboardService = {
  getResilienceAudit: (token: string | null) => apiClient.get<ResilienceAudit>('/api/resilience/audit', token),
  updateResilienceProfile: (payload: any, token: string | null) =>
    apiClient.put<ResilienceAudit>('/api/resilience/profile', payload, token),
  simulateCustomStress: (payload: any, token: string | null) =>
    apiClient.post<CustomStressSimulationResult>('/api/resilience/simulate', payload, token),
  getFireProfile: (token: string | null) => apiClient.get<FireProfile>('/api/fire-profile', token),
  updateFireProfile: (payload: Partial<FireProfile>, token: string | null) =>
    apiClient.put<FireProfile>('/api/fire-profile', payload, token),
  getImpulseItems: (token: string | null) => apiClient.get<ImpulseItem[]>('/api/impulse', token),
  getImpulseStats: (token: string | null) => apiClient.get<ImpulseStats>('/api/impulse/stats', token),
  createImpulseItem: (
    payload: {
      name: string;
      amount: number;
      currency?: string;
      category?: string;
      notes?: string;
      url?: string;
      triggers?: string[];
      urgencyScore?: number;
      utilityScore?: number;
      coolingHours?: number;
    },
    token: string | null
  ) => apiClient.post<ImpulseItem>('/api/impulse', payload, token),
  updateImpulseItem: (id: string, payload: Partial<ImpulseItem>, token: string | null) =>
    apiClient.put<ImpulseItem>(`/api/impulse/${id}`, payload, token),
  deleteImpulseItem: (id: string, token: string | null) =>
    apiClient.delete<{ success: boolean }>(`/api/impulse/${id}`, token),
  resolveImpulseItem: (
    id: string,
    payload: { decision: 'resisted' | 'purchased' | 'dismissed'; notes?: string; goalId?: string; walletId?: string },
    token: string | null
  ) => apiClient.post<ImpulseItem>(`/api/impulse/${id}/resolve`, payload, token),
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
