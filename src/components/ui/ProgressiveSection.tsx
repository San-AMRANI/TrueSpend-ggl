import React, { useEffect, useRef, useState } from 'react';

interface ProgressiveSectionProps {
  children: React.ReactNode;
  /**
   * Approximate height of the section to prevent Cumulative Layout Shift (CLS)
   * while the section awaits viewport intersection or idle hydration.
   */
  minHeight?: number;
  /**
   * Optional staggered idle timer (ms) so sections below the fold still hydrate
   * smoothly during browser idle time even before the user scrolls to them.
   */
  priorityDelayMs?: number;
  /**
   * IntersectionObserver rootMargin (default pre-warms 240px before entering viewport).
   */
  rootMargin?: string;
  /**
   * Accessible label or placeholder title shown in the lightweight skeleton.
   */
  label?: string;
  /**
   * Optional custom skeleton override.
   */
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * ProgressiveSection implements incremental partial rendering for heavy dashboard bands:
 * 1. Above-the-fold sections mount synchronously on frame 1.
 * 2. Below-the-fold sections mount lightweight placeholders first and hydrate either:
 *    - Immediately when scrolled near the viewport (IntersectionObserver with 240px rootMargin), OR
 *    - Automatically after `priorityDelayMs` during idle frames via requestIdleCallback/setTimeout.
 * Once hydrated, sections remain mounted to preserve scroll position and interactive state.
 */
export const ProgressiveSection: React.FC<ProgressiveSectionProps> = ({
  children,
  minHeight = 260,
  priorityDelayMs = 120,
  rootMargin = '240px 0px',
  label,
  fallback,
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    // In headless unit tests without IntersectionObserver, mount directly
    return typeof IntersectionObserver === 'undefined' && priorityDelayMs === 0;
  });

  useEffect(() => {
    if (hydrated) return;

    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const triggerHydrate = () => {
      if (cancelled) return;
      setHydrated(true);
    };

    if (typeof IntersectionObserver !== 'undefined' && hostRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              triggerHydrate();
              observer?.disconnect();
              break;
            }
          }
        },
        { rootMargin }
      );
      observer.observe(hostRef.current);
    }

    const scheduleIdle = () => {
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof w.requestIdleCallback === 'function') {
        idleHandle = w.requestIdleCallback(triggerHydrate, {
          timeout: Math.max(250, priorityDelayMs + 250),
        });
      } else {
        timeoutHandle = setTimeout(triggerHydrate, 16);
      }
    };

    const delayTimer = setTimeout(scheduleIdle, Math.max(0, priorityDelayMs));

    return () => {
      cancelled = true;
      observer?.disconnect();
      clearTimeout(delayTimer);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const w = window as unknown as { cancelIdleCallback?: (id: number) => void };
      if (idleHandle !== null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle);
      }
    };
  }, [hydrated, priorityDelayMs, rootMargin]);

  if (hydrated) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={hostRef} className={className} style={{ minHeight }}>
      {fallback ?? (
        <div
          className="w-full rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/50 p-5 animate-pulse flex flex-col justify-between"
          style={{ minHeight }}
          aria-busy="true"
          aria-label={label || 'Loading section'}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-4 w-40 rounded-md bg-slate-200/80 dark:bg-slate-800/90" />
              <div className="h-3 w-64 rounded-md bg-slate-200/60 dark:bg-slate-800/60" />
            </div>
            <div className="h-7 w-24 rounded-lg bg-slate-200/70 dark:bg-slate-800/70" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />
            <div className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />
            <div className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />
            <div className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />
          </div>
          <div className="h-20 w-full rounded-xl bg-slate-200/50 dark:bg-slate-800/50" />
        </div>
      )}
    </div>
  );
};

/**
 * Incrementally reveals large lists (tables/cards) in chunks over animation/idle frames
 * so rendering 500+ rows never blocks main-thread frame responsiveness.
 */
export function useProgressiveItems<T>(
  items: readonly T[],
  initialCount = 24,
  batchSize = 36
): { visibleItems: T[]; isComplete: boolean; totalCount: number } {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [items, initialCount]);

  useEffect(() => {
    if (visibleCount >= items.length) return;
    const id = setTimeout(() => {
      setVisibleCount((prev) => Math.min(items.length, prev + batchSize));
    }, 24);
    return () => clearTimeout(id);
  }, [visibleCount, items.length, batchSize]);

  const capped = Math.min(items.length, visibleCount);
  return {
    visibleItems: items.slice(0, capped) as T[],
    isComplete: capped >= items.length,
    totalCount: items.length,
  };
}
