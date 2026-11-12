import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', ['Income', 'Expense', 'Transfer', 'Debt Repayment']);
export const walletTypeEnum = pgEnum('wallet_type', ['Bank', 'Cash', 'Savings', 'Investment']);

export const wallets = pgTable('wallets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(), // e.g., 'Main Bank', 'Savings', 'Cash', 'Binance', 'IBKR'
  type: walletTypeEnum('type').notNull(),
  accountSubtype: text('account_subtype').default('Checking').notNull(), // 'Checking' | 'Savings' | 'Cash' | 'Brokerage' | 'CreditCard' | 'Overdraft'
  institutionName: text('institution_name'),
  accountReference: text('account_reference'),
  currency: text('currency').default('MAD').notNull(),
  isMain: boolean('is_main').default(false).notNull(),
  initialBalance: decimal('initial_balance').default('0').notNull(),
  currentBalance: decimal('current_balance').default('0').notNull(),
  creditLimit: decimal('credit_limit').default('0').notNull(),
  liabilityBalance: decimal('liability_balance').default('0').notNull(),
  statementClosingDay: integer('statement_closing_day'),
  paymentDueDay: integer('payment_due_day'),
  minimumPayment: decimal('minimum_payment').default('0').notNull(),
  valuationStatus: text('valuation_status').default('verified').notNull(), // 'verified' | 'manual' | 'synced' | 'stale'
  lastReconciledAt: timestamp('last_reconciled_at'),
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
  baseCurrency: text('base_currency').default('MAD').notNull(),
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
  counterpartyType: text('counterparty_type').default('Person').notNull(), // 'Person' | 'Institution' | 'Merchant'
  type: debtTypeEnum('type').notNull(),
  originalAmount: decimal('original_amount').notNull(),
  remainingBalance: decimal('remaining_balance').notNull(),
  principalBalance: decimal('principal_balance').default('0').notNull(),
  accruedInterest: decimal('accrued_interest').default('0').notNull(),
  feesAmount: decimal('fees_amount').default('0').notNull(),
  interestRateApr: decimal('interest_rate_apr').default('0').notNull(),
  rateType: text('rate_type').default('none').notNull(), // 'none' | 'fixed' | 'variable'
  installmentAmount: decimal('installment_amount'),
  installmentFrequency: text('installment_frequency').default('one_time').notNull(), // 'one_time' | 'monthly' | 'biweekly' | 'weekly'
  currency: text('currency').default('MAD').notNull(),
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
  status: text('status').default('expected').notNull(), // 'expected' | 'confirmed' | 'matched'
  confirmedAmount: decimal('confirmed_amount'),
  confirmedAt: timestamp('confirmed_at'),
  varianceAmount: decimal('variance_amount').default('0').notNull(),
  varianceNotes: text('variance_notes'),
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
  nativeAmount: decimal('native_amount'),
  currency: text('currency').default('MAD').notNull(),
  exchangeRateUsed: decimal('exchange_rate_used').default('1').notNull(),
  fxSource: text('fx_source').default('locked_at_posting').notNull(), // 'locked_at_posting' | 'manual' | 'estimated_backfill'
  idempotencyKey: text('idempotency_key'),
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
  fundingCadence: text('funding_cadence').default('monthly').notNull(), // 'monthly' | 'weekly' | 'biweekly' | 'adhoc'
  plannedContributionAmount: decimal('planned_contribution_amount').default('0').notNull(),
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
    rolloverEnabled: boolean('rollover_enabled').default(false).notNull(),
    rolloverAmount: decimal('rollover_amount').default('0').notNull(),
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

// ─── Core Audit Extensions (Items A through P) ───────────────────────────────

/** A. Balanced Double-Entry Accounting Journal Entries */
export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  entryType: text('entry_type').default('standard').notNull(), // 'standard' | 'transfer' | 'credit_purchase' | 'credit_settlement' | 'investment' | 'reversal' | 'correction' | 'opening_backfill'
  status: text('status').default('posted').notNull(), // 'posted' | 'reversed'
  reversalOfEntryId: uuid('reversal_of_entry_id'),
  currency: text('currency').default('MAD').notNull(),
  exchangeRateUsed: decimal('exchange_rate_used').default('1').notNull(),
  isEstimatedBackfill: boolean('is_estimated_backfill').default(false).notNull(),
  idempotencyKey: text('idempotency_key'),
  memo: text('memo'),
  postedAt: timestamp('posted_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** A. Balanced Double-Entry Accounting Journal Lines */
export const journalLines = pgTable('journal_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  accountCode: text('account_code').notNull(), // e.g., '1010-BANK', '2010-CREDIT-CARD', '4010-INCOME', '5010-EXPENSE'
  accountName: text('account_name').notNull(),
  accountClass: text('account_class').notNull(), // 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity' | 'Clearing'
  debitMad: decimal('debit_mad').default('0').notNull(),
  creditMad: decimal('credit_mad').default('0').notNull(),
  nativeAmount: decimal('native_amount').default('0').notNull(),
  nativeCurrency: text('native_currency').default('MAD').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** C. Historical Exchange Rates */
export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  baseCurrency: text('base_currency').notNull(), // e.g. 'USD', 'EUR'
  quoteCurrency: text('quote_currency').default('MAD').notNull(),
  rate: decimal('rate').notNull(),
  source: text('source').default('reference_feed').notNull(), // 'reference_feed' | 'manual' | 'locked_posting'
  effectiveDate: text('effective_date').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** D. Statement Import Batches */
export const statementImportBatches = pgTable('statement_import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'cascade' }).notNull(),
  fileName: text('file_name').notNull(),
  fileFormat: text('file_format').default('CSV').notNull(), // 'CSV' | 'XLSX' | 'TSV'
  statementOpeningBalance: decimal('statement_opening_balance'),
  statementClosingBalance: decimal('statement_closing_balance'),
  reconciledVariance: decimal('reconciled_variance').default('0').notNull(),
  totalRows: integer('total_rows').default(0).notNull(),
  matchedCount: integer('matched_count').default(0).notNull(),
  unmatchedCount: integer('unmatched_count').default(0).notNull(),
  ambiguousCount: integer('ambiguous_count').default(0).notNull(),
  duplicateCount: integer('duplicate_count').default(0).notNull(),
  status: text('status').default('pending_review').notNull(), // 'pending_review' | 'reconciled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** D. Statement Import Rows */
export const statementImportRows = pgTable('statement_import_rows', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: uuid('batch_id').references(() => statementImportBatches.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'cascade' }).notNull(),
  rowDate: text('row_date').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('MAD').notNull(),
  externalReference: text('external_reference'),
  rowHash: text('row_hash').notNull(),
  matchStatus: text('match_status').default('unmatched').notNull(), // 'matched' | 'unmatched' | 'ambiguous' | 'duplicate' | 'confirmed_created' | 'confirmed_linked' | 'ignored'
  matchConfidence: decimal('match_confidence').default('0').notNull(),
  suggestedTransactionId: uuid('suggested_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  candidateTransactionIdsJson: text('candidate_transaction_ids_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** E. Persistent Financial Review Inbox */
export const financialReviewItems = pgTable('financial_review_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sourceType: text('source_type').notNull(), // 'receipt_ocr' | 'statement_row' | 'voice_draft' | 'unmatched_investment' | 'suspected_duplicate' | 'recurring_suggestion'
  status: text('status').default('Needs Review').notNull(), // 'Captured' | 'Needs Review' | 'Confirmed' | 'Linked' | 'Posted' | 'Rejected' | 'Duplicate'
  confidenceScore: decimal('confidence_score').default('0.8').notNull(),
  parsedAmount: decimal('parsed_amount').notNull(),
  parsedCurrency: text('parsed_currency').default('MAD').notNull(),
  parsedDate: text('parsed_date').notNull(),
  parsedDescription: text('parsed_description').notNull(),
  parsedCategory: text('parsed_category'),
  parsedType: text('parsed_type').default('Expense').notNull(),
  walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  rawPayloadJson: text('raw_payload_json'),
  decisionNotes: text('decision_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** F. Reusable Commitment Occurrences */
export const commitmentOccurrences = pgTable('commitment_occurrences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sourceType: text('source_type').notNull(), // 'subscription' | 'debt_installment' | 'payroll' | 'planned_bill'
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  expectedDate: text('expected_date').notNull(), // YYYY-MM-DD
  expectedAmount: decimal('expected_amount').notNull(),
  currency: text('currency').default('MAD').notNull(),
  status: text('status').default('scheduled').notNull(), // 'scheduled' | 'completed' | 'overdue' | 'skipped' | 'partial'
  actualDate: text('actual_date'),
  actualAmount: decimal('actual_amount'),
  varianceAmount: decimal('variance_amount').default('0').notNull(),
  linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** I. Auditable Goal & Sinking-Fund Contribution Events */
export const goalContributionEvents = pgTable('goal_contribution_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }).notNull(),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  sourceWalletId: uuid('source_wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  destinationWalletId: uuid('destination_wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  eventType: text('event_type').default('contribution').notNull(), // 'contribution' | 'withdrawal' | 'reconciliation'
  amount: decimal('amount').notNull(),
  eventDate: text('event_date').notNull(), // YYYY-MM-DD
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** J. Saved & Comparable Multi-Event What-If Scenarios */
export const savedScenarios = pgTable('saved_scenarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  baselineSnapshotJson: text('baseline_snapshot_json').notNull(),
  eventsJson: text('events_json').notNull(), // Array of dated scenario events
  assumptionsJson: text('assumptions_json').notNull(),
  projectedSummaryJson: text('projected_summary_json').notNull(),
  isApprovedPlan: boolean('is_approved_plan').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** K. User-Configurable Financial Rules */
export const financialRules = pgTable('financial_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  triggerType: text('trigger_type').notNull(), // 'salary_confirmed' | 'transaction_posted' | 'balance_threshold_crossed' | 'commitment_approaching' | 'budget_pace_crossed'
  conditionsJson: text('conditions_json').notNull(), // { walletId?, category?, minAmount?, maxAmount?, threshold? }
  actionType: text('action_type').notNull(), // 'send_notification' | 'create_review_draft' | 'suggest_category' | 'prepare_allocation'
  actionPayloadJson: text('action_payload_json').notNull(),
  approvalPolicy: text('approval_policy').default('notify_only').notNull(), // 'notify_only' | 'create_draft' | 'request_approval'
  version: integer('version').default(1).notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** K. Financial Rule Execution Audit Logs */
export const financialRuleLogs = pgTable('financial_rule_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  ruleId: uuid('rule_id').references(() => financialRules.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  ruleVersion: integer('rule_version').default(1).notNull(),
  triggerEventSummary: text('trigger_event_summary').notNull(),
  proposedResultSummary: text('proposed_result_summary').notNull(),
  outcomeStatus: text('outcome_status').default('executed').notNull(), // 'notified' | 'draft_created' | 'awaiting_approval' | 'approved' | 'rate_limited'
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** L. External Assets & Liabilities for Unified Net Worth */
export const externalWealthItems = pgTable('external_wealth_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  itemClass: text('item_class').notNull(), // 'Property' | 'Vehicle' | 'PreciousMetals' | 'PrivateInvestment' | 'PersonalLoan' | 'CreditFacility' | 'OtherAsset' | 'OtherLiability'
  isLiability: boolean('is_liability').default(false).notNull(),
  isLiquid: boolean('is_liquid').default(false).notNull(),
  estimatedValue: decimal('estimated_value').notNull(),
  currency: text('currency').default('MAD').notNull(),
  valuationDate: text('valuation_date').notNull(), // YYYY-MM-DD
  valuationSource: text('valuation_source').default('manual_estimate').notNull(), // 'manual_estimate' | 'appraisal' | 'statement_verified'
  confidenceLevel: text('confidence_level').default('medium').notNull(), // 'high' | 'medium' | 'low'
  isExternallyVerified: boolean('is_externally_verified').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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



