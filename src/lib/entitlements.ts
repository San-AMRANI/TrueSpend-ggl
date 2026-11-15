import type { DashboardTab, ExperienceTier, FeatureKey, UserRole } from '../types/index.js';

export const ENTITLEMENTS_VERSION = 1;

export const FEATURE_ENTITLEMENTS: Record<ExperienceTier, Record<FeatureKey, boolean>> = {
  basic: {
    'dashboard.core': true,
    'transactions.core': true,
    'accounts.core': true,
    'budgets.core': true,
    'calendar.core': true,
    'debts.core': true,
    'goals.core': true,
    'subscriptions.core': true,
    'analytics.basic': true,
    'reports.basic': true,
    'ai.basic': true,
    'forecast.advanced': false,
    'simulator': false,
    'investments': false,
    'binance.integration': false,
    'statements.import': false,
    'review.inbox': false,
    'budgets.advanced': false,
    'debts.advanced': false,
    'goals.contributions': false,
    'contexts.advanced': false,
    'commitments.advanced': false,
    'rules.automation': false,
    'analytics.advanced': false,
    'reports.advanced': false,
    'ai.advanced': false,
    'backups.advanced': false,
  },
  advanced: {
    'dashboard.core': true,
    'transactions.core': true,
    'accounts.core': true,
    'budgets.core': true,
    'calendar.core': true,
    'debts.core': true,
    'goals.core': true,
    'subscriptions.core': true,
    'analytics.basic': true,
    'reports.basic': true,
    'ai.basic': true,
    'forecast.advanced': true,
    'simulator': true,
    'investments': true,
    'binance.integration': true,
    'statements.import': true,
    'review.inbox': true,
    'budgets.advanced': true,
    'debts.advanced': true,
    'goals.contributions': true,
    'contexts.advanced': true,
    'commitments.advanced': true,
    'rules.automation': true,
    'analytics.advanced': true,
    'reports.advanced': true,
    'ai.advanced': true,
    'backups.advanced': true,
  },
};

export interface FeatureMetadata {
  key: FeatureKey;
  title: string;
  description: string;
}

