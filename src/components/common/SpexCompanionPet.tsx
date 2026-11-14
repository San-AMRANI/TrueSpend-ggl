import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Compass,
  Minimize2,
  Play,
  Pause,
  X,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  SpexSprite,
  SPEX_ANIMATION_STATES,
  type SpexAnimationState,
  type LookDirectionSpec,
} from './SpexSprite';
import { useTheme } from '../../context/ThemeContext';
import { usePrivacy } from '../../context/PrivacyContext';
import type { DashboardTab, KPI } from '../../types';

const PET_STORAGE_KEY = 'truespend_spex_companion_mode_v1';

type PetDisplayMode = 'perched' | 'roaming' | 'minimized';

interface SpexCompanionPetProps {
  activeTab: DashboardTab;
  kpis?: KPI | null;
  onOpenChat: () => void;
}

const TAB_REACTIONS: Partial<
  Record<DashboardTab, { state: SpexAnimationState; message: string }>
> = {
  accounts: {
    state: 'review',
    message: 'Inspecting wallet balances, FX rates & double-entry integrity.',
  },
  transactions: {
    state: 'review',
    message: 'Tracking expenses, splits & net reimbursements.',
  },
  calendar: {
    state: 'waiting',
    message: 'Monitoring payroll dates & 14-day commitment due dates.',
  },
  subscriptions: {
    state: 'review',
    message: 'Auditing recurring renewals, upgrades & unused passes.',
  },
  investments: {
    state: 'running',
    message: 'Tracking your live Binance & equity positions.',
  },
  forecast: {
    state: 'review',
    message: 'Projecting your 90-day cash flow & runway scenarios.',
  },
  budgets: {
    state: 'review',
    message: 'Checking category burn caps & 50/30/20 pace.',
  },
  goals: {
    state: 'jumping',
    message: 'Every contribution brings your goals closer.',
  },
  debts: {
    state: 'review',
    message: 'Watching pending receivables & debt payoff schedules.',
  },
  calculators: {
    state: 'waiting',
    message: 'Ready to simulate What-If scenarios with you.',
  },
};

