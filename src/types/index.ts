export interface User {
  email: string;
  uid: string;
}

export interface HealthFactor {
  name: string;
  score: number;
  maxPoints: number;
  label: string;
}

export interface Forecast {
  expected: number;
  best: number;
  worst: number;
  daysRemaining: number;
  totalDays: number;
  elapsedDays: number;
  spendingPacePercent: number;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  type: 'Bank' | 'Cash' | 'Savings';
  isMain: boolean;
  initialBalance: string;
  balance: number;
}

export interface KPI {
  accounts: Wallet[];
  totalLiquidity: number;
  bankBalance: number;
  cashOnHand: number;
  monthlyExpenses: number;
  monthlyIncome: number;
  adjustedTrueSpend: number;
  daysUntilPayday: number;
  dailyAllowance: number;
  dailySpent: number;
  dailyRemaining: number;
  dailyUsagePercent: number;
  dailyStatus: 'on_track' | 'warning' | 'critical';
  payday: number | null;
  emergencyBuffer: number;
  salary?: number;
  automatedDriveBackups?: boolean;
  lastDriveBackupDate?: string;
  driveBackupFrequency?: 'daily' | '3days' | 'weekly';
  currentFinancialAmount: number;
  financialPeriodStart: string | null;
  financialPeriodEnd: string | null;
  nextPayrollDate: string | null;
  financialMonthReady: boolean;
  financialMonthMessage: string | null;
  // Phase 1 Intelligence
  safeToSpend: number;
  pendingPayables: number;
  pendingReceivables: number;
  runwayDays: number;
  avgDailySpend: number;
  avgDailyVariableSpend?: number;
  remainingFixedBudget?: number;
  forecast: Forecast;
  walletBalances: {
    [key: string]: number;
    Bank?: number;
    Cash?: number;
    Savings?: number;
  };
  healthScore: number;
  healthFactors: HealthFactor[];
}

export type FinancialContextType = 'Trip' | 'Work / Mission' | 'Project' | 'Life Event' | 'Other';
export type FinancialContextStatus = 'Planned' | 'Active' | 'Completed';

