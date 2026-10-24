export type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type UserStatus = 'active' | 'suspended' | 'pending' | 'legacy_hidden';
export type WorkspaceMode = 'shared' | 'isolated';

export interface UserPermissions {
  canWriteTransactions: boolean;
  canManageWallets: boolean;
  canManageBudgets: boolean;
  canAccessInvestments: boolean;
  canUseAiChat: boolean;
  canExportData: boolean;
  canManageUsers: boolean;
}

export interface User {
  id?: string;
  email: string;
  uid: string;
  username?: string;
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  workspaceMode?: WorkspaceMode;
  permissions?: UserPermissions;
  avatarColor?: string;
  impersonatedBy?: {
    id: string;
    username: string;
    displayName: string;
    role: UserRole;
  } | null;
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
  type: 'Bank' | 'Cash' | 'Savings' | 'Investment';
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
  investmentReserve?: number;
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
    Investment?: number;
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
  | 'investments'
  | 'forecast'
  | 'calculators'
  | 'calendar'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'subscriptions'
  | 'debts'
  | 'analytics'
  | 'settings'
  | 'users'
  | 'chat'
  | 'reports'
  | 'contexts';

export type StockMarketType = 'US' | 'BVC' | 'ETF' | 'GLOBAL';
export type StockOrderAction = 'BUY' | 'SELL' | 'DIVIDEND';

export interface StockPosition {
  id: string;
  userId: string;
  walletId?: string | null;
  walletName?: string | null;
  ticker: string;
  companyName: string;
  market: StockMarketType;
  sector: string;
  shares: string;
  avgCostPerShare: string;
  currentPrice: string;
  currency: 'USD' | 'MAD' | 'EUR' | string;
  annualDividendPerShare: string;
  targetWeightPercent: string;
  convictionThesis?: string | null;
  isWatchlistOnly: boolean;
  createdAt: string;
  updatedAt: string;
  // Enriched live metrics
  sharesNum: number;
  avgCostNum: number;
  currentPriceNum: number;
  change24hPercent: number;
  costBasisNative: number;
  marketValueNative: number;
  unrealizedPnlNative: number;
  unrealizedPnlPercent: number;
  costBasisMad: number;
  marketValueMad: number;
  unrealizedPnlMad: number;
  actualWeightPercent: number;
  annualDividendNative: number;
  annualDividendMad: number;
  dividendYieldPercent: number;
  affordableSharesFromSurplus: number;
}

export interface StockOrder {
  id: string;
  userId: string;
  positionId: string;
  ticker?: string;
  companyName?: string;
  currency?: string;
  walletId?: string | null;
  walletName?: string | null;
  linkedTransactionId?: string | null;
  action: StockOrderAction;
  shares: string;
  pricePerShare: string;
  totalNativeAmount: string;
  totalMadAmount: string;
  exchangeRateUsed: string;
  realizedPnlMad: string;
  notes?: string | null;
  executedAt: string;
}

export interface StockCatalogItem {
  ticker: string;
  companyName: string;
  market: StockMarketType;
  sector: string;
  price: number;
  change24hPercent: number;
  currency: 'USD' | 'MAD' | 'EUR';
  priceInMad: number;
  annualDividendPerShare: number;
  dividendYieldPercent: number;
  thesis: string;
  inPortfolio?: boolean;
  inWatchlist?: boolean;
}

export interface BuyingPowerSnapshot {
  safeToSpendMad: number;
  investmentWalletBalanceMad: number;
  monthlyIncomeMad: number;
  monthlyInvestmentBudgetMad: number;
  investedThisCycleMad: number;
  remainingInvestmentBudgetMad: number;
  deployableSurplusMad: number;
  deployableSurplusUsd: number;
  emergencyBufferIntact: boolean;
  emergencyDeficitMad: number;
  daysUntilPayday: number;
  guidanceText: string;
}

export interface InvestmentWalletSummary {
  walletId: string;
  name: string;
  type: 'Investment';
  uninvestedCashMad: number;
  investedStockValueMad: number;
  totalAccountValueMad: number;
  positionsCount: number;
}

export interface InvestmentsData {
  positions: StockPosition[];
  watchlistPositions: StockPosition[];
  orders: StockOrder[];
  catalog: StockCatalogItem[];
  investmentWallets?: InvestmentWalletSummary[];
  rates: {
    USD_TO_MAD: number;
    EUR_TO_MAD: number;
    USD_TO_EUR: number;
  };
  buyingPower: BuyingPowerSnapshot;
  // Portfolio Aggregates (MAD & USD)
  totalPortfolioValueMad: number;
  totalPortfolioValueUsd: number;
  totalCostBasisMad: number;
  totalUnrealizedPnlMad: number;
  totalUnrealizedPnlPercent: number;
  totalRealizedPnlMad: number;
  totalDividendsCollectedMad: number;
  annualPassiveIncomeMad: number;
  monthlyPassiveIncomeMad: number;
  portfolioYieldPercent: number;
  subscriptionCoveragePercent: number;
  livingExpenseCoveragePercent: number;
  sectorBreakdown: { sector: string; valueMad: number; weightPercent: number }[];
  marketBreakdown: { market: string; valueMad: number; weightPercent: number }[];
  // Compatibility for PredictiveEngine
  fireCoveragePercent: number;
  safeToInvest: {
    monthlyIncome: number;
    fixedObligations: number;
    variableSpendPace: number;
    emergencyBufferDeficiency: number;
    pendingPayables: number;
    totalInvestmentBudget?: number;
    investedThisMonth?: number;
    remainingInvestmentBudget?: number;
    safeToInvestMonthly: number;
    currentMonthlyDcaTarget: number;
    surplusAfterDca: number;
    recommendationText: string;
    riskAppetiteMax: number;
  };
}

export type RetrospectiveLetterGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'D' | 'F';

export interface CycleCategoryPerformance {
  category: string;
  actual: number;
  budget: number;
  difference: number;
  percentUsed: number;
  grade: RetrospectiveLetterGrade;
  status: 'under' | 'on_track' | 'warning' | 'over';
  commentary?: string;
}

export interface CycleDailyVelocity {
  date: string;
  dayNumber: number;
  dayOfWeek: string;
  spent: number;
  allowance: number;
  isUnderBudget: boolean;
  cumulativeSpent: number;
}

export interface CyclePaydayAllocation {
  bucket: string;
  recommendedAmount: number;
  rationale: string;
  actionableStep: string;
}

export interface CycleComparison {
  previousPeriodLabel: string;
  expensesChangePercent: number;
  savingsChangePercent: number;
  avgDailySpendChange: number;
  healthScoreChange: number;
}

export interface CyclePeriodSummary {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  year: number;
  month: number;
}

export interface CycleRetrospectiveData {
  id?: string;
  cycleId: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  isCurrentCycle: boolean;
  totalDays: number;
  elapsedDays: number;
  daysRemaining: number;

