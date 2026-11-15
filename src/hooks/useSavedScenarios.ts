import { useCallback, useMemo, useState } from 'react';
import type { SavedWhatIfScenario } from '../types';
import { dashboardService } from '../services/api/dashboardService';
import { parseSavedScenario, type ParsedScenarioData } from '../lib/auditContracts';

export function useSavedScenarios(token: string | null) {
  const [scenarios, setScenarios] = useState<SavedWhatIfScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return [];
    setLoading(true);
    setError(null);
    try {
      const list = await dashboardService.getSavedScenarios(token);
      const normalized = Array.isArray(list) ? list : [];
      setScenarios(normalized);
      return normalized;
    } catch (err: any) {
      setError(err?.message || 'Failed to load saved scenarios');
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  const parsedScenarios: ParsedScenarioData[] = useMemo(
    () => scenarios.map(parseSavedScenario),
    [scenarios]
  );

  const saveScenario = useCallback(
    async (payload: {
      id?: string;
      name: string;
      description?: string;
      baselineSnapshot: Record<string, unknown>;
      events: unknown[];
      assumptions: Record<string, unknown>;
      projectedSummary: Record<string, unknown>;
      isApprovedPlan?: boolean;
    }) => {
      if (!token) return null;
      setSaving(true);
      setError(null);
      try {
        const saved = await dashboardService.saveScenario(payload, token);
        await refresh();
        return saved;
      } catch (err: any) {
        setError(err?.message || 'Failed to save scenario');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [token, refresh]
  );

  const removeScenario = useCallback(
    async (id: string) => {
      if (!token) return;
      setError(null);
      try {
        await dashboardService.deleteScenario(id, token);
        setScenarios((prev) => prev.filter((s) => s.id !== id));
      } catch (err: any) {
        setError(err?.message || 'Failed to delete scenario');
        throw err;
      }
    },
    [token]
  );

  return {
    scenarios,
    parsedScenarios,
    loading,
    saving,
    error,
    setError,
    refresh,
    saveScenario,
    removeScenario,
  };
}
