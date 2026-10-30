import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  THEME_PRESETS,
  useTheme,
  type FontStyle,
  type RadiusStyle,
  type SurfaceStyle,
  type ThemeId,
} from '../../context/ThemeContext';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Check,
  RotateCcw,
  Type,
  Box,
  Layers,
  Feather,
  Terminal,
  Shield,
  Coffee,
  Compass,
  Zap,
  Landmark,
  Leaf,
  Gem,
  Waves,
} from 'lucide-react';

const THEME_ICONS: Record<string, React.FC<{ className?: string }>> = {
  light: Sun,
  vintage: Feather,
  espresso: Coffee,
  'sahara-dune': Compass,
  'kyoto-zen': Leaf,
  'rose-atelier': Gem,
  dark: Moon,
  'emerald-night': Shield,
  terminal: Terminal,
  'tokyo-night': Zap,
  'wall-street': Landmark,
  'deep-abyss': Waves,
};

const RADIUS_OPTIONS: { id: RadiusStyle; label: string; desc: string; previewRadius: string }[] = [
  { id: 'theme-default', label: 'Theme Native', desc: 'Follows selected theme', previewRadius: 'rounded-md' },
  { id: 'sharp', label: 'Sharp Ledger', desc: 'Crisp 2px corners', previewRadius: 'rounded-none' },
  { id: 'balanced', label: 'Balanced', desc: 'Tailored 12px radius', previewRadius: 'rounded-lg' },
  { id: 'soft', label: 'Soft Organic', desc: 'Generous 20px curves', previewRadius: 'rounded-2xl' },
];

const FONT_OPTIONS: { id: FontStyle; label: string; desc: string; sampleClass: string }[] = [
  { id: 'theme-default', label: 'Theme Native', desc: 'Curated per theme', sampleClass: '' },
  { id: 'sans', label: 'Neo-Grotesque', desc: 'Plus Jakarta Sans', sampleClass: 'font-sans' },
  { id: 'editorial', label: 'Vintage Serif', desc: 'Fraunces & Lora', sampleClass: 'font-serif' },
  { id: 'technical', label: 'Quant Mono', desc: 'IBM Plex Mono', sampleClass: 'font-mono' },
];

const SURFACE_OPTIONS: { id: SurfaceStyle; label: string; desc: string }[] = [
  { id: 'theme-default', label: 'Theme Native', desc: 'Default finish' },
  { id: 'flat', label: 'Flat Hairline', desc: 'Crisp 1px borders, no shadow' },
  { id: 'elevated', label: 'Elevated Depth', desc: 'Ambient studio shadow' },
  { id: 'textured', label: 'Ruled Ledger', desc: 'Subtle archival lines' },
];

