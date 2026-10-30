import React from 'react';
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
} from 'lucide-react';

const THEME_ICONS: Record<string, React.FC<{ className?: string }>> = {
  light: Sun,
  vintage: Feather,
  espresso: Coffee,
  dark: Moon,
  'emerald-night': Shield,
  terminal: Terminal,
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
            Select from 6 signature color &amp; typographic themes—including archival Vintage Ledger—and fine-tune corner geometry, font pairings, and surface elevation.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
        {/* 1. 6 Signature Themes Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              1. Signature Theme Palettes (6 Presets)
            </h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Active: <strong className="text-gray-900 dark:text-gray-100">{activePreset.name}</strong>
              {theme === 'system' ? ' (System Sync)' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEME_PRESETS.map((preset) => {
              const isSelected = theme === preset.id || (theme === 'system' && resolvedTheme === preset.id);
              const Icon = THEME_ICONS[preset.id] || Palette;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setTheme(preset.id as ThemeId)}
                  className={`group relative flex flex-col text-left rounded-xl border p-3.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isSelected
                      ? 'border-indigo-600 dark:border-indigo-400 ring-1 ring-indigo-600 dark:ring-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900/60'
                  }`}
                >
                  {/* Mini Architectural Theme Viewport Preview */}
                  <div
                    className="w-full h-24 rounded-lg border mb-3 p-2.5 flex flex-col justify-between overflow-hidden relative"
                    style={{
                      backgroundColor: preset.swatches.canvas,
                      borderColor: preset.swatches.border,
                    }}
                  >
                    {/* Top Mini Bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: preset.swatches.accent }}
                        />
                        <span
                          className="text-[11px] font-semibold tracking-tight"
                          style={{
                            color: preset.swatches.text,
                            fontFamily:
                              preset.id === 'vintage' || preset.id === 'espresso'
                                ? '"Fraunces", Georgia, serif'
                                : preset.id === 'terminal'
                                ? '"IBM Plex Mono", monospace'
                                : '"Plus Jakarta Sans", sans-serif',
                          }}
                        >
                          {preset.name}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
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
                      className="rounded p-2 flex items-center justify-between"
                      style={{
                        backgroundColor: preset.swatches.surface,
                        border: `1px solid ${preset.swatches.border}`,
                      }}
                    >
                      <div className="space-y-1">
                        <div
                          className="h-1.5 w-16 rounded-full"
                          style={{ backgroundColor: preset.swatches.text, opacity: 0.75 }}
                        />
                        <div
                          className="h-1.5 w-10 rounded-full"
                          style={{ backgroundColor: preset.swatches.text, opacity: 0.35 }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-mono font-semibold tabular-nums"
                          style={{ color: preset.swatches.accent }}
                        >
                          4,280 MAD
                        </span>
                        <span
                          className="h-3 w-1 rounded-full"
                          style={{ backgroundColor: preset.swatches.secondaryAccent }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme Title & Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {preset.tagline}
                      </p>
                    </div>

                    {isSelected && (
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>

                  {/* Swatch Strip & Native Specs */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 w-full">
                    <span className="truncate">{preset.defaultFontLabel}</span>
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
                          className="h-3 w-3 rounded-full border border-black/15 dark:border-white/15"
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
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setTheme(resolvedTheme === 'vintage' ? 'light' : 'vintage')
              }
            >
              {resolvedTheme === 'vintage' ? 'Switch to Swiss Alabaster' : 'Try Vintage Ledger'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
