import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, AlertTriangle, TrendingUp, Camera, Bot } from 'lucide-react';
import { KPI, DashboardTab } from '../../types';

interface SpexAiPulseBannerProps {
  kpis: KPI | null;
  setActiveTab: (tab: DashboardTab) => void;
  onSendPrompt?: (prompt: string) => void;
}

export const SpexAiPulseBanner: React.FC<SpexAiPulseBannerProps> = ({
  kpis,
  setActiveTab,
  onSendPrompt,
}) => {
  const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png`;

  // Compute live diagnostic summary
  const safeToSpend = kpis?.safeToSpend ?? 0;
  const dailyRemaining = kpis?.dailyRemaining ?? 0;
  const daysUntilPayday = kpis?.daysUntilPayday ?? 0;
  const forecastExpected = kpis?.forecast?.expected ?? 0;
  const dailyStatus = kpis?.dailyStatus || 'on_track';

  let tone: 'positive' | 'warning' | 'alert' = 'positive';
  let headline = `Finances on track with ${safeToSpend.toFixed(0)} MAD safe to spend.`;
  let subtext = `${daysUntilPayday} days until payday. Daily allowance remaining: ${dailyRemaining.toFixed(0)} MAD.`;

  if (forecastExpected < 0) {
    tone = 'alert';
    headline = `Forecast Alert: Potential ${Math.abs(forecastExpected).toFixed(0)} MAD shortfall before payday.`;
    subtext = 'Spex can analyze your biggest discretionary categories and suggest cuts.';
  } else if (dailyStatus === 'critical') {
    tone = 'warning';
    headline = `Daily allowance reached: ${kpis?.dailySpent.toFixed(0)} MAD spent today.`;
    subtext = 'Pacing your remaining days will protect your emergency cushion.';
  } else if (safeToSpend < (kpis?.emergencyBuffer ?? 0)) {
    tone = 'warning';
    headline = 'Liquidity is approaching your emergency safety buffer.';
    subtext = 'Simulate your remaining burn rate with Spex before major purchases.';
  }

  const handleAction = (prompt: string) => {
    setActiveTab('chat');
    // Dispatch custom event to auto-populate and send in AIChat
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('truespend:sendChatPrompt', { detail: { prompt } }));
    }, 100);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-4.5 transition-all shadow-xs ${
      tone === 'alert'
        ? 'border-rose-200/80 bg-gradient-to-r from-rose-50/90 via-orange-50/50 to-white dark:border-rose-900/60 dark:from-rose-950/30 dark:via-gray-900 dark:to-gray-900'
        : tone === 'warning'
        ? 'border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-yellow-50/50 to-white dark:border-amber-900/60 dark:from-amber-950/30 dark:via-gray-900 dark:to-gray-900'
        : 'border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-white dark:border-indigo-900/40 dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Spex Avatar & Headline */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 p-1.5 shadow-sm flex items-center justify-center">
              <img src={appIconSrc} alt="Spex" className="h-full w-full object-contain drop-shadow-sm" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white ring-2 ring-white dark:ring-gray-900 shadow-xs">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                Spex AI Financial Pulse
              </span>
              <span className="rounded-full bg-indigo-100/80 dark:bg-indigo-900/50 px-2 py-0.2 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 leading-snug">
              {headline}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {subtext}
            </p>
          </div>
        </div>

        {/* Right: Quick Launch Chips */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => handleAction('Run a complete financial health audit and cash flow checkup')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Audit Health
          </button>

          <button
            type="button"
            onClick={() => handleAction('What can I safely spend today, and what is my daily allowance breakdown?')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 shadow-xs hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Check Allowance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
            Chat with Spex
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