export const ThemeStudioCard: React.FC = () => {
  const {
    theme,
    resolvedTheme,
    activePreset,
    radiusStyle,
    fontStyle,
    surfaceStyle,
    setTheme,
    setRadiusStyle,
    setFontStyle,
    setSurfaceStyle,
    resetStyleOverrides,
  } = useTheme();

  const [activeModeFilter, setActiveModeFilter] = useState<'all' | 'light' | 'dark'>('all');

  const filteredPresets = THEME_PRESETS.filter((p) => {
    if (activeModeFilter === 'all') return true;
    return p.mode === activeModeFilter;
  });

  const hasCustomOverrides =
    radiusStyle !== 'theme-default' ||
    fontStyle !== 'theme-default' ||
    surfaceStyle !== 'theme-default';

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Theme &amp; Frontend Style Studio
          </CardTitle>
          <CardDescription className="mt-1">
            Choose from 12 signature themes (including Vintage Ledger, Moroccan Sahara, Kyoto Zen, Parisian Rose, Wall Street, and Neo-Tokyo) plus independent typography, geometry, and surface texture controls.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
              theme === 'system'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            System Auto
            {theme === 'system' && <Check className="h-3.5 w-3.5 ml-0.5" />}
          </button>

          {hasCustomOverrides && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetStyleOverrides}
              className="flex items-center gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Style Overrides
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-8">
        {/* 1. 12 Signature Themes Grid with Segmented Filter */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                1. Signature Theme Palettes (12 Curated Presets)
              </h4>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Active: <strong className="text-indigo-600 dark:text-indigo-400">{activePreset.name}</strong>
              </span>
            </div>

            {/* Segmented Filter (All / Light / Dark) */}
            <div className="inline-flex items-center p-0.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100/60 dark:bg-gray-900/60 text-xs">
              <button
                type="button"
                onClick={() => setActiveModeFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeModeFilter === 'all'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                All (12)
              </button>
              <button
                type="button"
                onClick={() => setActiveModeFilter('light')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeModeFilter === 'light'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Light (6)
              </button>
              <button
                type="button"
                onClick={() => setActiveModeFilter('dark')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeModeFilter === 'dark'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Dark (6)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredPresets.map((preset) => {
              const isSelected = theme === preset.id || (theme === 'system' && resolvedTheme === preset.id);
              const Icon = THEME_ICONS[preset.id] || Palette;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTheme(preset.id as ThemeId)}
                  className={`group relative flex flex-col text-left rounded-xl border p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-400 ring-1 ring-indigo-600 dark:ring-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900/60'
                  }`}
                >
                  {/* Mini Architectural Theme Viewport Preview */}
                  <div
                    className="w-full h-20 rounded-lg border mb-2.5 p-2 flex flex-col justify-between overflow-hidden relative"
                    style={{
                      backgroundColor: preset.swatches.canvas,
                      borderColor: preset.swatches.border,
                    }}
                  >
                    {/* Top Mini Bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: preset.swatches.accent }}
                        />
                        <span
                          className="text-[11px] font-semibold tracking-tight truncate max-w-[110px]"
                          style={{
                            color: preset.swatches.text,
                            fontFamily:
                              preset.id === 'vintage' || preset.id === 'espresso' || preset.id === 'sahara-dune' || preset.id === 'rose-atelier'
                                ? '"Fraunces", Georgia, serif'
                                : preset.id === 'terminal' || preset.id === 'deep-abyss'
                                ? '"IBM Plex Mono", monospace'
                                : '"Plus Jakarta Sans", sans-serif',
                          }}
                        >
                          {preset.name}
                        </span>
                      </div>
                      <span
                        className="text-[9px] font-mono tabular-nums px-1.5 py-0.2 rounded"
                        style={{
                          backgroundColor: preset.swatches.surface,
                          color: preset.swatches.text,
                          border: `1px solid ${preset.swatches.border}`,
                        }}
                      >
                        {preset.mode.toUpperCase()}
                      </span>
                    </div>

                    {/* Mini Ledger Card inside Viewport */}
                    <div
                      className="rounded p-1.5 flex items-center justify-between"
                      style={{
                        backgroundColor: preset.swatches.surface,
                        border: `1px solid ${preset.swatches.border}`,
                      }}
                    >
                      <div className="space-y-1">
                        <div
                          className="h-1.5 w-12 rounded-full"
                          style={{ backgroundColor: preset.swatches.text, opacity: 0.75 }}
                        />
                        <div
                          className="h-1 w-8 rounded-full"
                          style={{ backgroundColor: preset.swatches.text, opacity: 0.35 }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className="text-[10px] font-mono font-semibold tabular-nums"
                          style={{ color: preset.swatches.accent }}
                        >
                          4,280 MAD
                        </span>
                        <span
                          className="h-2.5 w-1 rounded-full"
                          style={{ backgroundColor: preset.swatches.secondaryAccent }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme Title & Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                        {preset.tagline}
                      </p>
                    </div>

                    {isSelected && (
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>

                  {/* Swatch Strip & Native Specs */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 w-full">
                    <span className="truncate max-w-[100px]">{preset.defaultFontLabel}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {[
                        preset.swatches.canvas,
                        preset.swatches.surface,
                        preset.swatches.text,
                        preset.swatches.accent,
                        preset.swatches.secondaryAccent,
                      ].map((hex, i) => (
                        <span
                          key={i}
                          className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/15"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Architectural Style Controls (3 Axes) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2 border-t border-gray-200 dark:border-gray-800">
          {/* Axis A: Typography Pairing */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5 text-indigo-500" />
              2. Typography Architecture
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FONT_OPTIONS.map((opt) => {
                const active = fontStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFontStyle(opt.id)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${opt.sampleClass}`}>{opt.label}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate w-full">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Axis B: Corner Geometry */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5 text-indigo-500" />
              3. Corner Geometry
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RADIUS_OPTIONS.map((opt) => {
                const active = radiusStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRadiusStyle(opt.id)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate w-full">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Axis C: Surface & Card Finish */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              4. Surface &amp; Card Finish
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SURFACE_OPTIONS.map((opt) => {
                const active = surfaceStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSurfaceStyle(opt.id)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-xs font-semibold">{opt.label}</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate w-full">
                      {opt.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Live Architecture Specimen Bar */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Live Theme Specimen</span>
              <span aria-hidden="true">·</span>
              <span>{activePreset.eraOrStyle}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">tabular-nums</span>
            </div>
            <h5 className="font-display text-base font-semibold text-gray-900 dark:text-gray-100">
              Safe to Spend Allowance: <span className="font-mono text-indigo-600 dark:text-indigo-400">4,280.50 MAD</span>
            </h5>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Emergency buffer protected · 18 days remaining in current financial cycle
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTheme(resolvedTheme === 'vintage' ? 'sahara-dune' : resolvedTheme === 'sahara-dune' ? 'tokyo-night' : 'vintage')}
            >
              Cycle Featured Themes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
