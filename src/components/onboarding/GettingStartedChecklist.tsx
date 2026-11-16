import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  Compass,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import type { DashboardTab } from '../../types';

interface GettingStartedChecklistProps {
  onNavigateTab: (tab: DashboardTab) => void;
  onRelaunchWizard: () => void;
}

export const GettingStartedChecklist: React.FC<GettingStartedChecklistProps> = ({
  onNavigateTab,
  onRelaunchWizard,
}) => {
  const { onboarding, token, setOnboardingDirect } = useAuth();
  const [dismissing, setDismissing] = useState(false);

  if (!onboarding || !onboarding.shouldShowChecklist) {
    return null;
  }

  const pct =
    onboarding.totalCount > 0
      ? Math.round((onboarding.completedCount / onboarding.totalCount) * 100)
      : 0;

  const handleDismiss = async () => {
    if (!token) return;
    setDismissing(true);
    try {
      const res = await dashboardService.updateOnboardingState({ action: 'dismiss' }, token);
      if (res?.onboarding) setOnboardingDirect(res.onboarding);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/40 dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Compass className="h-4 w-4" />
            <span>Getting Started Checklist</span>
            <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
              · {onboarding.completedCount}/{onboarding.totalCount} complete ({pct}%)
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Track real setup milestones derived from your private workspace. Finish anytime or
            dismiss when you feel ready.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRelaunchWizard}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Guided Setup
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissing}
            title="Dismiss checklist (relaunch anytime in Settings)"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {onboarding.checklist.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.targetTab) onNavigateTab(item.targetTab);
            }}
            className={`group flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
              item.completed
                ? 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-700'
            }`}
          >
            {item.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`text-xs font-semibold ${
                  item.completed
                    ? 'text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-400/60'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {item.label}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                {item.description}
              </div>
            </div>
            {!item.completed && item.targetTab && (
              <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
