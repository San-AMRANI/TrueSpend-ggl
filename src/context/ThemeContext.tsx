import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeId =
  | 'light'
  | 'dark'
  | 'vintage'
  | 'espresso'
  | 'emerald-night'
  | 'terminal'
  | 'sahara-dune'
  | 'tokyo-night'
  | 'wall-street'
  | 'kyoto-zen'
  | 'rose-atelier'
  | 'deep-abyss'
  | 'system';

export type ResolvedThemeId = Exclude<ThemeId, 'system'>;

export type RadiusStyle = 'theme-default' | 'sharp' | 'balanced' | 'soft';
export type FontStyle = 'theme-default' | 'sans' | 'editorial' | 'technical';
export type SurfaceStyle = 'theme-default' | 'flat' | 'elevated' | 'textured';

export interface ThemePresetMeta {
  id: ResolvedThemeId;
  name: string;
  tagline: string;
  description: string;
  mode: 'light' | 'dark';
  eraOrStyle: string;
  defaultFontLabel: string;
  defaultRadiusLabel: string;
  swatches: {
    canvas: string;
    surface: string;
    border: string;
    text: string;
    accent: string;
    secondaryAccent: string;
  };
}

export const THEME_PRESETS: ThemePresetMeta[] = [
  // ── Light Themes ────────────────────────────────────────────────────────────
  {
    id: 'light',
    name: 'Swiss Alabaster',
    tagline: 'Clean Daylight Ledger',
    description:
      'Crisp cool-alabaster canvas with slate hairline borders and royal indigo accents for effortless daytime clarity.',
    mode: 'light',
    eraOrStyle: 'Modern Neo-Grotesque',
    defaultFontLabel: 'Plus Jakarta Sans',
    defaultRadiusLabel: 'Balanced (12px)',
    swatches: {
      canvas: '#f8fafc',
      surface: '#ffffff',
      border: '#e2e8f0',
      text: '#0f172a',
      accent: '#4f46e5',
      secondaryAccent: '#0d9488',
    },
  },
  {
    id: 'vintage',
    name: 'Vintage Ledger',
    tagline: '1920s Archival Paper & Ink',
    description:
      'Warm cotton ledger parchment, fountain-pen sepia ink, aged brass accents, ruled ledger lines, and classic editorial serif typography.',
    mode: 'light',
    eraOrStyle: 'Archival Broadsheet',
    defaultFontLabel: 'Fraunces & Lora Serif',
    defaultRadiusLabel: 'Architectural (4px)',
    swatches: {
      canvas: '#f3ebd9',
      surface: '#fbf7ee',
      border: '#d5c5a7',
      text: '#2b2015',
      accent: '#9a4422',
      secondaryAccent: '#2f5d46',
    },
  },
  {
    id: 'espresso',
    name: 'Travertine & Espresso',
    tagline: 'Quiet Luxury Private Wealth',
    description:
      'Warm limestone and travertine surfaces paired with deep roasted espresso typography and burnished bronze-taupe accents.',
    mode: 'light',
    eraOrStyle: 'Editorial Wealth',
    defaultFontLabel: 'Plus Jakarta & Fraunces',
    defaultRadiusLabel: 'Tailored (10px)',
    swatches: {
      canvas: '#f4f0ea',
      surface: '#fcfaf7',
      border: '#e2d9cc',
      text: '#1f1a17',
      accent: '#7c5333',
      secondaryAccent: '#3d6352',
    },
  },
  {
    id: 'sahara-dune',
    name: 'Sahara & Terracotta',
    tagline: 'Moroccan Saffron & Clay',
    description:
      'Warm terracotta clay and desert sand canvas inspired by Marrakech, paired with rich saffron ochre and oasis palm green.',
    mode: 'light',
    eraOrStyle: 'Moroccan Saffron',
    defaultFontLabel: 'Fraunces & Plus Jakarta',
    defaultRadiusLabel: 'Balanced (10px)',
    swatches: {
      canvas: '#faf4eb',
      surface: '#fffdf9',
      border: '#e6d7c3',
      text: '#2b221a',
      accent: '#c85a2b',
      secondaryAccent: '#2a6349',
    },
  },
  {
    id: 'kyoto-zen',
    name: 'Kyoto Bamboo & Matcha',
    tagline: 'Washi Paper & Ceremonial Matcha',
    description:
      'Calming Japanese washi paper canvas with pale hinoki surfaces, deep sumi-e ink typography, and ceremonial matcha green accents.',
    mode: 'light',
    eraOrStyle: 'Zen Botanical',
    defaultFontLabel: 'Plus Jakarta & Lora',
    defaultRadiusLabel: 'Soft (14px)',
    swatches: {
      canvas: '#f5f7f2',
      surface: '#fcfffa',
      border: '#d2ded0',
      text: '#1c241e',
      accent: '#2d6a4f',
      secondaryAccent: '#b47834',
    },
  },
  {
    id: 'rose-atelier',
    name: 'Rose Gold & Champagne',
    tagline: 'Cashmere Ivory & Rose Gold',
    description:
      'Soft cashmere ivory canvas paired with polished porcelain surfaces, warm antique rose gold accents, and deep charcoal-plum typography.',
    mode: 'light',
    eraOrStyle: 'Parisian Haute Joaillerie',
    defaultFontLabel: 'Fraunces & Lora',
    defaultRadiusLabel: 'Soft (16px)',
    swatches: {
      canvas: '#faf5f2',
      surface: '#fffcfb',
      border: '#ebd8d0',
      text: '#2b1d22',
      accent: '#b35d6b',
      secondaryAccent: '#4a6b5d',
    },
  },

  // ── Dark Themes ─────────────────────────────────────────────────────────────
  {
    id: 'dark',
    name: 'Midnight Obsidian',
    tagline: 'Deep Carbon Studio',
    description:
      'Low-glare obsidian slate surfaces with luminous indigo and cyan highlights, engineered for extended night analysis.',
    mode: 'dark',
    eraOrStyle: 'Dark Studio',
    defaultFontLabel: 'Plus Jakarta Sans',
    defaultRadiusLabel: 'Balanced (12px)',
    swatches: {
      canvas: '#030712',
      surface: '#111827',
      border: '#1f2937',
      text: '#f9fafb',
      accent: '#6366f1',
      secondaryAccent: '#10b981',
    },
  },
  {
    id: 'emerald-night',
    name: 'Nordic Private Bank',
    tagline: 'Botanical Pine & Bullion Gold',
    description:
      'Deep pine-charcoal surfaces inspired by private wealth vaults, accented with emerald jade and warm bullion gold.',
    mode: 'dark',
    eraOrStyle: 'Institutional Vault',
    defaultFontLabel: 'Outfit & JetBrains Mono',
    defaultRadiusLabel: 'Balanced (12px)',
    swatches: {
      canvas: '#06110e',
      surface: '#0c1d18',
      border: '#19352c',
      text: '#ecfdf5',
      accent: '#10b981',
      secondaryAccent: '#d4af37',
    },
  },
  {
    id: 'terminal',
    name: 'Amber Desk Terminal',
    tagline: 'Institutional Quant Console',
    description:
      'High-contrast matte carbon workspace with phosphor amber-gold accents, razor-sharp borders, and tabular monospace precision.',
    mode: 'dark',
    eraOrStyle: 'Quant Desk',
    defaultFontLabel: 'IBM Plex Mono',
    defaultRadiusLabel: 'Sharp (2px)',
    swatches: {
      canvas: '#08090c',
      surface: '#101217',
      border: '#242936',
      text: '#f5f3ef',
      accent: '#f59e0b',
      secondaryAccent: '#22d3ee',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Neo-Tokyo Cyber',
    tagline: 'Midnight Neon & Cyan Matrix',
    description:
      'Deep midnight navy-black canvas with hyper-clean titanium surfaces, luminous electric cyan, and neon magenta accents.',
    mode: 'dark',
    eraOrStyle: 'Cyberpunk High-Tech',
    defaultFontLabel: 'Outfit & JetBrains Mono',
    defaultRadiusLabel: 'Sharp (4px)',
    swatches: {
      canvas: '#0b0e17',
      surface: '#121826',
      border: '#1f293d',
      text: '#f1f5f9',
      accent: '#06b6d4',
      secondaryAccent: '#d946ef',
    },
  },
  {
    id: 'wall-street',
    name: 'Blue Chip Wall Street',
    tagline: 'Deep Harbor Navy & Gold',
    description:
      'Classic institutional trading desk navy with crisp harbor steel surfaces, bold cobalt blue accents, and bullion gold metrics.',
    mode: 'dark',
    eraOrStyle: 'Institutional Cobalt',
    defaultFontLabel: 'Plus Jakarta & IBM Plex Mono',
    defaultRadiusLabel: 'Balanced (8px)',
    swatches: {
      canvas: '#08101e',
      surface: '#0f1c30',
      border: '#1c3252',
      text: '#f0f6fc',
      accent: '#2563eb',
      secondaryAccent: '#f59e0b',
    },
  },
  {
    id: 'deep-abyss',
    name: 'Mariana Oceanic Abyss',
    tagline: 'Bioluminescent Mariana Trench',
    description:
      'Subsea abyss deep black-navy canvas, high-pressure submarine steel surfaces, and bioluminescent aquamarine & teal phosphor highlights.',
    mode: 'dark',
    eraOrStyle: 'Subsea Benthic Spec',
    defaultFontLabel: 'JetBrains Mono & Outfit',
    defaultRadiusLabel: 'Sharp (4px)',
    swatches: {
      canvas: '#030a10',
      surface: '#081622',
      border: '#0f2b40',
      text: '#ecfeff',
      accent: '#14b8a6',
      secondaryAccent: '#38bdf8',
    },
  },
];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeId;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: ThemeId;
  resolvedTheme: ResolvedThemeId;
  activePreset: ThemePresetMeta;
  isDark: boolean;
  radiusStyle: RadiusStyle;
  fontStyle: FontStyle;
  surfaceStyle: SurfaceStyle;
  setTheme: (theme: ThemeId) => void;
  setRadiusStyle: (radius: RadiusStyle) => void;
  setFontStyle: (font: FontStyle) => void;
  setSurfaceStyle: (surface: SurfaceStyle) => void;
  resetStyleOverrides: () => void;
  cycleTheme: () => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  activePreset: THEME_PRESETS[0],
  isDark: false,
  radiusStyle: 'theme-default',
  fontStyle: 'theme-default',
  surfaceStyle: 'theme-default',
  setTheme: () => null,
  setRadiusStyle: () => null,
  setFontStyle: () => null,
  setSurfaceStyle: () => null,
  resetStyleOverrides: () => null,
  cycleTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const VALID_THEMES: ThemeId[] = [
  'light',
  'dark',
  'vintage',
  'espresso',
  'emerald-night',
  'terminal',
  'sahara-dune',
  'tokyo-night',
  'wall-street',
  'kyoto-zen',
  'rose-atelier',
  'deep-abyss',
  'system',
];

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(storageKey) as ThemeId;
    return VALID_THEMES.includes(stored) ? stored : defaultTheme;
  });

  const [radiusStyle, setRadiusStyleState] = useState<RadiusStyle>(() => {
    return (localStorage.getItem(`${storageKey}-radius`) as RadiusStyle) || 'theme-default';
  });

  const [fontStyle, setFontStyleState] = useState<FontStyle>(() => {
    return (localStorage.getItem(`${storageKey}-font`) as FontStyle) || 'theme-default';
  });

  const [surfaceStyle, setSurfaceStyleState] = useState<SurfaceStyle>(() => {
    return (localStorage.getItem(`${storageKey}-surface`) as SurfaceStyle) || 'theme-default';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  const resolvedTheme: ResolvedThemeId = useMemo(() => {
    if (theme === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemPrefersDark]);

  const activePreset = useMemo(() => {
    return THEME_PRESETS.find((p) => p.id === resolvedTheme) || THEME_PRESETS[0];
  }, [resolvedTheme]);

  const isDark = activePreset.mode === 'dark';

  useEffect(() => {
    const root = window.document.documentElement;

    // 1. Apply light/dark base class for Tailwind dark:* variant
    root.classList.remove('light', 'dark');
    root.classList.add(activePreset.mode);

    // 2. Apply theme and architectural style data attributes
    root.setAttribute('data-theme', resolvedTheme);
    root.setAttribute('data-radius', radiusStyle);
    root.setAttribute('data-font', fontStyle);
    root.setAttribute('data-surface', surfaceStyle);
  }, [resolvedTheme, activePreset.mode, radiusStyle, fontStyle, surfaceStyle]);

  const setTheme = (nextTheme: ThemeId) => {
    localStorage.setItem(storageKey, nextTheme);
    setThemeState(nextTheme);
  };

  const setRadiusStyle = (nextRadius: RadiusStyle) => {
    localStorage.setItem(`${storageKey}-radius`, nextRadius);
    setRadiusStyleState(nextRadius);
  };

  const setFontStyle = (nextFont: FontStyle) => {
    localStorage.setItem(`${storageKey}-font`, nextFont);
    setFontStyleState(nextFont);
  };

  const setSurfaceStyle = (nextSurface: SurfaceStyle) => {
    localStorage.setItem(`${storageKey}-surface`, nextSurface);
    setSurfaceStyleState(nextSurface);
  };

  const resetStyleOverrides = () => {
    setRadiusStyle('theme-default');
    setFontStyle('theme-default');
    setSurfaceStyle('theme-default');
  };

  const cycleTheme = () => {
    const order: ResolvedThemeId[] = [
      'light',
      'vintage',
      'espresso',
      'sahara-dune',
      'kyoto-zen',
      'rose-atelier',
      'dark',
      'emerald-night',
      'terminal',
      'tokyo-night',
      'wall-street',
      'deep-abyss',
    ];
    const currentIdx = order.indexOf(resolvedTheme);
    const next = order[(currentIdx + 1) % order.length];
    setTheme(next);
  };

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    activePreset,
    isDark,
    radiusStyle,
    fontStyle,
    surfaceStyle,
    setTheme,
    setRadiusStyle,
    setFontStyle,
    setSurfaceStyle,
    resetStyleOverrides,
    cycleTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
