import React, { useState, useEffect, useRef, useCallback } from 'react';

export type SpexAnimationState =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'
  | 'look';

export interface SpexStateMetadata {
  id: SpexAnimationState;
  row: number;
  frames: number;
  defaultFps: number;
  loop: boolean;
  label: string;
  shortLabel: string;
  description: string;
  stillFallback?: string;
}

export const SPEX_SPRITESHEET_WEBP = '/assets/aistudio/SPEX-spritesheet-v2_e340fd32.webp';
export const SPEX_SPRITESHEET_PNG = '/assets/aistudio/SPEX-spritesheet-v2_cbf6b027.png';
export const SPEX_SOURCE_PNG = '/assets/aistudio/SPEX-source_453384e7.png';

export const SPEX_STILLS = {
  idle: '/assets/aistudio/still-idle_1d57cbeb.png',
  jumpPeak: '/assets/aistudio/still-jump-peak_4ffbe5d3.png',
  lookDown: '/assets/aistudio/still-look-down_aacce62e.png',
  runRight: '/assets/aistudio/still-run-right_b5430615.png',
} as const;

export const SPEX_ANIMATION_STATES: Record<SpexAnimationState, SpexStateMetadata> = {
  idle: {
    id: 'idle',
    row: 0,
    frames: 6,
    defaultFps: 6,
    loop: true,
    label: 'Idle & Breathing',
    shortLabel: 'Idle',
    description: 'Subtle breathing, warm amber visor blink, and gentle leaf-wing respiration.',
    stillFallback: SPEX_STILLS.idle,
  },
  'running-right': {
    id: 'running-right',
    row: 1,
    frames: 8,
    defaultFps: 10,
    loop: true,
    label: 'Flight Patrol Right',
    shortLabel: 'Fly Right',
    description: 'Forward-leaning aerial propulsion with synchronized wing beats.',
    stillFallback: SPEX_STILLS.runRight,
  },
  'running-left': {
    id: 'running-left',
    row: 2,
    frames: 8,
    defaultFps: 10,
    loop: true,
    label: 'Flight Patrol Left',
    shortLabel: 'Fly Left',
    description: 'Mirrored leftward aerial patrol with brass compass core glow.',
    stillFallback: SPEX_STILLS.idle,
  },
  waving: {
    id: 'waving',
    row: 3,
    frames: 4,
    defaultFps: 7,
    loop: true,
    label: 'Friendly Greeting Wave',
    shortLabel: 'Wave',
    description: 'Cheerful raised-hand greeting with happy chevron visor eyes.',
    stillFallback: SPEX_SOURCE_PNG,
  },
  jumping: {
    id: 'jumping',
    row: 4,
    frames: 5,
    defaultFps: 8,
    loop: true,
    label: 'Wing-Boosted Jump',
    shortLabel: 'Jump',
    description: 'Crouch anticipation, full 55px airborne wing-flare lift, and cushioned landing.',
    stillFallback: SPEX_STILLS.jumpPeak,
  },
  failed: {
    id: 'failed',
    row: 5,
    frames: 8,
    defaultFps: 7,
    loop: true,
    label: 'Alert Droop & Recovery',
    shortLabel: 'Droop',
    description: 'Empathetic head droop on budget alerts followed by resilient recovery.',
    stillFallback: SPEX_STILLS.lookDown,
  },
  waiting: {
    id: 'waiting',
    row: 6,
    frames: 6,
    defaultFps: 7,
    loop: true,
    label: 'Expectant Listening',
    shortLabel: 'Waiting',
    description: 'Attentive head tilt and open hand while you type or dictate a prompt.',
    stillFallback: SPEX_STILLS.idle,
  },
  running: {
    id: 'running',
    row: 7,
    frames: 6,
    defaultFps: 8,
    loop: true,
    label: 'Active AI Processing Dance',
    shortLabel: 'Processing',
    description: 'Energetic celebratory sway while computing 360° portfolio & cash-flow forensics.',
    stillFallback: SPEX_SOURCE_PNG,
  },
  review: {
    id: 'review',
    row: 8,
    frames: 6,
    defaultFps: 6,
    loop: true,
    label: 'Forensic Audit & Review',
    shortLabel: 'Audit',
    description: 'Focused analytical inspection of receipts, subscriptions, and wallet balances.',
    stillFallback: SPEX_STILLS.idle,
  },
  look: {
    id: 'look',
    row: 9,
    frames: 16,
    defaultFps: 8,
    loop: true,
    label: '360° Cursor Gaze Tracking',
    shortLabel: '16° Gaze',
    description: '16-angle directional head and visor gaze tracking following your pointer.',
    stillFallback: SPEX_STILLS.lookDown,
  },
};

