import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Maximize2,
  Check,
  Play,
  Pause,
  Compass,
  Film,
  Palette,
  Eye,
  Zap,
} from 'lucide-react';
import {
  THEME_PRESETS,
  useTheme,
  type ResolvedThemeId,
  type ThemeId,
} from '../../context/ThemeContext';
import {
  SpexSprite,
  SPEX_ANIMATION_STATES,
  SPEX_LOOK_DIRECTIONS,
  type SpexAnimationState,
  type LookDirectionSpec,
} from './SpexSprite';
import spexLightSrc from '../../assets/spex-light.png';
import spexVintageSrc from '../../assets/spex-vintage.png';
import spexKyotoSrc from '../../assets/spex-kyoto.png';
import spexDarkSrc from '../../assets/spex-dark.png';
import spexTerminalSrc from '../../assets/spex-terminal.png';
import spexTokyoSrc from '../../assets/spex-tokyo.png';

export const THEME_SPEX_AVATARS: Record<
  ResolvedThemeId,
  { src: string; editionName: string; archetype: string }
> = {
  light: {
    src: spexLightSrc,
    editionName: 'Swiss Alabaster Spex',
    archetype: 'White & Indigo Ceramic Shell · Mint Holographic Visor',
  },
  vintage: {
    src: spexVintageSrc,
    editionName: '1920s Clockwork Ledger Spex',
    archetype: 'Brushed Brass & Parchment Enamel · Warm Amber Visor',
  },
  espresso: {
    src: spexVintageSrc,
    editionName: 'Archival Bronze & Espresso Spex',
    archetype: 'Brushed Brass & Roasted Umber · Warm Amber Visor',
  },
  'sahara-dune': {
    src: spexVintageSrc,
    editionName: 'Terracotta & Oasis Spex',
    archetype: 'Sun-Baked Ochre & Brass Accents · Warm Amber Visor',
  },
  'kyoto-zen': {
    src: spexKyotoSrc,
    editionName: 'Kyoto Matcha & Hinoki Spex',
    archetype: 'Washi Stone & Botanical Sage · Jade Bamboo Visor',
  },
  'rose-atelier': {
    src: spexLightSrc,
    editionName: 'Porcelain & Alabaster Spex',
    archetype: 'Silk Alabaster & Indigo Trim · Mint Holographic Visor',
  },
  dark: {
    src: spexDarkSrc,
    editionName: 'Midnight Carbon Obsidian Spex',
    archetype: 'Matte Carbon-Weave Armor · Electric Violet & Cyan Visor',
  },
  'emerald-night': {
    src: spexDarkSrc,
    editionName: 'Nordic Emerald Vault Spex',
    archetype: 'Obsidian Carbon-Weave Armor · Emerald & Cyan Visor',
  },
  terminal: {
    src: spexTerminalSrc,
    editionName: 'Amber Quant Radar Spex',
    archetype: 'Stealth Matte-Black Chassis · Phosphor Amber & Radar Green',
  },
  'wall-street': {
    src: spexTerminalSrc,
    editionName: 'Bullion & Harbor Desk Spex',
    archetype: 'Stealth Executive Chassis · Bullion Gold & Radar Green',
  },
  'tokyo-night': {
    src: spexTokyoSrc,
    editionName: 'Neo-Tokyo Cyber Neon Spex',
    archetype: 'Deep Violet Cyber-Armor · Magenta & Electric Cyan Neon',
  },
  'deep-abyss': {
    src: spexDarkSrc,
    editionName: 'Bioluminescent Abyss Spex',
    archetype: 'Trench Obsidian Carbon Shell · Bioluminescent Cyan Visor',
  },
};

export function getSpexAvatarForTheme(themeId?: ThemeId | ResolvedThemeId): {
  src: string;
  editionName: string;
  archetype: string;
} {
  if (!themeId || themeId === 'system') {
    return THEME_SPEX_AVATARS.light;
  }
  return THEME_SPEX_AVATARS[themeId as ResolvedThemeId] || THEME_SPEX_AVATARS.light;
}

export interface SpexAvatarProps {
  className?: string;
  size?: number | string;
  animated?: boolean;
  state?: SpexAnimationState;
  lookAtCursor?: boolean;
  useSprite?: boolean;
  themeId?: ThemeId | ResolvedThemeId;
  clickable?: boolean;
}

const STUDIO_STATES_ORDER: SpexAnimationState[] = [
  'idle',
  'waving',
  'jumping',
  'running',
  'review',
  'waiting',
  'running-right',
  'running-left',
  'failed',
  'look',
];

