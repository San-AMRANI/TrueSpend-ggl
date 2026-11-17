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

export function getLookCellFromVector(dx: number, dy: number): LookDirectionSpec {
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const sector = Math.round(deg / 22.5) % 16;
  return SPEX_LOOK_DIRECTIONS[sector] || SPEX_LOOK_DIRECTIONS[0];
}

export function computeSpriteFrameCoords(params: {
  effectiveState: SpexAnimationState;
  lookAtCursor: boolean;
  isPointerLooking: boolean;
  hasTransientState: boolean;
  forcedLookSector: number | null;
  forcedFrame: number | null;
  frameIndex: number;
  activeLookSector: number;
}): { row: number; col: number; bgPosX: string; bgPosY: string; shouldUseLookCell: boolean } {
  const stateMeta = SPEX_ANIMATION_STATES[params.effectiveState] || SPEX_ANIMATION_STATES.idle;
  const shouldUseLookCell =
    params.effectiveState === 'look' ||
    (params.lookAtCursor &&
      params.isPointerLooking &&
      params.effectiveState === 'idle' &&
      !params.hasTransientState);

  let row = stateMeta.row;
  let col = 0;

  if (shouldUseLookCell) {
    const sector =
      params.forcedLookSector !== null && params.forcedLookSector !== undefined
        ? ((params.forcedLookSector % 16) + 16) % 16
        : params.effectiveState === 'look' && !params.isPointerLooking
        ? (((params.forcedFrame ?? params.frameIndex) % 16) + 16) % 16
        : ((params.activeLookSector % 16) + 16) % 16;
    const lookSpec = SPEX_LOOK_DIRECTIONS[sector] || SPEX_LOOK_DIRECTIONS[0];
    row = lookSpec.row;
    col = lookSpec.col;
  } else {
    const safeFrame =
      params.forcedFrame !== null && params.forcedFrame !== undefined
        ? ((params.forcedFrame % stateMeta.frames) + stateMeta.frames) % stateMeta.frames
        : ((params.frameIndex % stateMeta.frames) + stateMeta.frames) % stateMeta.frames;
    row = stateMeta.row;
    col = safeFrame;
  }

  return {
    row,
    col,
    bgPosX: `${(col / 7) * 100}%`,
    bgPosY: `${(row / 10) * 100}%`,
    shouldUseLookCell,
  };
}

let cachedWebpSupport: boolean | null = null;
function detectWebpSupport(): boolean {
  if (cachedWebpSupport !== null) return cachedWebpSupport;
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      cachedWebpSupport = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      return cachedWebpSupport;
    }
  } catch {
    // fallback
  }
  cachedWebpSupport = true;
  return true;
}

