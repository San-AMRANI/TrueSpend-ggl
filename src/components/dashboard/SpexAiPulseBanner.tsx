import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, AlertTriangle, TrendingUp, Camera, Bot } from 'lucide-react';
import { KPI, DashboardTab } from '../../types';
import { SpexAvatar } from '../common/SpexAvatar';

interface SpexAiPulseBannerProps {
  kpis: KPI | null;
  setActiveTab: (tab: DashboardTab) => void;
  onSendPrompt?: (prompt: string) => void;
  isPrivacyMode?: boolean;
}

export const SpexAiPulseBanner: React.FC<SpexAiPulseBannerProps> = ({
  kpis,
  setActiveTab,
  isPrivacyMode = false,
}) => {
  // Compute live diagnostic summary
  const safeToSpend = kpis?.safeToSpend ?? 0;
  const dailyRemaining = kpis?.dailyRemaining ?? 0;
  const daysUntilPayday = kpis?.daysUntilPayday ?? 0;
  const forecastExpected = kpis?.forecast?.expected ?? 0;
  const dailyStatus = kpis?.dailyStatus || 'on_track';

  const fmt = (val: number) => (isPrivacyMode ? '••••' : val.toFixed(0));

  let tone: 'positive' | 'warning' | 'alert' = 'positive';
  let headline = `Finances on track with ${fmt(safeToSpend)} MAD safe to spend.`;
  let subtext = `${daysUntilPayday} days until payday · Daily allowance remaining: ${fmt(dailyRemaining)} MAD.`;

  if (forecastExpected < 0) {
    tone = 'alert';
    headline = `Forecast Alert: Potential ${fmt(Math.abs(forecastExpected))} MAD shortfall before payday.`;
    subtext = 'Analyze your top discretionary categories and run a recovery simulation.';
  } else if (dailyStatus === 'critical') {
    tone = 'warning';
    headline = `Daily allowance reached: ${fmt(kpis?.dailySpent ?? 0)} MAD spent today.`;
    subtext = 'Pacing your remaining days will protect your emergency cushion.';
  } else if (safeToSpend < (kpis?.emergencyBuffer ?? 0)) {
    tone = 'warning';
    headline = 'Liquidity is approaching your emergency safety buffer.';
    subtext = 'Review your remaining daily burn before scheduling non-essential purchases.';
  }

  const handleAction = (prompt: string) => {
    setActiveTab('chat');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('truespend:sendChatPrompt', { detail: { prompt } }));
    }, 100);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-colors ${
        tone === 'alert'
          ? 'border-rose-200/90 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
          : tone === 'warning'
          ? 'border-amber-200/90 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Spex Avatar & Headline */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative flex-shrink-0">
            <SpexAvatar
              className="h-12 w-12"
              animated
              clickable
              lookAtCursor
              state={tone === 'alert' ? 'failed' : tone === 'warning' ? 'review' : 'idle'}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Daily Financial Pulse
              </span>
              <span className="text-gray-300 dark:text-gray-700" aria-hidden="true">·</span>
              <span className="text-[11px] font-medium tabular-nums text-gray-500 dark:text-gray-400">
                {daysUntilPayday}d to payday
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 leading-snug truncate sm:whitespace-normal">
              {headline}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate sm:whitespace-normal">
              {subtext}
            </p>
          </div>
        </div>

        {/* Right: Quick Launch Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleAction('Run a complete financial health audit and cash flow checkup')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Audit Health
          </button>

          <button
            type="button"
            onClick={() => handleAction('What can I safely spend today, and what is my daily allowance breakdown?')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Check Allowance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Bot className="h-3.5 w-3.5" />
            Ask Spex
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