export const SpexCompanionPet: React.FC<SpexCompanionPetProps> = ({
  activeTab,
  kpis,
  onOpenChat,
}) => {
  const [mode, setMode] = useState<PetDisplayMode>(() => {
    if (typeof window === 'undefined') return 'perched';
    const saved = localStorage.getItem(PET_STORAGE_KEY);
    if (saved === 'perched' || saved === 'roaming' || saved === 'minimized') {
      return saved;
    }
    return 'perched';
  });

  const [animState, setAnimState] = useState<SpexAnimationState>('idle');
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lookSpec, setLookSpec] = useState<LookDirectionSpec | null>(null);
  const { desktopNavLayout, sidebarCollapsed } = useTheme();
  const { isPrivacyMode } = usePrivacy();
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktopViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const sidebarSideOffsetPx =
    isDesktopViewport && desktopNavLayout === 'side' ? (sidebarCollapsed ? 92 : 272) : 16;
  const roamMinVw = isDesktopViewport && desktopNavLayout === 'side' ? (sidebarCollapsed ? 8 : 20) : 4;

  // Live Financial Pulse Diagnostic (migrated from the removed Overview AI Pulse Banner)
  const pulse = useMemo(() => {
    const safeToSpend = kpis?.safeToSpend ?? 0;
    const dailyRemaining = kpis?.dailyRemaining ?? 0;
    const daysUntilPayday = kpis?.daysUntilPayday ?? 0;
    const forecastExpected = kpis?.forecast?.expected ?? 0;
    const dailyStatus = kpis?.dailyStatus || 'on_track';
    const fmt = (val: number) => (isPrivacyMode ? '••••' : val.toFixed(0));

    let tone: 'positive' | 'warning' | 'alert' = 'positive';
    let state: SpexAnimationState = 'waving';
    let headline = `Finances on track: ${fmt(safeToSpend)} MAD safe to spend.`;
    let subtext = `${daysUntilPayday}d to payday · Daily allowance left: ${fmt(dailyRemaining)} MAD.`;

    if (!kpis) {
      return {
        tone: 'positive' as const,
        state: 'idle' as SpexAnimationState,
        headline: 'SPEX AI Companion ready across your workspace.',
        subtext: 'Click me anytime for health audits, allowance checks, or What-If scenarios.',
      };
    }

    if (forecastExpected < 0) {
      tone = 'alert';
      state = 'failed';
      headline = `Forecast Alert: Potential ${fmt(Math.abs(forecastExpected))} MAD shortfall before payday.`;
      subtext = 'Tap Audit Health to identify top discretionary cuts.';
    } else if (dailyStatus === 'critical') {
      tone = 'warning';
      state = 'review';
      headline = `Daily allowance reached: ${fmt(kpis.dailySpent ?? 0)} MAD spent today.`;
      subtext = 'Pacing remaining days will protect your emergency buffer.';
    } else if (safeToSpend < (kpis.emergencyBuffer ?? 0)) {
      tone = 'warning';
      state = 'review';
      headline = 'Liquidity is approaching your emergency safety buffer.';
      subtext = `${fmt(dailyRemaining)} MAD/day remaining · Simulate before major purchases.`;
    }

    return { tone, state, headline, subtext };
  }, [kpis, isPrivacyMode]);

  // Horizontal roaming state (percentage of viewport width)
  const [roamX, setRoamX] = useState<number>(6);
  const roamDirRef = useRef<1 | -1>(1);
  const roamPauseRef = useRef<boolean>(false);
  const reactionTimeoutRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const lastTabRef = useRef<DashboardTab | null>(null);

  const updateMode = useCallback((nextMode: PetDisplayMode) => {
    setMode(nextMode);
    try {
      localStorage.setItem(PET_STORAGE_KEY, nextMode);
    } catch {}
  }, []);

  const triggerReaction = useCallback(
    (nextState: SpexAnimationState, message?: string, durationMs = 3400) => {
      setAnimState(nextState);
      if (reactionTimeoutRef.current) {
        window.clearTimeout(reactionTimeoutRef.current);
      }
      reactionTimeoutRef.current = window.setTimeout(() => {
        setAnimState(
          mode === 'roaming'
            ? roamDirRef.current === 1
              ? 'running-right'
              : 'running-left'
            : 'idle',
        );
      }, durationMs);

      if (message) {
        setSpeechBubble(message);
        if (speechTimeoutRef.current) {
          window.clearTimeout(speechTimeoutRef.current);
        }
        speechTimeoutRef.current = window.setTimeout(() => {
          setSpeechBubble(null);
        }, durationMs + 2200);
      }
    },
    [mode],
  );

  // React to tab changes with live financial pulse on Overview & contextual hints elsewhere
  useEffect(() => {
    if (mode === 'minimized' || activeTab === 'chat') return;
    if (lastTabRef.current === activeTab) return;
    lastTabRef.current = activeTab;

    if (activeTab === 'overview') {
      triggerReaction(pulse.state, pulse.headline, 3600);
      return;
    }

    const reaction = TAB_REACTIONS[activeTab];
    if (reaction) {
      triggerReaction(reaction.state, reaction.message, 2800);
    }
  }, [activeTab, mode, pulse.headline, pulse.state, triggerReaction]);

  // Also surface a hint whenever an alert/warning state triggers while perched
  useEffect(() => {
    if (mode === 'minimized' || activeTab === 'chat' || !kpis) return;
    if (pulse.tone === 'alert' || pulse.tone === 'warning') {
      const timer = window.setTimeout(() => {
        triggerReaction(pulse.state, pulse.headline, 4000);
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [pulse.tone, pulse.headline, pulse.state, mode, activeTab, kpis, triggerReaction]);

  // Listen to global app toast events & custom Spex reaction events
  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.type === 'success') {
        triggerReaction('jumping', detail.message || 'Awesome! Balances updated!', 2800);
      } else if (detail.type === 'error') {
        triggerReaction('failed', detail.message || 'Uh oh, let us check that!', 3000);
      } else {
        triggerReaction('waving', detail.message, 2400);
      }
    };

    const handleCustomReaction = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.state) {
        triggerReaction(detail.state, detail.message, detail.duration || 3000);
      }
    };

    const handleTogglePet = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.forceOpen) {
        updateMode('perched');
        setIsMenuOpen(true);
        triggerReaction('jumping', pulse.headline, 2800);
      } else {
        updateMode(mode === 'minimized' ? 'perched' : 'minimized');
      }
    };

    window.addEventListener('truespend:toast', handleToast);
    window.addEventListener('truespend:spexReaction', handleCustomReaction);
    window.addEventListener('truespend:toggleSpexPet', handleTogglePet);
    return () => {
      window.removeEventListener('truespend:toast', handleToast);
      window.removeEventListener('truespend:spexReaction', handleCustomReaction);
      window.removeEventListener('truespend:toggleSpexPet', handleTogglePet);
    };
  }, [mode, pulse.headline, triggerReaction, updateMode]);

  // Roaming flight loop
  useEffect(() => {
    if (mode !== 'roaming') {
      roamPauseRef.current = false;
      return;
    }

    setAnimState(roamDirRef.current === 1 ? 'running-right' : 'running-left');

    const stepInterval = window.setInterval(() => {
      if (roamPauseRef.current || isMenuOpen) return;

      setRoamX((prev) => {
        const step = roamDirRef.current * 0.45;
        let next = prev + step;

        if (next >= 76) {
          next = 76;
          roamDirRef.current = -1;
          setAnimState('running-left');
        } else if (next <= roamMinVw) {
          next = roamMinVw;
          roamDirRef.current = 1;
          setAnimState('running-right');
        } else if (Math.random() < 0.008) {
          roamPauseRef.current = true;
          const midStates: SpexAnimationState[] = ['waving', 'jumping', 'review'];
          const pick = midStates[Math.floor(Math.random() * midStates.length)];
          setAnimState(pick);
          window.setTimeout(() => {
            roamPauseRef.current = false;
            setAnimState(roamDirRef.current === 1 ? 'running-right' : 'running-left');
          }, 1800);
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(stepInterval);
  }, [mode, isMenuOpen, roamMinVw]);

  // Hide completely on the AI Chat page
  if (activeTab === 'chat') {
    return null;
  }

  const handleLaunchPrompt = (prompt: string) => {
    setIsMenuOpen(false);
    setSpeechBubble(null);
    onOpenChat();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('truespend:sendChatPrompt', { detail: { prompt } }));
    }, 100);
  };

  // Minimized Dock Pill
  if (mode === 'minimized') {
    return (
      <button
        type="button"
        onClick={() => {
          updateMode('perched');
          triggerReaction(pulse.state, pulse.headline, 3400);
        }}
        style={{ left: `${sidebarSideOffsetPx}px` }}
        className="fixed bottom-20 md:bottom-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 shadow-lg backdrop-blur-md hover:scale-105 transition-all group cursor-pointer"
        title={pulse.headline}
      >
        <div className="relative">
          <SpexSprite state="idle" className="w-6 h-6" />
          {pulse.tone !== 'positive' && (
            <span
              className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                pulse.tone === 'alert' ? 'bg-rose-500' : 'bg-amber-500'
              }`}
            />
          )}
        </div>
        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 pr-1">
          Spex AI
        </span>
      </button>
    );
  }

  const QUICK_ACTIONS: { id: SpexAnimationState; label: string; msg: string }[] = [
    { id: 'waving', label: 'Wave', msg: pulse.headline },
    { id: 'jumping', label: 'Pulse', msg: pulse.subtext },
    { id: 'running', label: 'Dance', msg: 'Computing 360° portfolio & budget vectors!' },
    { id: 'review', label: 'Audit', msg: 'Inspecting subscriptions & wallet balances…' },
    { id: 'waiting', label: 'Wait', msg: 'Listening! Click Ask Spex to start a chat.' },
    { id: 'look', label: '16° Gaze', msg: 'Move your cursor around—I track all 16 angles!' },
  ];

  return (
    <div
      className="fixed bottom-20 md:bottom-4 z-40 select-none transition-[left] duration-200"
      style={{
        left: mode === 'roaming' ? `${Math.max(roamMinVw, roamX)}vw` : `${sidebarSideOffsetPx}px`,
      }}
    >
      {/* Interactive AI Pulse + Companion Controls Popover */}
      {isMenuOpen && (
        <div className="mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white/98 dark:bg-gray-900/98 border border-gray-200 dark:border-gray-700 shadow-2xl p-3.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                Spex AI Assistant
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  updateMode('minimized');
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                title="Minimize companion"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                title="Close panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Financial Pulse Hint Card */}
          <div
            className={`rounded-xl border p-2.5 mb-2.5 ${
              pulse.tone === 'alert'
                ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30'
                : pulse.tone === 'warning'
                ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
                : 'border-indigo-200/70 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/25'
            }`}
          >
            <div className="flex items-start gap-2">
              {pulse.tone !== 'positive' ? (
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    pulse.tone === 'alert' ? 'text-rose-500' : 'text-amber-500'
                  }`}
                />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">
                  {pulse.headline}
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5 leading-snug">
                  {pulse.subtext}
                </p>
              </div>
            </div>
          </div>

          {/* Quick AI Prompts (previously in Pulse Banner) */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={() =>
                handleLaunchPrompt('Run a complete financial health audit and cash flow checkup')
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 transition-colors cursor-pointer"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Audit Health</span>
            </button>
            <button
              type="button"
              onClick={() =>
                handleLaunchPrompt(
                  'What can I safely spend today, and what is my daily allowance breakdown?',
                )
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 transition-colors cursor-pointer"
            >
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Allowance</span>
            </button>
          </div>

          {/* Live Status Readout */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200/70 dark:border-gray-700/70 mb-2 text-[10px]">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              State:{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">
                {SPEX_ANIMATION_STATES[animState].shortLabel}
              </strong>
            </span>
            <span className="font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-indigo-500" />
              {lookSpec ? `${lookSpec.compass} (${lookSpec.angleDeg}°)` : '16° Gaze'}
            </span>
          </div>

          {/* Quick Animation Triggers */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {QUICK_ACTIONS.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => triggerReaction(act.id, act.msg, 3200)}
                className={`py-1 px-2 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  animState === act.id
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                {act.label}
              </button>
            ))}
          </div>

          {/* Patrol Flight Toggle + Open AI Chat */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (mode === 'roaming') {
                  updateMode('perched');
                  setAnimState('idle');
                } else {
                  updateMode('roaming');
                  setAnimState('running-right');
                }
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                mode === 'roaming'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-200/70'
              }`}
            >
              {mode === 'roaming' ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Stop Patrol
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Patrol
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenChat();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Spex
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Speech Hint Bubble (replaces the removed AI Pulse Banner cleanly) */}
      {speechBubble && !isMenuOpen && (
        <div
          className={`mb-1.5 max-w-[260px] rounded-2xl rounded-bl-xs border px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-1 duration-150 flex items-start gap-2 ${
            pulse.tone === 'alert'
              ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-100'
              : pulse.tone === 'warning'
              ? 'bg-amber-50/95 dark:bg-amber-950/95 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
              : 'bg-white/95 dark:bg-gray-900/95 border-indigo-200/90 dark:border-indigo-800/80 text-gray-800 dark:text-gray-100'
          }`}
        >
          <p
            onClick={() => setIsMenuOpen(true)}
            className="leading-snug flex-1 cursor-pointer"
          >
            {speechBubble}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSpeechBubble(null);
            }}
            aria-label="Dismiss hint"
            className="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0 cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* SPEX Interactive Sprite Body */}
      <div className="relative flex items-center group">
        <button
          type="button"
          onClick={() => {
            setIsMenuOpen((prev) => !prev);
            if (!isMenuOpen && mode !== 'roaming') {
              triggerReaction(pulse.state, pulse.headline, 3000);
            }
          }}
          onMouseEnter={() => {
            if (mode === 'perched' && animState === 'idle' && !isMenuOpen) {
              triggerReaction('waving', pulse.headline, 2400);
            }
          }}
          className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center focus:outline-none transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer"
          title={`${pulse.headline} — Click to open Spex AI controls`}
        >
          <SpexSprite
            state={animState}
            lookAtCursor={mode === 'perched'}
            onSectorChange={setLookSpec}
            className="w-full h-full"
          />
          {pulse.tone !== 'positive' && !isMenuOpen && (
            <span
              className={`absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${
                pulse.tone === 'alert' ? 'bg-rose-500' : 'bg-amber-500'
              }`}
            />
          )}
        </button>
      </div>
    </div>
  );
};

export default SpexCompanionPet;
