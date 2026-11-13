import type {
  FinancialReviewItem,
  FinancialRuleItem,
  SavedWhatIfScenario,
  StatementBatchWithRows,
  StatementImportRowRecord,
} from '../types';

export interface ParsedScenarioData {
  id: string;
  name: string;
  description: string;
  isApprovedPlan: boolean;
  baselineSnapshot: {
    startingCashMad?: number;
    startingNetWorthMad?: number;
    emergencyBufferMad?: number;
    [key: string]: unknown;
  };
  assumptions: {
    horizonMonths?: number;
    monthlyIncomeMad?: number;
    monthlyExpensesMad?: number;
    extraMonthlyDcaMad?: number;
    discretionaryCutPercent?: number;
    cancelReviewingSubs?: boolean;
    oneTimeShockMad?: number;
    incomeDeltaMad?: number;
    customEvents?: Array<{ label?: string; amountMad?: number; monthOffset?: number; kind?: string }>;
    [key: string]: unknown;
  };
  events: Array<{
    id?: string;
    label: string;
    amountMad: number;
    monthOffset: number;
    kind: 'one_time' | 'recurring' | 'shock' | string;
  }>;
  projectedSummary: {
    baselineNetWorth12m: number;
    simulatedNetWorth12m: number;
    lowest30dBalance: number;
    survivalRunwayDays: number;
    deltaVsBaselineMad: number;
  };
  updatedAt: string;
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function parseSavedScenario(scenario: SavedWhatIfScenario): ParsedScenarioData {
  const baselineSnapshot = safeJsonParse<Record<string, any>>(scenario.baselineSnapshotJson, {});
  const assumptions = safeJsonParse<Record<string, any>>(scenario.assumptionsJson, {});
  const events = safeJsonParse<any[]>(scenario.eventsJson, []);
  const summary = safeJsonParse<Record<string, any>>(scenario.projectedSummaryJson, {});

  const baselineNw = Number(summary.baselineNetWorth12m ?? summary.baselineNetWorth ?? 0) || 0;
  const simNw = Number(summary.simulatedNetWorth12m ?? summary.simulatedNetWorth ?? 0) || 0;

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description || '',
    isApprovedPlan: Boolean(scenario.isApprovedPlan),
    baselineSnapshot,
    assumptions,
    events: Array.isArray(events) ? events : [],
    projectedSummary: {
      baselineNetWorth12m: baselineNw,
      simulatedNetWorth12m: simNw,
      lowest30dBalance: Number(summary.lowest30dBalance ?? 0) || 0,
      survivalRunwayDays: Number(summary.survivalRunwayDays ?? 0) || 0,
      deltaVsBaselineMad: Number(summary.deltaVsBaselineMad ?? simNw - baselineNw) || 0,
    },
    updatedAt: scenario.updatedAt,
  };
}

export interface ParsedFinancialRule {
  conditions: Record<string, any>;
  actionPayload: Record<string, any>;
  conditionChips: string[];
  actionSummary: string;
}

