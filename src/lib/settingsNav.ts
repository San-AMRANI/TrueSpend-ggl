export type SettingsSectionId =
  | 'general'
  | 'appearance'
  | 'automation'
  | 'notifications'
  | 'security'
  | 'data_mobile';

export interface SettingsSectionMeta {
  id: SettingsSectionId;
  group: 'Workspace' | 'Account & System';
  label: string;
  shortLabel: string;
  description: string;
  keywords: string[];
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    id: 'general',
    group: 'Workspace',
    label: 'General & Profile',
    shortLabel: 'General',
    description: 'Identity, currency, regional defaults, experience mode, and starter templates.',
    keywords: [
      'profile',
      'name',
      'currency',
      'mad',
      'usd',
      'eur',
      'timezone',
      'country',
      'locale',
      'basic',
      'advanced',
      'tier',
      'mode',
      'onboarding',
      'wizard',
      'templates',
      'accounts',
      'wallets',
      'users',
      'roles',
      'sign out',
    ],
  },
  {
    id: 'appearance',
    group: 'Workspace',
    label: 'Appearance & Theme',
    shortLabel: 'Appearance',
    description: 'Color palettes, light or dark mode, typography, and layout density.',
    keywords: [
      'theme',
      'dark',
      'light',
      'color',
      'style',
      'studio',
      'swiss',
      'alabaster',
      'layout',
      'density',
      'font',
      'ui',
    ],
  },
  {
    id: 'automation',
    group: 'Workspace',
    label: 'Payday & Automation',
    shortLabel: 'Automation',
    description: 'Monthly payday sweeps, yearly audits, and deterministic financial rules.',
    keywords: [
      'payday',
      'payroll',
      'salary',
      'sweep',
      'rollover',
      'monthly',
      'yearly',
      'closeout',
      'audit',
      'cash recovery',
      'rules',
      'if/then',
      'dry-run',
      'automation',
      'trigger',
    ],
  },
  {
    id: 'notifications',
    group: 'Workspace',
    label: 'Notifications',
    shortLabel: 'Notifications',
    description: 'Push delivery, intelligence channels, delivery schedule, and quiet hours.',
    keywords: [
      'notifications',
      'alerts',
      'push',
      'browser',
      'stocks',
      'subscriptions',
      'calendar',
      'budgets',
      'challenges',
      'cadence',
      'quiet hours',
      'do not disturb',
      'dnd',
      'test',
    ],
  },
  {
    id: 'security',
    group: 'Account & System',
    label: 'Security & Privacy',
    shortLabel: 'Security',
    description: 'Password, account email, active sessions, activity log, and data rights.',
    keywords: [
      'security',
      'password',
      'email',
      'sessions',
      'devices',
      'revoke',
      'logout',
      'activity',
      'privacy',
      'gdpr',
      'json',
      'export',
      'legal',
      'terms',
      'delete account',
      'danger',
    ],
  },
  {
    id: 'data_mobile',
    group: 'Account & System',
    label: 'Backups & Mobile',
    shortLabel: 'Backups & Mobile',
    description: 'Google Drive sync, SQL backup/restore, Android APK, and offline queue.',
    keywords: [
      'backup',
      'google drive',
      'cloud',
      'sql',
      'export',
      'import',
      'restore',
      'validate',
      'android',
      'apk',
      'mobile',
      'capacitor',
      'offline',
      'outbox',
      'sync',
      'endpoint',
      'api',
    ],
  },
];

export interface SettingsSearchMatch {
  section: SettingsSectionMeta;
  matchedTerms: string[];
  score: number;
}

/**
 * Pure deterministic search across settings sections and keywords.
 */
export function filterSettingsSections(query: string): SettingsSearchMatch[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return SETTINGS_SECTIONS.map((section) => ({
      section,
      matchedTerms: [],
      score: 0,
    }));
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const matches: SettingsSearchMatch[] = [];

  for (const section of SETTINGS_SECTIONS) {
    const labelLower = section.label.toLowerCase();
    const descLower = section.description.toLowerCase();
    const matchedTerms = new Set<string>();
    let score = 0;

    for (const token of tokens) {
      let tokenMatched = false;
      if (labelLower.includes(token)) {
        score += 10;
        tokenMatched = true;
      }
      if (descLower.includes(token)) {
        score += 4;
        tokenMatched = true;
      }
      for (const kw of section.keywords) {
        if (kw.includes(token)) {
          score += kw === token ? 8 : 5;
          matchedTerms.add(kw);
          tokenMatched = true;
        }
      }
      if (!tokenMatched) {
        score = -1;
        break;
      }
    }

    if (score > 0) {
      matches.push({
        section,
        matchedTerms: Array.from(matchedTerms).slice(0, 3),
        score,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function getSettingsSectionById(id: SettingsSectionId): SettingsSectionMeta {
  return SETTINGS_SECTIONS.find((s) => s.id === id) || SETTINGS_SECTIONS[0];
}