export interface FinancialContext {
  id: string;
  userId: string;
  name: string;
  type: FinancialContextType;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  status: FinancialContextStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSplit {
  id?: string;
  reimbursableAmount: string;
  linkedContactId?: string | null;
  linkedContactName?: string | null;
  linkedDebtType?: 'Receivable' | 'Payable' | null;
  remainingBalance?: string | null;
  status?: 'Pending' | 'Cleared' | null;
}

export interface Transaction {
  id: string;
  userId: string;
  createdAt: string;
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId?: string | null;
  sourceWallet?: string | null;
  destinationWalletId?: string | null;
  toWalletId?: string | null;
  category: string;
  notes?: string;
  payrollId?: string | null;
  reimbursableAmount?: string;
  linkedContactId?: string | null;
  linkedContactName?: string | null;
  linkedDebtType?: 'Receivable' | 'Payable' | null;
  splits?: TransactionSplit[];
  contextId?: string | null;
}

export interface Goal {
  id: string;
  userId: string;
  walletId?: string | null;
  name: string;
  targetAmount: string;
  currentAmount: string;
  autoSyncBalance?: boolean;
  deadline?: string | null;
  category: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionBillingCycle = 'monthly' | 'yearly' | 'quarterly' | 'weekly';
export type SubscriptionStatus = 'active' | 'paused' | 'reviewing' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  amount: string;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  category: string;
  walletId?: string | null;
  walletName?: string | null;
  nextBillingDate?: string | null;
  status: SubscriptionStatus;
  notes?: string | null;
  icon?: string | null;
  websiteUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedSubscription {
  name: string;
  suggestedAmount: number;
  suggestedCycle: SubscriptionBillingCycle;
  suggestedCategory: string;
  frequencyCount: number;
  lastSeenDate: string;
  sampleTransactionNotes?: string;
  confidence: 'high' | 'medium';
}

export interface CategoryBudget {
  id: string;
  userId: string;
  category: string;
  year: number;
  /** 1-based calendar month. */
  month: number;
  amount: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payroll {
  id: string;
  userId: string;
  scheduledFor: string;
  amount: string;
  createdAt: string;
}

export interface DebtSettlement {
  id: string;
  amount: string;
  createdAt: string;
}

export interface Debt {
  id: string;
  userId: string;
  contactName: string;
  type: 'Receivable' | 'Payable';
  originalAmount: string;
  remainingBalance: string;
  status: 'Pending' | 'Cleared';
  createdAt: string;
  dueDate?: string | null;
  settlements?: DebtSettlement[];
}

export interface UserSettings {
  emergencyBuffer: number;
  payday?: number;
  salary?: number;
  automatedDriveBackups?: boolean;
  lastDriveBackupDate?: string;
  driveBackupFrequency?: 'daily' | '3days' | 'weekly';
  googleDriveToken?: string;
}

export type DashboardTab =
  | 'overview'
  | 'plan'
  | 'portfolio'
  | 'roadmap'
  | 'decision-lab'
  | 'calendar'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'subscriptions'
  | 'what-if'
  | 'debts'
  | 'analytics'
  | 'settings'
  | 'chat'
  | 'reports'
  | 'cash-flow'
  | 'contexts';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'VeryHigh';
export type FinancialStrategy = 'BufferFirst' | 'DebtFirst' | 'GoalFirst' | 'Balanced' | 'Custom';

export interface FinancialProfile {
  id?: string;
  userId?: string;
  baseCurrency: string;
  incomeFrequency: 'monthly' | 'weekly' | 'irregular';
  incomeStability: 'stable' | 'variable' | 'irregular';
  strategy: FinancialStrategy;
  riskPreference: RiskLevel;
  investmentExperience: 'None' | 'Beginner' | 'Intermediate' | 'Experienced';
  investmentHorizon: string;
  emergencyTargetMonths: string;
  minimumUnallocatedAmount: string;
  minimumUnallocatedPercent: string;
  allowCashEquivalentReserve: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancialSnapshot {
  asOf: string;
  financialPeriod: { start: string | null; end: string | null; daysRemaining: number };
  liquidCash: number;
  protectedEmergencyCash: number;
  reservedForCommitments: number;
  reservedForGoals: number;
  remainingRequiredBudgetReserve: number;
  budgetPacing: Array<{
    category: string;
    budget: number;
    spent: number;
    remaining: number;
    dailyAllowance: number;
    classification: BudgetClassification;
    isLocked: boolean;
    neverAutoChange: boolean;
    atRisk: boolean;
  }>;
  safeToSpend: number;
  safeToSpendBreakdown: Array<{ label: string; amount: number; purpose: string }>;
  investmentCapacity: number;
  pendingPayables: number;
  pendingReceivables: number;
  investmentMarketValue: number;
  netWorth: number;
  forecast: { expected: number; best: number; worst: number };
  buffer: { current: number; target: number; coverageMonths: number };
  plan: { activePlanId?: string; unallocatedIncome: number; status?: string };
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
}

export type BudgetClassification = 'essential' | 'flexible' | 'growth' | 'excluded';

export interface BudgetCategoryPreference {
  id: string;
  userId: string;
  category: string;
  classification: BudgetClassification;
  isLocked: boolean;
  neverAutoChange: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlanStatus = 'Draft' | 'Active' | 'Superseded' | 'Completed' | 'Cancelled';
export type PlanAllocationStatus = 'Planned' | 'Approved' | 'Executed' | 'Skipped' | 'Changed' | 'Failed';
export type PlanAllocationType = 'Commitment' | 'Debt' | 'EmergencyBuffer' | 'Goal' | 'Budget' | 'Investment' | 'UnallocatedMargin';

export interface PlanAllocation {
  id: string;
  planId: string;
  userId: string;
  type: PlanAllocationType;
  name: string;
  amount: string;
  status: PlanAllocationStatus;
  priority: number;
  category?: string | null;
  goalId?: string | null;
  investmentAccountId?: string | null;
  sourceWalletId?: string | null;
  destinationWalletId?: string | null;
  executedTransactionId?: string | null;
  rationale: string;
  evidenceJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  executedAt?: string | null;
}

export interface FinancialPlan {
  id: string;
  userId: string;
  parentPlanId?: string | null;
  payrollId?: string | null;
  sourceTransactionId?: string | null;
  status: PlanStatus;
  periodStart?: string | null;
  periodEnd?: string | null;
  incomeAmount: string;
  baseCurrency: string;
  snapshotJson: FinancialSnapshot;
  engineVersion: string;
  allocations: PlanAllocation[];
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
}

export type RecommendationType = 'SalaryPlanReady' | 'UnallocatedIncome' | 'EmergencyBufferGap' | 'BillReserveRequired' | 'BudgetPaceRisk' | 'GoalAtRisk' | 'DebtDueSoon' | 'InvestmentCapacityAvailable' | 'AllocationDrift' | 'UnusualSpending' | 'PlanReviewRequired';
export type RecommendationStatus = 'Active' | 'Viewed' | 'Approved' | 'Dismissed' | 'Snoozed' | 'Expired';

export interface Recommendation {
  id: string;
  userId: string;
  type: RecommendationType;
  status: RecommendationStatus;
  priorityScore: string;
  title: string;
  summary: string;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  actionPayload: Record<string, unknown>;
  evidenceJson: Record<string, unknown>;
  dedupeKey: string;
  availableFrom: string;
  expiresAt?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  actedAt?: string | null;
}

export type InvestmentAccountType = 'Exchange' | 'Brokerage' | 'Retirement' | 'PreciousMetals' | 'Manual' | 'Other';
export type AssetClass = 'Crypto' | 'Stock' | 'ETF' | 'MutualFund' | 'Bond' | 'PreciousMetal' | 'CashEquivalent' | 'Retirement' | 'Other';
export type InvestmentEventType = 'Funding' | 'Withdrawal' | 'Buy' | 'Sell' | 'Dividend' | 'Interest' | 'Fee' | 'Adjustment';

export interface InvestmentAccount {
  id: string;
  userId: string;
  name: string;
  institution?: string | null;
  type: InvestmentAccountType;
  baseCurrency: string;
  liquidity: 'Liquid' | 'Restricted' | 'Illiquid';
  includeInNetWorth: boolean;
  includeInEmergencyReserve: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentAsset {
  id: string;
  userId?: string | null;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  coinGeckoCoinId?: string | null;
  quoteCurrency: string;
  unitsPrecision: number;
  riskLevel: RiskLevel;
  marketDataProvider?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentEvent {
  id: string;
  userId: string;
  investmentAccountId: string;
  assetId?: string | null;
  type: InvestmentEventType;
  tradeDate: string;
  units?: string | null;
  unitPrice?: string | null;
  quoteCurrency: string;
  grossAmount: string;
  feeAmount: string;
  feeCurrency: string;
  exchangeRateToBase: string;
  baseAmount: string;
  linkedTransactionId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentHolding {
  accountId: string;
  asset: InvestmentAsset;
  units: number;
  costBasis: number;
  marketValue: number;
  unrealizedGain: number;
  latestPrice?: number;
  priceAsOf?: string;
}

export interface PortfolioSummary {
  baseCurrency: string;
  marketValue: number;
  /** Subset of portfolio value the user elected to include in net worth. */
  includedInNetWorthValue: number;
  totalContributions: number;
  costBasis: number;
  unrealizedGain: number;
  realizedGain: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings: InvestmentHolding[];
  allocationByAssetClass: Array<{ name: string; value: number; percent: number }>;
  allocationByAccount: Array<{ name: string; value: number; percent: number }>;
  riskConcentration: Array<{ risk: RiskLevel; value: number; percent: number }>;
  priceFreshness: 'fresh' | 'stale' | 'manual' | 'unavailable';
}

export interface PriceSnapshot {
  id: string;
  assetId: string;
  userId?: string | null;
  price: string;
  currency: string;
  exchangeRateToBase: string;
  priceInBase: string;
  source: 'Manual' | 'Provider' | 'Import';
  provider?: string | null;
  providerAssetId?: string | null;
  providerPriceTimestamp?: string | null;
  capturedAt: string;
}

export interface DecisionScenario {
  type: 'one-time-purchase' | 'monthly-investment' | 'emergency-catch-up' | 'budget-change' | 'debt-change' | 'income-change' | 'goal-change' | 'asset-decline';
  amount: number;
  label?: string;
  result?: Partial<FinancialSnapshot & { portfolioValue: number }>;
}

export interface FinancialHomeResponse {
  snapshot: FinancialSnapshot;
  profile: FinancialProfile;
  activePlan: FinancialPlan | null;
  recommendations: Recommendation[];
  dataCompleteness: string[];
}