export const FEATURE_METADATA: Record<FeatureKey, FeatureMetadata> = {
  'dashboard.core': {
    key: 'dashboard.core',
    title: 'Core Overview',
    description: 'Balances, income, spending, remaining budget and payday context.',
  },
  'transactions.core': {
    key: 'transactions.core',
    title: 'Transactions',
    description: 'Record and search income, expenses, transfers and repayments.',
  },
  'accounts.core': {
    key: 'accounts.core',
    title: 'Everyday Accounts',
    description: 'Bank, Cash and Savings accounts with opening balances.',
  },
  'budgets.core': {
    key: 'budgets.core',
    title: 'Monthly Budgets',
    description: 'Category budgets, progress tracking and starter templates.',
  },
  'calendar.core': {
    key: 'calendar.core',
    title: 'Calendar & Cash Flow',
    description: 'Payday, scheduled bills and upcoming cash-flow calendar.',
  },
  'debts.core': {
    key: 'debts.core',
    title: 'Debts & Splits',
    description: 'Track money owed and receivable with straightforward settlements.',
  },
  'goals.core': {
    key: 'goals.core',
    title: 'Savings Goals',
    description: 'Target savings goals with deadlines and progress tracking.',
  },
  'subscriptions.core': {
    key: 'subscriptions.core',
    title: 'Subscriptions & Bills',
    description: 'Track recurring bills and next due dates.',
  },
  'analytics.basic': {
    key: 'analytics.basic',
    title: 'Essential Analytics',
    description: 'Monthly and category summaries with clear charts.',
  },
  'reports.basic': {
    key: 'reports.basic',
    title: 'Basic Reports & Export',
    description: 'Monthly summaries and personal data exports.',
  },
  'ai.basic': {
    key: 'ai.basic',
    title: 'Spex AI Explanations',
    description: 'Clear explanations and help understanding your own records.',
  },
  'forecast.advanced': {
    key: 'forecast.advanced',
    title: 'Advanced Cash-Flow Forecast',
    description: 'Multi-month runway trajectories, scenarios and calibration.',
  },
  'simulator': {
    key: 'simulator',
    title: 'Simulators & Calculators',
    description: 'Saved What-If scenarios, Moroccan IGR/CNSS tax & loan payoff modeling.',
  },
  'investments': {
    key: 'investments',
    title: 'Investments & Portfolios',
    description: 'Stock portfolios, orders, dividends, market data and external wealth.',
  },
  'binance.integration': {
    key: 'binance.integration',
    title: 'Binance Portfolio Sync',
    description: 'Read-only Binance spot/funding wallet integration.',
  },
  'statements.import': {
    key: 'statements.import',
    title: 'Statement Import & Matching',
    description: 'CSV/XLSX/TSV bank statement import, duplicate detection & matching.',
  },
  'review.inbox': {
    key: 'review.inbox',
    title: 'Persistent Review Inbox',
    description: 'Receipt OCR, statement row and rule suggestion review queue.',
  },
  'budgets.advanced': {
    key: 'budgets.advanced',
    title: 'Advanced Envelope & Rollover Budgets',
    description: 'Rollovers, AI budget allocation models and multi-period calibration.',
  },
  'debts.advanced': {
    key: 'debts.advanced',
    title: 'Advanced Debt & APR Schedules',
    description: 'APR modeling, installment amortization and payoff comparisons.',
  },
  'goals.contributions': {
    key: 'goals.contributions',
    title: 'Goal Contribution Ledger',
    description: 'Detailed contribution audit events and mirrored vault allocation.',
  },
  'contexts.advanced': {
    key: 'contexts.advanced',
    title: 'Financial Contexts',
    description: 'Dedicated workspaces for trips, life events and project budgets.',
  },
  'commitments.advanced': {
    key: 'commitments.advanced',
    title: 'Commitment Engine',
    description: 'Recurring obligation occurrences, variance tracking and settlement history.',
  },
  'rules.automation': {
    key: 'rules.automation',
    title: 'Financial Rules & Automation',
    description: 'Event-driven rules, dry-runs and execution audit logs.',
  },
  'analytics.advanced': {
    key: 'analytics.advanced',
    title: 'Advanced Analytics & Net Worth Bridge',
    description: 'Double-entry journal audit, FX exposure, heatmaps and position history.',
  },
  'reports.advanced': {
    key: 'reports.advanced',
    title: 'Cycle Retrospectives & Diagnostics',
    description: 'AI cycle grade retrospectives and integrity diagnostics.',
  },
  'ai.advanced': {
    key: 'ai.advanced',
    title: 'Spex AI Actions & Impact Simulation',
    description: 'Simulate and execute AI-proposed financial ledger actions.',
  },
  'backups.advanced': {
    key: 'backups.advanced',
    title: 'SQL Backups & Drive Automation',
    description: 'Full PostgreSQL SQL backup/restore drills and Google Drive sync.',
  },
};

export const TAB_REQUIRED_FEATURE: Partial<Record<DashboardTab, FeatureKey>> = {
  investments: 'investments',
  calculators: 'simulator',
  forecast: 'forecast.advanced',
  contexts: 'contexts.advanced',
};

export function normalizeExperienceTier(tier?: string | null): ExperienceTier {
  return tier === 'basic' ? 'basic' : 'advanced';
}

export function hasFeatureAccess(
  tier: string | null | undefined,
  feature: FeatureKey
): boolean {
  const normalized = normalizeExperienceTier(tier);
  return Boolean(FEATURE_ENTITLEMENTS[normalized][feature]);
}

export function getTabRequiredFeature(tab: DashboardTab): FeatureKey | null {
  return TAB_REQUIRED_FEATURE[tab] ?? null;
}

export function isTabAvailableForUser(
  tab: DashboardTab,
  tier?: string | null,
  role?: UserRole | string | null
): boolean {
  if (tab === 'users') {
    return role === 'admin' || role === 'owner';
  }
  const required = getTabRequiredFeature(tab);
  if (!required) return true;
  return hasFeatureAccess(tier, required);
}

export function getAdvancedOnlySummaryList(): Array<{ key: FeatureKey; title: string; description: string }> {
  return (Object.keys(FEATURE_ENTITLEMENTS.advanced) as FeatureKey[])
    .filter((k) => FEATURE_ENTITLEMENTS.advanced[k] && !FEATURE_ENTITLEMENTS.basic[k])
    .map((k) => FEATURE_METADATA[k]);
}
