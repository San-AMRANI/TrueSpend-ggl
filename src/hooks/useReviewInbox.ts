import { useCallback, useState } from 'react';
import type { FinancialReviewItem } from '../types';
import { dashboardService } from '../services/api/dashboardService';
import { buildReviewDecisionPayload } from '../lib/auditContracts';

export function useReviewInbox(token: string | null, onDataChange?: () => Promise<void> | void) {
  const [items, setItems] = useState<FinancialReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (statusFilter?: string) => {
    if (!token) return [];
    setLoading(true);
    setError(null);
    try {
      const list = await dashboardService.getReviewInbox(token, statusFilter);
      const normalized = Array.isArray(list) ? list : [];
      setItems(normalized);
      return normalized;
    } catch (err: any) {
      setError(err?.message || 'Failed to load review inbox');
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  const decideItem = useCallback(
    async (
      id: string,
      input: {
        action: 'post_transaction' | 'link_existing' | 'reject' | 'mark_duplicate';
        walletId?: string;
        category?: string;
        amount?: number;
        description?: string;
        linkedTransactionId?: string;
        decisionNotes?: string;
      }
    ) => {
      if (!token) return null;
      setBusyId(id);
      setError(null);
      try {
        const payload = buildReviewDecisionPayload(input);
        const res = await dashboardService.decideReviewItem(id, payload, token);
        await refresh();
        if (input.action === 'post_transaction' || input.action === 'link_existing') {
          await onDataChange?.();
        }
        return res;
      } catch (err: any) {
        setError(err?.message || 'Failed to process review decision');
        throw err;
      } finally {
        setBusyId(null);
      }
    },
    [token, refresh, onDataChange]
  );

  return {
    items,
    setItems,
    loading,
    busyId,
    error,
    setError,
    refresh,
    decideItem,
  };
}
