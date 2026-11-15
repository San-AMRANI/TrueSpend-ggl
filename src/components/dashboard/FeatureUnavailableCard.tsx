import React, { useState } from 'react';
import { Compass, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import type { DashboardTab } from '../../types';

interface FeatureUnavailableCardProps {
  title: string;
  description: string;
  targetTab?: DashboardTab;
  onReturnOverview: () => void;
  onSwitched?: (targetTab?: DashboardTab) => void;
}

export const FeatureUnavailableCard: React.FC<FeatureUnavailableCardProps> = ({
  title,
  description,
  targetTab,
  onReturnOverview,
  onSwitched,
}) => {
  const { switchExperienceTier } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState('');

  const handleEnableAdvanced = async () => {
    setError('');
    setIsSwitching(true);
    try {
      await switchExperienceTier('advanced');
      onSwitched?.(targetTab);
    } catch (err: any) {
      setError(err?.message || 'Could not switch experience mode.');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl my-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm text-center space-y-5">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        <Compass className="h-6 w-6" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          <Sparkles className="h-3 w-3" />
          Advanced Experience · Free
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          {description} Your workspace is currently set to the streamlined{' '}
          <strong>Basic</strong> experience. Switch to <strong>Advanced</strong> at any time —
          both Basic and Advanced are completely free, and your data is always preserved.
        </p>
      </div>

      <div className="rounded-xl bg-gray-50 dark:bg-gray-950/50 border border-gray-200/70 dark:border-gray-800 p-4 text-left text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Instant free switch — no cost, trials, or restrictions</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Return to Basic anytime in Settings → Experience</span>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
        <Button onClick={handleEnableAdvanced} disabled={isSwitching} className="w-full sm:w-auto">
          {isSwitching ? 'Switching to Advanced...' : 'Switch to Advanced Experience (Free)'}
        </Button>
        <Button
          variant="outline"
          onClick={onReturnOverview}
          className="w-full sm:w-auto inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Overview
        </Button>
      </div>
    </div>
  );
};
