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
  type: 'Bank' | 'Cash' | 'Savings' | 'Brokerage';
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
    Brokerage?: number;
  };
  healthScore: number;
  healthFactors: HealthFactor[];
  investmentValue?: number;
  netWorthTotal?: number;
  safeToInvestBreakdown?: SafeToInvestBreakdown;
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

export type InvestmentAssetType = 'crypto' | 'stock' | 'etf' | 'manual';
export type InvestmentAction = 'Buy' | 'Sell' | 'Dividend' | 'Staking';

export interface InvestmentHolding {
  id: string;
  userId: string;
  walletId: string;
  walletName?: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  quantity: string;
  avgCostBasis: string;
  currency: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed price fields
  currentPriceUsd?: number;
  currentPriceMad?: number;
  currentPriceEur?: number;
  marketValueMad?: number;
  unrealizedGainLoss?: number;
  unrealizedGainLossPct?: number;
  lastPriceFetchedAt?: string;
}

export interface AssetPrice {
  symbol: string;
  assetType: InvestmentAssetType;
  priceUsd: number;
  priceMad: number;
  priceEur: number;
  fetchedAt: string;
  source: string;
}

export interface DcaPlan {
  id: string;
  userId: string;
  symbol: string;
  assetName: string;
  assetType: InvestmentAssetType;
  walletId?: string | null;
  walletName?: string | null;
  amount: string;
  currency: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextDate: string;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorthSnapshot {
  id: string;
  userId: string;
  date: string;
  liquidValue: string;
  investmentValue: string;
  debtValue: string;
  netWorth: string;
  currency: string;
  createdAt: string;
}

export interface InvestmentPortfolioSummary {
  totalInvestedMad: number;
  totalMarketValueMad: number;
  totalUnrealizedGainLoss: number;
  totalUnrealizedGainLossPct: number;
  totalRealizedGainLoss: number;
  passiveIncomeMonthlyMad: number;
  holdings: InvestmentHolding[];
}

export interface SafeToInvestBreakdown {
  salary: number;
  fixedBills: number;
  loans: number;
  groceries: number;
  emergencyBuffer: number;
  projectedCashNeeds: number;
  safeToInvest: number;
}

export interface FIREMetrics {
  annualExpenses: number;
  fiNumber: number;
  currentNetWorth: number;
  progressPct: number;
  yearsToFIRE: number | null;
  safeWithdrawalRate: number;
  monthlyPassiveIncome: number;
  monthlyExpensesNeeded: number;
}

export type DashboardTab =

  | 'overview'
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
  | 'contexts'
  | 'investment'
  | 'net-worth';



export interface SafeToInvestBreakdown {
  salary: number;
  fixedBills: number;
  loans: number;
  groceries: number;
  emergencyBuffer: number;
  projectedCashNeeds: number;
  safeToInvest: number;
}

export type InvestmentAssetType = 'crypto' | 'stock' | 'etf' | 'manual';
export type InvestmentAction = 'Buy' | 'Sell' | 'Dividend' | 'Staking';

export interface InvestmentHolding {
  id: string;
  userId: string;
  walletId: string;
  walletName?: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  quantity: string;
  avgCostBasis: string;
  currency: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  currentPriceUsd?: number;
  currentPriceMad?: number;
  currentPriceEur?: number;
  marketValueMad?: number;
  unrealizedGainLoss?: number;
  unrealizedGainLossPct?: number;
  lastPriceFetchedAt?: string;
}

export interface AssetPrice {
  symbol: string;
  assetType: InvestmentAssetType;
  priceUsd: number;
  priceMad: number;
  priceEur: number;
  fetchedAt: string;
  source: string;
}

export interface DcaPlan {
  id: string;
  userId: string;
  symbol: string;
  assetName: string;
  assetType: InvestmentAssetType;
  walletId?: string | null;
  walletName?: string | null;
  amount: string;
  currency: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextDate: string;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NetWorthSnapshot {
  id: string;
  userId: string;
  date: string;
  liquidValue: string;
  investmentValue: string;
  debtValue: string;
  netWorth: string;
  currency: string;
  createdAt: string;
}

export interface InvestmentPortfolioSummary {
  totalInvestedMad: number;
  totalMarketValueMad: number;
  totalUnrealizedGainLoss: number;
  totalUnrealizedGainLossPct: number;
  totalRealizedGainLoss: number;
  passiveIncomeMonthlyMad: number;
  holdings: InvestmentHolding[];
}

export interface FIREMetrics {
  annualExpenses: number;
  fiNumber: number;
  currentNetWorth: number;
  progressPct: number;
  yearsToFIRE: number | null;
  safeWithdrawalRate: number;
  monthlyPassiveIncome: number;
  monthlyExpensesNeeded: number;
}
