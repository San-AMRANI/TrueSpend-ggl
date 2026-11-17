import type {
  CategoryBudget,
  CommitmentOccurrence,
  Debt,
  ExternalWealthItem,
  FinancialIntegrityReport,
  FinancialReviewItem,
  Goal,
  InvestmentsData,
  KPI,
  Payroll,
  Subscription,
  Transaction,
} from '../types/index.js';

export type BootstrapScope = 'core' | 'history' | 'radar' | 'ledger' | 'all';

export interface TransactionsWindowMeta {
  isPartial: boolean;
  totalCount: number;
  loadedCount: number;
  windowDays: number;
  oldestLoadedDate: string | null;
}

export interface OperationalRadarData {
  upcomingCommitments: CommitmentOccurrence[];
  pendingReviews: FinancialReviewItem[];
  integritySummary: FinancialIntegrityReport | null;
  externalWealthSummary: {
    items: ExternalWealthItem[];
    totalExternalAssetsMad: number;
    totalExternalLiabilitiesMad: number;
    netExternalWealthMad: number;
    staleCount: number;
  } | null;
}

export interface DashboardBootstrapPayload {
  scope?: BootstrapScope;
  kpis?: KPI;
  transactions?: Transaction[];
  transactionsWindow?: TransactionsWindowMeta;
  debts?: Debt[];
  payrolls?: Payroll[];
  budgets?: CategoryBudget[];
  settings?: any;
  goals?: Goal[];
  subscriptions?: Subscription[];
  contexts?: any[];
  investmentsData?: InvestmentsData | null;
  operationalRadar?: OperationalRadarData | null;
}

/**
 * Selects a fast, representative recent window of transactions for Overview Frame-1 rendering:
 * - Includes all transactions within `windowDays` (default 120d so 4-cycle cashflow & daily burn are exact)
 * - Guarantees at least `minRows` (default 150) most-recent transactions if available
 * - Preserves descending chronological order
 */
export function sliceTransactionsWindow<T extends { createdAt?: string | Date | null }>(
  allTransactions: readonly T[],
  options?: { windowDays?: number; minRows?: number; nowMs?: number }
): { transactions: T[]; meta: TransactionsWindowMeta } {
  const totalCount = allTransactions.length;
  const windowDays = options?.windowDays ?? 120;
  const minRows = options?.minRows ?? 150;
  const nowMs = options?.nowMs ?? Date.now();

  if (totalCount <= minRows) {
    const oldest = totalCount > 0 ? allTransactions[totalCount - 1]?.createdAt : null;
    return {
      transactions: allTransactions as T[],
      meta: {
        isPartial: false,
        totalCount,
        loadedCount: totalCount,
        windowDays,
        oldestLoadedDate: oldest ? new Date(oldest).toISOString() : null,
      },
    };
  }

  const cutoffMs = nowMs - windowDays * 86_400_000;
  const recent: T[] = [];
  for (let i = 0; i < totalCount; i++) {
    const tx = allTransactions[i];
    const ts = tx?.createdAt ? new Date(tx.createdAt).getTime() : 0;
    if (i < minRows || ts >= cutoffMs) {
      recent.push(tx);
    }
  }

  const oldest = recent.length > 0 ? recent[recent.length - 1]?.createdAt : null;
  return {
    transactions: recent,
    meta: {
      isPartial: recent.length < totalCount,
      totalCount,
      loadedCount: recent.length,
      windowDays,
      oldestLoadedDate: oldest ? new Date(oldest).toISOString() : null,
    },
  };
}

/**
 * Merges a partial or full bootstrap response into existing client dashboard state
 * without wiping already-hydrated secondary slices (e.g. full history, radar, or investments).
 */
export function mergeTransactionsSlice<T extends { id: string; createdAt?: string | Date | null }>(
  existing: readonly T[],
  incoming: readonly T[],
  incomingIsPartial: boolean
): T[] {
  if (!incomingIsPartial) {
    return [...incoming];
  }
  if (existing.length === 0) {
    return [...incoming];
  }
  const byId = new Map<string, T>();
  for (const tx of incoming) {
    byId.set(tx.id, tx);
  }
  // Preserve older archived rows already hydrated into client memory while refreshing recent/modified rows
  const incomingOldestMs = incoming.reduce((min, tx) => {
    const ts = tx.createdAt ? new Date(tx.createdAt).getTime() : Infinity;
    return ts < min ? ts : min;
  }, Infinity);

  for (const tx of existing) {
    if (byId.has(tx.id)) continue;
    const ts = tx.createdAt ? new Date(tx.createdAt).getTime() : 0;
    if (ts < incomingOldestMs) {
      byId.set(tx.id, tx);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * Pure state machine deciding which data slices must be fetched for a given tab.
 */
export function getRequiredSlicesForTab(
  tab: string,
  state: {
    hasFullHistory: boolean;
    hasContexts: boolean;
    hasInvestments: boolean;
    isAdvanced: boolean;
  }
): { needHistory: boolean; needInvestments: boolean } {
  const historyTabs = new Set([
    'transactions',
    'analytics',
    'reports',
    'forecast',
    'budgets',
    'contexts',
    'retrospective',
    'calendar',
    'calculators',
    'subscriptions',
    'debts',
    'goals',
    'accounts',
  ]);
  const needHistory =
    (!state.hasFullHistory || (tab === 'contexts' && !state.hasContexts)) &&
    historyTabs.has(tab);
  const needInvestments = state.isAdvanced && !state.hasInvestments && tab === 'investments';
  return { needHistory, needInvestments };
}
