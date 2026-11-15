import { useCallback, useState } from 'react';
import type { FinancialRuleItem, FinancialRuleLogItem } from '../types';
import { dashboardService } from '../services/api/dashboardService';

export function useFinancialRules(token: string | null) {
  const [rules, setRules] = useState<FinancialRuleItem[]>([]);
  const [logs, setLogs] = useState<FinancialRuleLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardService.getFinancialRules(token);
      setRules(Array.isArray(res?.rules) ? res.rules : []);
      setLogs(Array.isArray(res?.logs) ? res.logs : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load automated financial rules');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const upsertRule = useCallback(
    async (payload: {
      id?: string;
      name: string;
      enabled?: boolean;
      triggerType: string;
      conditions: Record<string, unknown>;
      actionType: string;
      actionPayload: Record<string, unknown>;
      approvalPolicy?: string;
    }) => {
      if (!token) return null;
      setSaving(true);
      setError(null);
      try {
        const res = await dashboardService.upsertFinancialRule(payload, token);
        await refresh();
        return res;
      } catch (err: any) {
        setError(err?.message || 'Failed to save financial rule');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token, refresh]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      if (!token) return;
      setError(null);
      try {
        await dashboardService.deleteFinancialRule(id, token);
        setRules((prev) => prev.filter((r) => r.id !== id));
      } catch (err: any) {
        setError(err?.message || 'Failed to delete financial rule');
        throw err;
      }
    },
    [token]
  );

  const dryRunRule = useCallback(
    async (payload: {
      ruleId?: string;
      name?: string;
      triggerType: string;
      conditions: Record<string, unknown>;
      actionType: string;
      actionPayload?: Record<string, unknown>;
      approvalPolicy?: string;
      sampleEvent: Record<string, unknown>;
    }) => {
      if (!token) return null;
      return await dashboardService.dryRunFinancialRule(payload, token);
    },
    [token]
  );

  return {
    rules,
    logs,
    loading,
    saving,
    error,
    setError,
    refresh,
    upsertRule,
    deleteRule,
    dryRunRule,
  };
}