export function resolveSpritesheetUrl(supportsWebp: boolean): string {
  return supportsWebp ? SPEX_SPRITESHEET_WEBP : SPEX_SPRITESHEET_PNG;
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
  const spriteLayerRef = useRef<HTMLSpanElement>(null);
  const frameIndexRef = useRef(0);
  const activeLookSectorRef = useRef<number>(8);
  const isPointerLookingRef = useRef(false);
  const lastReportedRef = useRef<{ row: number; col: number }>({ row: -1, col: -1 });

  const [transientState, setTransientState] = useState<SpexAnimationState | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isOnScreen, setIsOnScreen] = useState(true);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden
  );

  const onSectorChangeRef = useRef(onSectorChange);
  onSectorChangeRef.current = onSectorChange;
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsOnScreen(entry.isIntersecting);
        }
      },
      { rootMargin: '80px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const effectiveState: SpexAnimationState = transientState || state;
  const stateMeta = SPEX_ANIMATION_STATES[effectiveState] || SPEX_ANIMATION_STATES.idle;
  const fps = fpsOverride || stateMeta.defaultFps;

  const paintSpriteFrame = useCallback(() => {
    const coords = computeSpriteFrameCoords({
      effectiveState,
      lookAtCursor,
      isPointerLooking: isPointerLookingRef.current,
      hasTransientState: Boolean(transientState),
      forcedLookSector,
      forcedFrame,
      frameIndex: frameIndexRef.current,
      activeLookSector: activeLookSectorRef.current,
    });

    if (spriteLayerRef.current) {
      spriteLayerRef.current.style.backgroundPosition = `${coords.bgPosX} ${coords.bgPosY}`;
    }

    if (
      lastReportedRef.current.row !== coords.row ||
      lastReportedRef.current.col !== coords.col
    ) {
      lastReportedRef.current = { row: coords.row, col: coords.col };
      onFrameChangeRef.current?.(coords.col, coords.row, coords.col);
    }
  }, [effectiveState, lookAtCursor, transientState, forcedLookSector, forcedFrame]);

  // Reset frame index when state changes and paint immediately
  useEffect(() => {
    frameIndexRef.current = 0;
    paintSpriteFrame();
  }, [effectiveState, forcedLookSector, forcedFrame, paintSpriteFrame]);

  // Zero-react-rerender DOM animation interval (auto-paused when off-screen or tab hidden)
  useEffect(() => {
    if (paused || reducedMotion || !isOnScreen || !isDocumentVisible) return;
    if (forcedFrame !== null && forcedFrame !== undefined) return;
    if (effectiveState === 'look' && (forcedLookSector !== null || isPointerLookingRef.current)) return;

    const totalFrames = effectiveState === 'look' ? 16 : stateMeta.frames;
    const intervalMs = Math.max(45, Math.round(1000 / fps));

    const timer = window.setInterval(() => {
      if (effectiveState === 'look' && isPointerLookingRef.current) return;
      frameIndexRef.current = (frameIndexRef.current + 1) % totalFrames;
      paintSpriteFrame();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    effectiveState,
    stateMeta.frames,
    fps,
    paused,
    reducedMotion,
    isOnScreen,
    isDocumentVisible,
    forcedFrame,
    forcedLookSector,
    paintSpriteFrame,
  ]);

  // rAF-throttled 16-angle cursor gaze tracking (zero layout thrash, zero React state per pixel)
  useEffect(() => {
    if (!lookAtCursor && effectiveState !== 'look') {
      isPointerLookingRef.current = false;
      paintSpriteFrame();
      return;
    }
    if (forcedLookSector !== null && forcedLookSector !== undefined) {
      return;
    }
    if (!isOnScreen || !isDocumentVisible) return;

    let rafId: number | null = null;
    let pendingEvent: MouseEvent | null = null;

    const processMouse = () => {
      rafId = null;
      const e = pendingEvent;
      pendingEvent = null;
      const el = containerRef.current;
      if (!e || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.hypot(dx, dy);

      const spec = distance < 10 ? SPEX_LOOK_DIRECTIONS[8] : getLookCellFromVector(dx, dy);
      const changed =
        activeLookSectorRef.current !== spec.sector || !isPointerLookingRef.current;
      activeLookSectorRef.current = spec.sector;
      isPointerLookingRef.current = true;

      if (changed) {
        paintSpriteFrame();
        onSectorChangeRef.current?.(spec);
      }

      if (pointerIdleTimeoutRef.current) {
        window.clearTimeout(pointerIdleTimeoutRef.current);
      }
      pointerIdleTimeoutRef.current = window.setTimeout(() => {
        isPointerLookingRef.current = false;
        paintSpriteFrame();
      }, 2400);
    };

    const handleMouseMove = (e: MouseEvent) => {
      pendingEvent = e;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(processMouse);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (pointerIdleTimeoutRef.current) {
        window.clearTimeout(pointerIdleTimeoutRef.current);
      }
    };
  }, [lookAtCursor, effectiveState, forcedLookSector, isOnScreen, isDocumentVisible, paintSpriteFrame]);

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

  const initialCoords = computeSpriteFrameCoords({
    effectiveState,
    lookAtCursor,
    isPointerLooking: isPointerLookingRef.current,
    hasTransientState: Boolean(transientState),
    forcedLookSector,
    forcedFrame,
    frameIndex: frameIndexRef.current,
    activeLookSector: activeLookSectorRef.current,
  });

  const spritesheetUrl = resolveSpritesheetUrl(detectWebpSupport());

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
        ref={spriteLayerRef}
        aria-hidden="true"
        className="block w-full h-full bg-no-repeat pointer-events-none transition-transform duration-150"
        style={{
          aspectRatio: '192 / 208',
          maxHeight: '100%',
          maxWidth: '100%',
          backgroundImage: `url("${spritesheetUrl}")`,
          backgroundSize: '800% 1100%',
          backgroundPosition: `${initialCoords.bgPosX} ${initialCoords.bgPosY}`,
          filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16))',
          willChange: 'background-position',
        }}
      />
    </span>
  );
};

export default SpexSprite;
