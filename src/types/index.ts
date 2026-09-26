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

export type ImpulseStatus = 'cooling' | 'resisted' | 'purchased' | 'dismissed';

export interface ImpulseItem {
  id: string;
  userId: string;
  name: string;
  amount: string;
  currency: string;
  category: string;
  notes?: string | null;
  url?: string | null;
  triggers: string[];
  urgencyScore: number;
  utilityScore: number;
  coolingHours: number;
  coolsAt: string;
  status: ImpulseStatus;
  decisionDate?: string | null;
  decisionNotes?: string | null;
  savedToGoalId?: string | null;
  savedToGoalName?: string | null;
  walletId?: string | null;
  walletName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImpulseStats {
  totalCoolingCount: number;
  totalCoolingAmount: number;
  totalResistedCount: number;
  totalResistedAmount: number;
  totalPurchasedCount: number;
  totalPurchasedAmount: number;
  totalReclaimedHours: number;
  resistanceRate: number;
  triggerBreakdown: { trigger: string; count: number; percentage: number }[];
}

export interface FireProfile {
  id?: string;
  userId?: string;
  currentAge: number;
  targetAge: number;
  expectedReturn: number;
  safeWithdrawalRate: number;
  monthlySavingsBoost: number;
  expenseTrimPercent: number;
  customMonthlyExpense?: number | null;
  updatedAt?: string;
}

export interface ResiliencePillar {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: string;
  status: 'fortress' | 'good' | 'moderate' | 'warning' | 'critical';
  headline: string;
  description: string;
  metric: string;
}

export interface MicroLeakItem {
  category: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  sampleNotes: string[];
}

export interface ResilienceDirective {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedBoost: number;
  actionTab?: string;
  actionLabel?: string;
}

export interface ResilienceAudit {
  profile: {
    emergencyTargetMonths: number;
    stressJobLossMonths: number;
    stressEmergencyExpense: string | number;
    stressInflationRate: string | number;
    essentialExpensesRatio: string | number;
    customEssentialMonthly?: string | number | null;
    microLeakThreshold: string | number;
    notes?: string | null;
  };
  overallScore: number;
  grade: string;
  gradeLabel: string;
  verdict: string;
  summary: string;
  baseline: {
    liquidBalance: number;
    savingsBalance: number;
    totalAssets: number;
    totalDebtsPayable: number;
    totalDebtsReceivable: number;
    monthlySalary: number;
    monthlyExpenses: number;
    essentialMonthly: number;
    discretionaryMonthly: number;
    subscriptionMonthly: number;
    netMonthlySurplus: number;
    savingsRatePercent: number;
    runwayMonths: number;
    runwayDays: number;
    targetRunwayMonths: number;
    emergencyTargetAmount: number;
  };
  pillars: ResiliencePillar[];
  stressScenarios: {
    jobLoss: {
      testedMonths: number;
      survives: boolean;
      daysRemaining: number;
      cashRemaining: number;
      deficitAmount: number;
      extendedDaysWithFreeze: number;
      verdict: string;
    };
    emergencyShock: {
      testedAmount: number;
      survives: boolean;
      cashRemaining: number;
      bufferPreservationPercent: number;
      shortfall: number;
      verdict: string;
    };
    inflationSurge: {
      testedRate: number;
      newMonthlyExpenses: number;
      newMonthlySurplus: number;
      monthlySurplusErosion: number;
      annualDrag: number;
      verdict: string;
    };
    blackSwan: {
      survives: boolean;
      cashRemaining: number;
      deficitAmount: number;
      verdict: string;
      timelineDescription: string;
    };
  };
  microLeaks: {
    threshold: number;
    totalCount: number;
    totalSpent: number;
    monthlyDrain: number;
    annualProjected: number;
    tenYearCompounded: number;
    workHoursEquivalent: number;
    items: MicroLeakItem[];
  };
  directives: ResilienceDirective[];
}

export interface CustomStressSimulationResult {
  input: {
    jobLossMonths: number;
    emergencyExpense: number;
    inflationRate: number;
    freezeSubscriptions: number;
    cutDiscretionary: number;
  };
  baseline: {
    liquidBalance: number;
    originalMonthlyBurn: number;
  };
  simulatedMonthlyBurn: number;
  totalSimulatedDrain: number;
  projectedEndingCash: number;
  survives: boolean;
  shortfall: number;
  runwayDays: number;
  runwayMonths: number;
  monthlySavingsFromAdjustments: number;
}

export type DashboardTab =
  | 'overview'
  | 'calendar'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'subscriptions'
  | 'impulse-shield'
  | 'freedom'
  | 'resilience'
  | 'opportunity'
  | 'what-if'
  | 'debts'
  | 'analytics'
  | 'settings'
  | 'digest'
  | 'chat'
  | 'reports'
  | 'cash-flow'
  | 'contexts';

export interface WealthAssetBenchmark {
  id: string;
  name: string;
  tickerOrCode: string;
  cagrPercent: number;
  description: string;
  category: 'Equities' | 'Tech' | 'Real Assets' | 'Fixed Income' | 'Debt Payoff';
  riskLabel: 'Low' | 'Moderate' | 'High' | 'Guaranteed';
}

export interface OpportunitySwap {
  id: string;
  title: string;
  category: string;
  monthlyAmountMAD: number;
  tradeoffDescription: string;
  streakWeeks: number;
  createdAt: string;
  isCustom?: boolean;
}

export interface LifeEnergyProfile {
  monthlyNetSalary: number;
  weeklyWorkHours: number;
  weeklyCommuteHours: number;
  monthlyWorkDirectExpenses: number;
}