export interface LookDirectionSpec {
  sector: number;
  angleDeg: number;
  row: number;
  col: number;
  compass: string;
  label: string;
}

export const SPEX_LOOK_DIRECTIONS: LookDirectionSpec[] = [
  { sector: 0, angleDeg: 0, row: 9, col: 0, compass: 'N', label: '0° Up' },
  { sector: 1, angleDeg: 22.5, row: 9, col: 1, compass: 'NNE', label: '22.5° Up-Right' },
  { sector: 2, angleDeg: 45, row: 9, col: 2, compass: 'NE', label: '45° Up-Right' },
  { sector: 3, angleDeg: 67.5, row: 9, col: 3, compass: 'ENE', label: '67.5° Right-Up' },
  { sector: 4, angleDeg: 90, row: 9, col: 4, compass: 'E', label: '90° Right' },
  { sector: 5, angleDeg: 112.5, row: 9, col: 5, compass: 'ESE', label: '112.5° Down-Right' },
  { sector: 6, angleDeg: 135, row: 9, col: 6, compass: 'SE', label: '135° Down-Right' },
  { sector: 7, angleDeg: 157.5, row: 9, col: 7, compass: 'SSE', label: '157.5° Down-Right' },
  { sector: 8, angleDeg: 180, row: 10, col: 0, compass: 'S', label: '180° Down' },
  { sector: 9, angleDeg: 202.5, row: 10, col: 1, compass: 'SSW', label: '202.5° Down-Left' },
  { sector: 10, angleDeg: 225, row: 10, col: 2, compass: 'SW', label: '225° Down-Left' },
  { sector: 11, angleDeg: 247.5, row: 10, col: 3, compass: 'WSW', label: '247.5° Left-Down' },
  { sector: 12, angleDeg: 270, row: 10, col: 4, compass: 'W', label: '270° Left' },
  { sector: 13, angleDeg: 292.5, row: 10, col: 5, compass: 'WNW', label: '292.5° Up-Left' },
  { sector: 14, angleDeg: 315, row: 10, col: 6, compass: 'NW', label: '315° Up-Left' },
  { sector: 15, angleDeg: 337.5, row: 10, col: 7, compass: 'NNW', label: '337.5° Up-Left' },
];

/**
 * Converts a (dx, dy) vector from SPEX's center to the pointer into one of the 16 gaze cells
 * on rows 9 and 10. Clockwise from 0° = North (Up).
 */
export function getLookCellFromVector(dx: number, dy: number): LookDirectionSpec {
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const sector = Math.round(deg / 22.5) % 16;
  return SPEX_LOOK_DIRECTIONS[sector] || SPEX_LOOK_DIRECTIONS[0];
}

export interface SpexSpriteProps {
  state?: SpexAnimationState;
  lookAtCursor?: boolean;
  forcedLookSector?: number | null;
  forcedFrame?: number | null;
  fpsOverride?: number;
  paused?: boolean;
  interactive?: boolean;
  className?: string;
  size?: number | string;
  onSectorChange?: (spec: LookDirectionSpec) => void;
  onFrameChange?: (frame: number, row: number, col: number) => void;
}