  // Grade & Scorecard
  letterGrade: RetrospectiveLetterGrade;
  score: number; // 0 - 100
  financialPersona: {
    title: string;
    description: string;
    trait: string;
    icon: string;
  };

  // Financial Figures
  totalInflow: number;
  totalOutflow: number;
  netSavings: number;
  savingsRate: number; // percentage
  dailyAllowance: number;
  avgDailySpend: number;
  daysUnderAllowanceCount: number;
  daysOverAllowanceCount: number;
  safeToSpendEnding: number;
  totalInvested: number;
  totalDebtRepaid: number;

  // Macro 50/30/20 Breakdown
  macroSplit: {
    needs: { amount: number; percent: number; targetPercent: number };
    wants: { amount: number; percent: number; targetPercent: number };
    savings: { amount: number; percent: number; targetPercent: number };
  };

  // Category Matrix
  categories: CycleCategoryPerformance[];

  // Daily Pace Velocity
  dailyVelocity: CycleDailyVelocity[];

  // Comparison
  comparison?: CycleComparison | null;

  // AI Narrative & Recommendations
  verdictTitle: string;
  executiveSummary: string;
  biggestWins: string[];
  financialLeaks: string[];
  paydayAllocations: CyclePaydayAllocation[];
  goldenRule: string;

  // Metadata
  generatedAt: string;
  modelUsed: string;
  isAiGenerated: boolean;
  fallbackReason?: string;
}

export interface ManagedUser {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  workspaceMode: WorkspaceMode;
  permissions: UserPermissions;
  avatarColor: string;
  notes?: string | null;
  payday: number;
  salary: number;
  emergencyBuffer: number;
  createdAt: string;
  lastLoginAt?: string | null;
  isOwnerAccount: boolean;
  stats: {
    transactionCount: number;
    walletCount: number;
    holdingCount: number;
  };
}

export interface UserAuditLog {
  id: string;
  actorId: string | null;
  actorName: string;
  targetUserId: string | null;
  targetUserName: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface RoleDefinition {
  role: UserRole;
  label: string;
  shortDesc: string;
  description: string;
  defaultWorkspaceMode: WorkspaceMode;
  defaultPermissions: UserPermissions;
}
