import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer, boolean, uniqueIndex, jsonb, date, index } from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', ['Income', 'Expense', 'Transfer', 'Debt Repayment']);
export const walletTypeEnum = pgEnum('wallet_type', ['Bank', 'Cash', 'Savings']);

export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(), // e.g., 'Main Bank', 'Savings', 'Cash'
  type: walletTypeEnum('type').notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  initialBalance: decimal('initial_balance').default('0').notNull(),
  currentBalance: decimal('current_balance').default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('wallets_user_name_unique').on(table.userId, table.name),
]);

export const walletEnum = pgEnum('wallet_type', ['Bank', 'Cash', 'Savings']);
export const accountTypeEnum = pgEnum('account_type', ['Bank', 'Cash', 'Savings', 'Credit']);
export const debtTypeEnum = pgEnum('debt_type', ['Receivable', 'Payable']);
export const debtStatusEnum = pgEnum('debt_status', ['Pending', 'Cleared']);
export const financialContextStatusEnum = pgEnum('financial_context_status', ['Planned', 'Active', 'Completed']);
export const financialContextTypeEnum = pgEnum('financial_context_type', ['Trip', 'Work / Mission', 'Project', 'Life Event', 'Other']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  payday: integer('payday').default(25),
  emergencyBuffer: decimal('emergency_buffer').default('0').notNull(),
  salary: decimal('salary').default('0').notNull(),
  automatedDriveBackups: integer('automated_drive_backups').default(0),
  lastDriveBackupDate: timestamp('last_drive_backup_date'),
  driveBackupFrequency: text('drive_backup_frequency').default('weekly'),
  googleDriveToken: text('google_drive_token'),
  googleDriveTokenExpiry: timestamp('google_drive_token_expiry'),
  notificationEnabled: integer('notification_enabled').default(0),
  notificationTime: text('notification_time').default('09:00'),
});

export const debts = pgTable('debts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  contactName: text('contact_name').notNull(),
  type: debtTypeEnum('type').notNull(),
  originalAmount: decimal('original_amount').notNull(),
  remainingBalance: decimal('remaining_balance').notNull(),
  status: debtStatusEnum('status').notNull(),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

/** A single, dated payroll configured from the financial calendar. */
export const payrolls = pgTable('payrolls', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  scheduledFor: timestamp('scheduled_for').notNull(),
  amount: decimal('amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const financialContexts = pgTable('financial_contexts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  type: financialContextTypeEnum('type').notNull(),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  budget: decimal('budget'),
  status: financialContextStatusEnum('status').default('Planned').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id),
  destinationWalletId: uuid('destination_wallet_id').references(() => wallets.id),
  sourceWallet: text('source_wallet'),
  createdAt: timestamp('created_at').defaultNow(),
  amount: decimal('amount').notNull(),
  type: transactionTypeEnum('type').notNull(),
  category: text('category'),
  notes: text('notes'),
  /** Present only for income generated from a calendar payroll. */
  payrollId: uuid('payroll_id').references(() => payrolls.id),
  contextId: uuid('context_id').references(() => financialContexts.id),
});

/** One installed browser/PWA can register one FCM token and delivery schedule. (Legacy) */
export const notificationDevices = pgTable('notification_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: text('token').notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  time: text('time').default('09:00').notNull(),
  timezone: text('timezone').notNull(),
  lastSentOn: text('last_sent_on'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Web Push Subscriptions for Notification Engine v2 */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** User Preferences for Notification Engine v2 */
export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  enabled: boolean('enabled').default(false).notNull(),
  dailyInsightEnabled: boolean('daily_insight_enabled').default(true).notNull(),
  budgetWarningEnabled: boolean('budget_warning_enabled').default(true).notNull(),
  forecastWarningEnabled: boolean('forecast_warning_enabled').default(true).notNull(),
  debtReminderEnabled: boolean('debt_reminder_enabled').default(true).notNull(),
  anomalyEnabled: boolean('anomaly_enabled').default(true).notNull(),
  goalEnabled: boolean('goal_enabled').default(true).notNull(),
  deliveryTime: text('delivery_time').default('09:00').notNull(),
  timezone: text('timezone').default('Africa/Casablanca').notNull(),
  quietHoursStart: text('quiet_hours_start').default('22:00').notNull(),
  quietHoursEnd: text('quiet_hours_end').default('07:00').notNull(),
});

/** Log of delivered notifications for idempotency */
export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // DAILY_INSIGHT, BUDGET_WARNING, etc.
  scheduledFor: text('scheduled_for').notNull(), // yyyy-MM-dd
  deliveredAt: timestamp('delivered_at').defaultNow().notNull(),
  status: text('status').default('sent').notNull(),
  metadata: text('metadata'),
}, (table) => [
  uniqueIndex('notification_deliveries_user_type_scheduled_unique').on(
    table.userId,
    table.type,
    table.scheduledFor
  ),
]);