export const SpexSprite: React.FC<SpexSpriteProps> = ({
  state = 'idle',
  lookAtCursor = false,
  forcedLookSector = null,
  forcedFrame = null,
  fpsOverride,
  paused = false,
  interactive = false,
  className = 'w-full h-full',
  size,
  onSectorChange,
  onFrameChange,
}) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [activeLookSector, setActiveLookSector] = useState<number>(8); // default 180° front-down
  const [isPointerLooking, setIsPointerLooking] = useState(false);
  const [transientState, setTransientState] = useState<SpexAnimationState | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const pointerIdleTimeoutRef = useRef<number | null>(null);
  const transientTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const effectiveState: SpexAnimationState = transientState || state;
  const stateMeta = SPEX_ANIMATION_STATES[effectiveState] || SPEX_ANIMATION_STATES.idle;
  const fps = fpsOverride || stateMeta.defaultFps;

  // Reset frame index when state changes
  useEffect(() => {
    setFrameIndex(0);
  }, [effectiveState]);

  // Frame loop interval
  useEffect(() => {
    if (paused || reducedMotion) return;
    if (forcedFrame !== null && forcedFrame !== undefined) return;
    if (effectiveState === 'look' && (forcedLookSector !== null || isPointerLooking)) return;

    const totalFrames = effectiveState === 'look' ? 16 : stateMeta.frames;
    const intervalMs = Math.max(45, Math.round(1000 / fps));

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % totalFrames);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [effectiveState, stateMeta.frames, fps, paused, reducedMotion, forcedFrame, forcedLookSector, isPointerLooking]);

  // 16-angle cursor gaze tracking
  useEffect(() => {
    if (!lookAtCursor && effectiveState !== 'look') {
      setIsPointerLooking(false);
      return;
    }
    if (forcedLookSector !== null && forcedLookSector !== undefined) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.hypot(dx, dy);

      // If within deadzone right on top of nose, look straight down/front (180°)
      const spec = distance < 10 ? SPEX_LOOK_DIRECTIONS[8] : getLookCellFromVector(dx, dy);
      setActiveLookSector(spec.sector);
      setIsPointerLooking(true);
      onSectorChange?.(spec);

      if (pointerIdleTimeoutRef.current) {
        window.clearTimeout(pointerIdleTimeoutRef.current);
      }
      pointerIdleTimeoutRef.current = window.setTimeout(() => {
        setIsPointerLooking(false);
      }, 2400);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (pointerIdleTimeoutRef.current) {
        window.clearTimeout(pointerIdleTimeoutRef.current);
      }
    };
  }, [lookAtCursor, effectiveState, forcedLookSector, onSectorChange]);

  useEffect(() => {
    return () => {
      if (transientTimeoutRef.current) {
        window.clearTimeout(transientTimeoutRef.current);
      }
    };
  }, []);

  const triggerTransientAnimation = useCallback((nextState: SpexAnimationState, durationMs = 1100) => {
    setTransientState(nextState);
    if (transientTimeoutRef.current) {
      window.clearTimeout(transientTimeoutRef.current);
    }
    transientTimeoutRef.current = window.setTimeout(() => {
      setTransientState(null);
    }, durationMs);
  }, []);

  // Compute exact (row, col) on the 8x11 spritesheet
  let row = stateMeta.row;
  let col = 0;

  const shouldUseLookCell =
    effectiveState === 'look' ||
    (lookAtCursor && isPointerLooking && effectiveState === 'idle' && !transientState);

  if (shouldUseLookCell) {
    const sector =
      forcedLookSector !== null && forcedLookSector !== undefined
        ? ((forcedLookSector % 16) + 16) % 16
        : effectiveState === 'look' && !isPointerLooking
        ? (forcedFrame ?? frameIndex) % 16
        : activeLookSector;
    const lookSpec = SPEX_LOOK_DIRECTIONS[sector] || SPEX_LOOK_DIRECTIONS[0];
    row = lookSpec.row;
    col = lookSpec.col;
  } else {
    const safeFrame =
      forcedFrame !== null && forcedFrame !== undefined
        ? forcedFrame % stateMeta.frames
        : frameIndex % stateMeta.frames;
    row = stateMeta.row;
    col = safeFrame;
  }

  useEffect(() => {
    onFrameChange?.(col, row, col);
  }, [row, col, onFrameChange]);

  // CSS background-position percentages for an 8-column (0..7) x 11-row (0..10) grid
  const bgPosX = `${(col / 7) * 100}%`;
  const bgPosY = `${(row / 10) * 100}%`;

  const containerStyle: React.CSSProperties | undefined = size
    ? { width: size, height: size }
    : undefined;

  return (
    <span
      ref={containerRef}
      style={containerStyle}
      onMouseEnter={
        interactive && !transientState && state === 'idle'
          ? () => triggerTransientAnimation('waving', 950)
          : undefined
      }
      onClick={
        interactive
          ? () => triggerTransientAnimation('jumping', 900)
          : undefined
      }
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-visible ${className}`}
    >
      <span
        aria-hidden="true"
        className="block w-full h-full bg-no-repeat pointer-events-none transition-transform duration-150"
        style={{
          aspectRatio: '192 / 208',
          maxHeight: '100%',
          maxWidth: '100%',
          backgroundImage: `url("${SPEX_SPRITESHEET_WEBP}"), url("${SPEX_SPRITESHEET_PNG}")`,
          backgroundSize: '800% 1100%',
          backgroundPosition: `${bgPosX} ${bgPosY}`,
          filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16))',
        }}
      />
    </span>
  );
};

export default SpexSprite;
