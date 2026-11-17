import React, { useEffect, useRef, useState } from 'react';

export interface ProgressiveSectionProps {
  children?: React.ReactNode;
  /**
   * Lazy render factory: avoids constructing heavy JSX trees (and running child hooks)
   * until the section actually enters the viewport.
   */
  render?: () => React.ReactNode;
  /**
   * Approximate height of the section to prevent Cumulative Layout Shift (CLS)
   * while the section awaits viewport intersection.
   */
  minHeight?: number;
  /**
   * When false (default), below-the-fold sections wait strictly for IntersectionObserver
   * instead of eagerly mounting via timers right after initial paint.
   */
  hydrateOnIdle?: boolean;
  /**
   * Optional staggered idle timer (ms) used ONLY when `hydrateOnIdle` is true.
   */
  priorityDelayMs?: number;
  /**
   * IntersectionObserver rootMargin (default pre-warms 280px before entering viewport).
   */
  rootMargin?: string;
  /**
   * Callback fired exactly once when the section hydrates (useful for triggering
   * deferred API slices like Operational Radar or Investments Summary on scroll).
   */
  onHydrate?: () => void;
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

export function shouldHydrateImmediately(options: {
  hasWindow: boolean;
  hasIntersectionObserver: boolean;
  hydrateOnIdle: boolean;
  priorityDelayMs: number;
}): boolean {
  if (!options.hasWindow) return true;
  if (!options.hasIntersectionObserver) return true;
  return options.hydrateOnIdle && options.priorityDelayMs === 0;
}

/**
 * ProgressiveSection implements true viewport-driven partial loading:
 * 1. Above-the-fold bands render synchronously on frame 1.
 * 2. Below-the-fold sections stay lightweight zero-chart placeholders until scrolled
 *    within `rootMargin` (280px) of the viewport (or `hydrateOnIdle: true` is opted in).
 * 3. `render` factory + React.lazy children defer JS parsing & JSX tree evaluation until needed.
 * 4. Once hydrated, `content-visibility: auto` lets the browser skip off-screen layout/paint.
 */
export const ProgressiveSection: React.FC<ProgressiveSectionProps> = ({
  children,
  render,
  minHeight = 260,
  hydrateOnIdle = false,
  priorityDelayMs = 120,
  rootMargin = '280px 0px',
  onHydrate,
  label,
  fallback,
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onHydrateRef = useRef(onHydrate);
  onHydrateRef.current = onHydrate;
  const didNotifyRef = useRef(false);

  const [hydrated, setHydrated] = useState<boolean>(() =>
    shouldHydrateImmediately({
      hasWindow: typeof window !== 'undefined',
      hasIntersectionObserver: typeof IntersectionObserver !== 'undefined',
      hydrateOnIdle,
      priorityDelayMs,
    })
  );

  useEffect(() => {
    if (hydrated) {
      if (!didNotifyRef.current) {
        didNotifyRef.current = true;
        onHydrateRef.current?.();
      }
      return;
    }

    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

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

    if (hydrateOnIdle) {
      const scheduleIdle = () => {
        const w = window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
          cancelIdleCallback?: (id: number) => void;
        };
        if (typeof w.requestIdleCallback === 'function') {
          idleHandle = w.requestIdleCallback(triggerHydrate, {
            timeout: Math.max(300, priorityDelayMs + 300),
          });
        } else {
          timeoutHandle = setTimeout(triggerHydrate, 16);
        }
      };
      delayTimer = setTimeout(scheduleIdle, Math.max(0, priorityDelayMs));
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (delayTimer) clearTimeout(delayTimer);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const w = window as unknown as { cancelIdleCallback?: (id: number) => void };
      if (idleHandle !== null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleHandle);
      }
    };
  }, [hydrated, hydrateOnIdle, priorityDelayMs, rootMargin]);

  if (hydrated) {
    return (
      <div
        className={className}
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: `auto ${minHeight}px`,
        }}
      >
        {render ? render() : children}
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ minHeight }}
      data-progressive-section="pending"
      data-section-label={label || undefined}
    >
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
 * Computes progressive chunk step without blocking frame time.
 */
export function computeNextProgressiveCount(
  current: number,
  total: number,
  batchSize: number
): number {
  return Math.min(total, current + Math.max(1, batchSize));
}

/**
 * Incrementally reveals large lists (tables/cards) in chunks over animation frames
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
    let rafId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(() => {
        setVisibleCount((prev) => computeNextProgressiveCount(prev, items.length, batchSize));
      });
    } else {
      timerId = setTimeout(() => {
        setVisibleCount((prev) => computeNextProgressiveCount(prev, items.length, batchSize));
      }, 16);
    }
    return () => {
      if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [visibleCount, items.length, batchSize]);

  const capped = Math.min(items.length, visibleCount);
  return {
    visibleItems: items.slice(0, capped) as T[],
    isComplete: capped >= items.length,
    totalCount: items.length,
  };
}