export const SpexAvatar: React.FC<SpexAvatarProps> = ({
  className = 'w-full h-full',
  size,
  animated = false,
  state,
  lookAtCursor = false,
  useSprite,
  themeId,
  clickable = false,
}) => {
  const { resolvedTheme, setTheme } = useTheme();
  const activeThemeId: ResolvedThemeId =
    themeId && themeId !== 'system' ? (themeId as ResolvedThemeId) : resolvedTheme;
  const avatarMeta = getSpexAvatarForTheme(activeThemeId);
  const style = size ? { width: size, height: size } : undefined;

  const shouldRenderSprite = Boolean(useSprite ?? (animated || state || lookAtCursor));
  const activeSpriteState: SpexAnimationState = state || 'idle';

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<'animations' | 'editions'>('animations');
  const [previewThemeId, setPreviewThemeId] = useState<ResolvedThemeId>(activeThemeId);

  // Studio Interactive Controls
  const [studioState, setStudioState] = useState<SpexAnimationState>(activeSpriteState);
  const [studioPaused, setStudioPaused] = useState(false);
  const [studioFps, setStudioFps] = useState<number>(8);
  const [studioManualFrame, setStudioManualFrame] = useState<number | null>(null);
  const [studioForcedSector, setStudioForcedSector] = useState<number | null>(null);
  const [liveCellInfo, setLiveCellInfo] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [liveLookSpec, setLiveLookSpec] = useState<LookDirectionSpec>(SPEX_LOOK_DIRECTIONS[8]);

  useEffect(() => {
    if (isLightboxOpen) {
      setPreviewThemeId(activeThemeId);
      setStudioState(state || 'waving');
      setStudioFps(SPEX_ANIMATION_STATES[state || 'waving'].defaultFps);
      setStudioManualFrame(null);
      setStudioForcedSector(null);
    }
  }, [isLightboxOpen, activeThemeId, state]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  const handleAvatarClick = (e: React.MouseEvent) => {
    if (!clickable) return;
    e.stopPropagation();
    e.preventDefault();
    setPreviewThemeId(activeThemeId);
    setIsLightboxOpen(true);
  };

  const handleSelectStudioState = (nextState: SpexAnimationState) => {
    setStudioState(nextState);
    setStudioFps(SPEX_ANIMATION_STATES[nextState].defaultFps);
    setStudioManualFrame(null);
    setStudioPaused(false);
    if (nextState !== 'look') {
      setStudioForcedSector(null);
    }
  };

  const previewAvatarMeta = getSpexAvatarForTheme(previewThemeId);
  const previewPreset =
    THEME_PRESETS.find((p) => p.id === previewThemeId) || THEME_PRESETS[0];
  const currentStudioMeta = SPEX_ANIMATION_STATES[studioState] || SPEX_ANIMATION_STATES.idle;

  // 6 distinct visual Spex character editions for quick switcher inside lightbox
  const DISTINCT_EDITIONS: { themeId: ResolvedThemeId; shortLabel: string }[] = [
    { themeId: 'light', shortLabel: 'Alabaster' },
    { themeId: 'dark', shortLabel: 'Obsidian' },
    { themeId: 'vintage', shortLabel: 'Vintage' },
    { themeId: 'terminal', shortLabel: 'Terminal' },
    { themeId: 'kyoto-zen', shortLabel: 'Kyoto Zen' },
    { themeId: 'tokyo-night', shortLabel: 'Neo-Tokyo' },
  ];

  return (
    <>
      <span
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleAvatarClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  setPreviewThemeId(activeThemeId);
                  setIsLightboxOpen(true);
                }
              }
            : undefined
        }
        style={style}
        className={`inline-flex items-center justify-center shrink-0 select-none ${
          clickable ? 'cursor-pointer group/spex focus:outline-none' : ''
        } ${
          animated || clickable ? 'hover:scale-105 active:scale-95 transition-transform duration-200' : ''
        } ${className}`}
        title={
          clickable
            ? `${avatarMeta.editionName} (${SPEX_ANIMATION_STATES[activeSpriteState].shortLabel}) — Click to open SPEX Animation Studio`
            : `${avatarMeta.editionName} — TrueSpend AI Financial Intelligence`
        }
      >
        {shouldRenderSprite ? (
          <SpexSprite
            state={activeSpriteState}
            lookAtCursor={lookAtCursor}
            interactive={!clickable}
            className="w-full h-full"
          />
        ) : (
          <img
            src={avatarMeta.src}
            alt={avatarMeta.editionName}
            className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
            draggable={false}
          />
        )}
      </span>

      {isLightboxOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(false);
            }}
          >
            <div
              className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: previewPreset.swatches.surface,
                borderColor: previewPreset.swatches.border,
                color: previewPreset.swatches.text,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Header Bar */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b shrink-0"
                style={{
                  backgroundColor: previewPreset.swatches.canvas,
                  borderColor: previewPreset.swatches.border,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles
                    className="w-4 h-4 shrink-0"
                    style={{ color: previewPreset.swatches.accent }}
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold truncate">
                      {studioTab === 'animations'
                        ? 'SPEX Spritesheet v2 · Animation & Gaze Studio'
                        : previewAvatarMeta.editionName}
                    </h3>
                    <p className="text-[11px] opacity-75 truncate">
                      {studioTab === 'animations'
                        ? '8×11 RGBA Atlas (1536×2288) · 9 Motion Loops + 16-Angle Gaze'
                        : `${previewPreset.name} Theme · ${previewPreset.tagline}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('truespend:toggleSpexPet', { detail: { forceOpen: true } })
                      );
                      setIsLightboxOpen(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: previewPreset.swatches.accent }}
                    title="Summon interactive SPEX Companion Pet on the dashboard"
                  >
                    <Zap className="w-3 h-3" />
                    <span className="hidden sm:inline">Companion Pet</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(false)}
                    className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: previewPreset.swatches.surface,
                      border: `1px solid ${previewPreset.swatches.border}`,
                    }}
                    title="Close studio (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Studio Mode Switcher Tabs */}
              <div
                className="grid grid-cols-2 p-1.5 gap-1.5 border-b shrink-0"
                style={{
                  backgroundColor: previewPreset.swatches.surface,
                  borderColor: previewPreset.swatches.border,
                }}
              >
                <button
                  type="button"
                  onClick={() => setStudioTab('animations')}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    backgroundColor:
                      studioTab === 'animations'
                        ? previewPreset.swatches.accent
                        : previewPreset.swatches.canvas,
                    color: studioTab === 'animations' ? '#ffffff' : previewPreset.swatches.text,
                  }}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Live Animations &amp; 16° Gaze</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudioTab('editions')}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    backgroundColor:
                      studioTab === 'editions'
                        ? previewPreset.swatches.accent
                        : previewPreset.swatches.canvas,
                    color: studioTab === 'editions' ? '#ffffff' : previewPreset.swatches.text,
                  }}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>6 Theme Editions</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {studioTab === 'animations' ? (
                  <>
                    {/* Live Animated Sprite Stage */}
                    <div
                      className="relative flex flex-col items-center justify-center p-5 sm:p-6 overflow-hidden"
                      style={{
                        backgroundColor: previewPreset.swatches.canvas,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute w-60 h-60 rounded-full blur-3xl opacity-25 transition-colors duration-500"
                        style={{
                          background: `radial-gradient(circle, ${previewPreset.swatches.accent}, ${previewPreset.swatches.secondaryAccent}, transparent 70%)`,
                        }}
                      />

                      {/* Telemetry Badge Top-Left */}
                      <div
                        className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono"
                        style={{
                          backgroundColor: previewPreset.swatches.surface,
                          border: `1px solid ${previewPreset.swatches.border}`,
                        }}
                      >
                        <span>
                          Row {liveCellInfo.row} · Col {liveCellInfo.col}
                        </span>
                        <span className="opacity-40">|</span>
                        <span>192×208px</span>
                      </div>

                      {/* Play / Pause Button Top-Right */}
                      {studioState !== 'look' && (
                        <button
                          type="button"
                          onClick={() => {
                            setStudioManualFrame(null);
                            setStudioPaused((p) => !p);
                          }}
                          className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-opacity hover:opacity-90"
                          style={{
                            backgroundColor: previewPreset.swatches.surface,
                            border: `1px solid ${previewPreset.swatches.border}`,
                          }}
                        >
                          {studioPaused ? (
                            <>
                              <Play className="w-3 h-3" /> Play
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3" /> Pause
                            </>
                          )}
                        </button>
                      )}

                      <div className="relative z-10 w-48 h-52 sm:w-56 sm:h-60 flex items-center justify-center">
                        <SpexSprite
                          state={studioState}
                          lookAtCursor={studioState === 'look' || studioState === 'idle'}
                          forcedLookSector={studioForcedSector}
                          forcedFrame={studioManualFrame}
                          fpsOverride={studioFps}
                          paused={studioPaused}
                          className="w-full h-full"
                          onSectorChange={setLiveLookSpec}
                          onFrameChange={(_f, r, c) => setLiveCellInfo({ row: r, col: c })}
                        />
                      </div>

                      <div className="relative z-10 mt-2 text-center max-w-sm">
                        <div className="inline-flex items-center gap-1.5 text-xs font-bold">
                          <Eye
                            className="w-3.5 h-3.5"
                            style={{ color: previewPreset.swatches.accent }}
                          />
                          <span>{currentStudioMeta.label}</span>
                        </div>
                        <p className="text-[11px] opacity-75 mt-0.5 leading-snug">
                          {currentStudioMeta.description}
                        </p>
                      </div>
                    </div>

                    {/* Controls Panel */}
                    <div
                      className="p-4 border-t space-y-4"
                      style={{
                        backgroundColor: previewPreset.swatches.surface,
                        borderColor: previewPreset.swatches.border,
                      }}
                    >
                      {/* 10 State Selector Grid */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                            Select Animation State (9 Loops + 16° Gaze)
                          </span>
                          <span className="text-[10px] font-mono opacity-60">
                            {studioState === 'look'
                              ? '16 Angles'
                              : `${currentStudioMeta.frames} Frames @ ${studioFps} FPS`}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {STUDIO_STATES_ORDER.map((stId) => {
                            const meta = SPEX_ANIMATION_STATES[stId];
                            const isSelected = studioState === stId;
                            return (
                              <button
                                key={stId}
                                type="button"
                                onClick={() => handleSelectStudioState(stId)}
                                className="flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border text-[11px] font-semibold transition-all hover:scale-[1.02]"
                                style={{
                                  backgroundColor: isSelected
                                    ? previewPreset.swatches.accent
                                    : previewPreset.swatches.canvas,
                                  borderColor: isSelected
                                    ? previewPreset.swatches.accent
                                    : previewPreset.swatches.border,
                                  color: isSelected ? '#ffffff' : previewPreset.swatches.text,
                                }}
                              >
                                <span className="truncate max-w-full">{meta.shortLabel}</span>
                                <span
                                  className={`text-[9px] font-mono ${
                                    isSelected ? 'opacity-90' : 'opacity-55'
                                  }`}
                                >
                                  {stId === 'look' ? '16 dir' : `${meta.frames}f`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Contextual Inspector: 16-Angle Compass OR Frame Scrubber + FPS */}
                      {studioState === 'look' ? (
                        <div
                          className="p-3 rounded-xl border space-y-2.5"
                          style={{
                            backgroundColor: previewPreset.swatches.canvas,
                            borderColor: previewPreset.swatches.border,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                              <Compass
                                className="w-3.5 h-3.5"
                                style={{ color: previewPreset.swatches.accent }}
                              />
                              16-Direction Gaze Compass
                            </span>
                            <button
                              type="button"
                              onClick={() => setStudioForcedSector(null)}
                              className="text-[10px] font-semibold underline opacity-80 hover:opacity-100"
                              style={{ color: previewPreset.swatches.accent }}
                            >
                              {studioForcedSector === null
                                ? `Following Cursor (${liveLookSpec.label})`
                                : 'Resume Live Cursor Tracking'}
                            </button>
                          </div>

                          <div className="grid grid-cols-8 gap-1">
                            {SPEX_LOOK_DIRECTIONS.map((dir) => {
                              const isActive =
                                studioForcedSector !== null
                                  ? studioForcedSector === dir.sector
                                  : liveLookSpec.sector === dir.sector;
                              return (
                                <button
                                  key={dir.sector}
                                  type="button"
                                  onClick={() => setStudioForcedSector(dir.sector)}
                                  className="py-1.5 px-1 rounded-lg border text-center transition-all"
                                  style={{
                                    backgroundColor: isActive
                                      ? previewPreset.swatches.accent
                                      : previewPreset.swatches.surface,
                                    borderColor: isActive
                                      ? previewPreset.swatches.accent
                                      : previewPreset.swatches.border,
                                    color: isActive ? '#ffffff' : previewPreset.swatches.text,
                                  }}
                                  title={dir.label}
                                >
                                  <div className="text-[10px] font-bold">{dir.compass}</div>
                                  <div className="text-[8px] font-mono opacity-75">
                                    {dir.angleDeg}°
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="p-3 rounded-xl border space-y-2.5"
                          style={{
                            backgroundColor: previewPreset.swatches.canvas,
                            borderColor: previewPreset.swatches.border,
                          }}
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold">Frame-by-Frame Inspector</span>
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-mono opacity-75">
                                Speed: {studioFps} FPS
                              </label>
                              <input
                                type="range"
                                min={3}
                                max={16}
                                value={studioFps}
                                onChange={(e) => setStudioFps(Number(e.target.value))}
                                className="w-20 accent-indigo-600 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {Array.from({ length: currentStudioMeta.frames }).map((_, idx) => {
                              const isCurrent = liveCellInfo.col === idx;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setStudioPaused(true);
                                    setStudioManualFrame(idx);
                                  }}
                                  className="flex-1 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all"
                                  style={{
                                    backgroundColor: isCurrent
                                      ? previewPreset.swatches.accent
                                      : previewPreset.swatches.surface,
                                    borderColor: isCurrent
                                      ? previewPreset.swatches.accent
                                      : previewPreset.swatches.border,
                                    color: isCurrent ? '#ffffff' : previewPreset.swatches.text,
                                  }}
                                >
                                  F{idx}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Big Full-Resolution Spex Theme Edition Stage */}
                    <div
                      className="relative flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden"
                      style={{
                        backgroundColor: previewPreset.swatches.canvas,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute w-64 h-64 rounded-full blur-3xl opacity-25 transition-colors duration-500"
                        style={{
                          background: `radial-gradient(circle, ${previewPreset.swatches.accent}, ${previewPreset.swatches.secondaryAccent}, transparent 70%)`,
                        }}
                      />

                      <img
                        src={previewAvatarMeta.src}
                        alt={previewAvatarMeta.editionName}
                        className="relative z-10 w-60 h-60 sm:w-72 sm:h-72 object-contain drop-shadow-2xl select-none transition-transform duration-300 hover:scale-105"
                      />

                      <div className="relative z-10 mt-3 text-center">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium"
                          style={{
                            backgroundColor: previewPreset.swatches.surface,
                            border: `1px solid ${previewPreset.swatches.border}`,
                            color: previewPreset.swatches.text,
                          }}
                        >
                          <Maximize2
                            className="w-3 h-3"
                            style={{ color: previewPreset.swatches.accent }}
                          />
                          {previewAvatarMeta.archetype}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Edition Switcher & Theme Action Bar */}
                    <div
                      className="p-4 border-t space-y-3"
                      style={{
                        backgroundColor: previewPreset.swatches.surface,
                        borderColor: previewPreset.swatches.border,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
                          Inspect All 6 Spex Editions
                        </span>
                        {previewThemeId !== resolvedTheme && (
                          <button
                            type="button"
                            onClick={() => setTheme(previewThemeId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95"
                            style={{ backgroundColor: previewPreset.swatches.accent }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Switch to {previewPreset.name}
                          </button>
                        )}
                        {previewThemeId === resolvedTheme && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold"
                            style={{ color: previewPreset.swatches.accent }}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Active Theme
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-6 gap-2">
                        {DISTINCT_EDITIONS.map((item) => {
                          const itemAvatar = getSpexAvatarForTheme(item.themeId);
                          const itemPreset =
                            THEME_PRESETS.find((p) => p.id === item.themeId) || THEME_PRESETS[0];
                          const isSelected = previewAvatarMeta.src === itemAvatar.src;

                          return (
                            <button
                              key={item.themeId}
                              type="button"
                              onClick={() => setPreviewThemeId(item.themeId)}
                              className="flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all hover:scale-105"
                              style={{
                                backgroundColor: itemPreset.swatches.canvas,
                                borderColor: isSelected
                                  ? previewPreset.swatches.accent
                                  : itemPreset.swatches.border,
                                boxShadow: isSelected
                                  ? `0 0 0 2px ${previewPreset.swatches.accent}`
                                  : undefined,
                              }}
                              title={`Preview ${itemAvatar.editionName}`}
                            >
                              <img
                                src={itemAvatar.src}
                                alt={item.shortLabel}
                                className="w-9 h-9 object-contain"
                              />
                              <span
                                className="text-[9px] font-semibold truncate w-full text-center"
                                style={{ color: itemPreset.swatches.text }}
                              >
                                {item.shortLabel}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default SpexAvatar;
