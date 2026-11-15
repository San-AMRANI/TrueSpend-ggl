import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const SETTLE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface PageTransitionProps {
  pageKey: string;
  children: React.ReactNode;
  className?: string;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  pageKey,
  children,
  className = '',
}) => (
  <motion.div
    key={pageKey}
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.16, ease: SETTLE_EASE }}
    className={className}
  >
    {children}
  </motion.div>
);

interface AnimatedMetricValueProps {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  masked?: boolean;
  maskText?: string;
  className?: string;
}

export const AnimatedMetricValue: React.FC<AnimatedMetricValueProps> = ({
  value,
  decimals = 2,
  suffix = '',
  prefix = '',
  masked = false,
  maskText = '******',
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevRef.current;
    const endVal = Number.isFinite(value) ? value : 0;
    if (Math.abs(endVal - startVal) < 0.005) {
      setDisplayValue(endVal);
      prevRef.current = endVal;
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayValue(endVal);
      prevRef.current = endVal;
      return;
    }

    let rafId = 0;
    const duration = 260;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startVal + (endVal - startVal) * eased;
      setDisplayValue(next);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endVal);
        prevRef.current = endVal;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  if (masked) {
    return (
      <span className={`font-mono tabular-nums ${className}`}>
        {maskText}
        {suffix}
      </span>
    );
  }

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {displayValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
};

interface MotionBackdropProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  zIndexClass?: string;
  containerClassName?: string;
}

export const MotionModal: React.FC<MotionBackdropProps> = ({
  isOpen,
  onClose,
  children,
  zIndexClass = 'z-[80]',
  containerClassName = 'w-full max-w-lg',
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto`}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 6 }}
          transition={{ duration: 0.18, ease: SETTLE_EASE }}
          onClick={(e) => e.stopPropagation()}
          className={containerClassName}
        >
          {children}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

interface StaggerListProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const StaggerList: React.FC<StaggerListProps> = ({
  children,
  className = '',
  staggerDelay = 0.035,
}) => (
  <motion.div
    initial="hidden"
    animate="visible"
    variants={{
      hidden: {},
      visible: {
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggerItem: React.FC<StaggerItemProps> = ({ children, className = '' }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.19, ease: SETTLE_EASE },
      },
    }}
    className={className}
  >
    {children}
  </motion.div>
);

interface AnimatedProgressBarProps {
  percent: number;
  className?: string;
  barClassName?: string;
  trackClassName?: string;
  delay?: number;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  percent,
  className = '',
  barClassName = 'bg-indigo-600 dark:bg-indigo-500',
  trackClassName = 'h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800',
  delay = 0.04,
}) => {
  const ratio = Math.max(0, Math.min(1, (Number.isFinite(percent) ? percent : 0) / 100));
  return (
    <div className={`${trackClassName} ${className}`}>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: ratio }}
        transition={{ duration: 0.42, delay, ease: SETTLE_EASE }}
        style={{ transformOrigin: 'left' }}
        className={`h-full w-full rounded-full ${barClassName}`}
      />
    </div>
  );
};

