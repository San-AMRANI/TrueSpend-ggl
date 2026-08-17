import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Banknote,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  HandCoins,
  Landmark,
  Layers,
  PiggyBank,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import type { FactIcon, FinancialFact } from '../../lib/financialFacts';

// ── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<FactIcon, React.ComponentType<{ className?: string }>> = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  wallet: Wallet,
  calendar: Calendar,
  coffee: Coffee,
  'shopping-bag': ShoppingBag,
  landmark: Landmark,
  banknote: Banknote,
  'piggy-bank': PiggyBank,
  receipt: Receipt,
  'alert-triangle': AlertTriangle,
  'bar-chart': BarChart2,
  activity: Activity,
  clock: Clock,
  repeat: Repeat,
  zap: Zap,
  target: Target,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'shield-check': ShieldCheck,
  users: Users,
  'hand-coins': HandCoins,
  layers: Layers,
};

// ── Colour palette per fact type ─────────────────────────────────────────────

const TYPE_STYLES: Record<
  FinancialFact['type'],
  { card: string; icon: string; value: string; dot: string }
> = {
  spending: {
    card: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40 border-rose-100 dark:border-rose-900/50',
    icon: 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400',
    value: 'text-rose-700 dark:text-rose-300',
    dot: 'bg-rose-400',
  },
  budget: {
    card: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40 border-violet-100 dark:border-violet-900/50',
    icon: 'bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-400',
    value: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-400',
  },
  liquidity: {
    card: 'bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40 border-sky-100 dark:border-sky-900/50',
    icon: 'bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400',
    value: 'text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-400',
  },
  debt: {
    card: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-amber-100 dark:border-amber-900/50',
    icon: 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
  },
  reimbursement: {
    card: 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/40 dark:to-cyan-950/40 border-teal-100 dark:border-teal-900/50',
    icon: 'bg-teal-100 dark:bg-teal-900/60 text-teal-600 dark:text-teal-400',
    value: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-400',
  },
  income: {
    card: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40 border-emerald-100 dark:border-emerald-900/50',
    icon: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-400',
  },
  behavioral: {
    card: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-100 dark:border-orange-900/50',
    icon: 'bg-orange-100 dark:bg-orange-900/60 text-orange-600 dark:text-orange-400',
    value: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-400',
  },
  daily: {
    card: 'bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border-indigo-100 dark:border-indigo-900/50',
    icon: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400',
    value: 'text-indigo-700 dark:text-indigo-300',
    dot: 'bg-indigo-400',
  },
};

// ── Single Fact Card ──────────────────────────────────────────────────────────

interface FactCardProps {
  fact: FinancialFact;
}

const FactCard: React.FC<FactCardProps> = ({ fact }) => {
  const styles = TYPE_STYLES[fact.type];
  const IconComponent = ICON_MAP[fact.icon] ?? Activity;

  return (
    <div
      className={`flex h-full w-full flex-col justify-between rounded-2xl border p-4 sm:p-5 ${styles.card} select-none`}
    >
      {/* Header: icon + title */}
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <IconComponent className="h-4 w-4" />
        </span>
        <p className="pt-0.5 text-sm font-semibold leading-tight text-gray-800 dark:text-gray-100">
          {fact.title}
        </p>
      </div>

      {/* Value — big and prominent */}
      <p className={`mt-3 text-2xl font-bold tabular-nums leading-none ${styles.value}`}>
        {fact.value}
      </p>

      {/* Message */}
      <p className="mt-2 text-xs leading-snug text-gray-600 dark:text-gray-400">
        {fact.message}
      </p>
    </div>
  );
};

// ── Carousel ─────────────────────────────────────────────────────────────────

interface FinancialFactsCarouselProps {
  facts: FinancialFact[];
}

export const FinancialFactsCarousel: React.FC<FinancialFactsCarouselProps> = ({ facts }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  const total = facts.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, total - 1)));
    },
    [total],
  );

  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  // Touch / Mouse drag
  const handlePointerDown = (clientX: number) => {
    startXRef.current = clientX;
    isDraggingRef.current = false;
    dragOffsetRef.current = 0;
  };

  const handlePointerMove = (clientX: number) => {
    if (startXRef.current === null) return;
    const delta = clientX - startXRef.current;
    if (Math.abs(delta) > 5) isDraggingRef.current = true;
    dragOffsetRef.current = delta;
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      const threshold = 50;
      if (dragOffsetRef.current < -threshold) next();
      else if (dragOffsetRef.current > threshold) prev();
    }
    startXRef.current = null;
    isDraggingRef.current = false;
    dragOffsetRef.current = 0;
  };

  if (total === 0) return null;

  return (
    <div className="min-w-0 w-full">
      {/* Card window */}
      <div
        className="relative overflow-hidden"
        onMouseDown={(e) => handlePointerDown(e.clientX)}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
        onTouchMove={(e) => handlePointerMove(e.touches[0].clientX)}
        onTouchEnd={handlePointerUp}
      >
        {/* Sliding track */}
        <div
          ref={trackRef}
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {facts.map((fact) => (
            <div key={fact.id} className="w-full shrink-0" style={{ minWidth: '100%' }}>
              <div className="h-40 sm:h-44">
                <FactCard fact={fact} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {/* Dot indicators */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          {facts.map((fact, i) => {
            const dotColor = TYPE_STYLES[fact.type].dot;
            return (
              <button
                key={fact.id}
                type="button"
                aria-label={`Go to fact ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${dotColor} ${
                  i === currentIndex ? 'w-5 opacity-100' : 'w-1.5 opacity-30'
                }`}
              />
            );
          })}
        </div>

        {/* Prev / Next buttons */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={prev}
            disabled={currentIndex === 0}
            aria-label="Previous fact"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-gray-400 dark:text-gray-500">
            {currentIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={currentIndex === total - 1}
            aria-label="Next fact"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 transition hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
