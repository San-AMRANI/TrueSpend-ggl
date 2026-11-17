import type { ResolvedThemeId, ThemeId } from '../../context/ThemeContext';

export type SpexEditionAssetKey =
  | 'light'
  | 'vintage'
  | 'kyoto'
  | 'dark'
  | 'terminal'
  | 'tokyo';

export interface SpexEditionMeta {
  assetKey: SpexEditionAssetKey;
  editionName: string;
  archetype: string;
}

const EDITION_META_MAP: Record<ResolvedThemeId, SpexEditionMeta> = {
  light: {
    assetKey: 'light',
    editionName: 'Swiss Alabaster Spex',
    archetype: 'White & Indigo Ceramic Shell · Mint Holographic Visor',
  },
  vintage: {
    assetKey: 'vintage',
    editionName: '1920s Clockwork Ledger Spex',
    archetype: 'Brushed Brass & Parchment Enamel · Warm Amber Visor',
  },
  espresso: {
    assetKey: 'vintage',
    editionName: 'Archival Bronze & Espresso Spex',
    archetype: 'Brushed Brass & Roasted Umber · Warm Amber Visor',
  },
  'sahara-dune': {
    assetKey: 'vintage',
    editionName: 'Terracotta & Oasis Spex',
    archetype: 'Sun-Baked Ochre & Brass Accents · Warm Amber Visor',
  },
  'kyoto-zen': {
    assetKey: 'kyoto',
    editionName: 'Kyoto Matcha & Hinoki Spex',
    archetype: 'Washi Stone & Botanical Sage · Jade Bamboo Visor',
  },
  'rose-atelier': {
    assetKey: 'light',
    editionName: 'Porcelain & Alabaster Spex',
    archetype: 'Silk Alabaster & Indigo Trim · Mint Holographic Visor',
  },
  dark: {
    assetKey: 'dark',
    editionName: 'Midnight Carbon Obsidian Spex',
    archetype: 'Matte Carbon-Weave Armor · Electric Violet & Cyan Visor',
  },
  'emerald-night': {
    assetKey: 'dark',
    editionName: 'Nordic Emerald Vault Spex',
    archetype: 'Obsidian Carbon-Weave Armor · Emerald & Cyan Visor',
  },
  terminal: {
    assetKey: 'terminal',
    editionName: 'Amber Quant Radar Spex',
    archetype: 'Stealth Matte-Black Chassis · Phosphor Amber & Radar Green',
  },
  'wall-street': {
    assetKey: 'terminal',
    editionName: 'Bullion & Harbor Desk Spex',
    archetype: 'Stealth Executive Chassis · Bullion Gold & Radar Green',
  },
  'tokyo-night': {
    assetKey: 'tokyo',
    editionName: 'Neo-Tokyo Cyber Neon Spex',
    archetype: 'Deep Violet Cyber-Armor · Magenta & Electric Cyan Neon',
  },
  'deep-abyss': {
    assetKey: 'dark',
    editionName: 'Bioluminescent Abyss Spex',
    archetype: 'Trench Obsidian Carbon Shell · Bioluminescent Cyan Visor',
  },
};

export function getSpexThemeEditionMeta(themeId?: ThemeId | ResolvedThemeId): SpexEditionMeta {
  if (!themeId || themeId === 'system') {
    return EDITION_META_MAP.light;
  }
  return EDITION_META_MAP[themeId as ResolvedThemeId] || EDITION_META_MAP.light;
}

const ASSET_CACHE = new Map<SpexEditionAssetKey, string>();
const ASSET_INFLIGHT = new Map<SpexEditionAssetKey, Promise<string>>();

async function importAssetByKey(key: SpexEditionAssetKey): Promise<string> {
  switch (key) {
    case 'light':
      return (await import('../../assets/spex-light.png')).default;
    case 'vintage':
      return (await import('../../assets/spex-vintage.png')).default;
    case 'kyoto':
      return (await import('../../assets/spex-kyoto.png')).default;
    case 'dark':
      return (await import('../../assets/spex-dark.png')).default;
    case 'terminal':
      return (await import('../../assets/spex-terminal.png')).default;
    case 'tokyo':
      return (await import('../../assets/spex-tokyo.png')).default;
  }
}

export function getCachedSpexAvatarSrc(themeId?: ThemeId | ResolvedThemeId): string | null {
  const { assetKey } = getSpexThemeEditionMeta(themeId);
  return ASSET_CACHE.get(assetKey) || null;
}

export async function loadSpexAvatarSrc(themeId?: ThemeId | ResolvedThemeId): Promise<string> {
  const { assetKey } = getSpexThemeEditionMeta(themeId);
  const cached = ASSET_CACHE.get(assetKey);
  if (cached) return cached;

  const inflight = ASSET_INFLIGHT.get(assetKey);
  if (inflight) return inflight;

  const promise = importAssetByKey(assetKey)
    .then((src) => {
      ASSET_CACHE.set(assetKey, src);
      return src;
    })
    .catch(() => '/spex-avatar.png')
    .finally(() => {
      ASSET_INFLIGHT.delete(assetKey);
    });

  ASSET_INFLIGHT.set(assetKey, promise);
  return promise;
}
