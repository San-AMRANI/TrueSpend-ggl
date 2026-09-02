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

export interface GoalMetric {
  goalId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercent: number;
  deadline: string | null;
  daysRemaining: number | null;
  requiredMonthlyContribution: number | null;
  requiredWeeklyContribution: number | null;
  completed: boolean;
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

export interface KPI {
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
  forecast: Forecast;
  healthScore: number;
  healthFactors: HealthFactor[];
  goalMetrics: GoalMetric[];
}

export interface Transaction {
  id: string;
  userId: string;
  createdAt: string;
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  sourceWallet: 'Bank' | 'Cash';
  category: string;
  notes?: string;
  payrollId?: string | null;
  reimbursableAmount?: string;
  linkedContactId?: string | null;
  linkedContactName?: string | null;
  linkedDebtType?: 'Receivable' | 'Payable' | null;
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
}

// ── Phase 2 — Personal Intelligence ──────────────────────────────────────────
export interface MerchantStat {
  name: string;
  total: number;
  count: number;
  avgAmount: number;
  confidence: number;
  thisMonth: number;
  lastMonth: number;
  changePercent: number;
}

export interface Anomaly {
  transactionId: string;
  date: string;
  amount: number;
  category: string;
  notes: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  avgAmount: number;
  confidence: number;
}

export interface Subscription {
  name: string;
  amount: number;
  category: string;
  frequency: 'monthly' | 'weekly';
  occurrences: number;
  annualCost: number;
  lastSeen: string;
  confidence: number;
}

export interface SpendingPattern {
  category: string;
  currentMonthTotal: number;
  threeMonthAvg: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

// ── Phase 3 — Planning ────────────────────────────────────────────────────────
export interface Goal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  category: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type DashboardTab = 'overview' | 'calendar' | 'transactions' | 'budgets' | 'what-if' | 'debts' | 'analytics' | 'settings' | 'digest' | 'chat' | 'goals' | 'insights' | 'reconciliation' | 'reports';