export function parseFinancialRuleDetails(rule: FinancialRuleItem): ParsedFinancialRule {
  const conditions = safeJsonParse<Record<string, any>>(rule.conditionsJson, {});
  const actionPayload = safeJsonParse<Record<string, any>>(rule.actionPayloadJson, {});
  const chips: string[] = [];

  if (conditions.transactionType) chips.push(`Type: ${conditions.transactionType}`);
  if (conditions.minAmount !== undefined) chips.push(`Min: ${conditions.minAmount} MAD`);
  if (conditions.maxAmount !== undefined) chips.push(`Max: ${conditions.maxAmount} MAD`);
  if (conditions.thresholdMad !== undefined) chips.push(`Floor <= ${conditions.thresholdMad} MAD`);
  if (conditions.pacePercent !== undefined) chips.push(`Pace >= ${conditions.pacePercent}%`);
  if (conditions.withinDays !== undefined) chips.push(`Within ${conditions.withinDays}d`);
  if (conditions.category) chips.push(`Category: ${conditions.category}`);
  if (conditions.counterparty) chips.push(`Counterparty: ${conditions.counterparty}`);
  if (conditions.descriptionContains) chips.push(`Matches "${conditions.descriptionContains}"`);
  if (conditions.cooldownHours !== undefined) chips.push(`Cooldown ${conditions.cooldownHours}h`);
  if (chips.length === 0) chips.push('All matching trigger events');

  let actionSummary = rule.actionType.replace(/_/g, ' ');
  if (rule.actionType === 'send_notification') {
    actionSummary = `Notify: "${actionPayload.notificationTitle || rule.name}"`;
  } else if (rule.actionType === 'prepare_allocation') {
    actionSummary = `Draft ${actionPayload.percent ?? 20}% allocation -> ${actionPayload.target || 'Savings'}`;
  } else if (rule.actionType === 'suggest_category') {
    actionSummary = `Suggest category -> ${actionPayload.suggestedCategory || actionPayload.category || 'Reviewed'}`;
  } else if (rule.actionType === 'create_review_draft') {
    actionSummary = `Create Review Draft: ${actionPayload.description || rule.name}`;
  }

  return { conditions, actionPayload, conditionChips: chips, actionSummary };
}

export function normalizeStatementImportResult(raw: any): {
  batch: StatementBatchWithRows;
  rows: StatementImportRowRecord[];
} {
  const rows: StatementImportRowRecord[] = Array.isArray(raw?.rows) ? raw.rows : [];
  const batchRaw = raw?.batch || raw || {};
  const batch: StatementBatchWithRows = {
    id: String(batchRaw.id || ''),
    userId: String(batchRaw.userId || ''),
    walletId: batchRaw.walletId ?? null,
    fileName: String(batchRaw.fileName || 'statement.csv'),
    fileFormat: batchRaw.fileFormat || 'CSV',
    statementOpeningBalance: batchRaw.statementOpeningBalance ?? null,
    statementClosingBalance: batchRaw.statementClosingBalance ?? null,
    status: batchRaw.status || 'pending_review',
    totalRows: Number(batchRaw.totalRows ?? rows.length) || 0,
    matchedCount: Number(batchRaw.matchedCount ?? 0) || 0,
    unmatchedCount: Number(batchRaw.unmatchedCount ?? 0) || 0,
    ambiguousCount: Number(batchRaw.ambiguousCount ?? 0) || 0,
    duplicateCount: Number(batchRaw.duplicateCount ?? 0) || 0,
    reconciledVariance: batchRaw.reconciledVariance ?? '0',
    createdAt: String(batchRaw.createdAt || new Date().toISOString()),
    rows,
  };
  return { batch, rows };
}

export function buildReviewDecisionPayload(input: {
  action: 'post_transaction' | 'link_existing' | 'reject' | 'mark_duplicate';
  item?: FinancialReviewItem;
  walletId?: string;
  category?: string;
  amount?: number;
  description?: string;
  linkedTransactionId?: string;
  decisionNotes?: string;
}) {
  return {
    action: input.action,
    ...(input.walletId ? { walletId: input.walletId } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.amount !== undefined && Number.isFinite(input.amount) ? { amount: input.amount } : {}),
    ...(input.description ? { description: input.description.trim() } : {}),
    ...(input.linkedTransactionId ? { linkedTransactionId: input.linkedTransactionId } : {}),
    ...(input.decisionNotes ? { decisionNotes: input.decisionNotes.trim() } : {}),
  };
}

export function buildPayrollConfirmPayload(input: {
  confirmedAmount?: number;
  confirmedDate?: string;
  walletId?: string;
  varianceNotes?: string;
}) {
  return {
    ...(input.confirmedAmount !== undefined && Number.isFinite(input.confirmedAmount)
      ? { confirmedAmount: input.confirmedAmount }
      : {}),
    ...(input.confirmedDate ? { confirmedDate: input.confirmedDate } : {}),
    ...(input.walletId ? { walletId: input.walletId } : {}),
    ...(input.varianceNotes ? { varianceNotes: input.varianceNotes.trim() } : {}),
  };
}
