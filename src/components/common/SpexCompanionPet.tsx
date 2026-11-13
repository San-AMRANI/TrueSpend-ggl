import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Sparkles,
  Compass,
  Minimize2,
  Play,
  Pause,
  X,
  MessageSquare,
} from 'lucide-react';
import {
  SpexSprite,
  SPEX_ANIMATION_STATES,
  type SpexAnimationState,
  type LookDirectionSpec,
} from './SpexSprite';
import { useTheme } from '../../context/ThemeContext';
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
  overview: {
    state: 'waving',
    message: 'Watching your Safe-to-Spend & daily allowance!',
  },
  subscriptions: {
    state: 'review',
    message: 'Auditing your 3-month passes & recurring renewals!',
  },
  investments: {
    state: 'running',
    message: 'Tracking your live Binance & equity positions!',
  },
  forecast: {
    state: 'review',
    message: 'Projecting your 90-day cash flow & runway!',
  },
  budgets: {
    state: 'review',
    message: 'Checking category burn caps & 50/30/20 pace!',
  },
  goals: {
    state: 'jumping',
    message: 'Every contribution brings your goals closer!',
  },
  calculators: {
    state: 'waiting',
    message: 'Ready to simulate What-If scenarios with you!',
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

  // Horizontal roaming state (percentage of viewport width: 4% to 78%)
  const [roamX, setRoamX] = useState<number>(6);
  const roamDirRef = useRef<1 | -1>(1);
  const roamPauseRef = useRef<boolean>(false);
  const reactionTimeoutRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);

  const updateMode = useCallback((nextMode: PetDisplayMode) => {
    setMode(nextMode);
    try {
      localStorage.setItem(PET_STORAGE_KEY, nextMode);
    } catch {}
  }, []);

  const triggerReaction = useCallback(
    (nextState: SpexAnimationState, message?: string, durationMs = 2600) => {
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
        }, durationMs + 900);
      }
    },
    [mode],
  );

  // React to tab changes
  useEffect(() => {
    if (mode === 'minimized' || activeTab === 'chat') return;
    const reaction = TAB_REACTIONS[activeTab];
    if (reaction) {
      triggerReaction(reaction.state, reaction.message, 2200);
    }
  }, [activeTab, mode, triggerReaction]);

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
        triggerReaction(detail.state, detail.message, detail.duration || 2600);
      }
    };

    const handleTogglePet = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.forceOpen) {
        updateMode('perched');
        setIsMenuOpen(true);
        triggerReaction('jumping', 'SPEX Companion reporting for duty!', 2600);
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
  }, [mode, triggerReaction, updateMode]);

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
          // Occasional brief hover/wave mid-patrol
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

  // Hide on mobile when chat overlay takes full viewport
  if (activeTab === 'chat') {
    return null;
  }

  // Minimized Dock Pill
  if (mode === 'minimized') {
    return (
      <button
        type="button"
        onClick={() => {
          updateMode('perched');
          triggerReaction('waving', 'Hey! Ready to track your finances!', 2400);
        }}
        style={{ left: `${sidebarSideOffsetPx}px` }}
        className="fixed bottom-20 md:bottom-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 shadow-lg backdrop-blur-md hover:scale-105 transition-all group cursor-pointer"
        title="Summon SPEX Interactive Companion Pet"
      >
        <SpexSprite state="idle" className="w-6 h-6" />
        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 pr-1">
          SPEX Pet
        </span>
      </button>
    );
  }

  const QUICK_ACTIONS: { id: SpexAnimationState; label: string; msg: string }[] = [
    { id: 'waving', label: 'Wave', msg: 'Hello there! Ready to optimize your cash flow!' },
    { id: 'jumping', label: 'Jump', msg: 'Wing-boosted takeoff! Liquidity looking strong!' },
    { id: 'running', label: 'Dance', msg: 'Computing 360° portfolio & budget vectors!' },
    { id: 'review', label: 'Audit', msg: 'Inspecting subscriptions & wallet balances…' },
    { id: 'waiting', label: 'Wait', msg: 'Listening! Click Chat to ask me anything.' },
    { id: 'look', label: '16° Gaze', msg: 'Move your cursor around—I track all 16 angles!' },
  ];

  return (
    <div
      className="fixed bottom-20 md:bottom-4 z-40 select-none transition-[left] duration-200"
      style={{
        left: mode === 'roaming' ? `${Math.max(roamMinVw, roamX)}vw` : `${sidebarSideOffsetPx}px`,
      }}
    >
      {/* Interactive Action Popover Menu */}
      {isMenuOpen && (
        <div className="mb-2 w-72 rounded-2xl bg-white/98 dark:bg-gray-900/98 border border-gray-200 dark:border-gray-700 shadow-2xl p-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-gray-900 dark:text-white">
                SPEX Companion Controls
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  updateMode('minimized');
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Minimize companion to pill"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Close menu"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Status Readout */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/70 dark:border-gray-700/70 mb-2.5 text-[10px]">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              State: <strong className="text-indigo-600 dark:text-indigo-400">{SPEX_ANIMATION_STATES[animState].shortLabel}</strong>
            </span>
            <span className="font-mono text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-indigo-500" />
              {lookSpec ? `${lookSpec.compass} (${lookSpec.angleDeg}°)` : '16° Gaze Ready'}
            </span>
          </div>

          {/* Quick Animation Triggers */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {QUICK_ACTIONS.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => triggerReaction(act.id, act.msg, 3200)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all ${
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
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
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
                  <Play className="w-3.5 h-3.5" /> Patrol Flight
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenChat();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask Spex
            </button>
          </div>
        </div>
      )}

      {/* Speech Bubble */}
      {speechBubble && !isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(true)}
          className="mb-1.5 max-w-[230px] rounded-2xl rounded-bl-xs bg-white/95 dark:bg-gray-900/95 border border-indigo-200/90 dark:border-indigo-800/80 px-3 py-2 text-[11px] font-medium text-gray-800 dark:text-gray-100 shadow-lg backdrop-blur-md cursor-pointer animate-in fade-in slide-in-from-bottom-1 duration-150"
        >
          <p className="leading-snug">{speechBubble}</p>
        </div>
      )}

      {/* SPEX Interactive Sprite Body */}
      <div className="relative flex items-center group">
        <button
          type="button"
          onClick={() => {
            setIsMenuOpen((prev) => !prev);
            if (!isMenuOpen && mode !== 'roaming') {
              triggerReaction(
                'jumping',
                kpis
                  ? `Safe to spend: ${kpis.safeToSpend.toFixed(0)} MAD (${kpis.daysUntilPayday}d to payday)`
                  : 'Click any action to animate me!',
                2600,
              );
            }
          }}
          onMouseEnter={() => {
            if (mode === 'perched' && animState === 'idle' && !isMenuOpen) {
              triggerReaction('waving', undefined, 1200);
            }
          }}
          className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center focus:outline-none transition-transform duration-200 hover:scale-105 active:scale-95"
          title="SPEX Interactive Companion — Moves eyes with your cursor! Click for controls & animations"
        >
          <SpexSprite
            state={animState}
            lookAtCursor={mode === 'perched'}
            onSectorChange={setLookSpec}
            className="w-full h-full"
          />
        </button>
      </div>
    </div>
  );
};

export default SpexCompanionPet;
