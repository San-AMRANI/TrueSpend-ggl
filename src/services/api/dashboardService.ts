import { apiClient } from './apiClient';
import { CategoryBudget, KPI, Transaction, Debt, UserSettings } from '../../types';

export const dashboardService = {
  getKpis: (token: string | null) => apiClient.get<KPI>('/api/kpis', token),
  getTransactions: (token: string | null) => apiClient.get<Transaction[]>('/api/transactions', token),
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
  deleteCategoryBudget: (id: string, token: string | null) =>
    apiClient.delete<CategoryBudget>(`/api/category-budgets/${id}`, token),
  getDebts: (token: string | null) => apiClient.get<Debt[]>('/api/debts', token),
  settleDebt: (debtId: string, amount: number, token: string | null, category?: string) =>
    apiClient.post<{ message: string }>('/api/debts', { debt_id: debtId, amount, category }, token),
  updateDebt: (debtId: string, payload: { amount: number; contact: string; type: string }, token: string | null) =>
    apiClient.put<{ message: string }>(`/api/debts/${debtId}`, payload, token),
  deleteDebt: (debtId: string, token: string | null) =>
    apiClient.delete<{ message: string }>(`/api/debts/${debtId}`, token),
  getSettings: (token: string | null) => apiClient.get<UserSettings>('/api/settings', token),
  updateSettings: (payload: { payday?: number; emergencyBuffer?: number; salary?: number }, token: string | null) =>
    apiClient.post<{ success: boolean; payday?: number; emergencyBuffer?: number }>('/api/settings', payload, token),
  exportSql: async (token: string | null) => {
    const response = await fetch('/api/settings/export-sql', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
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
