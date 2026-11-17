import type { DashboardTab } from '../types';

const prefetchedTabs = new Set<DashboardTab>();

const TAB_LOADERS: Partial<Record<DashboardTab, () => Promise<unknown>>> = {
  overview: () => import('../components/dashboard/OverviewTab'),
  accounts: () => import('../components/dashboard/WalletsManager'),
  transactions: () => import('../components/dashboard/TransactionsTab'),
  investments: () => import('../components/dashboard/InvestmentsTab'),
  analytics: () => import('../components/dashboard/AnalyticsTab'),
  budgets: () => import('../components/dashboard/BudgetsTab'),
  debts: () => import('../components/dashboard/DebtsTab'),
  goals: () => import('../components/dashboard/GoalsTab'),
  subscriptions: () => import('../components/dashboard/SubscriptionsTab'),
  calendar: () => import('../components/dashboard/FinancialCalendarTab'),
  reports: () => import('../components/dashboard/ReportsTab'),
  contexts: () => import('../components/dashboard/ContextsTab'),
  forecast: () => import('../components/dashboard/PredictiveForecastTab'),
  calculators: () => import('../components/dashboard/CalculatorsHubTab'),
  settings: () => import('../components/dashboard/SettingsTab'),
  users: () => import('../components/dashboard/UsersAndRolesSection'),
  chat: () => import('../components/AIChat'),
};

/**
 * Intent-triggered chunk prefetcher: only downloads a tab's JS chunk when the
 * user hovers or focuses its navigation button, never eagerly on initial boot.
 */
export function prefetchTabChunk(tab: DashboardTab): void {
  if (prefetchedTabs.has(tab)) return;
  const loader = TAB_LOADERS[tab];
  if (!loader) return;
  prefetchedTabs.add(tab);
  void loader().catch(() => {
    prefetchedTabs.delete(tab);
  });
}
