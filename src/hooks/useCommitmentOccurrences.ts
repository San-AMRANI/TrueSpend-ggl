import { useCallback, useState } from 'react';
import type { CommitmentOccurrence } from '../types';
import { dashboardService } from '../services/api/dashboardService';

export function useCommitmentOccurrences(token: string | null, onDataChange?: () => Promise<void> | void) {
  const [occurrences, setOccurrences] = useState<CommitmentOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return [];
    setLoading(true);
    setError(null);
    try {
      const list = await dashboardService.getCommitmentOccurrences(token);
      const normalized = Array.isArray(list) ? list : [];
      setOccurrences(normalized);
      return normalized;
    } catch (err: any) {
      setError(err?.message || 'Failed to load scheduled commitments');
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  const settleOccurrence = useCallback(
    async (
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
      }
    ) => {
      if (!token) return null;
      setBusyId(id);
      setError(null);
      try {
        const res = await dashboardService.settleCommitmentOccurrence(id, payload, token);
        await refresh();
        await onDataChange?.();
        return res;
      } catch (err: any) {
        setError(err?.message || 'Failed to settle commitment');
        throw err;
      } finally {
        setBusyId(null);
      }
    },
    [token, refresh, onDataChange]
  );

  const createRecurringIncome = useCallback(
    async (payload: {
      title: string;
      expectedAmount: number;
      expectedDate: string;
      cadence?: 'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'once';
      currency?: string;
    }) => {
      if (!token) return null;
      setLoading(true);
      setError(null);
      try {
        const created = await dashboardService.createRecurringIncomeCommitment(payload, token);
        await refresh();
        return created;
      } catch (err: any) {
        setError(err?.message || 'Failed to create recurring income commitment');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, refresh]
  );

  return {
    occurrences,
    setOccurrences,
    loading,
    busyId,
    error,
    setError,
    refresh,
    settleOccurrence,
    createRecurringIncome,
  };
}
