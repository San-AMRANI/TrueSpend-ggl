import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Maximize2, Check } from 'lucide-react';
import {
  THEME_PRESETS,
  useTheme,
  type ResolvedThemeId,
  type ThemeId,
} from '../../context/ThemeContext';
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

interface SpexAvatarProps {
  className?: string;
  size?: number | string;
  animated?: boolean;
  themeId?: ThemeId | ResolvedThemeId;
  clickable?: boolean;
}

export const SpexAvatar: React.FC<SpexAvatarProps> = ({
  className = 'w-full h-full',
  size,
  animated = false,
  themeId,
  clickable = true,
}) => {
  const { resolvedTheme, setTheme } = useTheme();
  const activeThemeId: ResolvedThemeId =
    themeId && themeId !== 'system' ? (themeId as ResolvedThemeId) : resolvedTheme;
  const avatarMeta = getSpexAvatarForTheme(activeThemeId);
  const style = size ? { width: size, height: size } : undefined;

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [previewThemeId, setPreviewThemeId] = useState<ResolvedThemeId>(activeThemeId);

  useEffect(() => {
    if (isLightboxOpen) {
      setPreviewThemeId(activeThemeId);
    }
  }, [isLightboxOpen, activeThemeId]);

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

  const previewAvatarMeta = getSpexAvatarForTheme(previewThemeId);
  const previewPreset =
    THEME_PRESETS.find((p) => p.id === previewThemeId) || THEME_PRESETS[0];

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
            ? `${avatarMeta.editionName} — Click to view full avatar`
            : `${avatarMeta.editionName} — TrueSpend AI Financial Intelligence`
        }
      >
        <img
          src={avatarMeta.src}
          alt={avatarMeta.editionName}
          className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
          draggable={false}
        />
      </span>

      {isLightboxOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(false);
            }}
          >
            <div
              className="relative w-full max-w-md rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300"
              style={{
                backgroundColor: previewPreset.swatches.surface,
                borderColor: previewPreset.swatches.border,
                color: previewPreset.swatches.text,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Header Bar */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
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
                      {previewAvatarMeta.editionName}
                    </h3>
                    <p className="text-[11px] opacity-75 truncate">
                      {previewPreset.name} Theme · {previewPreset.tagline}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="p-1.5 rounded-lg opacity-70 hover:opacity-100 transition-opacity"
                  style={{
                    backgroundColor: previewPreset.swatches.surface,
                    border: `1px solid ${previewPreset.swatches.border}`,
                  }}
                  title="Close preview (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Big Full-Resolution Spex Stage */}
              <div
                className="relative flex flex-col items-center justify-center p-6 sm:p-8 overflow-hidden"
                style={{
                  backgroundColor: previewPreset.swatches.canvas,
                }}
              >
                {/* Ambient Theme Glow Behind Character */}
                <div
                  className="pointer-events-none absolute w-64 h-64 rounded-full blur-3xl opacity-25 transition-colors duration-500"
                  style={{
                    background: `radial-gradient(circle, ${previewPreset.swatches.accent}, ${previewPreset.swatches.secondaryAccent}, transparent 70%)`,
                  }}
                />

                <img
                  src={previewAvatarMeta.src}
                  alt={previewAvatarMeta.editionName}
                  className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 object-contain drop-shadow-2xl select-none transition-transform duration-300 hover:scale-105"
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
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default SpexAvatar;


