import { useCallback, useState } from 'react';
import type { GoalContributionEvent } from '../types';
import { dashboardService } from '../services/api/dashboardService';

export function useGoalEvents(token: string | null) {
  const [eventsByGoal, setEventsByGoal] = useState<Record<string, GoalContributionEvent[]>>({});
  const [loadingGoalId, setLoadingGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchEventsForGoal = useCallback(
    async (goalId: string) => {
      if (!token || !goalId) return [];
      setLoadingGoalId(goalId);
      setError(null);
      try {
        const list = await dashboardService.getGoalContributionEvents(token, goalId);
        const normalized = Array.isArray(list) ? list : [];
        setEventsByGoal((prev) => ({ ...prev, [goalId]: normalized }));
        return normalized;
      } catch (err: any) {
        setError(err?.message || 'Failed to load goal contribution history');
        return [];
      } finally {
        setLoadingGoalId(null);
      }
    },
    [token]
  );

  return {
    eventsByGoal,
    loadingGoalId,
    error,
    fetchEventsForGoal,
  };
}
