import { apiClient } from './apiClient';
import { KPI, Transaction, Debt, UserSettings } from '../../types';

export const dashboardService = {
  getKpis: (token: string | null) => apiClient.get<KPI>('/api/kpis', token),
  getTransactions: (token: string | null) => apiClient.get<Transaction[]>('/api/transactions', token),
  deleteTransaction: (id: string, token: string | null) =>
    apiClient.delete<{ message: string }>(`/api/transactions/${id}`, token),
  getDebts: (token: string | null) => apiClient.get<Debt[]>('/api/debts', token),
  settleDebt: (debtId: string, amount: number, token: string | null) =>
    apiClient.post<{ message: string }>('/api/debts', { debt_id: debtId, amount }, token),
  updateDebt: (debtId: string, payload: { amount: number; contact: string; type: string }, token: string | null) =>
    apiClient.put<{ message: string }>(`/api/debts/${debtId}`, payload, token),
  deleteDebt: (debtId: string, token: string | null) =>
    apiClient.delete<{ message: string }>(`/api/debts/${debtId}`, token),
  getSettings: (token: string | null) => apiClient.get<UserSettings>('/api/settings', token),
  updateSettings: (payload: { payday?: number; emergencyBuffer?: number }, token: string | null) =>
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
    a.download = `truespend_export_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  seedData: (token: string | null) => apiClient.post<{ success: boolean }>('/api/seed', {}, token),
};