export const splits = pgTable('splits', {
  id: uuid('id').defaultRandom().primaryKey(),
  transactionId: uuid('transaction_id').references(() => transactions.id).notNull(),
  reimbursableAmount: decimal('reimbursable_amount').notNull(),
  linkedContactId: uuid('linked_contact_id').references(() => debts.id),
});

export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  targetAmount: decimal('target_amount').notNull(),
  currentAmount: decimal('current_amount').default('0').notNull(),
  autoSyncBalance: boolean('auto_sync_balance').default(false).notNull(),
  deadline: timestamp('deadline'),
  category: text('category').default('').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('MAD').notNull(),
  billingCycle: text('billing_cycle').default('monthly').notNull(), // 'monthly' | 'yearly' | 'quarterly' | 'weekly'
  category: text('category').default('Subscriptions & Streaming').notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  nextBillingDate: timestamp('next_billing_date'),
  status: text('status').default('active').notNull(), // 'active' | 'paused' | 'reviewing' | 'cancelled'
  notes: text('notes'),
  icon: text('icon').default('📱'),
  websiteUrl: text('website_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categoryBudgets = pgTable(
  'category_budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    category: text('category').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    amount: decimal('amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('category_budgets_user_category_month_unique').on(
      table.userId,
      table.category,
      table.year,
      table.month,
    ),
  ],
);

// ─── Financial Operating System V2 ──────────────────────────────────────────
// These tables are intentionally additive. The original transaction ledger
// remains the source of truth for cash; plans and investments are separate,
// auditable domain records.
export const planStatusEnum = pgEnum('plan_status', ['Draft', 'Active', 'Superseded', 'Completed', 'Cancelled']);
export const planAllocationStatusEnum = pgEnum('plan_allocation_status', ['Planned', 'Approved', 'Executed', 'Skipped', 'Changed', 'Failed']);
export const planAllocationTypeEnum = pgEnum('plan_allocation_type', ['Commitment', 'Debt', 'EmergencyBuffer', 'Goal', 'Budget', 'Investment', 'UnallocatedMargin']);
export const recommendationTypeEnum = pgEnum('recommendation_type', ['SalaryPlanReady', 'UnallocatedIncome', 'EmergencyBufferGap', 'BillReserveRequired', 'BudgetPaceRisk', 'GoalAtRisk', 'DebtDueSoon', 'InvestmentCapacityAvailable', 'AllocationDrift', 'UnusualSpending', 'PlanReviewRequired']);
export const recommendationStatusEnum = pgEnum('recommendation_status', ['Active', 'Viewed', 'Approved', 'Dismissed', 'Snoozed', 'Expired']);
export const investmentAccountTypeEnum = pgEnum('investment_account_type', ['Exchange', 'Brokerage', 'Retirement', 'PreciousMetals', 'Manual', 'Other']);
export const assetClassEnum = pgEnum('asset_class', ['Crypto', 'Stock', 'ETF', 'MutualFund', 'Bond', 'PreciousMetal', 'CashEquivalent', 'Retirement', 'Other']);
export const investmentEventTypeEnum = pgEnum('investment_event_type', ['Funding', 'Withdrawal', 'Buy', 'Sell', 'Dividend', 'Interest', 'Fee', 'Adjustment']);
export const priceSourceEnum = pgEnum('price_source', ['Manual', 'Provider', 'Import']);
export const riskLevelEnum = pgEnum('risk_level', ['Low', 'Medium', 'High', 'VeryHigh']);
/** User-controlled guidance for an existing calendar budget category. */
export const budgetClassificationEnum = pgEnum('budget_classification', ['essential', 'flexible', 'growth', 'excluded']);

export const financialProfiles = pgTable('financial_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  baseCurrency: text('base_currency').default('MAD').notNull(),
  incomeFrequency: text('income_frequency').default('monthly').notNull(),
  incomeStability: text('income_stability').default('stable').notNull(),
  strategy: text('strategy').default('Balanced').notNull(),
  riskPreference: riskLevelEnum('risk_preference').default('Medium').notNull(),
  investmentExperience: text('investment_experience').default('None').notNull(),
  investmentHorizon: text('investment_horizon').default('Not set').notNull(),
  emergencyTargetMonths: decimal('emergency_target_months').default('3').notNull(),
  minimumUnallocatedAmount: decimal('minimum_unallocated_amount').default('0').notNull(),
  minimumUnallocatedPercent: decimal('minimum_unallocated_percent').default('0').notNull(),
  allowCashEquivalentReserve: boolean('allow_cash_equivalent_reserve').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Keeps the V1 category-budget ledger intact while giving the planning engine
 * explicit guardrails. A lock prevents automatic changes; a user can still
 * deliberately edit a draft before approving it.
 */
export const budgetCategoryPreferences = pgTable('budget_category_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  category: text('category').notNull(),
  classification: budgetClassificationEnum('classification').default('flexible').notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  neverAutoChange: boolean('never_auto_change').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('budget_category_preferences_user_category_unique').on(table.userId, table.category)]);

