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
  seedData: (token: string | null) => apiClient.post<{ success: boolean }>('/api/seed', {}, token),
};
