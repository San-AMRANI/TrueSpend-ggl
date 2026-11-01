import React from 'react';
import { useTheme, type ResolvedThemeId, type ThemeId } from '../../context/ThemeContext';
import spexLightSrc from '../../assets/spex-light.png';
import spexVintageSrc from '../../assets/spex-vintage.png';
import spexKyotoSrc from '../../assets/spex-kyoto.png';
import spexDarkSrc from '../../assets/spex-dark.png';
import spexTerminalSrc from '../../assets/spex-terminal.png';
import spexTokyoSrc from '../../assets/spex-tokyo.png';

export const THEME_SPEX_AVATARS: Record<
  ResolvedThemeId,
  { src: string; editionName: string }
> = {
  light: {
    src: spexLightSrc,
    editionName: 'Swiss Alabaster Spex',
  },
  vintage: {
    src: spexVintageSrc,
    editionName: '1920s Clockwork Ledger Spex',
  },
  espresso: {
    src: spexVintageSrc,
    editionName: 'Archival Bronze & Espresso Spex',
  },
  'sahara-dune': {
    src: spexVintageSrc,
    editionName: 'Terracotta & Oasis Spex',
  },
  'kyoto-zen': {
    src: spexKyotoSrc,
    editionName: 'Kyoto Matcha & Hinoki Spex',
  },
  'rose-atelier': {
    src: spexLightSrc,
    editionName: 'Porcelain & Alabaster Spex',
  },
  dark: {
    src: spexDarkSrc,
    editionName: 'Midnight Carbon Obsidian Spex',
  },
  'emerald-night': {
    src: spexDarkSrc,
    editionName: 'Nordic Emerald Vault Spex',
  },
  terminal: {
    src: spexTerminalSrc,
    editionName: 'Amber Quant Radar Spex',
  },
  'wall-street': {
    src: spexTerminalSrc,
    editionName: 'Bullion & Harbor Desk Spex',
  },
  'tokyo-night': {
    src: spexTokyoSrc,
    editionName: 'Neo-Tokyo Cyber Neon Spex',
  },
  'deep-abyss': {
    src: spexDarkSrc,
    editionName: 'Bioluminescent Abyss Spex',
  },
};

export function getSpexAvatarForTheme(themeId?: ThemeId | ResolvedThemeId): {
  src: string;
  editionName: string;
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
}

export const SpexAvatar: React.FC<SpexAvatarProps> = ({
  className = 'w-full h-full',
  size,
  animated = false,
  themeId,
}) => {
  const { resolvedTheme } = useTheme();
  const activeThemeId: ResolvedThemeId =
    themeId && themeId !== 'system' ? (themeId as ResolvedThemeId) : resolvedTheme;
  const avatarMeta = getSpexAvatarForTheme(activeThemeId);
  const style = size ? { width: size, height: size } : undefined;

  return (
    <span
      style={style}
      className={`inline-flex items-center justify-center shrink-0 select-none ${
        animated ? 'hover:scale-105 transition-transform duration-300' : ''
      } ${className}`}
      title={`${avatarMeta.editionName} — TrueSpend AI Financial Intelligence`}
    >
      <img
        src={avatarMeta.src}
        alt={avatarMeta.editionName}
        className="w-full h-full object-contain drop-shadow-sm pointer-events-none"
        draggable={false}
      />
    </span>
  );
};

export default SpexAvatar;