export const financialPlans = pgTable('financial_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  parentPlanId: uuid('parent_plan_id'),
  payrollId: uuid('payroll_id').references(() => payrolls.id, { onDelete: 'set null' }),
  sourceTransactionId: uuid('source_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  status: planStatusEnum('status').default('Draft').notNull(),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  incomeAmount: decimal('income_amount').notNull(),
  baseCurrency: text('base_currency').default('MAD').notNull(),
  snapshotJson: jsonb('snapshot_json').$type<Record<string, unknown>>().notNull(),
  engineVersion: text('engine_version').default('v2.0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  approvedAt: timestamp('approved_at'),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('financial_plans_user_status_idx').on(table.userId, table.status),
  index('financial_plans_user_period_idx').on(table.userId, table.periodStart),
]);

export const investmentAccounts = pgTable('investment_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  institution: text('institution'),
  type: investmentAccountTypeEnum('type').notNull(),
  baseCurrency: text('base_currency').default('MAD').notNull(),
  liquidity: text('liquidity').default('Restricted').notNull(),
  includeInNetWorth: boolean('include_in_net_worth').default(true).notNull(),
  includeInEmergencyReserve: boolean('include_in_emergency_reserve').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('investment_accounts_user_name_unique').on(table.userId, table.name)]);

export const investmentAssets = pgTable('investment_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  assetClass: assetClassEnum('asset_class').notNull(),
  coinGeckoCoinId: text('coingecko_coin_id'),
  quoteCurrency: text('quote_currency').default('MAD').notNull(),
  unitsPrecision: integer('units_precision').default(8).notNull(),
  riskLevel: riskLevelEnum('risk_level').default('Medium').notNull(),
  marketDataProvider: text('market_data_provider'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('investment_assets_user_symbol_quote_unique').on(table.userId, table.symbol, table.quoteCurrency)]);

