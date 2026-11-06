import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', ['Income', 'Expense', 'Transfer', 'Debt Repayment']);
export const walletTypeEnum = pgEnum('wallet_type', ['Bank', 'Cash', 'Savings', 'Investment']);

export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(), // e.g., 'Main Bank', 'Savings', 'Cash', 'Binance', 'IBKR'
  type: walletTypeEnum('type').notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  initialBalance: decimal('initial_balance').default('0').notNull(),
  currentBalance: decimal('current_balance').default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('wallets_user_name_unique').on(table.userId, table.name),
]);

export const walletEnum = pgEnum('wallet_type', ['Bank', 'Cash', 'Savings', 'Investment']);
export const accountTypeEnum = pgEnum('account_type', ['Bank', 'Cash', 'Savings', 'Credit']);
export const debtTypeEnum = pgEnum('debt_type', ['Receivable', 'Payable']);
export const debtStatusEnum = pgEnum('debt_status', ['Pending', 'Cleared']);
export const financialContextStatusEnum = pgEnum('financial_context_status', ['Planned', 'Active', 'Completed']);
export const financialContextTypeEnum = pgEnum('financial_context_type', ['Trip', 'Work / Mission', 'Project', 'Life Event', 'Other']);

export const stockPositions = pgTable('stock_positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  ticker: text('ticker').notNull(),
  companyName: text('company_name').notNull(),
  market: text('market').default('US').notNull(), // 'US' | 'BVC' | 'ETF' | 'GLOBAL'
  sector: text('sector').default('Technology').notNull(),
  instrumentType: text('instrument_type').default('Common Stock').notNull(),
  rawHeldTicker: text('raw_held_ticker'),
  underlyingTicker: text('underlying_ticker'),
  exchange: text('exchange').default('NYSE / NASDAQ'),
  country: text('country').default('United States'),
  shares: decimal('shares').default('0').notNull(),
  avgCostPerShare: decimal('avg_cost_per_share').default('0').notNull(),
  currentPrice: decimal('current_price').default('0').notNull(),
  currency: text('currency').default('USD').notNull(), // 'USD' | 'MAD' | 'EUR'
  annualDividendPerShare: decimal('annual_dividend_per_share').default('0').notNull(),
  targetWeightPercent: decimal('target_weight_percent').default('0').notNull(),
  targetPrice: decimal('target_price'),
  alertAbove: decimal('alert_above'),
  alertBelow: decimal('alert_below'),
  convictionThesis: text('conviction_thesis'),
  isWatchlistOnly: boolean('is_watchlist_only').default(false).notNull(),
  dataSource: text('data_source').default('manual'),
  priceUpdatedAt: timestamp('price_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockOrders = pgTable('stock_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  positionId: uuid('position_id').references(() => stockPositions.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'BUY' | 'SELL' | 'DIVIDEND' | 'SPLIT' | 'FEE_ADJUSTMENT'
  shares: decimal('shares').default('0').notNull(),
  pricePerShare: decimal('price_per_share').default('0').notNull(),
  totalNativeAmount: decimal('total_native_amount').notNull(),
  totalMadAmount: decimal('total_mad_amount').notNull(),
  exchangeRateUsed: decimal('exchange_rate_used').default('1').notNull(),
  feeNative: decimal('fee_native').default('0'),
  taxNative: decimal('tax_native').default('0'),
  splitRatio: decimal('split_ratio').default('1'),
  accountSource: text('account_source').default('manual'),
  realizedPnlMad: decimal('realized_pnl_mad').default('0').notNull(),
  notes: text('notes'),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
});

export const marketDataSymbols = pgTable('market_data_symbols', {
  symbol: text('symbol').primaryKey(),
  rawHeldSymbol: text('raw_held_symbol'),
  underlyingSymbol: text('underlying_symbol'),
  displayName: text('display_name').notNull(),
  instrumentType: text('instrument_type').default('Common Stock').notNull(),
  exchange: text('exchange').default('NASDAQ').notNull(),
  micCode: text('mic_code'),
  country: text('country').default('United States').notNull(),
  sector: text('sector').default('Technology & Cloud').notNull(),
  industry: text('industry'),
  currency: text('currency').default('USD').notNull(),
  provider: text('provider').default('cached_eod').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const marketDataDailyBars = pgTable(
  'market_data_daily_bars',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    symbol: text('symbol').notNull(),
    barDate: text('bar_date').notNull(), // YYYY-MM-DD
    open: decimal('open').notNull(),
    high: decimal('high').notNull(),
    low: decimal('low').notNull(),
    close: decimal('close').notNull(),
    volume: decimal('volume').default('0').notNull(),
    currency: text('currency').default('USD').notNull(),
    provider: text('provider').default('cached_eod').notNull(),
    isAdjusted: boolean('is_adjusted').default(true).notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('market_data_daily_bars_symbol_date_unique').on(table.symbol, table.barDate),
  ]
);

export const marketDataUsage = pgTable('market_data_usage', {
  id: uuid('id').defaultRandom().primaryKey(),
  utcDate: text('utc_date').notNull(), // YYYY-MM-DD
  utcMinute: text('utc_minute').notNull(), // YYYY-MM-DDTHH:mm
  provider: text('provider').default('twelve_data').notNull(),
  endpoint: text('endpoint').notNull(),
  creditWeight: integer('credit_weight').default(1).notNull(),
  symbolsCount: integer('symbols_count').default(1).notNull(),
  creditsReserved: integer('credits_reserved').default(1).notNull(),
  creditsUsedHeader: integer('credits_used_header'),
  creditsLeftHeader: integer('credits_left_header'),
  status: text('status').default('reserved').notNull(),
  requestId: text('request_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const portfolioDailySnapshots = pgTable(
  'portfolio_daily_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    snapshotDate: text('snapshot_date').notNull(), // YYYY-MM-DD
    baseCurrency: text('base_currency').default('MAD').notNull(),
    totalMarketValueMad: decimal('total_market_value_mad').default('0').notNull(),
    investmentCashMad: decimal('investment_cash_mad').default('0').notNull(),
    netContributionsMad: decimal('net_contributions_mad').default('0').notNull(),
    costBasisMad: decimal('cost_basis_mad').default('0').notNull(),
    unrealizedPnlMad: decimal('unrealized_pnl_mad').default('0').notNull(),
    realizedPnlMad: decimal('realized_pnl_mad').default('0').notNull(),
    dividendsReceivedMad: decimal('dividends_received_mad').default('0').notNull(),
    usdToMadRate: decimal('usd_to_mad_rate').default('9.95').notNull(),
    isEstimated: boolean('is_estimated').default(false).notNull(),
    positionsJson: text('positions_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('portfolio_daily_snapshots_user_date_unique').on(table.userId, table.snapshotDate),
  ]
);

export const investmentDividendEvents = pgTable('investment_dividend_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  positionId: uuid('position_id').references(() => stockPositions.id, { onDelete: 'set null' }),
  ticker: text('ticker').notNull(),
  companyName: text('company_name').notNull(),
  declarationDate: text('declaration_date'),
  exDividendDate: text('ex_dividend_date'),
  recordDate: text('record_date'),
  paymentDate: text('payment_date').notNull(),
  dividendPerShare: decimal('dividend_per_share').default('0').notNull(),
  eligibleShares: decimal('eligible_shares').default('0').notNull(),
  currency: text('currency').default('USD').notNull(),
  grossAmount: decimal('gross_amount').default('0').notNull(),
  withholdingTax: decimal('withholding_tax').default('0').notNull(),
  feeAmount: decimal('fee_amount').default('0').notNull(),
  netAmount: decimal('net_amount').default('0').notNull(),
  netAmountMad: decimal('net_amount_mad').default('0').notNull(),
  fxRateUsed: decimal('fx_rate_used').default('9.95').notNull(),
  status: text('status').default('confirmed').notNull(), // 'paid' | 'confirmed' | 'estimated' | 'manual'
  source: text('source').default('manual').notNull(),
  notes: text('notes'),
  verifiedAt: timestamp('verified_at').defaultNow().notNull(),
});

export const investmentSettings = pgTable('investment_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  reportingCurrency: text('reporting_currency').default('MAD').notNull(),
  selectedBenchmarks: text('selected_benchmarks').default('["SPY","QQQ","MASI"]').notNull(),
  riskFreeRatePercent: decimal('risk_free_rate_percent').default('3.5').notNull(),
  manualUsdMadRate: decimal('manual_usd_mad_rate'),
  twelveDataDisplayApproved: boolean('twelve_data_display_approved').default(false).notNull(),
  targetAllocationsJson: text('target_allocations_json'),
  goalsJson: text('goals_json'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or unique user identifier
  username: text('username'),
  displayName: text('display_name'),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').default('member').notNull(), // 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  status: text('status').default('active').notNull(), // 'active' | 'suspended' | 'pending' | 'legacy_hidden'
  workspaceMode: text('workspace_mode').default('isolated').notNull(), // 'shared' | 'isolated'
  permissions: text('permissions'), // JSON string of UserPermissions
  avatarColor: text('avatar_color').default('indigo'),
  notes: text('notes'),
  lastLoginAt: timestamp('last_login_at'),
  createdBy: uuid('created_by'),
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

export const userAuditLogs = pgTable('user_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: text('actor_name').notNull(),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  targetUserName: text('target_user_name').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  stockPositions: many(stockPositions),
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

export const stockPositionsRelations = relations(stockPositions, ({ one, many }) => ({
  user: one(users, {
    fields: [stockPositions.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [stockPositions.walletId],
    references: [wallets.id],
  }),
  orders: many(stockOrders),
}));

export const stockOrdersRelations = relations(stockOrders, ({ one }) => ({
  user: one(users, {
    fields: [stockOrders.userId],
    references: [users.id],
  }),
  position: one(stockPositions, {
    fields: [stockOrders.positionId],
    references: [stockPositions.id],
  }),
  wallet: one(wallets, {
    fields: [stockOrders.walletId],
    references: [wallets.id],
  }),
  linkedTransaction: one(transactions, {
    fields: [stockOrders.linkedTransactionId],
    references: [transactions.id],
  }),
}));



