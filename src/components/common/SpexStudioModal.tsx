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
} from '../../context/ThemeContext';
import {
  SpexSprite,
  SPEX_ANIMATION_STATES,
  SPEX_LOOK_DIRECTIONS,
  type SpexAnimationState,
  type LookDirectionSpec,
} from './SpexSprite';
import { getSpexThemeEditionMeta, loadSpexAvatarSrc } from './spexAvatarAssets';

interface SpexStudioModalProps {
  activeThemeId: ResolvedThemeId;
  initialSpriteState: SpexAnimationState;
  onClose: () => void;
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

const DISTINCT_EDITIONS: { themeId: ResolvedThemeId; shortLabel: string }[] = [
  { themeId: 'light', shortLabel: 'Alabaster' },
  { themeId: 'dark', shortLabel: 'Obsidian' },
  { themeId: 'vintage', shortLabel: 'Vintage' },
  { themeId: 'terminal', shortLabel: 'Terminal' },
  { themeId: 'kyoto-zen', shortLabel: 'Kyoto Zen' },
  { themeId: 'tokyo-night', shortLabel: 'Neo-Tokyo' },
];

export const SpexStudioModal: React.FC<SpexStudioModalProps> = ({
  activeThemeId,
  initialSpriteState,
  onClose,
}) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [studioTab, setStudioTab] = useState<'animations' | 'editions'>('animations');
  const [previewThemeId, setPreviewThemeId] = useState<ResolvedThemeId>(activeThemeId);

  const [studioState, setStudioState] = useState<SpexAnimationState>(
    initialSpriteState === 'idle' ? 'waving' : initialSpriteState
  );
  const [studioPaused, setStudioPaused] = useState(false);
  const [studioFps, setStudioFps] = useState<number>(
    SPEX_ANIMATION_STATES[initialSpriteState === 'idle' ? 'waving' : initialSpriteState].defaultFps
  );
  const [studioManualFrame, setStudioManualFrame] = useState<number | null>(null);
  const [studioForcedSector, setStudioForcedSector] = useState<number | null>(null);
  const [liveCellInfo, setLiveCellInfo] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [liveLookSpec, setLiveLookSpec] = useState<LookDirectionSpec>(SPEX_LOOK_DIRECTIONS[8]);
  const [editionSrcs, setEditionSrcs] = useState<Partial<Record<ResolvedThemeId, string>>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void loadSpexAvatarSrc(previewThemeId).then((src) => {
      if (!cancelled) {
        setEditionSrcs((prev) => (prev[previewThemeId] === src ? prev : { ...prev, [previewThemeId]: src }));
      }
    });
    if (studioTab === 'editions') {
      DISTINCT_EDITIONS.forEach((ed) => {
        void loadSpexAvatarSrc(ed.themeId).then((src) => {
          if (!cancelled) {
            setEditionSrcs((prev) => (prev[ed.themeId] === src ? prev : { ...prev, [ed.themeId]: src }));
          }
        });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [previewThemeId, studioTab]);

  const handleSelectStudioState = (nextState: SpexAnimationState) => {
    setStudioState(nextState);
    setStudioFps(SPEX_ANIMATION_STATES[nextState].defaultFps);
    setStudioManualFrame(null);
    setStudioPaused(false);
    if (nextState !== 'look') {
      setStudioForcedSector(null);
    }
  };

  const previewMeta = getSpexThemeEditionMeta(previewThemeId);
  const previewSrc = editionSrcs[previewThemeId] || '/spex-avatar.png';
  const previewPreset = THEME_PRESETS.find((p) => p.id === previewThemeId) || THEME_PRESETS[0];
  const currentStudioMeta = SPEX_ANIMATION_STATES[studioState] || SPEX_ANIMATION_STATES.idle;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
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
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: previewPreset.swatches.accent }} />
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">
                {studioTab === 'animations'
                  ? 'SPEX Spritesheet v2 · Animation & Gaze Studio'
                  : previewMeta.editionName}
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
                onClose();
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
              onClick={onClose}
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
              <div
                className="relative flex flex-col items-center justify-center p-5 sm:p-6 overflow-hidden"
                style={{ backgroundColor: previewPreset.swatches.canvas }}
              >
                <div
                  className="pointer-events-none absolute w-60 h-60 rounded-full blur-3xl opacity-25 transition-colors duration-500"
                  style={{
                    background: `radial-gradient(circle, ${previewPreset.swatches.accent}, ${previewPreset.swatches.secondaryAccent}, transparent 70%)`,
                  }}
                />

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
                    <Eye className="w-3.5 h-3.5" style={{ color: previewPreset.swatches.accent }} />
                    <span>{currentStudioMeta.label}</span>
                  </div>
                  <p className="text-[11px] opacity-75 mt-0.5 leading-snug">
                    {currentStudioMeta.description}
                  </p>
                </div>
              </div>

              <div
                className="p-4 border-t space-y-4"
                style={{
                  backgroundColor: previewPreset.swatches.surface,
                  borderColor: previewPreset.swatches.border,
                }}
              >
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
                          <span className={`text-[9px] font-mono ${isSelected ? 'opacity-90' : 'opacity-55'}`}>
                            {stId === 'look' ? '16 dir' : `${meta.frames}f`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                        <Compass className="w-3.5 h-3.5" style={{ color: previewPreset.swatches.accent }} />
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
                            <div className="text-[8px] font-mono opacity-75">{dir.angleDeg}°</div>
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
                        <label className="text-[10px] font-mono opacity-75">Speed: {studioFps} FPS</label>
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
              <div
                className="relative flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden"
                style={{ backgroundColor: previewPreset.swatches.canvas }}
              >
                <div
                  className="pointer-events-none absolute w-64 h-64 rounded-full blur-3xl opacity-25 transition-colors duration-500"
                  style={{
                    background: `radial-gradient(circle, ${previewPreset.swatches.accent}, ${previewPreset.swatches.secondaryAccent}, transparent 70%)`,
                  }}
                />

                <img
                  src={previewSrc}
                  alt={previewMeta.editionName}
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
                    <Maximize2 className="w-3 h-3" style={{ color: previewPreset.swatches.accent }} />
                    {previewMeta.archetype}
                  </span>
                </div>
              </div>

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
                  {previewThemeId !== resolvedTheme ? (
                    <button
                      type="button"
                      onClick={() => setTheme(previewThemeId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95"
                      style={{ backgroundColor: previewPreset.swatches.accent }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Switch to {previewPreset.name}
                    </button>
                  ) : (
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
                    const itemMeta = getSpexThemeEditionMeta(item.themeId);
                    const itemPreset = THEME_PRESETS.find((p) => p.id === item.themeId) || THEME_PRESETS[0];
                    const isSelected = getSpexThemeEditionMeta(previewThemeId).assetKey === itemMeta.assetKey;
                    const thumbSrc = editionSrcs[item.themeId] || '/spex-avatar.jpg';

                    return (
                      <button
                        key={item.themeId}
                        type="button"
                        onClick={() => setPreviewThemeId(item.themeId)}
                        className="flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all hover:scale-105"
                        style={{
                          backgroundColor: itemPreset.swatches.canvas,
                          borderColor: isSelected ? previewPreset.swatches.accent : itemPreset.swatches.border,
                          boxShadow: isSelected ? `0 0 0 2px ${previewPreset.swatches.accent}` : undefined,
                        }}
                        title={`Preview ${itemMeta.editionName}`}
                      >
                        <img src={thumbSrc} alt={item.shortLabel} className="w-9 h-9 object-contain" />
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
    document.body
  );
};

export default SpexStudioModal;