export const investmentEvents = pgTable('investment_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  investmentAccountId: uuid('investment_account_id').references(() => investmentAccounts.id, { onDelete: 'cascade' }).notNull(),
  assetId: uuid('asset_id').references(() => investmentAssets.id, { onDelete: 'set null' }),
  type: investmentEventTypeEnum('type').notNull(),
  tradeDate: timestamp('trade_date').notNull(),
  units: decimal('units'),
  unitPrice: decimal('unit_price'),
  quoteCurrency: text('quote_currency').default('MAD').notNull(),
  grossAmount: decimal('gross_amount').notNull(),
  feeAmount: decimal('fee_amount').default('0').notNull(),
  feeCurrency: text('fee_currency').default('MAD').notNull(),
  exchangeRateToBase: decimal('exchange_rate_to_base').default('1').notNull(),
  baseAmount: decimal('base_amount').notNull(),
  linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const investmentLots = pgTable('investment_lots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  investmentEventId: uuid('investment_event_id').references(() => investmentEvents.id, { onDelete: 'cascade' }).notNull(),
  investmentAccountId: uuid('investment_account_id').references(() => investmentAccounts.id, { onDelete: 'cascade' }).notNull(),
  assetId: uuid('asset_id').references(() => investmentAssets.id, { onDelete: 'cascade' }).notNull(),
  acquiredAt: timestamp('acquired_at').notNull(),
  originalUnits: decimal('original_units').notNull(),
  remainingUnits: decimal('remaining_units').notNull(),
  costBasisBase: decimal('cost_basis_base').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** FIFO disposal audit records preserve realized gain/loss without mutating buy history. */
export const investmentLotDisposals = pgTable('investment_lot_disposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  investmentEventId: uuid('investment_event_id').references(() => investmentEvents.id, { onDelete: 'cascade' }).notNull(),
  investmentLotId: uuid('investment_lot_id').references(() => investmentLots.id, { onDelete: 'cascade' }).notNull(),
  units: decimal('units').notNull(),
  costBasisBase: decimal('cost_basis_base').notNull(),
  proceedsBase: decimal('proceeds_base').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const priceSnapshots = pgTable('price_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  assetId: uuid('asset_id').references(() => investmentAssets.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  price: decimal('price').notNull(),
  currency: text('currency').notNull(),
  exchangeRateToBase: decimal('exchange_rate_to_base').default('1').notNull(),
  priceInBase: decimal('price_in_base').notNull(),
  source: priceSourceEnum('source').notNull(),
  provider: text('provider'),
  providerAssetId: text('provider_asset_id'),
  providerPriceTimestamp: timestamp('provider_price_timestamp'),
  capturedAt: timestamp('captured_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('price_snapshots_asset_captured_source_unique').on(table.assetId, table.capturedAt, table.source)]);

export const planAllocations = pgTable('plan_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  planId: uuid('plan_id').references(() => financialPlans.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: planAllocationTypeEnum('type').notNull(),
  name: text('name').notNull(),
  amount: decimal('amount').notNull(),
  status: planAllocationStatusEnum('status').default('Planned').notNull(),
  priority: integer('priority').notNull(),
  category: text('category'),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
  investmentAccountId: uuid('investment_account_id').references(() => investmentAccounts.id, { onDelete: 'set null' }),
  sourceWalletId: uuid('source_wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  destinationWalletId: uuid('destination_wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  executedTransactionId: uuid('executed_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  rationale: text('rationale').notNull(),
  evidenceJson: jsonb('evidence_json').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  executedAt: timestamp('executed_at'),
}, (table) => [index('plan_allocations_plan_idx').on(table.planId), index('plan_allocations_user_idx').on(table.userId)]);

export const recommendations = pgTable('recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: recommendationTypeEnum('type').notNull(),
  status: recommendationStatusEnum('status').default('Active').notNull(),
  priorityScore: decimal('priority_score').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  rationale: text('rationale').notNull(),
  confidence: text('confidence').notNull(),
  actionPayload: jsonb('action_payload').$type<Record<string, unknown>>().notNull(),
  evidenceJson: jsonb('evidence_json').$type<Record<string, unknown>>().notNull(),
  dedupeKey: text('dedupe_key').notNull(),
  availableFrom: timestamp('available_from').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  snoozedUntil: timestamp('snoozed_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  actedAt: timestamp('acted_at'),
}, (table) => [index('recommendations_user_status_idx').on(table.userId, table.status), uniqueIndex('recommendations_user_dedupe_unique').on(table.userId, table.dedupeKey)]);

export const financialSnapshots = pgTable('financial_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  snapshotDate: date('snapshot_date').notNull(),
  liquidCash: decimal('liquid_cash').notNull(),
  reservedCash: decimal('reserved_cash').notNull(),
  safeToSpend: decimal('safe_to_spend').notNull(),
  investmentValue: decimal('investment_value').notNull(),
  totalDebt: decimal('total_debt').notNull(),
  netWorth: decimal('net_worth').notNull(),
  emergencyCoverageMonths: decimal('emergency_coverage_months').notNull(),
  dataJson: jsonb('data_json').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('financial_snapshots_user_date_unique').on(table.userId, table.snapshotDate)]);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  debts: many(debts),
  categoryBudgets: many(categoryBudgets),
  payrolls: many(payrolls),
  financialContexts: many(financialContexts),
  goals: many(goals),
  subscriptions: many(subscriptions),
  notificationDevices: many(notificationDevices),
  pushSubscriptions: many(pushSubscriptions),
  notificationPreferences: one(notificationPreferences),
  notificationDeliveries: many(notificationDeliveries),
}));

export const financialContextsRelations = relations(financialContexts, ({ one, many }) => ({
  user: one(users, {
    fields: [financialContexts.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  split: one(splits, {
    fields: [transactions.id],
    references: [splits.transactionId],
  }),
  payroll: one(payrolls, {
    fields: [transactions.payrollId],
    references: [payrolls.id],
  }),
  context: one(financialContexts, {
    fields: [transactions.contextId],
    references: [financialContexts.id],
  }),
}));

export const payrollsRelations = relations(payrolls, ({ one, many }) => ({
  user: one(users, {
    fields: [payrolls.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const notificationDevicesRelations = relations(notificationDevices, ({ one }) => ({
  user: one(users, {
    fields: [notificationDevices.userId],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  user: one(users, {
    fields: [notificationDeliveries.userId],
    references: [users.id],
  }),
}));

export const debtsRelations = relations(debts, ({ one }) => ({
  user: one(users, {
    fields: [debts.userId],
    references: [users.id],
  }),
}));

export const splitsRelations = relations(splits, ({ one }) => ({
  transaction: one(transactions, {
    fields: [splits.transactionId],
    references: [transactions.id],
  }),
  linkedContact: one(debts, {
    fields: [splits.linkedContactId],
    references: [debts.id],
  }),
}));

export const categoryBudgetsRelations = relations(categoryBudgets, ({ one }) => ({
  user: one(users, {
    fields: [categoryBudgets.userId],
    references: [users.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  goals: many(goals),
  subscriptions: many(subscriptions),
  transactions: many(transactions),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [goals.walletId],
    references: [wallets.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [subscriptions.walletId],
    references: [wallets.id],
  }),
}));


